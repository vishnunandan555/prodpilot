"""Tests for Watchdog Auto-Revert and Remediation Cap Enforcement."""

import json
from unittest.mock import patch

from backend.prodpilot.db import (
    create_incident,
    get_events,
    get_incident,
    init_db,
)
from backend.prodpilot.staging.deploy import DeployAdapter


def test_watchdog_auto_revert_and_remediation_cap(tmp_path):
    init_db()
    incident_id = "inc-watchdog-test-001"
    create_incident(
        incident_id=incident_id,
        service="order-service",
        detected_at="2026-10-23T18:00:00Z",
        status="AWAITING_APPROVAL",
    )

    adapter = DeployAdapter(prod_port=8999)

    # 1. First attempt: simulates a deploy that fails watchdog health checks
    res1 = adapter.deploy(
        action="fix_forward",
        repo_path=str(tmp_path),
        mock_mode=True,
        incident_id=incident_id,
        simulate_watchdog_failure=True,
    )

    assert res1["status"] == "AUTO_REVERTED"
    assert res1["health_check"] == "failed"

    # Incident status in DB should be AUTO_REVERTED
    inc1 = get_incident(incident_id)
    assert inc1["status"] == "AUTO_REVERTED"

    # Check auto_reverted audit event
    events = get_events(incident_id=incident_id)
    auto_revert_events = [e for e in events if e.get("kind") == "auto_reverted"]
    assert len(auto_revert_events) >= 1

    # 2. Second attempt: remediation cap of 1 attempt should trigger ESCALATED
    res2 = adapter.deploy(
        action="fix_forward",
        repo_path=str(tmp_path),
        mock_mode=True,
        incident_id=incident_id,
    )

    assert res2["status"] == "ESCALATED"
    assert "exceeded" in res2["error"].lower()

    inc2 = get_incident(incident_id)
    assert inc2["status"] == "ESCALATED"
