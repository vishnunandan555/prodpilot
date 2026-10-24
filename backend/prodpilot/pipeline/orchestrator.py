"""ProdPilot Autonomous End-to-End Orchestrator Daemon
Ties the Watcher, Repro-First Pipeline, Staging, and Decision Engine together.
Monitors SQLite DB for 'OPEN' incidents and advances them to 'AWAITING_APPROVAL'
with verified patches and active side-port canaries (8001 & 8002).
Part of Phase 2 (Stream A).
"""

import argparse
import logging
import os
import sys
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
load_dotenv()

from backend.prodpilot.agents.factory import get_agent_adapter
from backend.prodpilot.db import (
    get_incident,
    init_db,
    list_incidents,
    log_event,
    update_incident_brief,
    update_incident_status,
)
from backend.prodpilot.decide.jev import decide_jev as decide
from backend.prodpilot.pipeline.brief import create_brief
from backend.prodpilot.pipeline.github_pr_workflow import (
    create_linked_github_issue,
    post_github_issue_comment,
)
from backend.prodpilot.pipeline.repro_runner import run_repro_pipeline
from backend.prodpilot.pipeline.worktree import cleanup_stale_worktrees, remove_worktree

logger = logging.getLogger("prodpilot.orchestrator")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


def resolve_target_repo_path(custom_path: Optional[str] = None) -> str:
    """Finds the target git repository for the active service."""
    if custom_path and Path(custom_path).exists():
        return str(Path(custom_path).resolve())

    env_path = os.environ.get("TARGET_REPO_PATH") or os.environ.get("DEMO_PROD_PATH")
    if env_path and Path(env_path).exists():
        return str(Path(env_path).resolve())

    try:
        from backend.prodpilot.db import get_active_repo
        active = get_active_repo()
        if active and active.get("local_path") and Path(active["local_path"]).exists():
            return str(Path(active["local_path"]).resolve())
    except Exception as e:
        logger.warning(f"Failed to resolve active repo from DB: {e}")

    raise FileNotFoundError("No target Git repository is connected; set repo_path or configure an active project")

# Backward compatibility alias
resolve_demo_repo_path = resolve_target_repo_path

_ORCHESTRATOR_LOCK = threading.Lock()
_IN_FLIGHT_INCIDENTS: set = set()
_DISENGAGED_INCIDENTS: set = set()


def disengage_incident_pipeline(incident_id: str) -> None:
    """Signals an active remediation pipeline to halt immediately (e.g. on manual takeover)."""
    with _ORCHESTRATOR_LOCK:
        _DISENGAGED_INCIDENTS.add(incident_id)


def resume_incident_pipeline(incident_id: str) -> None:
    """Clears disengagement signal for an incident when operator resumes autonomous loop."""
    with _ORCHESTRATOR_LOCK:
        _DISENGAGED_INCIDENTS.discard(incident_id)


def is_incident_disengaged(incident_id: str, db_path: Optional[str] = None) -> bool:
    """Checks in-memory flag and persistent database status to verify if pipeline is halted."""
    with _ORCHESTRATOR_LOCK:
        if incident_id in _DISENGAGED_INCIDENTS:
            return True
    try:
        from backend.prodpilot.db import get_incident
        inc = get_incident(incident_id, db_path=db_path)
        if inc and inc.get("status") in ("MANUAL_TAKEOVER", "RESOLVED", "ROLLED_BACK", "DEPLOYED", "FAILED", "DISMISSED"):
            return True
    except Exception:
        pass
    return False


def process_incident(
    incident: Dict[str, Any],
    repo_path: Optional[str] = None,
    mock_staging: bool = False,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    """Autonomous pipeline execution for a single incident.
    
    1. Transition status to INVESTIGATING & log UNDERSTAND stage_started.
    2. Extract and persist incident brief.
    3. Transition status to FIXING and run Repro-First Pipeline.
    4. Stage canaries on side ports 8001 (fix-forward) & 8002 (rollback).
    5. Run Decision Engine to compute recommendation and probabilities.
    6. Transition status to AWAITING_APPROVAL & log awaiting_approval event.
    """
    incident_id = incident["id"]
    with _ORCHESTRATOR_LOCK:
        if incident_id in _IN_FLIGHT_INCIDENTS:
            raise RuntimeError(f"Incident {incident_id} is already being processed concurrently")
        _IN_FLIGHT_INCIDENTS.add(incident_id)

    try:
        return _run_process_incident(
            incident=incident,
            repo_path=repo_path,
            mock_staging=mock_staging,
            db_path=db_path,
        )
    finally:
        with _ORCHESTRATOR_LOCK:
            _IN_FLIGHT_INCIDENTS.discard(incident_id)
            _DISENGAGED_INCIDENTS.discard(incident_id)


def _run_process_incident(
    incident: Dict[str, Any],
    repo_path: Optional[str] = None,
    mock_staging: bool = False,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    incident_id = incident["id"]
    target_repo = resolve_demo_repo_path(repo_path)
    if not (Path(target_repo) / ".git").exists():
        raise FileNotFoundError(f"Target path is not a Git repository: {target_repo}")
    logger.info(f"Processing incident {incident_id} (service: {incident.get('service')}) in repo {target_repo}")

    # Checkpoint 0: Entry guard against processing an incident already under manual takeover / disengaged
    if is_incident_disengaged(incident_id, db_path=db_path):
        logger.info(f"Pipeline disengaged for {incident_id} at entry point.")
        return {"status": "MANUAL_TAKEOVER", "incident_id": incident_id, "disengaged": True}

    # a. Transition status to INVESTIGATING
    update_incident_status(incident_id, "INVESTIGATING", db_path=db_path)
    log_event(
        run_id=None,
        incident_id=incident_id,
        stage="UNDERSTAND",
        kind="stage_started",
        payload={"stage": "UNDERSTAND", "message": f"Analyzing incident {incident_id} root cause and git history..."},
        db_path=db_path,
    )

    # Immediately fire automated Sev-1 emergency voice escalation in parallel
    try:
        from backend.prodpilot.db import get_setting
        twilio_enabled = (get_setting("SERVICE_ENABLED_TWILIO") or "true").strip().lower() not in ("false", "0", "off", "no")
        is_sev1 = (
            (incident.get("severity") or "").lower() in ("sev1", "sev-1", "critical", "high")
            or "crash" in (incident.get("root_cause_report") or "").lower()
            or "outage" in (incident.get("title") or "").lower()
        )
        if twilio_enabled and is_sev1:
            from backend.prodpilot.integrations.twilio_client import dispatch_incident_voice_drill
            dispatch_incident_voice_drill(incident, db_path=db_path)
    except Exception as e:
        logger.warning(f"Could not trigger Twilio emergency voice escalation: {e}")

    # Immediately create GitHub Issue when diagnosis starts
    try:
        create_linked_github_issue(incident=incident, brief=None, repo_path=target_repo, db_path=db_path)
    except Exception as e:
        logger.warning(f"Could not create initial GitHub issue: {e}")

    # b. Extract brief
    brief = create_brief(incident)
    update_incident_brief(incident_id, brief, db_path=db_path)
    logger.info(f"Generated brief: {brief['summary']} (suspect: {brief['suspected_area']})")

    # Post Milestone Comment 1: Root Cause Analysis Report
    try:
        from backend.prodpilot.integrations.telegram_client import generate_natural_incident_explanation
        suspect_commit = incident.get("suspect_commit") or brief.get("introduced_by") or "HEAD~1"
        suspect_area = brief.get("suspected_area") or "codebase"
        raw_trace = (incident.get("trace") or incident.get("error_trace") or "No trace").strip()
        natural_issue = generate_natural_incident_explanation(brief=brief, trace=raw_trace)
        rca_comment = f"""### Root Cause Investigation

- **Service**: `{incident.get('service', 'production-service')}`
- **Severity**: `{incident.get('severity', 'sev2').upper()}`
- **Suspect Commit**: `{suspect_commit}`
- **Suspect Location**: `{suspect_area}`
- **Summary**: {brief.get('summary')}

#### Analysis
{natural_issue}

#### Stack Trace
```text
{raw_trace[:800]}
```

*Isolated worktree created to reproduce the failure with targeted test case.*
"""
        post_github_issue_comment(incident_id, rca_comment, repo_path=target_repo, db_path=db_path)
    except Exception as e:
        logger.warning(f"Could not post GitHub RCA comment: {e}")

    # Dispatch Stage 2 Telegram Alert (Incident Created / Analysis Complete -> Remediation Start)
    try:
        from backend.prodpilot.integrations.telegram_client import send_stage2_rca_plan_alert
        send_stage2_rca_plan_alert(
            incident_id=incident_id,
            service_name=incident.get("service", "production-service"),
            summary=brief.get("summary", ""),
            suspect_commit=incident.get("suspect_commit"),
            suspected_area=brief.get("suspected_area"),
            brief=brief,
            trace=incident.get("trace"),
        )
    except Exception as e:
        logger.warning(f"Telegram stage 2 alert error: {e}")


    # Checkpoint 1: Check if incident was disengaged before running agent repro & fix
    if is_incident_disengaged(incident_id, db_path=db_path):
        logger.info(f"Pipeline disengaged for {incident_id} before repro-and-fix stage.")
        return {"status": "MANUAL_TAKEOVER", "incident_id": incident_id, "disengaged": True}

    # c. Transition status to FIXING and run repro pipeline
    update_incident_status(incident_id, "FIXING", db_path=db_path)
    adapter = get_agent_adapter()
    pipeline_res = run_repro_pipeline(
        incident=incident,
        repo_path=target_repo,
        agent_adapter=adapter,
        db_path=db_path,
    )

    if not pipeline_res.ok:
        logger.error(f"Repro pipeline failed for {incident_id}: {pipeline_res.error}")
        if pipeline_res.worktree_path:
            remove_worktree(pipeline_res.worktree_path, repo_path=target_repo)
        update_incident_status(incident_id, "FAILED", db_path=db_path)
        log_event(
            run_id=pipeline_res.run_id,
            incident_id=incident_id,
            stage="FIX",
            kind="error",
            payload={"error": pipeline_res.error or "Failed test verification after retries"},
            db_path=db_path,
        )
        return {"status": "FAILED", "incident_id": incident_id, "error": pipeline_res.error}

    logger.info(f"Verified fix for {incident_id}. Evidence: before={pipeline_res.test_evidence.get('before')}, after={pipeline_res.test_evidence.get('after')}")

    # Post Milestone Comment 2: Fix Generation & Test Repro
    try:
        from backend.prodpilot.integrations.telegram_client import generate_natural_fix_explanation
        before_log = (pipeline_res.test_evidence.get('before') or 'FAILED').strip()[:600]
        after_log = (pipeline_res.test_evidence.get('after') or 'PASSED').strip()[:600]
        natural_fix = generate_natural_fix_explanation(
            patch_diff=pipeline_res.patch_diff,
            brief=brief,
            suspected_area=brief.get("suspected_area"),
        )
        fix_comment = f"""### Reproduction & Fix Verification

The failure was reproduced in an isolated worktree and verified against the candidate patch.

#### Changes
{natural_fix}

#### Test Results
- **Baseline (Before Fix)**: FAILED
```text
{before_log}
```
- **Patch (After Fix)**: PASSED
```text
{after_log}
```

*Deploying side-by-side canaries on port 8001 (fix-forward) and port 8002 (rollback) for verification.*
"""
        post_github_issue_comment(incident_id, fix_comment, repo_path=target_repo, db_path=db_path)
    except Exception as e:
        logger.warning(f"Could not post GitHub fix verification comment: {e}")

    # Checkpoint 2: Check if incident was disengaged before spinning up canaries
    if is_incident_disengaged(incident_id, db_path=db_path):
        logger.info(f"Pipeline disengaged for {incident_id} before canary staging. Preserving worktree {pipeline_res.worktree_path}.")
        log_event(
            run_id=pipeline_res.run_id,
            incident_id=incident_id,
            stage="TAKEOVER",
            kind="pipeline_disengaged",
            payload={
                "message": f"Autonomous remediation halted: Preserving worktree {pipeline_res.worktree_path} for engineer inspection.",
                "worktree_path": pipeline_res.worktree_path,
            },
            db_path=db_path,
        )
        return {"status": "MANUAL_TAKEOVER", "incident_id": incident_id, "disengaged": True, "worktree_path": pipeline_res.worktree_path}

    # d. Stage Canaries (8001 & 8002)
    log_event(
        run_id=pipeline_res.run_id,
        incident_id=incident_id,
        stage="STAGE",
        kind="stage_started",
        payload={"stage": "STAGE", "message": "Spinning up side-port canary instances (8001 & 8002)..."},
        db_path=db_path,
    )

    from backend.prodpilot.staging.manager import StagingManager
    staging_mgr = StagingManager(repo_path=target_repo)
    suspect_hash = brief.get("introduced_by") or "HEAD~1"

    # Stage fix-forward on 8001
    staging_mgr.stage_fix_forward(
        patched_worktree=pipeline_res.worktree_path,
        port=8001,
        mock_mode=mock_staging,
    )

    # Stage rollback on 8002
    staging_mgr.stage_rollback(
        suspect_commit=suspect_hash,
        port=8002,
        mock_mode=mock_staging,
    )

    staging_status = staging_mgr.get_status()
    logger.info(f"Canary status: fix_forward={staging_status['fix_forward']}, rollback={staging_status['rollback']}")

    if not any(
        staging_status.get(option, {}).get("health") is True
        for option in ("fix_forward", "rollback")
    ):
        staging_mgr.stop_all()
        update_incident_status(incident_id, "FAILED", db_path=db_path)
        log_event(
            run_id=pipeline_res.run_id,
            incident_id=incident_id,
            stage="STAGE",
            kind="error",
            payload={"error": "Both fix-forward and rollback canaries failed health checks; approval is blocked."},
            db_path=db_path,
        )
        return {"status": "FAILED", "incident_id": incident_id, "error": "No healthy recovery canary"}

    # e. Run Decision Engine
    log_event(
        run_id=pipeline_res.run_id,
        incident_id=incident_id,
        stage="DECIDE",
        kind="stage_started",
        payload={"stage": "DECIDE", "message": "Evaluating diff size, commit recency, and canary health..."},
        db_path=db_path,
    )

    decision = decide(
        incident=incident,
        staging_status=staging_status,
        patch_diff=pipeline_res.patch_diff,
        run_id=pipeline_res.run_id,
        db_path=db_path,
    )

    log_event(
        run_id=pipeline_res.run_id,
        incident_id=incident_id,
        stage="DECIDE",
        kind="decision",
        payload=decision,
        db_path=db_path,
    )
    logger.info(f"Decision: {decision['recommendation']} ({decision['probabilities']}) - {decision['reason']}")

    # Post Milestone Comment 3: Fix & Verification Report
    try:
        ff_ok = staging_status.get('fix_forward', {}).get('health', False)
        rb_ok = staging_status.get('rollback', {}).get('health', False)
        prob_ff = int((decision.get('probabilities') or {}).get('fix_forward', 0) * 100)
        prob_rb = int((decision.get('probabilities') or {}).get('rollback', 0) * 100)
        decision_comment = f"""### Canary Validation & Recommendation

- **Fix-Forward Canary (port 8001)**: `{'HEALTHY' if ff_ok else 'FAILED'}`
- **Rollback Canary (port 8002)**: `{'HEALTHY' if rb_ok else 'FAILED'}`
- **Recommended Action**: `{decision.get('recommendation', 'fix_forward').upper()}`
- **Confidence Score**: `{prob_ff}%`
- **Rationale**: {decision.get('reason')}

*Pull request opened. System is in standby awaiting engineer approval on the dashboard.*
"""
        post_github_issue_comment(incident_id, decision_comment, repo_path=target_repo, db_path=db_path)
    except Exception as e:
        logger.warning(f"Could not post GitHub decision comment: {e}")

    # Checkpoint 3: Check if incident was disengaged before opening GitHub PR
    if is_incident_disengaged(incident_id, db_path=db_path):
        logger.info(f"Pipeline disengaged for {incident_id}; skipping PR creation and review comments.")
        return {"status": "MANUAL_TAKEOVER", "incident_id": incident_id, "disengaged": True}

    # Open a review PR from the verified patch in an isolated worktree. The helper
    # never merges; the PR remains a review artifact until a separate provider flow exists.
    pr_result: Dict[str, Any] = {"ok": False, "error": "GitHub PR was not prepared"}
    try:
        from backend.prodpilot.pipeline.github_pr_workflow import execute_github_pr_lifecycle
        pr_result = execute_github_pr_lifecycle(
            incident_id=incident_id,
            action="fix_forward",
            repo_path=target_repo,
            patch_diff=pipeline_res.patch_diff,
            source="remediation_pipeline",
            db_path=db_path,
        )
    except Exception as exc:
        logger.exception("Could not prepare GitHub PR for incident %s", incident_id)
        pr_result = {"ok": False, "error": str(exc)}
    log_event(
        run_id=pipeline_res.run_id,
        incident_id=incident_id,
        stage="FIX",
        kind="pr_prepared" if pr_result.get("ok") else "pr_preparation_failed",
        payload=pr_result,
        db_path=db_path,
    )

    # Checkpoint 4: Guard against overwriting MANUAL_TAKEOVER status
    if is_incident_disengaged(incident_id, db_path=db_path):
        logger.info(f"Incident {incident_id} disengaged; preserving current status and skipping AWAITING_APPROVAL.")
        return {"status": "MANUAL_TAKEOVER", "incident_id": incident_id, "disengaged": True}

    # f. Transition status to AWAITING_APPROVAL
    update_incident_status(incident_id, "AWAITING_APPROVAL", db_path=db_path)
    log_event(
        run_id=pipeline_res.run_id,
        incident_id=incident_id,
        stage="AWAIT_APPROVAL",
        kind="awaiting_approval",
        payload={
            "recommendation": decision["recommendation"],
            "github_pr": {
                "ok": pr_result.get("ok", False),
                "url": pr_result.get("pr_url"),
                "number": pr_result.get("pr_number"),
                "branch": pr_result.get("branch"),
                "merged": False,
                "error": pr_result.get("error"),
            },
            "options": {
                "fix_forward": {
                    "port": 8001,
                    "health_ok": staging_status.get("fix_forward", {}).get("health", False),
                    "diff_stats": f"+{len(pipeline_res.patch_diff.splitlines())} lines",
                },
                "rollback": {
                    "port": 8002,
                    "health_ok": staging_status.get("rollback", {}).get("health", False),
                    "revert_commit": suspect_hash,
                },
            },
        },
        db_path=db_path,
    )

    # Dispatch Stage 3 Telegram Alert (Fix Verified, Canaries Active, The Gate / Awaiting Operator Approval)
    try:
        from backend.prodpilot.integrations.telegram_client import send_stage3_approval_alert
        send_stage3_approval_alert(
            incident_id=incident_id,
            service_name=incident.get("service", "production-service"),
            diff_stats=f"+{len(pipeline_res.patch_diff.splitlines())} lines modified",
            patch_diff=pipeline_res.patch_diff,
            decision=decision,
            test_evidence=pipeline_res.test_evidence,
            staging_status=staging_status,
            brief=brief,
            suspected_area=brief.get("suspected_area"),
        )
    except Exception as e:
        logger.warning(f"Telegram stage 3 alert error: {e}")

    return {
        "status": "AWAITING_APPROVAL",
        "incident_id": incident_id,
        "run_id": pipeline_res.run_id,
        "brief": brief,
        "patch_diff": pipeline_res.patch_diff,
        "decision": decision,
        "staging": staging_status,
        "staging_manager": staging_mgr,
    }


def run_orchestrator(
    poll_interval: float = 2.0,
    once: bool = False,
    repo_path: Optional[str] = None,
    mock_staging: bool = False,
    db_path: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Polls database for 'OPEN' incidents and processes them."""
    init_db(db_path=db_path)
    logger.info(f"ProdPilot Orchestrator started (poll_interval={poll_interval}s, once={once})")

    # Clean any stale or dead-process worktrees on startup
    target_clean_repo = repo_path or os.getcwd()
    try:
        pruned = cleanup_stale_worktrees(target_clean_repo)
        if pruned:
            logger.info(f"Orchestrator pruned {len(pruned)} stale worktree(s) on startup")
    except Exception as e:
        logger.debug(f"Startup worktree prune notice: {e}")

    processed = []
    try:
        while True:
            open_incidents = list_incidents(status="OPEN", db_path=db_path)
            if open_incidents:
                logger.info(f"Found {len(open_incidents)} OPEN incident(s) needing resolution.")
                for inc in open_incidents:
                    try:
                        res = process_incident(
                            incident=inc,
                            repo_path=repo_path,
                            mock_staging=mock_staging,
                            db_path=db_path,
                        )
                        processed.append(res)
                    except Exception as e:
                        logger.exception(f"Unhandled error processing incident {inc.get('id')}: {e}")
                        update_incident_status(inc["id"], "FAILED", db_path=db_path)

            if once:
                break
            time.sleep(poll_interval)
    except KeyboardInterrupt:
        logger.info("Orchestrator stopped by operator.")

    return processed


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ProdPilot Autonomous Orchestrator")
    parser.add_argument("--daemon", action="store_true", help="Run in continuous background polling daemon mode")
    parser.add_argument("--once", action="store_true", help="Process current open incidents and exit")
    parser.add_argument("--poll-interval", type=float, default=2.0, help="Poll interval in seconds")
    parser.add_argument("--repo-path", type=str, default=None, help="Custom path to target service git repository")
    parser.add_argument("--mock-staging", action="store_true", help="Run staging in mock mode (useful for testing)")
    args = parser.parse_args()

    is_once = args.once or (not args.daemon)
    run_orchestrator(
        poll_interval=args.poll_interval,
        once=is_once,
        repo_path=args.repo_path,
        mock_staging=args.mock_staging,
    )
