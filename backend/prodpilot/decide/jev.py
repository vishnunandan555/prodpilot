"""ProdPilot Jev Decision Engine (Powered by TypeSafe on OpenRouter)
Implements TypeSafe System One decision model using OpenRouter's Decisions API:
POST https://openrouter.ai/api/alpha/decisions

Reference: https://openrouter.ai/docs/guides/community/jev
"""

import json
import logging
import os
from typing import Any, Dict, Optional

import httpx

from backend.prodpilot.db import get_setting, record_decision
from backend.prodpilot.decide.rules import decide as decide_rules

logger = logging.getLogger(__name__)

# OpenRouter Decisions API Endpoint for TypeSafe Jev
JEV_DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions"
# Default Model: TypeSafe Jev 1.14 (or fallback to jev-1.13 or ~typesafe/jev-latest)
DEFAULT_JEV_MODEL = os.environ.get("JEV_MODEL", "typesafe/jev-1.14")


def decide_jev(
    incident: Dict[str, Any],
    staging_status: Dict[str, Any],
    patch_diff: Optional[str] = None,
    run_id: Optional[str] = None,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    """Evaluates incident and staging evidence via TypeSafe Jev System One model on OpenRouter."""
    api_key = (
        get_setting("JEV_API_KEY", db_path=db_path)
        or get_setting("OPENROUTER_API_KEY", db_path=db_path)
        or os.environ.get("JEV_API_KEY")
        or os.environ.get("OPENROUTER_API_KEY")
        or ""
    ).strip()

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
        patch_lines = sum(
            1 for line in patch_diff.splitlines()
            if line.startswith("+") and not line.startswith("+++")
        )

    # Prepare structured application state for Jev System One
    state = {
        "service": incident.get("service", "target-service"),
        "severity": incident.get("severity", "HIGH"),
        "error_summary": incident.get("title", "Production Outage"),
        "suspect_file": suspect_commit.get("suspect_file", ""),
        "suspect_commit_hash": (suspect_commit.get("hash") or "")[:8],
        "patch_added_lines": patch_lines,
        "canary_fix_forward_healthy": staging_status.get("fix_forward", {}).get("health", False),
        "canary_rollback_healthy": staging_status.get("rollback", {}).get("health", False),
    }

    # TypeSafe Jev Choice Primitive
    questions = {
        "recovery_action": {
            "type": "choice",
            "instructions": "Which recovery action should ProdPilot execute for this production incident?",
            "criteria": {
                "fix_forward": "Deploy the verified staging canary hotfix because the patch is verified, minimal, and restores service with zero downtime.",
                "rollback": "Roll back to the previous stable release commit because the patch is risky, complex, or unverified."
            }
        }
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/vishnunandan555/prodpilot",
        "X-Title": "ProdPilot Jev Decision Engine",
    }

    payload = {
        "model": DEFAULT_JEV_MODEL,
        "state": state,
        "questions": questions,
    }

    try:
        logger.info(f"Invoking TypeSafe Jev decision engine ({DEFAULT_JEV_MODEL}) on OpenRouter...")
        with httpx.Client(timeout=12.0) as client:
            resp = client.post(JEV_DECISIONS_URL, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                answers = data.get("answers", {})
                rec_answer = answers.get("recovery_action", {})

                rec = rec_answer.get("choice", "fix_forward")
                probs = rec_answer.get("probabilities", {"fix_forward": 0.85, "rollback": 0.15})
                confidence = rec_answer.get("confidence", 0.85)
                provider = data.get("provider", "TypeSafe")
                model_name = data.get("model", DEFAULT_JEV_MODEL)

                reason = f"Evaluated by TypeSafe Jev ({model_name}) with {int(confidence * 100)}% confidence."

                decision_data = {
                    "backend": "jev",
                    "model": model_name,
                    "provider": provider,
                    "recommendation": rec,
                    "probabilities": probs,
                    "confidence": confidence,
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
                            questions=questions,
                            answers=decision_data,
                            action=rec,
                            reason=reason,
                            db_path=db_path,
                        )
                    except Exception as e:
                        logger.debug(f"Could not record Jev decision to DB: {e}")

                logger.info(f"TypeSafe Jev decision: {rec} (probabilities: {probs}) via {provider}")
                return decision_data
            else:
                logger.warning(
                    f"OpenRouter Jev returned HTTP {resp.status_code}: {resp.text[:200]}. Falling back to rules."
                )
    except Exception as e:
        logger.warning(f"Failed to query TypeSafe Jev on OpenRouter ({e}). Falling back to rules.")

    # Seamless fallback to deterministic safety rules
    return decide_rules(incident, staging_status, patch_diff, run_id, db_path)
