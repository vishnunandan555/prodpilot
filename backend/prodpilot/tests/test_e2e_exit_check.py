"""ProdPilot Stream A End-to-End Exit Check Script
Performs full verification cycle:
1. Creates mock incident in DB
2. Runs Repro-First Pipeline (Repro test fails on baseline -> fix applied -> full suite green)
3. Stages on side ports (8001/8002) and verifies canaries
4. Computes decision recommendation
5. Triggers approval via FastAPI REST endpoint
6. Verifies fail-closed safe default (HTTP 501 when deployment disabled) and explicit local deployment
"""

import json
import os
import subprocess
import tempfile
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.prodpilot.api.server import app, deploy_adapter
from backend.prodpilot.db import (
    create_incident,
    get_incident,
    get_artifacts,
    get_events,
    log_event,
    init_db,
)
from backend.prodpilot.decide.rules import decide
from backend.prodpilot.pipeline.repro_runner import run_repro_pipeline
from backend.prodpilot.staging.manager import StagingManager


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

    # Initial app code
    app_code = '''from fastapi import FastAPI, HTTPException
app = FastAPI()

def calculate_order(order: dict) -> float:
    items = order.get("items", [])
    total = sum(i.get("price", 0) * i.get("qty", 1) for i in items)
    # Planted bug in suspect commit: direct key access raises KeyError when discount not provided
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

    # Tests dir with standard passing test
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


def _setup_pipeline_incident(tmp_repo_dir: str):
    """Sets up mock repo, registers mock incident, runs repro pipeline, stages canaries, and logs approval event."""
    init_db()

    suspect_hash = create_mock_service_repo(tmp_repo_dir)

    incident_id = f"inc-exit-{os.urandom(3).hex()}"
    incident_data = {
        "id": incident_id,
        "service": "demo-prod",
        "detected_at": "2026-10-23T14:30:00Z",
        "status": "OPEN",
        "health_url": "http://127.0.0.1:8000/health",
        "trace": (
            'Traceback (most recent call last):\n'
            '  File "app.py", line 8, in calculate_order\n'
            '    discount = order["discount"]\n'
            "KeyError: 'discount'"
        ),
        "log_tail": "ERROR KeyError: 'discount' in /orders\nHealthcheck probe failed: 500",
        "recent_commits": [
            {"hash": suspect_hash, "author": "Vishnu Nandan", "message": "feat: add discount support"}
        ],
        "suspect_commit": {
            "hash": suspect_hash,
            "author": "Vishnu Nandan",
            "suspect_file": "app.py",
            "suspect_line": 8,
            "minutes_ago": 15,
        },
    }

    create_incident(
        incident_id=incident_id,
        service=incident_data["service"],
        detected_at=incident_data["detected_at"],
        status="OPEN",
        health_url=incident_data["health_url"],
        trace=incident_data["trace"],
        log_tail=incident_data["log_tail"],
        recent_commits=incident_data["recent_commits"],
        suspect_commit=incident_data["suspect_commit"],
    )

    pipeline_res = run_repro_pipeline(
        incident=incident_data,
        repo_path=tmp_repo_dir,
    )

    assert pipeline_res.ok is True, f"Pipeline failed: {pipeline_res.error}"
    assert "KeyError" in pipeline_res.test_evidence["before"]
    assert pipeline_res.test_evidence["after"] == "PASSED"

    staging_mgr = StagingManager(repo_path=tmp_repo_dir)
    staging_mgr.stage_fix_forward(pipeline_res.worktree_path, port=8001, mock_mode=True)
    staging_mgr.stage_rollback(suspect_commit=suspect_hash, port=8002, mock_mode=True)
    staging_status = staging_mgr.get_status()

    decision = decide(
        incident=incident_data,
        staging_status=staging_status,
        patch_diff=pipeline_res.patch_diff,
        run_id=pipeline_res.run_id,
    )
    assert decision["recommendation"] == "fix_forward"
    assert decision["probabilities"]["fix_forward"] >= 0.70

    log_event(
        run_id=pipeline_res.run_id,
        incident_id=incident_id,
        stage="AWAIT_APPROVAL",
        kind="awaiting_approval",
        payload={
            "recommendation": decision["recommendation"],
            "options": {
                "fix_forward": {"port": 8001, "health_ok": True},
                "rollback": {"port": 8002, "health_ok": True},
            },
        },
    )

    return incident_id, staging_mgr, pipeline_res


def test_full_pipeline_exit_check():
    """Runs Stream A exit check with deployment disabled, expecting fail-closed HTTP 501."""
    print("\n" + "=" * 60)
    print("PRODPILOT STREAM A: RUNNING EXIT CHECK (DEPLOYMENT DISABLED)")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmp_repo_dir:
        incident_id, staging_mgr, pipeline_res = _setup_pipeline_incident(tmp_repo_dir)
        print(f"[1/3] Pipeline completed for incident: {incident_id}")

        client = TestClient(app)

        # Verify detail endpoint
        detail_res = client.get(f"/incidents/{incident_id}")
        assert detail_res.status_code == 200
        detail_json = detail_res.json()
        assert detail_json["status"] == "AWAITING_APPROVAL"
        assert detail_json["brief"]["suspected_area"] == "app.py:8"

        # Explicitly verify deployment-disabled fail-closed HTTP 501
        print("[2/3] Triggering approval with deployment disabled...")
        with patch.dict(os.environ, {"PRODPILOT_DEPLOY_TARGET": "disabled"}):
            approve_res = client.post(
                f"/incidents/{incident_id}/approve",
                json={"action": "fix_forward", "source": "telegram", "repo_path": tmp_repo_dir},
            )
            assert approve_res.status_code == 501
            approve_err = approve_res.json()
            assert "No production provider deployment adapter is configured" in approve_err["detail"]
            assert "Local process deployment is disabled" in approve_err["detail"]
            print("      - Approval Response: 501 Not Implemented (fail-closed safe default)")

        # Verify DB state: incident must remain AWAITING_APPROVAL, no DEPLOY event executed
        print("[3/3] Verifying fail-closed state in database...")
        updated_inc = get_incident(incident_id)
        assert updated_inc["status"] == "AWAITING_APPROVAL"

        events = get_events(incident_id=incident_id)
        assert any(e["stage"] == "REPRODUCE" for e in events)
        assert any(e["stage"] == "FIX" for e in events)
        assert not any(e["stage"] == "DEPLOY" for e in events)

        artifacts = get_artifacts(incident_id)
        assert any(a["kind"] == "repro_test" for a in artifacts)
        assert any(a["kind"] == "patch_diff" for a in artifacts)

        staging_mgr.stop_all()

        print("\n" + "=" * 60)
        print("EXIT CHECK PASSED: FAIL-CLOSED DEPLOYMENT SAFETY VERIFIED!")
        print("=" * 60 + "\n")


def test_pipeline_exit_check_local_deployment():
    """Runs exit check verifying local deployment only when PRODPILOT_DEPLOY_TARGET=local_process is explicitly set."""
    print("\n" + "=" * 60)
    print("PRODPILOT STREAM A: RUNNING LOCAL DEPLOYMENT CHECK (PRODPILOT_DEPLOY_TARGET=local_process)")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmp_repo_dir:
        incident_id, staging_mgr, pipeline_res = _setup_pipeline_incident(tmp_repo_dir)
        print(f"[1/3] Pipeline completed for incident: {incident_id}")

        client = TestClient(app)

        # Verify detail endpoint
        detail_res = client.get(f"/incidents/{incident_id}")
        assert detail_res.status_code == 200
        detail_json = detail_res.json()
        assert detail_json["status"] == "AWAITING_APPROVAL"

        # Explicitly verify local deployment when PRODPILOT_DEPLOY_TARGET=local_process is set
        print("[2/3] Triggering approval with PRODPILOT_DEPLOY_TARGET=local_process...")
        with patch.dict(os.environ, {"PRODPILOT_DEPLOY_TARGET": "local_process"}):
            approve_res = client.post(
                f"/incidents/{incident_id}/approve",
                json={"action": "fix_forward", "source": "telegram", "repo_path": tmp_repo_dir},
            )
            assert approve_res.status_code == 200
            approve_data = approve_res.json()
            assert approve_data["status"] == "DEPLOYED"
            assert approve_data["deployed_action"] == "fix_forward"
            assert approve_data["health_check"] == "ok"
            print("      - Approval Response: 200 OK -> DEPLOYED (local process)")

        # Verify DB state
        print("[3/3] Verifying DEPLOYED state in database and audit events...")
        updated_inc = get_incident(incident_id)
        assert updated_inc["status"] == "DEPLOYED"

        events = get_events(incident_id=incident_id)
        assert any(e["stage"] == "REPRODUCE" for e in events)
        assert any(e["stage"] == "FIX" for e in events)
        assert any(e["stage"] == "DEPLOY" for e in events)

        # Rule check: confirm local process deployment only; no provider deployment claimed or executed
        deploy_events = [e for e in events if e.get("stage") == "DEPLOY"]
        for de in deploy_events:
            payload = de.get("payload") or {}
            if isinstance(payload, str):
                try:
                    payload = json.loads(payload)
                except Exception:
                    payload = {}
            # Verify no provider deployment (render, aws, etc.) claimed
            assert "render" not in str(payload).lower()

        artifacts = get_artifacts(incident_id)
        assert any(a["kind"] == "repro_test" for a in artifacts)
        assert any(a["kind"] == "patch_diff" for a in artifacts)

        # Clean staging and active process
        staging_mgr.stop_all()
        deploy_adapter._kill_existing_port_process(deploy_adapter.prod_port)

        print("\n" + "=" * 60)
        print("LOCAL DEPLOYMENT PASSED: LOCAL PROCESS VERIFIED WITHOUT PROVIDER DEPLOYMENT!")
        print("=" * 60 + "\n")


if __name__ == "__main__":
    test_full_pipeline_exit_check()
    test_pipeline_exit_check_local_deployment()
