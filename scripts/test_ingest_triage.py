#!/usr/bin/env python3
"""Done Check Test Script for Stream A: Ingest, Triage Tier & Anti-Looping Store.

Tests:
1. Posts a mock warning log to /ingest -> asserts incident is created with severity LOW
   and status WAITING_FOR_DEVELOPER.
2. Posts a mock 500 KeyError traceback to /ingest -> asserts incident is created with
   severity HIGH and a SHA-256 fingerprint.
3. Posts the same 500 KeyError traceback again -> asserts no duplicate incident is created;
   asserts recurrence_count is incremented to 2.

Exit code 0 on success.
"""

import os
import re
import sys
from pathlib import Path

# Setup repository paths and activate local .venv
repo_root = Path(__file__).resolve().parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))
venv_site = repo_root / ".venv"
if venv_site.exists():
    for site_pkg in venv_site.glob("lib*/python*/site-packages"):
        if str(site_pkg) not in sys.path:
            sys.path.insert(0, str(site_pkg))

# Use an isolated test database for repeatable assertions
test_db_path = repo_root / "test_ingest_triage.db"
if test_db_path.exists():
    test_db_path.unlink()
os.environ["PRODPILOT_DB_PATH"] = str(test_db_path)

from fastapi.testclient import TestClient

from backend.prodpilot.api.server import app
from backend.prodpilot.db import get_db, get_incident, init_db

client = TestClient(app)


def test_stream_a_ingest_and_triage():
    print("=" * 60)
    print("PRODPILOT STREAM A: INGEST & TRIAGE VERIFICATION TEST")
    print("=" * 60)

    # Initialize fresh database schema
    init_db(str(test_db_path))
    print("✅ Initialized clean test database with schema migrations")

    # -------------------------------------------------------------
    # 1. Post mock warning log -> LOW severity, WAITING_FOR_DEVELOPER
    # -------------------------------------------------------------
    print("\n[Step 1] Posting mock warning log to /ingest...")
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

    res1 = client.post("/ingest", json=warning_payload)
    assert res1.status_code == 200, f"Expected 200, got {res1.status_code}: {res1.text}"
    data1 = res1.json()
    print(f"  Response: {data1}")

    assert data1["status"] in ("low_severity_recorded", "recurrent_incident"), (
        f"Unexpected status: {data1.get('status')}"
    )
    assert data1["severity"] == "LOW", f"Expected severity LOW, got {data1.get('severity')}"
    assert data1.get("status_code") == "WAITING_FOR_DEVELOPER", (
        f"Expected status_code WAITING_FOR_DEVELOPER, got {data1.get('status_code')}"
    )

    inc1_id = data1["incident_id"]
    inc1 = get_incident(inc1_id, db_path=str(test_db_path))
    assert inc1 is not None, f"Incident {inc1_id} not found in database"
    assert inc1["severity"] == "LOW", f"DB severity expected LOW, got {inc1['severity']}"
    assert inc1["status"] == "WAITING_FOR_DEVELOPER", (
        f"DB status expected WAITING_FOR_DEVELOPER, got {inc1['status']}"
    )
    print(f"✅ Step 1 Passed: Incident {inc1_id} created with severity=LOW, status=WAITING_FOR_DEVELOPER")

    # -------------------------------------------------------------
    # 2. Post mock 500 KeyError traceback -> HIGH severity & SHA-256 fingerprint
    # -------------------------------------------------------------
    print("\n[Step 2] Posting mock 500 KeyError traceback to /ingest...")
    error_payload = {
        "service": "demo-prod",
        "logs": [
            {
                "timestamp": "2026-10-23T18:20:00Z",
                "level": "ERROR",
                "message": (
                    "Traceback (most recent call last):\n"
                    "  File \"app.py\", line 8, in calculate_order\n"
                    "    discount = order[\"discount\"]\n"
                    "KeyError: 'discount'"
                ),
            }
        ],
    }

    res2 = client.post("/ingest", json=error_payload)
    assert res2.status_code == 200, f"Expected 200, got {res2.status_code}: {res2.text}"
    data2 = res2.json()
    print(f"  Response: {data2}")

    assert data2["status"] == "incident_created", f"Expected incident_created, got {data2.get('status')}"
    assert data2["severity"] == "HIGH", f"Expected severity HIGH, got {data2.get('severity')}"
    assert "fingerprint" in data2 and data2["fingerprint"], "Fingerprint missing in response"

    fingerprint = data2["fingerprint"]
    assert re.match(r"^[0-9a-f]{64}$", fingerprint), (
        f"Fingerprint is not a valid 64-char hex SHA-256 hash: {fingerprint}"
    )
    assert data2["recurrence_count"] == 1, (
        f"Expected initial recurrence_count 1, got {data2.get('recurrence_count')}"
    )

    inc2_id = data2["incident_id"]
    inc2 = get_incident(inc2_id, db_path=str(test_db_path))
    assert inc2 is not None, f"Incident {inc2_id} not found in database"
    assert inc2["severity"] == "HIGH", f"DB severity expected HIGH, got {inc2['severity']}"
    assert inc2["fingerprint"] == fingerprint, (
        f"DB fingerprint mismatch: {inc2['fingerprint']} != {fingerprint}"
    )
    assert inc2["recurrence_count"] == 1, (
        f"DB recurrence_count expected 1, got {inc2['recurrence_count']}"
    )
    print(f"✅ Step 2 Passed: Incident {inc2_id} created with severity=HIGH and SHA-256 fingerprint={fingerprint[:16]}...")

    # -------------------------------------------------------------
    # 3. Post SAME 500 KeyError traceback -> NO duplicate incident, recurrence_count = 2
    # -------------------------------------------------------------
    print("\n[Step 3] Posting the same 500 KeyError traceback again (Anti-Looping check)...")
    res3 = client.post("/ingest", json=error_payload)
    assert res3.status_code == 200, f"Expected 200, got {res3.status_code}: {res3.text}"
    data3 = res3.json()
    print(f"  Response: {data3}")

    assert data3["status"] == "recurrent_incident", (
        f"Expected status recurrent_incident, got {data3.get('status')}"
    )
    assert data3["incident_id"] == inc2_id, (
        f"Expected same incident ID {inc2_id}, got {data3.get('incident_id')}"
    )
    assert data3["fingerprint"] == fingerprint, (
        f"Fingerprint mismatch on recurrence: {data3.get('fingerprint')} != {fingerprint}"
    )
    assert data3["recurrence_count"] == 2, (
        f"Expected recurrence_count 2, got {data3.get('recurrence_count')}"
    )

    # Verify directly in SQLite that NO duplicate incident was created
    with get_db(str(test_db_path)) as conn:
        cursor = conn.execute(
            "SELECT COUNT(*) FROM incidents WHERE fingerprint = ?",
            (fingerprint,),
        )
        total_incidents_with_fp = cursor.fetchone()[0]
        assert total_incidents_with_fp == 1, (
            f"Expected exactly 1 incident with fingerprint {fingerprint}, found {total_incidents_with_fp}"
        )

    # Verify updated recurrence count and last_seen_at
    inc2_updated = get_incident(inc2_id, db_path=str(test_db_path))
    assert inc2_updated["recurrence_count"] == 2, (
        f"DB recurrence_count expected 2, got {inc2_updated['recurrence_count']}"
    )
    assert inc2_updated["last_seen_at"] is not None, "last_seen_at was not updated"
    print(f"✅ Step 3 Passed: Anti-looping verified! No duplicate incident created; recurrence_count incremented to {inc2_updated['recurrence_count']}.")

    # Clean up test database file
    try:
        test_db_path.unlink(missing_ok=True)
    except Exception:
        pass

    print("\n" + "=" * 60)
    print("🎉 ALL STREAM A INGEST & TRIAGE ASSERTIONS PASSED CLEANLY (Exit Code 0)")
    print("=" * 60)


if __name__ == "__main__":
    test_stream_a_ingest_and_triage()
    sys.exit(0)
