"""Tests for Autonomous Orchestrator Daemon and Post-Mortem Report Generator."""

import os
import subprocess
import tempfile
from pathlib import Path

from backend.prodpilot.db import (
    create_incident,
    get_artifacts,
    get_events,
    get_incident,
    init_db,
)
from backend.prodpilot.pipeline.orchestrator import process_incident, run_orchestrator
from backend.prodpilot.staging.deploy import generate_incident_report


def create_mock_service_repo(target_dir: str) -> str:
    """Initializes a realistic git repo simulating demo-prod microservice."""
    repo = Path(target_dir).resolve()
    repo.mkdir(parents=True, exist_ok=True)

    def git(*args):
        res = subprocess.run(["git", *args], cwd=str(repo), capture_output=True, text=True)
        if res.returncode != 0:
            raise RuntimeError(f"Git failed: {' '.join(args)} -> {res.stderr}")
        return res.stdout.strip()

    git("init", "-b", "main")
    git("config", "user.name", "Vishnu Nandan")
    git("config", "user.email", "vishnu@prodpilot.io")

    app_code = '''from fastapi import FastAPI, HTTPException
app = FastAPI()

def calculate_order(order: dict) -> float:
    items = order.get("items", [])
    total = sum(i.get("price", 0) * i.get("qty", 1) for i in items)
    discount = order["discount"]
    return total - discount

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/orders")
def create_order(order: dict):
    try:
        total = calculate_order(order)
        return {"total": total}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
'''
    (repo / "app.py").write_text(app_code, encoding="utf-8")

    tests_dir = repo / "tests"
    tests_dir.mkdir(exist_ok=True)
    test_code = '''import pytest
from app import calculate_order

def test_order_with_discount():
    order = {"items": [{"price": 10.0, "qty": 2}], "discount": 5.0}
    assert calculate_order(order) == 15.0
'''
    (tests_dir / "test_orders.py").write_text(test_code, encoding="utf-8")

    git("add", "-A")
    suspect_hash = git("commit", "-m", "feat: add discount support to order checkout")

    return suspect_hash


def test_orchestrator_advances_open_to_awaiting_approval():
    init_db()

    with tempfile.TemporaryDirectory() as tmp_repo_dir:
        suspect_hash = create_mock_service_repo(tmp_repo_dir)
        incident_id = f"inc-orch-{os.urandom(3).hex()}"

        create_incident(
            incident_id=incident_id,
            service="demo-prod",
            detected_at="2026-10-23T14:30:00Z",
            status="OPEN",
            health_url="http://127.0.0.1:8000/health",
            trace=(
                'Traceback (most recent call last):\n'
                '  File "app.py", line 8, in calculate_order\n'
                '    discount = order["discount"]\n'
                "KeyError: 'discount'"
            ),
            log_tail="ERROR KeyError: 'discount' in /orders\nHealthcheck probe failed: 500",
            recent_commits=[
                {"hash": suspect_hash, "author": "Vishnu Nandan", "message": "feat: add discount support"}
            ],
            suspect_commit={
                "hash": suspect_hash,
                "author": "Vishnu Nandan",
                "suspect_file": "app.py",
                "suspect_line": 8,
                "minutes_ago": 15,
            },
        )

        inc_before = get_incident(incident_id)
        assert inc_before["status"] == "OPEN"

        # Run orchestrator once
        results = run_orchestrator(
            once=True,
            repo_path=tmp_repo_dir,
            mock_staging=True,
        )

        assert len(results) >= 1
        res = next(r for r in results if r["incident_id"] == incident_id)
        assert res["status"] == "AWAITING_APPROVAL"
        assert res["decision"]["recommendation"] in ("fix_forward", "rollback")

        # Verify incident status in DB
        inc_after = get_incident(incident_id)
        assert inc_after["status"] == "AWAITING_APPROVAL"
        assert inc_after["brief_json"] is not None

        # Verify artifacts
        artifacts = get_artifacts(incident_id)
        kinds = [a["kind"] for a in artifacts]
        assert "repro_test" in kinds
        assert "patch_diff" in kinds

        # Verify events
        events = get_events(incident_id=incident_id)
        stages = [e["stage"] for e in events]
        assert "UNDERSTAND" in stages
        assert "FIX" in stages
        assert "STAGE" in stages
        assert "DECIDE" in stages
        assert "AWAIT_APPROVAL" in stages

        event_kinds = [e["kind"] for e in events]
        assert "awaiting_approval" in event_kinds

        # Verify Post-Mortem Report Generator
        report_md = generate_incident_report(
            incident_id=incident_id,
            action="fix_forward",
            approver_source="telegram",
        )
        assert "# ProdPilot Incident Post-Mortem Report" in report_md
        assert incident_id in report_md
        assert "KeyError" in report_md
        assert "Executive Summary & Root Cause" in report_md
        assert "Minimal Reproduction Test" in report_md
        assert "Patch Diff" in report_md
        assert "Canary Verification" in report_md
        assert "telegram" in report_md

        # Confirm report stored in artifacts table
        arts_after = get_artifacts(incident_id)
        assert any(a["kind"] == "incident_report" for a in arts_after)

        # Clean up test incident to prevent DB pollution
        from backend.prodpilot.db import get_connection
        with get_connection() as conn:
            conn.execute("DELETE FROM incidents WHERE id = ?", (incident_id,))
            conn.execute("DELETE FROM runs WHERE incident_id = ?", (incident_id,))
            conn.execute("DELETE FROM run_events WHERE incident_id = ?", (incident_id,))
            conn.execute("DELETE FROM artifacts WHERE incident_id = ?", (incident_id,))
            conn.execute("DELETE FROM decisions WHERE incident_id = ?", (incident_id,))
            conn.execute("DELETE FROM approvals WHERE incident_id = ?", (incident_id,))
            conn.commit()
