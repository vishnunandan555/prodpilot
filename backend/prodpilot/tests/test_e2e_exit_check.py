"""ProdPilot Stream A End-to-End Exit Check Script
Performs full verification cycle:
1. Creates mock incident in DB
2. Runs Repro-First Pipeline (Repro test fails on baseline -> fix applied -> full suite green)
3. Stages on side ports (8001/8002) and verifies canaries
4. Computes decision recommendation
5. Triggers approval via FastAPI REST endpoint
6. Verifies clean deployment
"""

import json
import os
import subprocess
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

from backend.prodpilot.api.server import app
from backend.prodpilot.db import (
    create_incident,
    get_incident,
    get_artifacts,
    get_events,
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


def test_full_pipeline_exit_check():
    """Runs complete Stream A exit check test."""
    print("\n" + "=" * 60)
    print("PRODPILOT STREAM A: RUNNING COMPLETE EXIT CHECK")
    print("=" * 60)

    # 1. Setup DB
    init_db()

    # 2. Setup mock git repo for demo-prod
    with tempfile.TemporaryDirectory() as tmp_repo_dir:
        suspect_hash = create_mock_service_repo(tmp_repo_dir)
        print(f"[1/5] Created mock microservice repo with suspect commit: {suspect_hash[:8]}")

        # 3. Create mock incident in SQLite DB
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
        print(f"[2/5] Mock incident registered in DB: {incident_id}")

        # 4. Run Repro-First Pipeline
        print("[3/5] Executing Repro-First Pipeline (Agent + Verifier)...")
        pipeline_res = run_repro_pipeline(
            incident=incident_data,
            repo_path=tmp_repo_dir,
        )

        assert pipeline_res.ok is True, f"Pipeline failed: {pipeline_res.error}"
        assert "KeyError" in pipeline_res.test_evidence["before"]
        assert pipeline_res.test_evidence["after"] == "PASSED"
        print(f"      - Repro Test Before Fix: {pipeline_res.test_evidence['before']}")
        print(f"      - Full Suite After Fix:  {pipeline_res.test_evidence['after']}")
        print(f"      - Generated Patch Diff:\n{pipeline_res.patch_diff}")

        # 5. Staging Canaries & Decision
        print("[4/5] Running Staging Canaries & Decision Engine...")
        staging_mgr = StagingManager(repo_path=tmp_repo_dir)
        # Stage in mock mode for unit test environment
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
        print(f"      - Recommendation: {decision['recommendation']}")
        print(f"      - Confidence: {decision['probabilities']['fix_forward'] * 100:.0f}%")
        print(f"      - Reason: {decision['reason']}")

        # 6. Trigger Approval via FastAPI REST Server
        print("[5/5] Triggering approval via FastAPI REST endpoint...")
        client = TestClient(app)

        # Verify detail endpoint
        detail_res = client.get(f"/incidents/{incident_id}")
        assert detail_res.status_code == 200
        detail_json = detail_res.json()
        assert detail_json["status"] == "AWAITING_APPROVAL"
        assert detail_json["brief"]["suspected_area"] == "app.py:8"

        # Approve fix_forward
        approve_res = client.post(
            f"/incidents/{incident_id}/approve",
            json={"action": "fix_forward", "source": "telegram"},
        )
        assert approve_res.status_code == 200
        approve_data = approve_res.json()
        assert approve_data["status"] == "DEPLOYED"
        assert approve_data["deployed_action"] == "fix_forward"
        assert approve_data["health_check"] == "ok"
        print("      - Approval Response: 200 OK -> DEPLOYED")

        # Verify DB state
        updated_inc = get_incident(incident_id)
        assert updated_inc["status"] == "DEPLOYED"

        events = get_events(incident_id=incident_id)
        assert any(e["stage"] == "REPRODUCE" for e in events)
        assert any(e["stage"] == "FIX" for e in events)
        assert any(e["stage"] == "DEPLOY" for e in events)

        artifacts = get_artifacts(incident_id)
        assert any(a["kind"] == "repro_test" for a in artifacts)
        assert any(a["kind"] == "patch_diff" for a in artifacts)

        print("\n" + "=" * 60)
        print("EXIT CHECK PASSED: COMPLETE STREAM A PIPELINE VERIFIED!")
        print("=" * 60 + "\n")


if __name__ == "__main__":
    test_full_pipeline_exit_check()
