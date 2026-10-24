"""Tests for hardened Render monitoring path, health probe timeouts,
log triage safety/cooldown, and incident lifecycle dispatch concurrency.
"""

from unittest.mock import MagicMock, patch
import httpx
import pytest

from backend.prodpilot.db import (
    claim_incident_for_processing,
    connect_server,
    create_incident,
    create_incident_with_fingerprint,
    compute_fingerprint,
    get_incident,
    get_active_server,
)
from backend.prodpilot.integrations.render_client import RenderClient
from backend.prodpilot.api.connect_router import (
    _LOG_TRIAGE_COOLDOWN,
    _LOG_TRIAGE_FAILURES,
    run_server_log_triage,
)
from backend.prodpilot.pipeline.orchestrator import process_incident, _IN_FLIGHT_INCIDENTS


@pytest.fixture(autouse=True)
def reset_in_memory_state():
    _LOG_TRIAGE_COOLDOWN.clear()
    _LOG_TRIAGE_FAILURES.clear()
    _IN_FLIGHT_INCIDENTS.clear()
    yield
    _LOG_TRIAGE_COOLDOWN.clear()
    _LOG_TRIAGE_FAILURES.clear()
    _IN_FLIGHT_INCIDENTS.clear()


# =========================================================================
# 1. Health Probe Timeout & Configuration Tests
# =========================================================================

def test_probe_health_empty_and_invalid_scheme():
    # Empty URL
    res_empty = RenderClient.probe_health("")
    assert res_empty["status"] == "UNKNOWN"
    assert res_empty["code"] is None
    assert "No health URL provided" in res_empty["error"]

    # Invalid scheme
    res_scheme = RenderClient.probe_health("ftp://example.com/health")
    assert res_scheme["status"] == "ERROR"
    assert "Invalid health URL scheme" in res_scheme["error"]


def test_probe_health_timeout_returns_accurate_error():
    with patch("httpx.Client.get", side_effect=httpx.TimeoutException("Read timed out")):
        res = RenderClient.probe_health("https://chunkstream.onrender.com/health", timeout_sec=2.5)
        assert res["status"] == "ERROR"
        assert res["code"] is None
        assert "timed out after 2.5s" in res["error"]
        assert res["latency_ms"] >= 0.0


def test_probe_health_connect_error():
    with patch("httpx.Client.get", side_effect=httpx.ConnectError("Connection refused")):
        res = RenderClient.probe_health("http://127.0.0.1:9999/health")
        assert res["status"] == "OFFLINE"
        assert res["code"] is None
        assert res["error"] == "Connection refused"


def test_probe_health_http_status_codes():
    mock_resp_200 = MagicMock(status_code=200)
    with patch("httpx.Client.get", return_value=mock_resp_200):
        res = RenderClient.probe_health("https://example.com/health")
        assert res["status"] == "HEALTHY"
        assert res["code"] == 200
        assert res["error"] is None

    mock_resp_503 = MagicMock(status_code=503)
    with patch("httpx.Client.get", return_value=mock_resp_503):
        res = RenderClient.probe_health("https://example.com/health")
        assert res["status"] == "ERROR"
        assert res["code"] == 503
        assert res["error"] == "HTTP 503"


# =========================================================================
# 2. Render Log Ingestion & Rate Limit / Error Handling
# =========================================================================

def test_render_client_get_logs_rate_limit_429():
    client = RenderClient(api_key="rnd_mock_test_key")
    mock_resp = MagicMock(status_code=429, headers={"ratelimit-reset": "45"})
    
    with patch.object(client, "_headers", return_value={"Authorization": "Bearer test"}):
        with patch("httpx.Client.get") as mock_get:
            mock_get.side_effect = [
                MagicMock(status_code=200, json=lambda: {"suspended": "not_suspended", "name": "test-svc", "ownerId": "own-123"}),
                mock_resp,  # /logs returns 429
            ]
            res = client.get_logs("mock-sid-429", force=True)
            assert res["ok"] is False
            assert res["rate_limited"] is True
            assert "rate limit reached (429)" in res["error"]


def test_render_client_get_logs_server_error_500():
    client = RenderClient(api_key="rnd_mock_test_key")
    mock_resp = MagicMock(status_code=500, text="Internal Server Error")
    
    with patch.object(client, "_headers", return_value={"Authorization": "Bearer test"}):
        with patch("httpx.Client.get") as mock_get:
            mock_get.side_effect = [
                MagicMock(status_code=200, json=lambda: {"suspended": "not_suspended", "name": "test-svc", "ownerId": "own-123"}),
                mock_resp,
            ]
            res = client.get_logs("mock-sid-500", force=True)
            assert res["ok"] is False
            assert "HTTP 500" in res["error"]
            assert res["logs"] == []


# =========================================================================
# 3. Log Triage Failure Handling, Hammer Prevention, and Historical Shield
# =========================================================================

def test_log_triage_fails_safely_without_creating_bogus_incident():
    server = connect_server(
        name="test-service-triage",
        health_url="https://test.onrender.com/health",
        render_service_id="srv-mock-1",
        render_api_key="rnd_test",
    )

    with patch("backend.prodpilot.integrations.render_client.RenderClient.get_logs") as mock_logs:
        # Simulate Render API error
        mock_logs.return_value = {
            "ok": False,
            "error": "Render API returned HTTP 503: Service Unavailable",
            "logs": [],
        }

        res = run_server_log_triage(server["id"])
        assert res["ok"] is False
        assert res["incident_created"] is False
        assert "503" in res["error"]

        # Ensure cooldown is active to prevent hammering Render
        assert server["id"] in _LOG_TRIAGE_COOLDOWN
        res_cooldown = run_server_log_triage(server["id"])
        assert res_cooldown["ok"] is False
        assert res_cooldown["rate_limited"] is True
        assert "on cooldown" in res_cooldown["error"]


def test_historical_crash_shield_prevents_duplicate_on_health_timeout():
    server_name = "chunkstream-shield"
    trace_err = "ZeroDivisionError: division by zero in transfer.py:45"
    fp = compute_fingerprint(trace_err)

    server = connect_server(
        name=server_name,
        health_url="https://chunkstream.onrender.com/health",
        render_service_id="srv-chunkstream-shield",
        render_api_key="rnd_test",
    )

    # 1. Existing resolved incident with the exact same fingerprint
    create_incident_with_fingerprint(
        incident_id="inc-prev-resolved-shield",
        service=server_name,
        detected_at="2026-10-23T18:00:00Z",
        status="RESOLVED",
        fingerprint=fp,
    )

    # 2. Render returns logs containing the old resolved traceback
    mock_log_entry = {
        "id": "log-1",
        "timestamp": "2026-10-23T18:00:00Z",
        "level": "ERROR",
        "message": trace_err,
    }

    with patch("backend.prodpilot.integrations.render_client.RenderClient.get_logs") as mock_logs:
        mock_logs.return_value = {
            "ok": True,
            "logs": [mock_log_entry],
            "rate_limited": False,
        }
        # Simulate health probe timeout on the configured health check
        with patch("backend.prodpilot.integrations.render_client.RenderClient.probe_health") as mock_probe:
            mock_probe.return_value = {
                "status": "ERROR",
                "code": None,
                "latency_ms": 4000.0,
                "error": "Health probe timed out after 4.0s",
            }

            res = run_server_log_triage(server["id"])
            assert res["ok"] is True
            assert res["incident_created"] is False
            assert "already resolved" in res["message"]


# =========================================================================
# 4. Incident Dispatch Atomicity, Audit Trail, and Concurrency Prevention
# =========================================================================

def test_claim_incident_for_processing_atomic():
    inc_id = "inc-claim-test-01"
    create_incident(
        incident_id=inc_id,
        service="order-svc",
        detected_at="2026-10-24T00:00:00Z",
        status="OPEN",
    )

    # First claim succeeds: transitions OPEN -> INVESTIGATING
    claimed = claim_incident_for_processing(inc_id, target_status="INVESTIGATING", expected_status="OPEN")
    assert claimed is True
    inc = get_incident(inc_id)
    assert inc["status"] == "INVESTIGATING"

    # Second concurrent claim fails: expected_status OPEN does not match INVESTIGATING
    claimed_again = claim_incident_for_processing(inc_id, target_status="INVESTIGATING", expected_status="OPEN")
    assert claimed_again is False


def test_process_incident_concurrency_lock():
    inc_id = "inc-concurrent-test"
    mock_incident = {"id": inc_id, "service": "demo-prod"}

    # Simulate in-flight incident
    _IN_FLIGHT_INCIDENTS.add(inc_id)

    with pytest.raises(RuntimeError) as exc_info:
        process_incident(mock_incident)
    assert f"Incident {inc_id} is already being processed concurrently" in str(exc_info.value)

    _IN_FLIGHT_INCIDENTS.discard(inc_id)
