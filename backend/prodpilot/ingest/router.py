"""ProdPilot Log Ingestion Router
Provides POST /ingest endpoint to receive log batches from local forwarder
or Render REST API, classify them into High vs Low severity, and enforce
stack-trace fingerprinting for anti-looping crash protection.
Part of Stream A: Log Ingestion.
"""

import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.prodpilot.db import (
    compute_fingerprint,
    create_incident_with_fingerprint,
    find_incident_by_fingerprint,
    increment_incident_recurrence,
    log_event,
)
from backend.prodpilot.triage.classifier import Severity, classify_logs
from backend.prodpilot.triage.low_severity import handle_low_severity

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ingest"])


class LogEntry(BaseModel):
    timestamp: Optional[str] = None
    level: Optional[str] = "INFO"
    message: str


class IngestPayload(BaseModel):
    service: str = "demo-prod"
    logs: List[Union[LogEntry, Dict[str, Any], str]] = Field(default_factory=list)


@router.post("/ingest")
def ingest_logs_endpoint(payload: IngestPayload) -> Dict[str, Any]:
    """Ingests log batches, runs lightweight triage classifier, enforces anti-looping
    fingerprinting on crashes, and records low-severity issues.
    """
    if not payload.logs:
        return {"status": "ignored", "reason": "No logs provided"}

    # Normalize logs to dict/str objects for classifier
    raw_logs: List[Any] = []
    for entry in payload.logs:
        if isinstance(entry, LogEntry):
            raw_logs.append(entry.model_dump() if hasattr(entry, "model_dump") else entry.dict())
        else:
            raw_logs.append(entry)

    # 1. Classify severity
    triage = classify_logs(service=payload.service, logs=raw_logs)

    # 2. Handle HIGH severity (crashes, 5xx, unhandled exceptions)
    if triage.severity == Severity.HIGH.value:
        fp = triage.fingerprint or compute_fingerprint(triage.trace or triage.log_tail)

        # Anti-Looping check
        existing = find_incident_by_fingerprint(fp)
        if existing:
            # Recurring incident! Increment recurrence count instead of spawning duplicate
            inc = increment_incident_recurrence(existing["id"])
            rec_count = inc.get("recurrence_count", 2)
            try:
                log_event(
                    run_id=None,
                    incident_id=existing["id"],
                    stage="INGEST",
                    kind="recurrence_detected",
                    payload={
                        "fingerprint": fp,
                        "recurrence_count": rec_count,
                        "service": payload.service,
                    },
                )
            except Exception as e:
                logger.debug(f"Event logging note: {e}")

            logger.warning(
                f"🔁 RECURRING CRASH DETECTED: ID={existing['id']} | FP={fp[:12]}... | Recurrence={rec_count}"
            )
            return {
                "status": "recurrent_incident",
                "incident_id": existing["id"],
                "fingerprint": fp,
                "recurrence_count": rec_count,
                "severity": Severity.HIGH.value,
                "is_crash": triage.is_crash,
            }

        # New High-Severity Incident
        now_iso = datetime.utcnow().isoformat()
        incident_id = f"inc-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{os.urandom(2).hex()}"
        created = create_incident_with_fingerprint(
            incident_id=incident_id,
            service=payload.service,
            detected_at=now_iso,
            status="OPEN",
            severity=Severity.HIGH.value,
            trace=triage.trace,
            log_tail=triage.log_tail,
            suspected_area=triage.suspected_area,
            fingerprint=fp,
            root_cause_report=f"High severity issue detected: {triage.reason}",
            recovery_action="TRIAGE_AUTO",
        )

        try:
            log_event(
                run_id=None,
                incident_id=incident_id,
                stage="INGEST",
                kind="incident_created",
                payload={
                    "fingerprint": fp,
                    "severity": Severity.HIGH.value,
                    "service": payload.service,
                    "reason": triage.reason,
                },
            )
        except Exception as e:
            logger.debug(f"Event logging note: {e}")

        logger.info(
            f"🚨 HIGH SEVERITY INCIDENT CREATED: ID={incident_id} | FP={fp[:12]}... | Service={payload.service}"
        )
        return {
            "status": "incident_created",
            "incident_id": incident_id,
            "fingerprint": fp,
            "recurrence_count": 1,
            "severity": Severity.HIGH.value,
            "is_crash": triage.is_crash,
        }

    # 3. Handle LOW severity (recoverable warnings, 404 spikes, non-critical errors)
    if triage.severity == Severity.LOW.value:
        # Check if identical warning already recorded and still open
        if triage.fingerprint:
            existing = find_incident_by_fingerprint(triage.fingerprint)
            if existing:
                inc = increment_incident_recurrence(existing["id"])
                rec_count = inc.get("recurrence_count", 2)
                return {
                    "status": "recurrent_incident",
                    "incident_id": existing["id"],
                    "fingerprint": triage.fingerprint,
                    "recurrence_count": rec_count,
                    "severity": Severity.LOW.value,
                    "status_code": "WAITING_FOR_DEVELOPER",
                }

        low_inc = handle_low_severity(payload.service, raw_logs, triage)
        return {
            "status": "low_severity_recorded",
            "incident_id": low_inc["id"],
            "severity": Severity.LOW.value,
            "status_code": "WAITING_FOR_DEVELOPER",
            "fingerprint": low_inc.get("fingerprint"),
            "recurrence_count": 1,
        }

    # 4. Handle INFRA severity (OOM, DB timeout, missing env vars)
    if triage.severity == Severity.INFRA.value:
        now_iso = datetime.utcnow().isoformat()
        incident_id = f"inc-infra-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{os.urandom(2).hex()}"
        infra_inc = create_incident_with_fingerprint(
            incident_id=incident_id,
            service=payload.service,
            detected_at=now_iso,
            status="OPEN",
            severity=Severity.INFRA.value,
            trace=triage.trace,
            log_tail=triage.log_tail,
            suspected_area=triage.suspected_area,
            root_cause_report=f"Infrastructure anomaly: {triage.reason}",
            recovery_action="INFRA_NOTIFICATION",
        )
        return {
            "status": "infra_alert_created",
            "incident_id": incident_id,
            "severity": Severity.INFRA.value,
            "reason": triage.reason,
        }

    # 5. Normal / INFO
    return {
        "status": "ignored",
        "reason": "No high or low severity anomaly found in logs",
        "severity": Severity.INFO.value,
    }
