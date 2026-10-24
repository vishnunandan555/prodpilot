"""Low-Severity Issue Creator
On LOW classification, synthesizes a short diagnostic brief and records
in SQLite with status WAITING_FOR_DEVELOPER and severity LOW.
Does NOT page developer or trigger code fixes.
Part of Stream A: Triage Tier.
"""

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from backend.prodpilot.db import create_incident_with_fingerprint, log_event, update_incident_brief
from backend.prodpilot.triage.classifier import TriageResult

logger = logging.getLogger(__name__)


def handle_low_severity(
    service: str,
    logs: List[Any],
    triage_result: TriageResult,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    """Synthesizes a short diagnostic brief, records incident in SQLite as LOW severity
    with status WAITING_FOR_DEVELOPER.
    Does NOT page developer or trigger code fixes.
    """
    now_iso = datetime.utcnow().isoformat()
    incident_id = f"inc-low-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{os.urandom(2).hex()}"

    # Extract sample log messages for the diagnostic brief
    sample_msgs: List[str] = []
    for entry in logs[:5]:
        if isinstance(entry, dict):
            sample_msgs.append(str(entry.get("message", "")))
        else:
            sample_msgs.append(str(entry))

    brief = {
        "title": f"[LOW] Recoverable warning in {service}",
        "service": service,
        "severity": "LOW",
        "status": "WAITING_FOR_DEVELOPER",
        "reason": triage_result.reason,
        "summary": f"Detected low-severity non-critical event in {service}: {triage_result.reason}.",
        "sample_logs": sample_msgs,
        "suggested_action": "Review when convenient. Paging and autonomous patch pipeline deferred.",
        "paged_developer": False,
        "triggered_fix": False,
        "created_at": now_iso,
    }

    # Persist record in SQLite
    incident = create_incident_with_fingerprint(
        incident_id=incident_id,
        service=service,
        detected_at=now_iso,
        status="WAITING_FOR_DEVELOPER",
        severity="LOW",
        trace=triage_result.trace,
        log_tail=triage_result.log_tail,
        suspected_area=triage_result.suspected_area or "warning_logs",
        root_cause_report=brief["summary"],
        recovery_action="WAITING_FOR_DEVELOPER",
        fingerprint=triage_result.fingerprint,
        db_path=db_path,
    )

    # Store structured brief in brief_json
    try:
        update_incident_brief(incident_id, brief, db_path=db_path)
    except Exception as e:
        logger.debug(f"Failed to update brief_json: {e}")

    # Log an event for observability
    try:
        log_event(
            run_id=None,
            incident_id=incident_id,
            stage="TRIAGE",
            kind="low_severity_recorded",
            payload={
                "incident_id": incident_id,
                "status": "WAITING_FOR_DEVELOPER",
                "severity": "LOW",
                "reason": triage_result.reason,
                "paged": False,
            },
            db_path=db_path,
        )
    except Exception as e:
        logger.debug(f"Event logging note: {e}")

    logger.info(
        f"📝 LOW SEVERITY ISSUE CREATED: ID={incident_id} | Status=WAITING_FOR_DEVELOPER | Paged=False"
    )
    return incident
