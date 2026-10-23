"""Tests for Ingest, Triage Tier, and Anti-Looping Incident Deduplication."""

import re
from fastapi.testclient import TestClient

from backend.prodpilot.api.server import app
from backend.prodpilot.db import get_incident, get_db

client = TestClient(app)


def test_ingest_low_severity_warning():
    warning_payload = {
        "service": "demo-prod",
        "logs": [
            {
                "timestamp": "2026-10-23T18:15:00Z",
                "level": "WARNING",
                "message": "UserWarning: Cache miss for order service, falling back to read-replica.",
            }
        ],
    }

    res = client.post("/ingest", json=warning_payload)
    assert res.status_code == 200
    data = res.json()

    assert data["status"] in ("low_severity_recorded", "recurrent_incident")
    assert data["severity"] == "LOW"
    assert data.get("status_code") == "WAITING_FOR_DEVELOPER"

    inc_id = data["incident_id"]
    inc = get_incident(inc_id)
    assert inc is not None
    assert inc["severity"] == "LOW"
    assert inc["status"] == "WAITING_FOR_DEVELOPER"


def test_ingest_high_severity_and_anti_looping_dedup():
    import os
    token = os.urandom(4).hex()
    error_payload = {
        "service": f"demo-prod-{token}",
        "logs": [
            {
                "timestamp": "2026-10-23T18:20:00Z",
                "level": "ERROR",
                "message": (
                    f"Traceback (most recent call last):\n"
                    f"  File \"app_{token}.py\", line 8, in calculate_order\n"
                    f"    discount = order[\"discount\"]\n"
                    f"KeyError: 'discount_{token}'"
                ),
            }
        ],
    }

    # First post -> new incident created with SHA-256 fingerprint
    res1 = client.post("/ingest", json=error_payload)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["status"] == "incident_created"

    assert data1["status"] in ("incident_created", "recurrent_incident")
    assert data1["severity"] == "HIGH"
    fingerprint = data1["fingerprint"]
    assert re.match(r"^[0-9a-f]{64}$", fingerprint)

    inc_id = data1["incident_id"]
    inc1 = get_incident(inc_id)
    assert inc1 is not None
    assert inc1["severity"] == "HIGH"
    assert inc1["fingerprint"] == fingerprint
    first_count = inc1["recurrence_count"]

    # Second post of identical error -> anti-looping deduplication increments recurrence_count
    res2 = client.post("/ingest", json=error_payload)
    assert res2.status_code == 200
    data2 = res2.json()

    assert data2["status"] == "recurrent_incident"
    assert data2["incident_id"] == inc_id
    assert data2["fingerprint"] == fingerprint
    assert data2["recurrence_count"] == first_count + 1

    # Verify no duplicate incident row with identical fingerprint
    with get_db() as conn:
        cursor = conn.execute(
            "SELECT COUNT(*) FROM incidents WHERE fingerprint = ?",
            (fingerprint,),
        )
        total_incidents_with_fp = cursor.fetchone()[0]
        assert total_incidents_with_fp == 1
