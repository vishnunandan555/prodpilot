"""ProdPilot Jev Decision Engine (OpenRouter-Powered)
Invoked exclusively during the DECIDE stage to evaluate fix_forward vs rollback.
Designed with strict token budgeting to preserve OpenRouter credits.
Falls back automatically to rules-based evaluation if API call fails or key is missing.
"""

import json
import logging
import os
from typing import Any, Dict, Optional

import httpx

from backend.prodpilot.db import record_decision
from backend.prodpilot.decide.rules import decide as decide_rules

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
# Fast, independent decision model on OpenRouter (Gemini reserved exclusively for Antigravity SDK)
DEFAULT_MODEL = os.environ.get("JEV_MODEL", "meta-llama/llama-3.3-70b-instruct")


def decide_jev(
    incident: Dict[str, Any],
    staging_status: Dict[str, Any],
    patch_diff: Optional[str] = None,
    run_id: Optional[str] = None,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    """Evaluates incident and staging evidence via Jev (OpenRouter), with strict credit conservation."""
    api_key = os.environ.get("JEV_API_KEY") or os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        logger.info("No JEV_API_KEY or OPENROUTER_API_KEY configured; using rules backend.")
        return decide_rules(incident, staging_status, patch_diff, run_id, db_path)

    suspect_commit = incident.get("suspect_commit") or {}
    if isinstance(suspect_commit, str):
        try:
            suspect_commit = json.loads(suspect_commit)
        except Exception:
            suspect_commit = {}

    patch_lines = 0
    if patch_diff:
        patch_lines = sum(1 for line in patch_diff.splitlines() if line.startswith("+") and not line.startswith("+++"))

    # Compact prompt representation to conserve input tokens
    prompt_context = {
        "service": incident.get("service", "target"),
        "severity": incident.get("severity", "HIGH"),
        "title": incident.get("title", ""),
        "suspect_commit": {
            "hash": suspect_commit.get("hash", "")[:7],
            "minutes_ago": suspect_commit.get("minutes_ago", 15),
            "file": suspect_commit.get("suspect_file", ""),
        },
        "staging_canaries": {
            "fix_forward_health": staging_status.get("fix_forward", {}).get("health", False),
            "rollback_health": staging_status.get("rollback", {}).get("health", False),
        },
        "patch_added_lines": patch_lines,
    }

    system_prompt = (
        "You are Jev, ProdPilot's autonomous SRE decision engine. "
        "Recommend whether to 'fix_forward' (promote verified canary patch) or 'rollback' (revert to parent commit). "
        "Respond strictly with valid JSON conforming to: "
        '{"recommendation": "fix_forward"|"rollback", "probabilities": {"fix_forward": float, "rollback": float}, "reason": string}. '
        "Keep reason under 25 words."
    )

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/vishnunandan555/prodpilot",
        "X-Title": "ProdPilot Jev Decision Engine",
    }

    payload = {
        "model": DEFAULT_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(prompt_context)},
        ],
        "temperature": 0.2,
        "max_tokens": 120,
        "response_format": {"type": "json_object"},
    }

    try:
        logger.info(f"Invoking Jev decision engine via OpenRouter ({DEFAULT_MODEL})...")
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(OPENROUTER_URL, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                parsed = json.loads(content)

                rec = parsed.get("recommendation", "fix_forward")
                probs = parsed.get("probabilities", {"fix_forward": 0.85, "rollback": 0.15})
                reason = parsed.get("reason", "Evaluated by Jev on OpenRouter.")

                decision_data = {
                    "backend": "jev",
                    "recommendation": rec,
                    "probabilities": probs,
                    "reason": reason,
                }

                # Record decision in SQLite
                incident_id = incident.get("id")
                if incident_id:
                    try:
                        record_decision(
                            decision_id=f"dec-{run_id or incident_id}",
                            run_id=run_id,
                            incident_id=incident_id,
                            backend="jev",
                            questions=prompt_context,
                            answers=decision_data,
                            action=rec,
                            reason=reason,
                            db_path=db_path,
                        )
                    except Exception as e:
                        logger.debug(f"Could not record Jev decision to DB: {e}")

                logger.info(f"Jev decision: {rec} (fix: {probs.get('fix_forward')}) - {reason}")
                return decision_data
            else:
                logger.warning(f"OpenRouter returned status {resp.status_code}: {resp.text}. Falling back to rules.")
    except Exception as e:
        logger.warning(f"Failed to query Jev on OpenRouter ({e}). Falling back to rules.")

    # Seamless fallback without error
    return decide_rules(incident, staging_status, patch_diff, run_id, db_path)
