"""Tests for low-severity client disconnect triage and manual remediation triggers."""

import pytest
from fastapi.testclient import TestClient

from backend.prodpilot.triage.classifier import classify_logs, Severity
from backend.prodpilot.db import (
    init_db,
    create_incident,
    get_incident,
    find_active_incident_by_service,
)
from backend.prodpilot.api.server import app

client = TestClient(app)


def test_client_abrupt_disconnect_classification():
    """Verify that abrupt client WebSocket drops are classified as LOW severity, not a system crash."""
    log_sample = """
    INFO:     117.223.180.185:0 - "GET /health HTTP/1.1" 200 OK
    TRACEBACK (CRITICAL)
    Error: %
    Exception in ASGI application
    Traceback (most recent call last):
      File "/home/app/.venv/lib/python3.12/site-packages/starlette/websockets.py", line 133, in receive
        message = await self._receive()
      File "starlette/middleware/base.py", line 189, in __call__
    starlette.websockets.WebSocketDisconnect: (1005, None)
    chunkstream.transfer.ClientAbruptDisconnectError: Client disconnected abruptly without closing handshake
    """
    result = classify_logs("chunkstream", [log_sample])
    assert result.severity == Severity.LOW.value
    assert result.is_crash is False
    assert "disconnect" in result.reason.lower() or "client" in result.reason.lower()


def test_connection_reset_disconnect_classification():
    """Verify ConnectionResetError / Broken pipe drops are triaged as LOW."""
    log_sample = """
    CRITICAL:uvicorn.error:Exception in ASGI application
    Traceback (most recent call last):
      File "app/main.py", line 42, in stream
        await websocket.send_bytes(chunk)
    ConnectionResetError: [Errno 104] Connection reset by peer
    """
    result = classify_logs("chunkstream", [log_sample])
    assert result.severity == Severity.LOW.value
    assert result.is_crash is False


def test_real_crash_with_critical_retains_high_severity():
    """Verify that true code exceptions (e.g. KeyError, IndexError) remain HIGH severity."""
    log_sample = """
    TRACEBACK (CRITICAL)
    Error: unhandled application failure
    Traceback (most recent call last):
      File "app/routes.py", line 112, in calc_discount
        discount = order["discount_code"]
    KeyError: 'discount_code'
    """
    result = classify_logs("chunkstream", [log_sample])
    assert result.severity == Severity.HIGH.value
    assert result.is_crash is True
    assert "keyerror" in result.reason.lower() or "crash" in result.reason.lower()


def test_suspected_area_isolation_prevents_false_recurrence():
    """Verify that incidents on the same service with different suspected areas are not cross-attributed."""
    inc_id = "inc-area-test-01"
    svc = "test-chunkstream-iso"
    create_incident(
        incident_id=inc_id,
        service=svc,
        detected_at="2026-10-24T05:00:00Z",
        status="OPEN",
        trace="KeyError: 'discount'",
        suspected_area="app/routes.py:calc_discount",
    )

    # 1. Searching for an unrelated area on service must return None
    unrelated = find_active_incident_by_service(
        service=svc,
        suspected_area="app/transfer.py:transfer_websocket",
    )
    assert unrelated is None

    # 2. Searching for the matching area returns the active incident
    matched = find_active_incident_by_service(
        service=svc,
        suspected_area="app/routes.py:calc_discount",
    )
    assert matched is not None
    assert matched["id"] == inc_id


def test_trigger_fix_endpoint_transitions_to_open():
    """Verify POST /incidents/{incident_id}/trigger-fix initiates remediation."""
    inc_id = "inc-manual-fix-test-01"
    create_incident(
        incident_id=inc_id,
        service="test-chunkstream-iso",
        detected_at="2026-10-24T05:10:00Z",
        status="WAITING_FOR_DEVELOPER",
        severity="LOW",
        trace="ClientAbruptDisconnectError: 1005",
        suspected_area="app/transfer.py:transfer_websocket",
    )

    res = client.post(f"/incidents/{inc_id}/trigger-fix")
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert data["status"] == "OPEN"
    assert data["severity"] == "HIGH"

    # Verify database was updated
    updated = get_incident(inc_id)
    assert updated["status"] == "OPEN"
    assert updated["severity"] == "HIGH"
