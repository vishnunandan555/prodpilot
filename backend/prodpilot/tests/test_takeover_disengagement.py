"""Unit and integration tests for Manual Takeover & Pipeline Disengagement Edge Cases."""

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from backend.prodpilot.api.server import app
from backend.prodpilot.db import (
    create_incident_with_fingerprint,
    get_incident,
    update_incident_status,
    find_active_incident_by_service,
)
from backend.prodpilot.pipeline.orchestrator import (
    disengage_incident_pipeline,
    resume_incident_pipeline,
    is_incident_disengaged,
    process_incident,
)

client = TestClient(app)


def test_disengage_and_resume_pipeline_flags():
    inc_id = "inc-test-disengage-1"
    # Initially not disengaged
    assert not is_incident_disengaged(inc_id)

    # Signal disengage
    disengage_incident_pipeline(inc_id)
    assert is_incident_disengaged(inc_id)

    # Resume clears disengage
    resume_incident_pipeline(inc_id)
    assert not is_incident_disengaged(inc_id)


def test_db_status_disengagement_detection():
    inc_id = "inc-test-disengage-db"
    create_incident_with_fingerprint(
        incident_id=inc_id,
        service="AuthEngine",
        detected_at="2026-10-24T00:00:00",
        status="OPEN",
        severity="HIGH",
        fingerprint="fp-test-takeover-db",
    )
    assert not is_incident_disengaged(inc_id)

    # Set to MANUAL_TAKEOVER
    update_incident_status(inc_id, "MANUAL_TAKEOVER")
    assert is_incident_disengaged(inc_id)


def test_find_active_incident_includes_manual_takeover():
    service_name = "PaymentGateway"
    inc_id = "inc-test-takeover-dedup"
    create_incident_with_fingerprint(
        incident_id=inc_id,
        service=service_name,
        detected_at="2026-10-24T00:00:00",
        status="MANUAL_TAKEOVER",
        severity="HIGH",
        fingerprint="fp-test-takeover-dedup",
    )

    # Watchdog active query MUST find incidents in MANUAL_TAKEOVER
    active = find_active_incident_by_service(service_name)
    assert active is not None
    assert active["id"] == inc_id
    assert active["status"] == "MANUAL_TAKEOVER"


def test_process_incident_halts_when_disengaged():
    inc_id = "inc-test-halt-pipeline"
    mock_inc = {
        "id": inc_id,
        "service": "TestService",
        "severity": "SEV-1",
        "trace": "TestError: crash",
    }
    create_incident_with_fingerprint(
        incident_id=inc_id,
        service="TestService",
        detected_at="2026-10-24T00:00:00",
        status="MANUAL_TAKEOVER",
        severity="HIGH",
        fingerprint="fp-test-halt",
    )

    with patch("backend.prodpilot.pipeline.orchestrator.resolve_demo_repo_path") as mock_repo, \
         patch("backend.prodpilot.pipeline.orchestrator.create_brief") as mock_brief, \
         patch("backend.prodpilot.pipeline.orchestrator.run_repro_pipeline") as mock_repro, \
         patch("backend.prodpilot.pipeline.github_pr_workflow.execute_github_pr_lifecycle") as mock_pr:
        
        mock_repo.return_value = "."
        mock_brief.return_value = {"summary": "Crash in handler", "suspected_area": "handler.py"}

        # Run process_incident with incident in MANUAL_TAKEOVER
        res = process_incident(mock_inc)
        
        assert res.get("disengaged") is True
        assert res.get("status") == "MANUAL_TAKEOVER"
        # Must NOT call repro pipeline or PR opening
        mock_repro.assert_not_called()
        mock_pr.assert_not_called()


def test_takeover_and_resume_endpoints():
    inc_id = "inc-test-api-takeover"
    create_incident_with_fingerprint(
        incident_id=inc_id,
        service="OrderService",
        detected_at="2026-10-24T00:00:00",
        status="OPEN",
        severity="HIGH",
        fingerprint="fp-test-api-takeover",
    )

    # 1. Initiate manual takeover via API
    res = client.post(f"/incidents/{inc_id}/takeover")
    assert res.status_code == 200
    assert res.json()["status"] == "MANUAL_TAKEOVER"

    inc = get_incident(inc_id)
    assert inc["status"] == "MANUAL_TAKEOVER"
    assert is_incident_disengaged(inc_id)

    # 2. Resume via API
    resume_res = client.post(f"/incidents/{inc_id}/resume")
    assert resume_res.status_code == 200
    assert resume_res.json()["status"] in ("AWAITING_APPROVAL", "INVESTIGATING")

    inc_resumed = get_incident(inc_id)
    assert inc_resumed["status"] in ("AWAITING_APPROVAL", "INVESTIGATING")
    assert not is_incident_disengaged(inc_id)
