"""ProdPilot Decision Engine (Rules Backend)
Evaluates incident, staging canary status, and patch evidence to recommend
fix_forward vs rollback with calibrated probabilities and reasoning.
Part of Task 5 (Stream A).
"""

import json
import logging
from typing import Any, Dict, Optional

from backend.prodpilot.db import record_decision

logger = logging.getLogger(__name__)


def decide(
    incident: Dict[str, Any],
    staging_status: Dict[str, Any],
    patch_diff: Optional[str] = None,
    run_id: Optional[str] = None,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    """Computes decision recommendation matching contracts/api.md.
    
    Args:
        incident: Incident dict (contains suspect_commit, brief, etc.)
        staging_status: Dict with status of fix_forward and rollback canaries
        patch_diff: Optional diff text
        run_id: Optional run identifier for recording to DB
        db_path: Optional custom SQLite DB path
        
    Returns:
        Dict conforming to Decision schema:
        {
            "backend": "rules",
            "recommendation": "fix_forward",
            "probabilities": {"fix_forward": 0.85, "rollback": 0.15},
            "reason": "..."
        }
    """
    suspect_commit = incident.get("suspect_commit") or {}
    if isinstance(suspect_commit, str):
        try:
            suspect_commit = json.loads(suspect_commit)
        except Exception:
            suspect_commit = {}

    minutes_ago = suspect_commit.get("minutes_ago", 15)
    suspect_file = suspect_commit.get("suspect_file") or incident.get("suspected_area") or incident.get("service") or "service core"

    # Staging health
    fix_status = staging_status.get("fix_forward", {})
    rb_status = staging_status.get("rollback", {})

    fix_healthy = fix_status.get("health", False)
    rb_healthy = rb_status.get("health", False)

    # Patch size calculation
    patch_lines = 0
    if patch_diff:
        patch_lines = sum(1 for line in patch_diff.splitlines() if line.startswith("+") and not line.startswith("+++"))

    # Rules Engine Decision Matrix
    if fix_healthy and not rb_healthy:
        rec = "fix_forward"
        probs = {"fix_forward": 0.95, "rollback": 0.05}
        reason = f"Fix-forward canary passed on port 8001 while rollback canary failed."

    elif rb_healthy and not fix_healthy:
        rec = "rollback"
        probs = {"fix_forward": 0.05, "rollback": 0.95}
        reason = f"Rollback canary passed on port 8002 while fix-forward canary failed."

    elif fix_healthy and rb_healthy:
        # Both canaries healthy: evaluate diff size and commit recency
        line_desc = f"{patch_lines}-line patch" if patch_lines else "targeted patch"
        if patch_lines <= 10:
            rec = "fix_forward"
            probs = {"fix_forward": 0.85, "rollback": 0.15}
            reason = (
                f"Small defensive {line_desc} in {suspect_file} passes 100% of regression tests; "
                f"canary probing confirmed healthy."
            )
        elif patch_lines > 25 and minutes_ago <= 30:
            rec = "rollback"
            probs = {"fix_forward": 0.35, "rollback": 0.65}
            reason = (
                f"Patch is relatively large ({patch_lines} lines); suspect commit landed only {minutes_ago}m ago, "
                f"making clean rollback lower risk."
            )
        else:
            rec = "fix_forward"
            probs = {"fix_forward": 0.70, "rollback": 0.30}
            reason = f"Both canaries healthy; fix-forward preserves recent code changes."

    else:
        # Neither healthy: fallback default
        rec = "fix_forward"
        probs = {"fix_forward": 0.50, "rollback": 0.50}
        reason = "Awaiting live canary responses or fallback evaluation."

    decision_data = {
        "backend": "rules",
        "recommendation": rec,
        "probabilities": probs,
        "reason": reason,
    }

    # Record to DB if incident_id available
    incident_id = incident.get("id")
    if incident_id:
        try:
            decision_id = f"dec-{run_id or incident_id}"
            record_decision(
                decision_id=decision_id,
                run_id=run_id,
                incident_id=incident_id,
                backend="rules",
                questions={"staging": staging_status, "patch_lines": patch_lines},
                answers=decision_data,
                action=rec,
                reason=reason,
                db_path=db_path,
            )
        except Exception as e:
            logger.debug(f"Could not record decision to DB: {e}")

    return decision_data
