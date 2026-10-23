"""Tests for FastAPI REST & SSE endpoints matching contracts/api.md."""

from fastapi.testclient import TestClient
from backend.prodpilot.api.server import app
from backend.prodpilot.db import create_incident, init_db

client = TestClient(app)


def setup_module():
    init_db()


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "version": "1.0.0"}


def test_incidents_crud_and_endpoints():
    inc_id = "inc-api-test-01"
    create_incident(
        incident_id=inc_id,
        service="demo-prod",
        detected_at="2026-10-23T14:30:00Z",
        status="AWAITING_APPROVAL",
        trace="KeyError: 'discount'",
        suspect_commit={"hash": "a1b2c3d", "author": "Vishnu", "minutes_ago": 15},
    )

    # 1. GET /incidents
    res = client.get("/incidents")
    assert res.status_code == 200
    incidents = res.json()
    assert any(i["id"] == inc_id for i in incidents)

    # 2. GET /incidents/{id}
    res = client.get(f"/incidents/{inc_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == inc_id
    assert "brief" in data
    assert "artifacts" in data
    assert "staging" in data
    assert "decision" in data
    assert data["decision"]["recommendation"] == "fix_forward"

    # 3. POST /incidents/{id}/followup
    res = client.post(f"/incidents/{inc_id}/followup", json={"instruction": "Use get method", "source": "desktop_ui"})
    assert res.status_code == 200
    assert res.json()["status"] == "FIXING"

    # 4. POST /incidents/{id}/reject
    res = client.post(f"/incidents/{inc_id}/reject", json={"reason": "Testing rejection", "source": "cli"})
    assert res.status_code == 200
    assert res.json()["status"] == "REJECTED"

    # 5. POST /incidents/{id}/approve
    res = client.post(f"/incidents/{inc_id}/approve", json={"action": "fix_forward", "source": "telegram"})
    assert res.status_code == 200
    assert res.json()["status"] == "DEPLOYED"
    assert res.json()["deployed_action"] == "fix_forward"

    # 6. DELETE /incidents/{id}
    res = client.delete(f"/incidents/{inc_id}")
    assert res.status_code == 200
    assert res.json()["ok"] is True
    assert res.json()["deleted_id"] == inc_id

    # Verify 404 after deletion
    res = client.get(f"/incidents/{inc_id}")
    assert res.status_code == 404
