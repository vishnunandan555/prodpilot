#!/usr/bin/env python3
"""Done Check Test Script: 10-Second Watchdog and Automatic Emergency Rollback
Simulates a deploy of a deliberately broken build, runs the 10-second watchdog,
and asserts that the watchdog detects the failure, triggers the automatic rollback
to the healthy build, and marks the incident status as AUTO_REVERTED.
Part of Stream B: Laptop Fixing, Context & Safety Guard.
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import httpx

from backend.prodpilot.db import (
    create_incident,
    get_events,
    get_incident,
    init_db,
)
from backend.prodpilot.staging.deploy import (
    DeployAdapter,
    approve_incident,
    get_remediation_attempts,
)


def run_git(cmd: list, cwd: str) -> str:
    """Helper to run git command."""
    res = subprocess.run(["git", *cmd], cwd=cwd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"Git command failed: git {' '.join(cmd)}\nStderr: {res.stderr}")
    return res.stdout.strip()


def cleanup_port(port: int = 8000):
    """Terminates any process bound to the specified port."""
    try:
        cmd = f"lsof -ti:{port} | xargs -r kill -9"
        subprocess.run(cmd, shell=True, capture_output=True, text=True)
        time.sleep(0.5)
    except Exception:
        pass


def main():
    print("=" * 70)
    print("PRODPILOT STREAM B: 10-SECOND SAFETY WATCHDOG & AUTO-REVERT TEST")
    print("=" * 70)

    temp_dir = tempfile.mkdtemp(prefix="prodpilot-watchdog-test-")
    test_db_path = os.path.join(temp_dir, "test_prodpilot.db")
    prod_port = 8000
    incident_id = "inc-broken-watchdog-001"

    cleanup_port(prod_port)

    try:
        # 1. Initialize test database
        print("\n[Step 1] Initializing test database...")
        init_db(db_path=test_db_path)
        create_incident(
            incident_id=incident_id,
            service="order-service",
            detected_at="2026-10-23T18:00:00Z",
            status="AWAITING_APPROVAL",
            db_path=test_db_path,
        )
        inc = get_incident(incident_id, db_path=test_db_path)
        assert inc is not None, "Failed to create test incident in SQLite"
        print(f"  ✓ Incident {incident_id} created with status '{inc['status']}'")

        # 2. Build local git repository with known-good healthy commit
        print("\n[Step 2] Setting up git repository with healthy baseline build...")
        repo_dir = os.path.join(temp_dir, "order-service")
        os.makedirs(repo_dir, exist_ok=True)

        run_git(["init", "-b", "main"], cwd=repo_dir)
        run_git(["config", "user.name", "ProdPilot Safety Guard"], cwd=repo_dir)
        run_git(["config", "user.email", "safety@prodpilot.io"], cwd=repo_dir)

        healthy_app_code = """from fastapi import FastAPI
app = FastAPI(title="Order Total Service")

@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0-healthy"}

@app.get("/")
def index():
    return {"message": "Service Healthy"}
"""
        with open(os.path.join(repo_dir, "app.py"), "w", encoding="utf-8") as f:
            f.write(healthy_app_code)

        run_git(["add", "app.py"], cwd=repo_dir)
        run_git(["commit", "-m", "feat: initial healthy production service"], cwd=repo_dir)
        healthy_sha = run_git(["rev-parse", "HEAD"], cwd=repo_dir)
        print(f"  ✓ Known-good baseline commit established: {healthy_sha[:8]}")

        # 3. Create deliberately broken patch
        print("\n[Step 3] Crafting deliberately broken patch...")
        broken_app_code = """from fastapi import FastAPI, HTTPException
app = FastAPI(title="Order Total Service")

@app.get("/health")
def health():
    # Deliberate failure simulating internal fatal defect post-deploy
    raise HTTPException(status_code=500, detail="Fatal: Database connection pool corrupted")

@app.get("/")
def index():
    raise HTTPException(status_code=500, detail="Service Broken")
"""
        # Calculate broken worktree
        broken_worktree = os.path.join(temp_dir, "broken-worktree")
        os.makedirs(broken_worktree, exist_ok=True)
        with open(os.path.join(broken_worktree, "app.py"), "w", encoding="utf-8") as f:
            f.write(broken_app_code)

        print(f"  ✓ Staged broken worktree created at {broken_worktree}")

        # 4. Deploy broken build and execute watchdog
        print("\n[Step 4] Deploying broken build & launching 10-second watchdog...")
        os.environ["PROD_PORT"] = str(prod_port)
        os.environ["DEMO_PROD_PATH"] = repo_dir

        deploy_result = approve_incident(
            incident_id=incident_id,
            action="fix",
            repo_path=repo_dir,
            source="desktop_ui",
            db_path=test_db_path,
            mock_mode=False,
            async_watchdog=False,  # Run synchronously for test verification
            patched_worktree=broken_worktree,
        )

        print(f"  ✓ Deploy finished. Result: status={deploy_result.get('status')}")

        # 5. Assertions
        print("\n[Step 5] Verifying Safety Guard and Auto-Revert assertions...")

        # Assertion 1: Deploy result reports AUTO_REVERTED
        assert deploy_result.get("status") == "AUTO_REVERTED", (
            f"Expected deploy status 'AUTO_REVERTED', got '{deploy_result.get('status')}'"
        )
        print("  ✓ Assertion 1 passed: Deploy result status is 'AUTO_REVERTED'")

        # Assertion 2: Incident status in SQLite is AUTO_REVERTED
        updated_inc = get_incident(incident_id, db_path=test_db_path)
        assert updated_inc is not None, "Incident record disappeared"
        assert updated_inc["status"] == "AUTO_REVERTED", (
            f"Expected SQLite incident status 'AUTO_REVERTED', got '{updated_inc['status']}'"
        )
        print("  ✓ Assertion 2 passed: SQLite incident status updated to 'AUTO_REVERTED'")

        # Assertion 3: Audit event logged with failure reason
        events = get_events(incident_id=incident_id, db_path=test_db_path)
        revert_events = [e for e in events if e.get("kind") == "auto_reverted"]
        assert len(revert_events) >= 1, "Expected at least 1 'auto_reverted' audit event in SQLite"
        payload = revert_events[0].get("payload", {})
        if isinstance(payload, str):
            payload = json.loads(payload)
        assert "failure_reason" in payload, "Missing 'failure_reason' in auto_reverted payload"
        print(f"  ✓ Assertion 3 passed: Audit event logged failure: '{payload['failure_reason'][:50]}...'")

        # Assertion 4: Git HEAD is restored to the healthy commit
        current_head = run_git(["rev-parse", "HEAD"], cwd=repo_dir)
        assert current_head == healthy_sha, (
            f"Git HEAD ({current_head[:8]}) did not revert to healthy baseline ({healthy_sha[:8]})"
        )
        print(f"  ✓ Assertion 4 passed: Git HEAD restored to healthy commit {healthy_sha[:8]}")

        # Assertion 5: Production service is restored on port 8000 and answers 200 OK
        time.sleep(1.0)
        try:
            with httpx.Client(timeout=3.0) as client:
                health_resp = client.get(f"http://127.0.0.1:{prod_port}/health")
                assert health_resp.status_code == 200, (
                    f"Restored service health returned {health_resp.status_code}, expected 200"
                )
                print(f"  ✓ Assertion 5 passed: Restored service on port {prod_port} returned 200 OK ({health_resp.json()})")
        except Exception as e:
            raise AssertionError(f"Failed to query restored service on port {prod_port}: {e}")

        # 6. Verify Strict Remediation Attempt Cap (Max 1 attempt before ESCALATED)
        print("\n[Step 6] Verifying Remediation Attempt Cap (Max 1 attempt)...")
        cap_result = approve_incident(
            incident_id=incident_id,
            action="fix",
            repo_path=repo_dir,
            source="desktop_ui",
            db_path=test_db_path,
            mock_mode=False,
            async_watchdog=False,
            patched_worktree=broken_worktree,
        )
        assert cap_result.get("status") == "ESCALATED", (
            f"Expected status 'ESCALATED' on retry, got '{cap_result.get('status')}'"
        )
        escalated_inc = get_incident(incident_id, db_path=test_db_path)
        assert escalated_inc["status"] == "ESCALATED", (
            f"Expected SQLite incident status 'ESCALATED', got '{escalated_inc['status']}'"
        )
        print("  ✓ Step 6 passed: Attempt cap strictly enforced. Second remediation escalated to on-call.")

        print("\n" + "=" * 70)
        print("ALL WATCHDOG SAFETY & AUTO-REVERT ASSERTIONS PASSED CLEANLY (EXIT 0)!")
        print("=" * 70)

    finally:
        print("\nCleaning up test processes and temporary files...")
        cleanup_port(prod_port)
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
