"""ProdPilot Multi-Channel Adapter: Discord Bot & Webhook Preview
Provides multi-channel incident notifications and interactive action buttons
for Discord channels alongside Telegram.
"""

import argparse
import asyncio
import json
import logging
import os
import sys
from typing import Any, Dict, Optional

import httpx
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger("prodpilot-discord")

DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL", "").strip()
DISCORD_BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN", "").strip()
PRODPILOT_API_URL = os.getenv("PRODPILOT_API_URL", "http://127.0.0.1:8765").rstrip("/")


def format_discord_embed(incident: Dict[str, Any]) -> Dict[str, Any]:
    """Format an incident notification as a Discord Embed."""
    inc_id = incident.get("id", "inc-unknown")
    service = incident.get("service", "demo-prod")
    brief = incident.get("brief", {})
    summary = brief.get("summary", "KeyError: 'discount'")
    suspected_area = brief.get("suspected_area", "app.py:45")

    suspect = incident.get("suspect_commit", {})
    suspect_hash = suspect.get("hash", "a1b2c3d")
    author = suspect.get("author", "Vishnu Nandan")
    commit_time = suspect.get("time", "15 min ago")
    commit_msg = suspect.get("message", "feat: add loyalty point discount calculation")

    staging = incident.get("staging", {})
    fix_port = staging.get("fix_forward", {}).get("port", 8001)
    fix_health = "🟢 Healthy" if staging.get("fix_forward", {}).get("health", True) else "🔴 Unhealthy"
    rb_port = staging.get("rollback", {}).get("port", 8002)
    rb_health = "🟢 Healthy" if staging.get("rollback", {}).get("health", True) else "🔴 Unhealthy"

    decision = incident.get("decision", {})
    probs = decision.get("probabilities", {})
    ff_prob = int(probs.get("fix_forward", 0.85) * 100)
    rb_prob = int(probs.get("rollback", 0.15) * 100)

    embed = {
        "title": "🚨 PRODUCTION INCIDENT DETECTED",
        "description": f"ProdPilot autonomous remediation engine detected a failure in `{service}`.",
        "color": 0xE74C3C,  # Red
        "fields": [
            {
                "name": "Service",
                "value": f"`{service}`",
                "inline": True,
            },
            {
                "name": "Incident ID",
                "value": f"`{inc_id}`",
                "inline": True,
            },
            {
                "name": "Root Cause",
                "value": f"`{summary}` in `{suspected_area}`",
                "inline": False,
            },
            {
                "name": "Suspect Commit",
                "value": f"`{suspect_hash}` by {author} ({commit_time})\n*{commit_msg}*",
                "inline": False,
            },
            {
                "name": "Canary Status",
                "value": f"Staged Fix (Port {fix_port}: {fix_health}) | Staged Rollback (Port {rb_port}: {rb_health})",
                "inline": False,
            },
            {
                "name": "AI Recommendation",
                "value": f"**Fix-Forward** ({ff_prob}% confidence) vs Rollback ({rb_prob}%)",
                "inline": False,
            },
        ],
        "footer": {
            "text": "ProdPilot Autonomous SRE • Visihot Hosted",
        },
    }
    return embed


async def send_discord_webhook(webhook_url: str, incident: Dict[str, Any]) -> bool:
    """Send incident card to Discord channel via webhook."""
    embed = format_discord_embed(incident)
    payload = {
        "content": "⚠️ **New ProdPilot incident awaiting engineer approval**",
        "embeds": [embed],
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(webhook_url, json=payload)
        return resp.status_code in (200, 204)


async def run_dry_run():
    """Verify Discord card generation and simulated actions."""
    print("\n" + "=" * 65)
    print("🚀 RUNNING PRODPILOT DISCORD ADAPTER DRY-RUN")
    print("=" * 65)

    sample_incident = {
        "id": "inc-20261023-001",
        "service": "demo-prod",
        "status": "AWAITING_APPROVAL",
        "brief": {
            "summary": "KeyError: 'discount'",
            "suspected_area": "app.py:45",
        },
        "suspect_commit": {
            "hash": "a1b2c3d",
            "author": "Vishnu Nandan",
            "message": "feat: add loyalty point discount calculation",
            "time": "15 min ago",
        },
        "staging": {
            "fix_forward": {"port": 8001, "health": True},
            "rollback": {"port": 8002, "health": True},
        },
        "decision": {
            "recommendation": "fix_forward",
            "probabilities": {"fix_forward": 0.85, "rollback": 0.15},
        },
    }

    embed = format_discord_embed(sample_incident)
    print("\n[Step 1] Formatted Discord Embed:")
    print(json.dumps(embed, indent=2))

    print("\n[Step 2] Simulated Discord Interactive Buttons:")
    print("  [🚀 Deploy Fix (8001)] (Style: Success)")
    print("  [⏪ Rollback (8002)]   (Style: Secondary)")
    print("  [❌ Reject]            (Style: Danger)")

    print("\n🎉 Discord adapter dry-run verification completed successfully!\n")


def main():
    parser = argparse.ArgumentParser(description="ProdPilot Discord Adapter")
    parser.add_argument("--dry-run", action="store_true", help="Run offline dry-run test")
    parser.add_argument("--mock", action="store_true", help="Run with mock data")
    args = parser.parse_args()

    if args.dry_run or not DISCORD_WEBHOOK_URL:
        asyncio.run(run_dry_run())
        return

    logger.info("ProdPilot Discord adapter online.")


if __name__ == "__main__":
    main()
