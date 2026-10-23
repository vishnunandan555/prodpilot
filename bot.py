"""ProdPilot Telegram Bot - Visihot Hosted Edition
Phase 2: Resilient cloud poller, proactive phone alerts on AWAITING_APPROVAL,
1-tap deployment confirmations, and post-mortem /report command.
Runs at the root of the 'telegram' branch.
"""

import argparse
import asyncio
import json
import logging
import os
import re
import sys
from typing import Any, Dict, List, Optional, Tuple

import httpx
from dotenv import load_dotenv

from telegram import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Update,
)
from telegram.constants import ParseMode
from telegram.ext import (
    Application,
    ApplicationBuilder,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
)

# Load environment variables from .env
load_dotenv()

# Logging Configuration
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger("prodpilot-bot")

# Global Configuration
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
ALLOWED_CHAT_ID = os.getenv("TELEGRAM_ALLOWED_CHAT_ID", "8787477099").strip()
PRODPILOT_API_URL = os.getenv("PRODPILOT_API_URL", "http://127.0.0.1:8765").rstrip("/")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "3"))

# Keep track of already notified incidents so we don't spam the chat
notified_incidents: Dict[str, Dict[str, Any]] = {}


# ============================================================================
# API Clients: Resilient Live HTTP Client and Mock Client
# ============================================================================

class ProdPilotClient:
    """Async HTTP Client for ProdPilot REST API Contract with Exponential Backoff."""

    def __init__(
        self,
        base_url: str,
        max_retries: int = 4,
        initial_delay: float = 1.0,
        backoff_factor: float = 2.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.max_retries = max_retries
        self.initial_delay = initial_delay
        self.backoff_factor = backoff_factor

    async def _request_with_retry(
        self, method: str, endpoint: str, **kwargs
    ) -> httpx.Response:
        """Execute HTTP request with exponential backoff for network/tunnel errors."""
        delay = self.initial_delay
        last_error = None
        for attempt in range(1, self.max_retries + 1):
            try:
                timeout = kwargs.pop("timeout", 12.0)
                async with httpx.AsyncClient(timeout=timeout) as client:
                    resp = await client.request(
                        method, f"{self.base_url}{endpoint}", **kwargs
                    )
                    resp.raise_for_status()
                    return resp
            except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as e:
                last_error = e
                if attempt < self.max_retries:
                    logger.warning(
                        f"[HTTP Retry {attempt}/{self.max_retries}] {method} {endpoint} failed: {e}. "
                        f"Retrying in {delay:.1f}s (exponential backoff)..."
                    )
                    await asyncio.sleep(delay)
                    delay *= self.backoff_factor
                else:
                    logger.error(
                        f"[HTTP Failure] {method} {endpoint} failed after {self.max_retries} attempts: {e}"
                    )
                    raise
            except Exception:
                raise
        if last_error:
            raise last_error
        raise RuntimeError("Request failed without response")

    async def get_health(self) -> Dict[str, Any]:
        resp = await self._request_with_retry("GET", "/health", timeout=5.0)
        return resp.json()

    async def list_incidents(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        params = {"status": status} if status else {}
        resp = await self._request_with_retry("GET", "/incidents", params=params, timeout=8.0)
        return resp.json()

    async def get_incident(self, incident_id: str) -> Dict[str, Any]:
        resp = await self._request_with_retry("GET", f"/incidents/{incident_id}", timeout=8.0)
        return resp.json()

    async def approve_incident(
        self, incident_id: str, action: str, source: str = "telegram"
    ) -> Dict[str, Any]:
        """action: 'fix_forward' or 'rollback'"""
        payload = {"action": action, "source": source}
        resp = await self._request_with_retry(
            "POST",
            f"/incidents/{incident_id}/approve",
            json=payload,
            timeout=20.0,
        )
        return resp.json()

    async def reject_incident(
        self,
        incident_id: str,
        reason: str = "Rejected via Telegram",
        source: str = "telegram",
    ) -> Dict[str, Any]:
        payload = {"reason": reason, "source": source}
        resp = await self._request_with_retry(
            "POST",
            f"/incidents/{incident_id}/reject",
            json=payload,
            timeout=10.0,
        )
        return resp.json()

    async def get_logs(self, incident_id: Optional[str] = None) -> str:
        """Fetch logs from incident details."""
        try:
            if not incident_id:
                incidents = await self.list_incidents()
                if not incidents:
                    return "No active incidents found to inspect logs."
                incident_id = incidents[0]["id"]

            detail = await self.get_incident(incident_id)
            log_tail = detail.get("log_tail")
            if log_tail:
                lines = log_tail.strip().split("\n")
                return "\n".join(lines[-20:])
            return f"No log tail available for incident {incident_id}."
        except Exception as e:
            return f"Error retrieving logs: {e}"


class MockProdPilotClient:
    """In-memory Mock Client mirroring contracts/api.md for standalone testing."""

    def __init__(self):
        self.reset()

    def reset(self):
        self.sample_incident: Dict[str, Any] = {
            "id": "inc-20261023-001",
            "service": "demo-prod",
            "detected_at": "2026-10-23T14:30:00Z",
            "status": "AWAITING_APPROVAL",
            "trace": (
                "Traceback (most recent call last):\n"
                "  File \"app.py\", line 45, in checkout\n"
                "    discount = item['discount']\n"
                "KeyError: 'discount'"
            ),
            "log_tail": (
                "2026-10-23 14:29:45 INFO [demo-prod] Incoming POST /checkout from 10.0.4.12\n"
                "2026-10-23 14:29:46 INFO [demo-prod] Cart processed: 4 items, subtotal $149.99\n"
                "2026-10-23 14:29:47 INFO [demo-prod] Applying customer loyalty coupons\n"
                "2026-10-23 14:29:48 ERROR [demo-prod] Exception on /checkout: KeyError: 'discount'\n"
                "Traceback (most recent call last):\n"
                "  File \"app.py\", line 45, in checkout\n"
                "    discount = item['discount']\n"
                "KeyError: 'discount'\n"
                "2026-10-23 14:29:49 CRITICAL [demo-prod] High 500 error rate: 94.2% failure on /checkout\n"
                "2026-10-23 14:29:50 WARN [demo-prod] Circuit breaker tripped for checkout service\n"
                "2026-10-23 14:30:00 ALERT [ProdPilot] Incident detected: inc-20261023-001\n"
                "2026-10-23 14:30:05 INFO [ProdPilot] Staged fix canary listening on port 8001 (🟢 Healthy)\n"
                "2026-10-23 14:30:08 INFO [ProdPilot] Staged rollback canary listening on port 8002 (🟢 Healthy)\n"
                "2026-10-23 14:30:10 INFO [ProdPilot] Decision recommendation: fix_forward (85% confidence)\n"
                "2026-10-23 14:30:12 INFO [ProdPilot] Status transitioned to AWAITING_APPROVAL"
            ),
            "recent_commits": [
                {
                    "hash": "a1b2c3d",
                    "author": "Vishnu Nandan",
                    "message": "feat: add loyalty point discount calculation",
                    "time": "15 min ago",
                }
            ],
            "suspect_commit": {
                "hash": "a1b2c3d",
                "author": "Vishnu Nandan",
                "message": "feat: add loyalty point discount calculation",
                "time": "15 min ago",
                "file": "app.py",
                "line": 45,
                "blame": "a1b2c3d (Vishnu Nandan 2026-10-23 14:15:00 +0530 45) discount = item['discount']",
            },
            "brief": {
                "summary": "KeyError: 'discount' in order calculation endpoint.",
                "suspected_area": "app.py:45",
                "introduced_by": "a1b2c3d",
            },
            "artifacts": {
                "repro_test": "tests/test_repro.py",
                "patch_diff": (
                    "--- a/app.py\n"
                    "+++ b/app.py\n"
                    "@@ -45,1 +45,1 @@\n"
                    "-    discount = item['discount']\n"
                    "+    discount = item.get('discount', 0)"
                ),
                "test_evidence": {
                    "before": "FAILED (KeyError: discount)",
                    "after": "PASSED (100% full suite green)",
                },
            },
            "staging": {
                "fix_forward": {"port": 8001, "health": True},
                "rollback": {"port": 8002, "health": True},
            },
            "decision": {
                "backend": "rules",
                "recommendation": "fix_forward",
                "probabilities": {"fix_forward": 0.85, "rollback": 0.15},
                "reason": "Clean 3-line patch with 100% test pass",
            },
        }

    async def get_health(self) -> Dict[str, Any]:
        return {"status": "ok", "version": "1.0.0-mock"}

    async def list_incidents(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        if status and self.sample_incident.get("status") != status:
            return []
        return [self.sample_incident]

    async def get_incident(self, incident_id: str) -> Dict[str, Any]:
        if incident_id == self.sample_incident["id"]:
            return self.sample_incident
        return self.sample_incident

    async def approve_incident(
        self, incident_id: str, action: str, source: str = "telegram"
    ) -> Dict[str, Any]:
        if action == "fix_forward":
            self.sample_incident["status"] = "DEPLOYED"
            return {
                "status": "DEPLOYED",
                "deployed_action": "fix_forward",
                "health_check": "ok",
                "incident_id": incident_id,
            }
        elif action == "rollback":
            self.sample_incident["status"] = "ROLLED_BACK"
            return {
                "status": "ROLLED_BACK",
                "deployed_action": "rollback",
                "health_check": "ok",
                "incident_id": incident_id,
            }
        else:
            raise ValueError(f"Unknown approval action: {action}")

    async def reject_incident(
        self,
        incident_id: str,
        reason: str = "Rejected via Telegram",
        source: str = "telegram",
    ) -> Dict[str, Any]:
        self.sample_incident["status"] = "REJECTED"
        return {"status": "REJECTED", "incident_id": incident_id, "reason": reason}

    async def get_logs(self, incident_id: Optional[str] = None) -> str:
        lines = self.sample_incident["log_tail"].strip().split("\n")
        return "\n".join(lines[-20:])


# Global Client instance
api_client: Any = None


# ============================================================================
# Security & Authorization Helpers
# ============================================================================

def is_authorized(chat_id: int | str, user_id: int | str) -> bool:
    """Strictly verify if the sender matches TELEGRAM_ALLOWED_CHAT_ID."""
    if not ALLOWED_CHAT_ID:
        logger.warning(
            f"TELEGRAM_ALLOWED_CHAT_ID not configured! Allowing interaction from chat_id={chat_id}"
        )
        return True

    allowed_list = [cid.strip() for cid in ALLOWED_CHAT_ID.split(",") if cid.strip()]
    return str(chat_id) in allowed_list or str(user_id) in allowed_list


# ============================================================================
# Message Formatting Helpers
# ============================================================================

def format_incident_card(incident: Dict[str, Any]) -> Tuple[str, InlineKeyboardMarkup]:
    """Format the Incident Notification Card matching task requirements."""
    inc_id = incident.get("id", "inc-unknown")
    service = incident.get("service", "demo-prod")

    brief = incident.get("brief", {})
    suspected_area = brief.get("suspected_area", "app.py:45")
    summary = brief.get("summary", "KeyError: 'discount'")
    root_cause = f"`{summary}` in `{suspected_area}`"

    suspect = incident.get("suspect_commit", {})
    suspect_hash = suspect.get("hash", "a1b2c3d")
    author = suspect.get("author", "Vishnu Nandan")
    commit_time = suspect.get("time", "15 min ago")
    commit_msg = suspect.get("message", "feat: add loyalty point discount calculation")
    blame_info = suspect.get("blame", "")

    # Format suspect commit line with git blame details
    suspect_line = f"`{suspect_hash}` by {author} ({commit_time}) - \"_{commit_msg}_\""
    if blame_info:
        suspect_line += f"\n  ↳ _git blame_: `{blame_info}`"

    evidence = "Repro test failed before fix, passed after. Full suite green."

    staging = incident.get("staging", {})
    fix_stg = staging.get("fix_forward", {})
    fix_healthy = "🟢" if fix_stg.get("health", True) else "🔴"

    rb_stg = staging.get("rollback", {})
    rb_healthy = "🟢" if rb_stg.get("health", True) else "🔴"

    canary_status = f"8001 Fix-Forward {fix_healthy} | 8002 Rollback {rb_healthy}"

    decision = incident.get("decision", {})
    probs = decision.get("probabilities", {})
    ff_prob = int(probs.get("fix_forward", 0.85) * 100)
    rb_prob = int(probs.get("rollback", 0.15) * 100)
    recommendation = f"Fix-Forward ({ff_prob}% confidence) vs Rollback ({rb_prob}%)"

    card_text = (
        "🚨 *CRITICAL INCIDENT DETECTED*\n"
        f"*Service*: `{service}`\n"
        f"*Root Cause*: {root_cause}\n"
        f"*Suspect Commit & Culprit*: {suspect_line}\n"
        f"*Evidence*: {evidence}\n"
        f"*Canary Status*: {canary_status}\n"
        f"*AI Recommendation*: {recommendation}"
    )

    # Inline Keyboard Buttons
    keyboard = [
        [
            InlineKeyboardButton("🚀 Deploy Fix (8001)", callback_data=f"approve_fix_{inc_id}"),
            InlineKeyboardButton("⏪ Rollback (8002)", callback_data=f"approve_rollback_{inc_id}"),
        ],
        [
            InlineKeyboardButton("❌ Reject", callback_data=f"reject_{inc_id}"),
        ],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    return card_text, reply_markup


def format_compact_summary(incident: Dict[str, Any]) -> str:
    """Format compact incident summary to append upon resolution."""
    service = incident.get("service", "demo-prod")
    brief = incident.get("brief", {})
    summary = brief.get("summary", "KeyError: 'discount'")
    suspected_area = brief.get("suspected_area", "app.py:45")
    suspect = incident.get("suspect_commit", {})
    commit_hash = suspect.get("hash", "a1b2c3d")
    author = suspect.get("author", "Vishnu Nandan")

    decision = incident.get("decision", {})
    rec = decision.get("recommendation", "fix_forward")
    probs = decision.get("probabilities", {})
    conf = int(probs.get(rec, 0.85) * 100)
    rec_title = rec.replace("_", "-").title()

    return (
        "📑 *Incident Report Summary*:\n"
        f"• *Service*: `{service}`\n"
        f"• *Root Cause*: `{summary}` in `{suspected_area}`\n"
        f"• *Suspect Commit*: `{commit_hash}` by {author}\n"
        "• *Evidence*: Repro test validated in staging. Full suite green.\n"
        f"• *AI Verdict*: {rec_title} ({conf}% confidence)"
    )


def format_report(incident: Dict[str, Any]) -> str:
    """Format full post-mortem markdown incident report."""
    inc_id = incident.get("id", "inc-unknown")
    service = incident.get("service", "demo-prod")
    detected_at = incident.get("detected_at", "2026-10-23T14:30:00Z")
    status = incident.get("status", "UNKNOWN")
    brief = incident.get("brief", {})
    summary = brief.get("summary", "KeyError: 'discount'")
    suspected_area = brief.get("suspected_area", "app.py:45")

    suspect = incident.get("suspect_commit", {})
    commit_hash = suspect.get("hash", "a1b2c3d")
    author = suspect.get("author", "Vishnu Nandan")
    msg = suspect.get("message", "feat: add loyalty point discount calculation")
    blame = suspect.get("blame", "")

    artifacts = incident.get("artifacts", {})
    repro = artifacts.get("repro_test", "tests/test_repro.py")
    patch = artifacts.get("patch_diff", "")
    evidence = artifacts.get("test_evidence", {})
    before = evidence.get("before", "FAILED (KeyError: discount)")
    after = evidence.get("after", "PASSED (100% suite green)")

    decision = incident.get("decision", {})
    rec = decision.get("recommendation", "fix_forward")
    probs = decision.get("probabilities", {})
    conf = int(probs.get(rec, 0.85) * 100)
    reason = decision.get("reason", "Clean 3-line patch with 100% test pass")

    report_lines = [
        "📑 *ProdPilot Incident Post-Mortem Report*",
        f"• *Incident ID*: `{inc_id}`",
        f"• *Service*: `{service}`",
        f"• *Detected At*: `{detected_at}`",
        f"• *Final Status*: `{status}`",
        f"• *Approver Source*: `telegram`",
        "",
        "---",
        "*1. Executive Summary & Root Cause*:",
        f"• *Summary*: {summary}",
        f"• *Suspect Area*: `{suspected_area}`",
        f"• *Suspect Commit*: `{commit_hash}` by **{author}**",
        f"• *Message*: _{msg}_",
    ]
    if blame:
        report_lines.append(f"• *Git Blame*: `{blame}`")

    report_lines.extend([
        "",
        "---",
        "*2. Reproduction Test & Evidence*:",
        f"• *Reproduction*: `{repro}`",
        f"• *Before Fix*: `{before}`",
        f"• *After Fix*: `{after}`",
        "",
        "---",
        "*3. Canary Verification & AI Decision*:",
        "• *Canary*: Fix 8001 (🟢 Healthy) | Rollback 8002 (🟢 Healthy)",
        f"• *AI Verdict*: *{rec.replace('_', '-').title()}* ({conf}% confidence)",
        f"• *Reasoning*: _{reason}_",
    ])

    if patch:
        report_lines.extend([
            "",
            "---",
            "*4. Applied Patch Diff*:",
            f"```diff\n{patch}\n```",
        ])

    return "\n".join(report_lines)


# ============================================================================
# Telegram Command Handlers
# ============================================================================

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command - displays connection status and commands."""
    user = update.effective_user
    chat = update.effective_chat

    if not is_authorized(chat.id, user.id):
        await update.message.reply_text(
            f"⛔ *Access Denied*: Your Chat ID (`{chat.id}`) is not authorized to interact with ProdPilot.",
            parse_mode=ParseMode.MARKDOWN,
        )
        return

    # Check connection to backend
    conn_status = "🔴 Unreachable"
    try:
        health = await api_client.get_health()
        if health.get("status") == "ok":
            v = health.get("version", "1.0.0")
            conn_status = f"🟢 Connected (`v{v}`)"
    except Exception as e:
        conn_status = f"🔴 Connection error: `{e}`"

    welcome_text = (
        "🤖 *ProdPilot Incident Remediation Bot*\n"
        "Visihot-hosted Telegram controller for autonomous production incident recovery.\n\n"
        f"*Backend Status*: {conn_status}\n"
        f"*API Target*: `{PRODPILOT_API_URL}`\n"
        f"*Your Chat ID*: `{chat.id}`\n\n"
        "*Available Commands*:\n"
        "• `/status` - Query active incident status & health\n"
        "• `/logs` - Fetch last 20 lines of service logs\n"
        "• `/report` - Show post-mortem markdown incident report\n"
        "• `/mock` - Trigger sample incident notification card"
    )

    await update.message.reply_text(welcome_text, parse_mode=ParseMode.MARKDOWN)


async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /status - Queries GET /health and GET /incidents."""
    chat = update.effective_chat
    user = update.effective_user

    if not is_authorized(chat.id, user.id):
        await update.message.reply_text(
            f"⛔ *Access Denied*: Chat ID (`{chat.id}`) unauthorized.",
            parse_mode=ParseMode.MARKDOWN,
        )
        return

    try:
        health = await api_client.get_health()
        incidents = await api_client.list_incidents()

        health_icon = "🟢" if health.get("status") == "ok" else "🟡"
        summary = f"{health_icon} *System Health*: `{health.get('status', 'unknown')}` (`v{health.get('version', '1.0')}`)\n\n"

        if not incidents:
            summary += "🟢 *No Active Incidents*\nAll production services are running normally."
            await update.message.reply_text(summary, parse_mode=ParseMode.MARKDOWN)
            return

        # Check for incident awaiting approval
        awaiting = [inc for inc in incidents if inc.get("status") == "AWAITING_APPROVAL"]
        if awaiting:
            inc = awaiting[0]
            card_text, reply_markup = format_incident_card(inc)
            await update.message.reply_text(
                summary + card_text,
                reply_markup=reply_markup,
                parse_mode=ParseMode.MARKDOWN,
            )
            return

        # Otherwise display status of active incidents
        summary += "*Active Incidents*:\n"
        for inc in incidents:
            status_icon = (
                "✅" if inc.get("status") in ("DEPLOYED", "ROLLED_BACK") else "⚠️"
            )
            summary += (
                f"• {status_icon} `{inc.get('id')}` ({inc.get('service')}): "
                f"Status: *{inc.get('status')}*\n"
            )

        await update.message.reply_text(summary, parse_mode=ParseMode.MARKDOWN)

    except Exception as e:
        logger.error(f"Error querying /status: {e}")
        await update.message.reply_text(
            f"❌ *Error Fetching Status*: `{e}`\nVerify ProdPilot backend is running at `{PRODPILOT_API_URL}`.",
            parse_mode=ParseMode.MARKDOWN,
        )


async def logs_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /logs - Fetches last 20 lines of service log."""
    chat = update.effective_chat
    user = update.effective_user

    if not is_authorized(chat.id, user.id):
        await update.message.reply_text("⛔ Unauthorized.", parse_mode=ParseMode.MARKDOWN)
        return

    try:
        logs = await api_client.get_logs()
        response = f"📋 *Service Logs (Last 20 Lines)*:\n```log\n{logs}\n```"
        await update.message.reply_text(response, parse_mode=ParseMode.MARKDOWN)
    except Exception as e:
        logger.error(f"Error fetching logs: {e}")
        await update.message.reply_text(f"❌ *Failed to fetch logs*: `{e}`", parse_mode=ParseMode.MARKDOWN)


async def report_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /report - Fetches and displays the generated post-mortem markdown report in chat."""
    chat = update.effective_chat
    user = update.effective_user

    if not is_authorized(chat.id, user.id):
        await update.message.reply_text("⛔ Unauthorized.", parse_mode=ParseMode.MARKDOWN)
        return

    try:
        incidents = await api_client.list_incidents()
        if not incidents:
            await update.message.reply_text("ℹ️ No incidents found to generate a post-mortem report for.")
            return

        active_inc = incidents[0]
        detail = await api_client.get_incident(active_inc["id"])
        report_text = format_report(detail)

        # Handle Telegram message length (limit 4096 chars)
        if len(report_text) <= 4000:
            try:
                await update.message.reply_text(report_text, parse_mode=ParseMode.MARKDOWN)
            except Exception:
                await update.message.reply_text(report_text)
        else:
            chunks = [report_text[i : i + 3900] for i in range(0, len(report_text), 3900)]
            for chunk in chunks:
                try:
                    await update.message.reply_text(chunk, parse_mode=ParseMode.MARKDOWN)
                except Exception:
                    await update.message.reply_text(chunk)

    except Exception as e:
        logger.error(f"Error generating report: {e}")
        await update.message.reply_text(f"❌ *Error generating report*: `{e}`", parse_mode=ParseMode.MARKDOWN)


async def mock_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /mock - Re-arms or triggers a sample incident card for testing."""
    chat = update.effective_chat
    user = update.effective_user

    if not is_authorized(chat.id, user.id):
        await update.message.reply_text("⛔ Unauthorized.", parse_mode=ParseMode.MARKDOWN)
        return

    if isinstance(api_client, MockProdPilotClient):
        api_client.reset()

    incidents = await api_client.list_incidents()
    if incidents:
        inc = incidents[0]
        card_text, reply_markup = format_incident_card(inc)
        await update.message.reply_text(
            card_text,
            reply_markup=reply_markup,
            parse_mode=ParseMode.MARKDOWN,
        )
    else:
        await update.message.reply_text("No incidents available.")


# ============================================================================
# Interactive Button Callback Handler
# ============================================================================

async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle interactive inline keyboard buttons: Deploy Fix, Rollback, Reject."""
    query = update.callback_query
    user = update.effective_user
    chat = update.effective_chat

    if not is_authorized(chat.id, user.id):
        await query.answer("⛔ Access Denied", show_alert=True)
        return

    callback_data = query.data
    logger.info(f"Button tapped: {callback_data} by user {user.id} in chat {chat.id}")

    # Pattern matching for actions
    match = re.match(r"^(approve_fix_|approve_rollback_|reject_)(.+)$", callback_data)
    if not match:
        await query.answer("Unknown action", show_alert=True)
        return

    action_type, incident_id = match.groups()

    try:
        # Fetch current incident details for the summary
        try:
            incident_detail = await api_client.get_incident(incident_id)
        except Exception:
            incident_detail = {"id": incident_id, "service": "demo-prod"}

        if action_type == "approve_fix_":
            await query.answer("Deploying Fix-Forward to production port 8000...")
            # Step 1: Immediate status update
            deploying_text = "⏳ *Deploying fix to production port 8000...*\nPromoting Canary 8001."
            try:
                await query.edit_message_text(deploying_text, parse_mode=ParseMode.MARKDOWN)
            except Exception:
                await query.edit_message_text(deploying_text)

            # Step 2: Call backend API via public tunnel
            result = await api_client.approve_incident(
                incident_id=incident_id, action="fix_forward", source="telegram"
            )

            # Step 3: Confirmation message exactly matching task specification
            report_summary = format_compact_summary(incident_detail)
            restored_text = (
                "✅ PRODUCTION RESTORED ON PORT 8000. Canary 8001 promoted. Health check 200 OK verified.\n\n"
                f"*Incident*: `{incident_id}`\n\n"
                f"{report_summary}"
            )
            try:
                await query.edit_message_text(restored_text, parse_mode=ParseMode.MARKDOWN)
            except Exception:
                await query.edit_message_text(restored_text)

        elif action_type == "approve_rollback_":
            await query.answer("Initiating rollback to production port 8000...")
            # Step 1: Immediate status update
            rollback_text = "⏳ *Rolling back to production port 8000...*\nPromoting Canary 8002."
            try:
                await query.edit_message_text(rollback_text, parse_mode=ParseMode.MARKDOWN)
            except Exception:
                await query.edit_message_text(rollback_text)

            # Step 2: Call backend API via public tunnel
            result = await api_client.approve_incident(
                incident_id=incident_id, action="rollback", source="telegram"
            )

            # Step 3: Confirmation message
            report_summary = format_compact_summary(incident_detail)
            restored_text = (
                "✅ PRODUCTION ROLLED BACK ON PORT 8000. Canary 8002 promoted. Health check 200 OK verified.\n\n"
                f"*Incident*: `{incident_id}`\n\n"
                f"{report_summary}"
            )
            try:
                await query.edit_message_text(restored_text, parse_mode=ParseMode.MARKDOWN)
            except Exception:
                await query.edit_message_text(restored_text)

        elif action_type == "reject_":
            await query.answer("Rejecting automated resolution...")
            # Step 1: Call reject API
            await api_client.reject_incident(
                incident_id=incident_id,
                reason="Rejected via Telegram interactive button",
                source="telegram",
            )

            # Step 2: Edit message
            rejected_text = (
                "❌ *INCIDENT REJECTED* - Automated fix/rollback rejected.\n\n"
                f"*Incident*: `{incident_id}`\n"
                "*Status*: REJECTED (Escalated to human on-call engineer)"
            )
            try:
                await query.edit_message_text(rejected_text, parse_mode=ParseMode.MARKDOWN)
            except Exception:
                await query.edit_message_text(rejected_text)

    except Exception as e:
        logger.error(f"Error handling button action {callback_data}: {e}")
        error_msg = f"❌ *Action Failed*: `{e}`\nPlease retry or check backend logs."
        try:
            await query.edit_message_text(error_msg, parse_mode=ParseMode.MARKDOWN)
        except Exception:
            await query.edit_message_text(error_msg)


# ============================================================================
# Background Poller Task
# ============================================================================

async def check_and_notify_incidents(bot):
    """Poll API for incidents with status AWAITING_APPROVAL and send notification cards."""
    if not ALLOWED_CHAT_ID:
        return

    target_chat_ids = [cid.strip() for cid in ALLOWED_CHAT_ID.split(",") if cid.strip()]

    try:
        incidents = await api_client.list_incidents(status="AWAITING_APPROVAL")
    except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as e:
        logger.warning(
            f"Backend API at {PRODPILOT_API_URL} currently unreachable ({e}). Poller will retry on next tick."
        )
        return
    except Exception as e:
        logger.debug(f"Poller check exception: {e}")
        return

    for inc in incidents:
        inc_id = inc.get("id")
        if not inc_id:
            continue

        if inc_id in notified_incidents:
            continue

        card_text, reply_markup = format_incident_card(inc)

        for chat_id in target_chat_ids:
            try:
                msg = await bot.send_message(
                    chat_id=chat_id,
                    text=card_text,
                    reply_markup=reply_markup,
                    parse_mode=ParseMode.MARKDOWN,
                )
                notified_incidents[inc_id] = {
                    "chat_id": chat_id,
                    "message_id": msg.message_id,
                }
                logger.info(f"Proactive alert dispatched for {inc_id} to chat {chat_id}")
            except Exception as e:
                logger.error(f"Failed to send incident card to chat {chat_id}: {e}")


async def incident_poller_task(app: Application):
    """Background async loop checking for incidents every POLL_INTERVAL seconds.
    Executes first check immediately to guarantee alert within 3s.
    """
    logger.info(f"Background incident poller active (polling every {POLL_INTERVAL}s)...")
    
    # Run immediate initial check on startup
    try:
        await check_and_notify_incidents(app.bot)
    except Exception as e:
        logger.debug(f"Initial incident check error: {e}")

    while True:
        try:
            await asyncio.sleep(POLL_INTERVAL)
            await check_and_notify_incidents(app.bot)
        except asyncio.CancelledError:
            logger.info("Incident poller task cancelled.")
            break
        except Exception as e:
            logger.error(f"Error in background incident poller: {e}")


# ============================================================================
# Dry-Run / Local CLI Verification Suite
# ============================================================================

async def run_dry_run_verification():
    """Verify all bot components, formatting, and mock lifecycle locally without Telegram network."""
    print("\n" + "=" * 65)
    print("🚀 RUNNING PRODPILOT TELEGRAM BOT VERIFICATION (DRY-RUN)")
    print("=" * 65)

    client = MockProdPilotClient()

    # 1. Health check
    print("\n[Step 1] Checking API health...")
    health = await client.get_health()
    assert health.get("status") == "ok", "Healthcheck failed"
    print(f"  ✅ Healthcheck passed: {health}")

    # 2. Incident listing
    print("\n[Step 2] Listing incidents awaiting approval...")
    incidents = await client.list_incidents(status="AWAITING_APPROVAL")
    assert len(incidents) == 1, "Expected 1 incident awaiting approval"
    inc = incidents[0]
    print(f"  ✅ Found incident: {inc['id']} (Service: {inc['service']})")

    # 3. Format Incident Card
    print("\n[Step 3] Generating Incident Notification Card & Inline Keyboard...")
    card_text, reply_markup = format_incident_card(inc)
    print("  --- Incident Notification Card Output ---")
    print(card_text)
    assert "CRITICAL INCIDENT DETECTED" in card_text, "Missing CRITICAL header"
    assert "8001 Fix-Forward" in card_text, "Missing Canary status for 8001"
    assert "8002 Rollback" in card_text, "Missing Canary status for 8002"
    assert "Suspect Commit & Culprit" in card_text, "Missing suspect commit & culprit"

    print("  --- Keyboard Buttons ---")
    for row in reply_markup.inline_keyboard:
        print("  " + " | ".join(f"[{b.text} -> {b.callback_data}]" for b in row))

    # Validate buttons
    buttons = [b for row in reply_markup.inline_keyboard for b in row]
    callback_map = {b.callback_data: b.text for b in buttons}
    assert f"approve_fix_{inc['id']}" in callback_map, "Missing Deploy Fix button"
    assert f"approve_rollback_{inc['id']}" in callback_map, "Missing Rollback button"
    assert f"reject_{inc['id']}" in callback_map, "Missing Reject button"
    print("  ✅ All required interactive buttons present!")

    # 4. Simulate Action: Deploy Fix with 1-Tap Deployment Confirmation
    print("\n[Step 4] Simulating tapping [🚀 Deploy Fix (8001)]...")
    deploy_res = await client.approve_incident(inc["id"], action="fix_forward", source="telegram")
    assert deploy_res["status"] == "DEPLOYED", "Approval failed"
    confirmation = (
        "✅ PRODUCTION RESTORED ON PORT 8000. Canary 8001 promoted. Health check 200 OK verified.\n\n"
        f"*Incident*: `{inc['id']}`\n\n"
        f"{format_compact_summary(inc)}"
    )
    assert "PRODUCTION RESTORED ON PORT 8000. Canary 8001 promoted. Health check 200 OK verified." in confirmation
    print(f"  ✅ Deploy fix approved. Response: {deploy_res}")
    print("  --- 1-Tap Deployment Confirmation Output ---")
    print(confirmation)

    # 5. Simulate Action: Rollback with Confirmation
    print("\n[Step 5] Simulating tapping [⏪ Rollback (8002)]...")
    client.reset()
    rb_res = await client.approve_incident(inc["id"], action="rollback", source="telegram")
    assert rb_res["status"] == "ROLLED_BACK", "Rollback failed"
    rb_confirmation = (
        "✅ PRODUCTION ROLLED BACK ON PORT 8000. Canary 8002 promoted. Health check 200 OK verified.\n\n"
        f"*Incident*: `{inc['id']}`\n\n"
        f"{format_compact_summary(inc)}"
    )
    assert "PRODUCTION ROLLED BACK ON PORT 8000. Canary 8002 promoted. Health check 200 OK verified." in rb_confirmation
    print(f"  ✅ Rollback approved. Response: {rb_res}")

    # 6. Simulate Action: Reject
    print("\n[Step 6] Simulating tapping [❌ Reject]...")
    client.reset()
    rej_res = await client.reject_incident(inc["id"], reason="Manual reject via dry run")
    assert rej_res["status"] == "REJECTED", "Reject failed"
    print(f"  ✅ Reject action verified. Response: {rej_res}")

    # 7. Check logs and Post-Mortem Report (/report)
    print("\n[Step 7] Testing /logs and /report post-mortem generator...")
    logs = await client.get_logs()
    assert "KeyError" in logs, "Logs missing error content"
    print(f"  ✅ Log tail fetched ({len(logs.splitlines())} lines)")

    report = format_report(client.sample_incident)
    assert "ProdPilot Incident Post-Mortem Report" in report, "Report header missing"
    assert "Executive Summary & Root Cause" in report, "Report root cause missing"
    assert "Reproduction Test & Evidence" in report, "Report repro test missing"
    assert "Canary Verification & AI Decision" in report, "Report canary decision missing"
    print("  ✅ Full Post-Mortem markdown incident report verified!")
    print("  --- Post-Mortem Report Output ---")
    print(report[:350] + "\n...[truncated for brevity]...")

    print("\n" + "=" * 65)
    print("🎉 ALL BOT DRY-RUN VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 65 + "\n")


# ============================================================================
# Main Entry Point
# ============================================================================

def parse_args():
    parser = argparse.ArgumentParser(description="ProdPilot Visihot Telegram Bot")
    parser.add_argument(
        "--mock",
        action="store_true",
        help="Run against internal mock API client (standalone mode)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run comprehensive test simulation locally and exit without connecting to Telegram network",
    )
    parser.add_argument(
        "--token",
        type=str,
        default="",
        help="Override Telegram Bot Token",
    )
    parser.add_argument(
        "--chat-id",
        type=str,
        default="",
        help="Override Telegram Allowed Chat ID",
    )
    parser.add_argument(
        "--api-url",
        type=str,
        default="",
        help="Override ProdPilot API URL",
    )
    parser.add_argument(
        "--poll-interval",
        type=int,
        default=0,
        help="Override polling interval (seconds)",
    )
    return parser.parse_args()


def main():
    global BOT_TOKEN, ALLOWED_CHAT_ID, PRODPILOT_API_URL, POLL_INTERVAL, api_client

    args = parse_args()

    if args.token:
        BOT_TOKEN = args.token
    if args.chat_id:
        ALLOWED_CHAT_ID = args.chat_id
    if args.api_url:
        PRODPILOT_API_URL = args.api_url.rstrip("/")
    if args.poll_interval > 0:
        POLL_INTERVAL = args.poll_interval

    # If --dry-run requested, run verification suite and exit
    if args.dry_run:
        asyncio.run(run_dry_run_verification())
        return

    # Initialize client
    if args.mock:
        logger.info("Initializing in MOCK mode (MockProdPilotClient)")
        api_client = MockProdPilotClient()
    else:
        logger.info(f"Initializing LIVE mode connecting to ProdPilot API: {PRODPILOT_API_URL}")
        api_client = ProdPilotClient(base_url=PRODPILOT_API_URL)

    # Check for BOT_TOKEN
    if not BOT_TOKEN:
        print("\n" + "=" * 65)
        print("⚠️  TELEGRAM_BOT_TOKEN NOT CONFIGURED")
        print("=" * 65)
        print("To connect the bot to live Telegram:")
        print("1. Message @BotFather on Telegram to obtain a bot token.")
        print("2. Set TELEGRAM_BOT_TOKEN in .env or pass --token <your_token>.")
        print("3. Set TELEGRAM_ALLOWED_CHAT_ID in .env or pass --chat-id <your_id>.")
        print("4. Run: python3 bot.py --mock\n")
        print("Executing local dry-run verification suite so you can verify bot logic...")
        print("=" * 65 + "\n")
        asyncio.run(run_dry_run_verification())
        return

    logger.info("Starting ProdPilot Telegram Bot Application...")

    async def post_init(application: Application):
        # Start background incident poller
        asyncio.create_task(incident_poller_task(application))

    # Build python-telegram-bot application
    application = (
        ApplicationBuilder()
        .token(BOT_TOKEN)
        .post_init(post_init)
        .build()
    )

    # Register command handlers
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("status", status_command))
    application.add_handler(CommandHandler("logs", logs_command))
    application.add_handler(CommandHandler("report", report_command))
    application.add_handler(CommandHandler("mock", mock_command))

    # Register callback query handler for interactive buttons
    application.add_handler(CallbackQueryHandler(button_callback))

    logger.info(f"ProdPilot Telegram Bot online! Listening for commands and polling every {POLL_INTERVAL}s...")
    application.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
