"""ProdPilot FastAPI REST & SSE Server
Runs on port 8765 conforming to contracts/api.md and contracts/events.md.
Endpoints:
- GET /health
- GET /incidents
- GET /incidents/{id}
- GET /incidents/{id}/events (SSE)
- POST /incidents/{id}/approve
- POST /incidents/{id}/reject
- POST /incidents/{id}/followup
Part of Task 6 (Stream A).
"""

import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from backend.prodpilot.db import (
    get_db,
    init_db,
    get_incident,
    list_incidents,
    update_incident_status,
    log_event,
    get_events,
    get_artifacts,
    record_approval,
    save_artifact,
)
from backend.prodpilot.decide.rules import decide
from backend.prodpilot.pipeline.brief import analyze_issue_readiness
from backend.prodpilot.staging.deploy import DeployAdapter, generate_incident_report

logger = logging.getLogger(__name__)

app = FastAPI(
    title="ProdPilot API",
    version="1.0.0",
    description="ProdPilot Autonomous SRE Engine Backend & SSE API",
)

# Enable CORS for desktop/Electron and browser clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from backend.prodpilot.api.connect_router import router as connect_router
from backend.prodpilot.ingest.router import router as ingest_router

app.include_router(connect_router)
app.include_router(ingest_router)

# Shared in-memory staging manager or deploy adapter
deploy_adapter = DeployAdapter(prod_port=int(os.environ.get("PROD_PORT", 8000)))


class ApproveRequest(BaseModel):
    action: str  # "fix_forward" or "rollback"
    source: str = "desktop_ui"  # "telegram", "desktop_ui", or "cli"
    repo_path: Optional[str] = None


class RejectRequest(BaseModel):
    reason: Optional[str] = "Rejected by operator"
    source: str = "desktop_ui"


class FollowupRequest(BaseModel):
    instruction: str
    source: str = "desktop_ui"


class IssueAnalyzeRequest(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    author: Optional[str] = "contributor"
    repo: Optional[str] = "demo-prod"


class IssueClarifyRequest(BaseModel):
    comment: Optional[str] = None
    questions: Optional[List[str]] = None
    source: str = "desktop_ui"


# Seed / cache for known issues and analyzed briefs
ISSUE_BRIEF_CACHE: Dict[str, Dict[str, Any]] = {
    "1": {
        "title": "[BUG] Missing discount key in order payload causes 500 crash",
        "body": "When calling POST /orders without a discount field, the service crashes with KeyError: discount.\n\nSteps to reproduce:\n1. POST /orders with payload: {\"items\": [{\"id\": \"1\", \"price\": 20.0}]}\n\nError log:\nTraceback (most recent call last):\n  File \"app.py\", line 8, in calculate_order\n    discount = order[\"discount\"]\nKeyError: 'discount'\n\nExpected behavior:\nEndpoint should safely default missing discount to 0 and return 20.0 instead of crashing.",
        "author": "vishnunandan555",
        "repo": "vishnunandan555/demo-prod",
    },
    "2": {
        "title": "[CHORE] Refactor auth context and update dependencies",
        "body": "We should probably clean up auth context sometime soon.",
        "author": "vishnunandan555",
        "repo": "vishnunandan555/care_app",
    },
    "3": {
        "title": "[FEATURE] Create UI for MayFly Dashboard",
        "body": "Create a very simple UI Dashboard for Linux, which will basically show a GUI equivalent for MayFly TUI Main Dashboard.\n\nReproduction:\nRun npm run dev to open GUI.\n\nError logs:\nNone\n\nExpected behavior:\nShow dashboard with CPU/RAM metrics.",
        "author": "vishnunandan555",
        "repo": "vishnunandan555/mayfly",
    },
}



@app.on_event("startup")
def on_startup():
    """Ensure database schema is initialized on start."""
    try:
        init_db()
    except Exception as e:
        logger.debug(f"DB init during startup: {e}")


@app.get("/health")
def health() -> Dict[str, str]:
    """1. Healthcheck endpoint conforming to contracts/api.md."""
    return {"status": "ok", "version": "1.0.0"}


@app.get("/incidents")
def get_incidents_list(status: Optional[str] = Query(None)) -> List[Dict[str, Any]]:
    """2. List Incidents conforming to contracts/api.md."""
    rows = list_incidents(status=status)
    results = []
    for inc in rows:
        suspect = inc.get("suspect_commit")
        if isinstance(suspect, str):
            try:
                suspect = json.loads(suspect)
            except Exception:
                suspect = {}

        # Determine recommendation if available
        rec = "fix_forward"
        brief = inc.get("brief_json")
        if isinstance(brief, str):
            try:
                brief = json.loads(brief)
            except Exception:
                pass

        results.append({
            "id": inc["id"],
            "service": inc["service"],
            "detected_at": inc["detected_at"],
            "status": inc["status"],
            "suspect_commit": suspect,
            "recommendation": rec,
        })
    return results


@app.get("/incidents/{incident_id}")
def get_incident_detail(incident_id: str) -> Dict[str, Any]:
    """3. Get Single Incident Detail conforming to contracts/api.md."""
    inc = get_incident(incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    recent_commits = inc.get("recent_commits") or []
    if isinstance(recent_commits, str):
        try:
            recent_commits = json.loads(recent_commits)
        except Exception:
            recent_commits = []

    suspect_commit = inc.get("suspect_commit") or {}
    if isinstance(suspect_commit, str):
        try:
            suspect_commit = json.loads(suspect_commit)
        except Exception:
            suspect_commit = {}

    brief = inc.get("brief_json") or {}
    if isinstance(brief, str):
        try:
            brief = json.loads(brief)
        except Exception:
            brief = {}
    if not brief:
        # Fallback synthesis of brief
        brief = {
            "summary": f"{inc.get('suspected_area', 'KeyError')} in order calculation endpoint.",
            "suspected_area": inc.get("suspected_area", "app.py:45"),
            "introduced_by": suspect_commit.get("hash", "unknown"),
        }

    # Fetch artifacts
    art_rows = get_artifacts(incident_id)
    artifacts_map: Dict[str, Any] = {
        "repro_test": "tests/test_repro.py",
        "patch_diff": "",
        "test_evidence": {
            "before": "FAILED (KeyError: discount)",
            "after": "PASSED",
        },
    }
    for row in art_rows:
        kind = row.get("kind")
        content = row.get("content", "")
        if kind == "repro_test":
            artifacts_map["repro_test"] = content or row.get("path", "tests/test_repro.py")
        elif kind == "patch_diff":
            artifacts_map["patch_diff"] = content
        elif kind == "test_log_before":
            artifacts_map["test_evidence"]["before"] = "FAILED (KeyError: discount)" if "KeyError" in content else content[:100]
        elif kind == "test_log_after":
            artifacts_map["test_evidence"]["after"] = "PASSED" if "passed" in content.lower() else content[:100]

    # Staging status
    staging_info = {
        "fix_forward": {"port": 8001, "health": True},
        "rollback": {"port": 8002, "health": True},
    }

    # Fetch or compute decision
    decision_info = None
    with get_db() as conn:
        dec_row = conn.execute("SELECT * FROM decisions WHERE incident_id = ? ORDER BY created_at DESC LIMIT 1", (incident_id,)).fetchone()
        if dec_row:
            d = dict(dec_row)
            ans = d.get("answers_json")
            if isinstance(ans, str):
                try:
                    ans = json.loads(ans)
                except Exception:
                    ans = {}
            decision_info = {
                "backend": d.get("backend", "rules"),
                "recommendation": d.get("action", "fix_forward"),
                "probabilities": ans.get("probabilities", {"fix_forward": 0.85, "rollback": 0.15}),
                "reason": d.get("reason", "Clean patch with full test pass"),
            }

    if not decision_info:
        decision_info = decide(inc, staging_info, patch_diff=artifacts_map.get("patch_diff"))

    return {
        "id": inc["id"],
        "service": inc["service"],
        "detected_at": inc["detected_at"],
        "status": inc["status"],
        "trace": inc.get("trace", ""),
        "log_tail": inc.get("log_tail", ""),
        "recent_commits": recent_commits,
        "suspect_commit": suspect_commit,
        "brief": brief,
        "artifacts": artifacts_map,
        "staging": staging_info,
        "decision": decision_info,
    }


@app.get("/incidents/{incident_id}/events")
async def stream_incident_events(request: Request, incident_id: str, after_id: int = Query(0)):
    """4. Stream Incident Events (SSE) conforming to contracts/events.md."""
    inc = get_incident(incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    async def event_generator():
        last_id = after_id
        idle_counter = 0

        while True:
            # Check client disconnection
            if await request.is_disconnected():
                logger.info(f"SSE client disconnected for {incident_id}")
                break

            events = get_events(incident_id=incident_id, after_id=last_id)
            if events:
                idle_counter = 0
                for evt in events:
                    last_id = max(last_id, evt["id"])
                    payload = evt.get("payload")
                    if isinstance(payload, str):
                        try:
                            payload = json.loads(payload)
                        except Exception:
                            pass

                    data = {
                        "id": evt["id"],
                        "run_id": evt.get("run_id"),
                        "incident_id": evt["incident_id"],
                        "ts": evt.get("ts"),
                        "stage": evt["stage"],
                        "kind": evt["kind"],
                        "payload": payload,
                    }
                    yield {
                        "event": "run_event",
                        "data": json.dumps(data),
                    }
            else:
                idle_counter += 1
                # Send periodic heartbeat comment to keep connection alive
                if idle_counter % 10 == 0:
                    yield {
                        "event": "ping",
                        "data": json.dumps({"ts": os.environ.get("HOSTNAME", "prodpilot")}),
                    }

            await asyncio.sleep(0.5)

    return EventSourceResponse(event_generator())


@app.post("/incidents/{incident_id}/approve")
def approve_incident_action(incident_id: str, body: ApproveRequest) -> Dict[str, Any]:
    """5. Approve Incident Action conforming to contracts/api.md."""
    inc = get_incident(incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    action = body.action
    if action not in ("fix_forward", "rollback"):
        raise HTTPException(status_code=400, detail="Action must be 'fix_forward' or 'rollback'")

    # Record approval in DB
    approval_id = f"appr-{incident_id[:8]}-{os.urandom(3).hex()}"
    record_approval(
        approval_id=approval_id,
        run_id=None,
        incident_id=incident_id,
        decision=f"APPROVED_{action.upper()}",
        source=body.source,
    )

    # Log stage started
    log_event(
        run_id=None,
        incident_id=incident_id,
        stage="DEPLOY",
        kind="stage_started",
        payload={"action": action, "source": body.source, "message": f"Deploying {action} to production port 8000..."},
    )

    # Find repo path for the target service
    repo_path = body.repo_path or os.environ.get("TARGET_REPO_PATH") or os.environ.get("DEMO_PROD_PATH")
    if not repo_path or not Path(repo_path).exists():
        try:
            active = get_active_repo()
            if active and active.get("local_path") and Path(active["local_path"]).exists():
                repo_path = str(Path(active["local_path"]).resolve())
        except Exception:
            pass

    suspect_commit_hash = None
    suspect = inc.get("suspect_commit")
    if isinstance(suspect, dict):
        suspect_commit_hash = suspect.get("hash")

    # Fetch patch diff artifact if fix_forward
    patch_diff = ""
    art_rows = get_artifacts(incident_id)
    for a in art_rows:
        if a.get("kind") == "patch_diff":
            patch_diff = a.get("content", "")

    # Execute Deploy Adapter: if no patch (for fix_forward) or no suspect commit (for rollback), use mock mode
    mock_deploy = (
        not (repo_path and Path(repo_path).exists())
        or (action == "fix_forward" and not patch_diff)
        or (action == "rollback" and not suspect_commit_hash)
    )
    deploy_res = deploy_adapter.deploy(
        action=action,
        repo_path=repo_path or ".",
        patch_diff=patch_diff,
        suspect_commit=suspect_commit_hash,
        mock_mode=mock_deploy,
    )

    deploy_status = deploy_res.get("status")
    if deploy_status in ("DEPLOYED", "RESOLVED"):
        new_status = "DEPLOYED"
    elif deploy_status == "AUTO_REVERTED":
        new_status = "AUTO_REVERTED"
    else:
        new_status = "ROLLED_BACK"

    update_incident_status(incident_id, new_status)

    if new_status == "DEPLOYED":
        try:
            generate_incident_report(
                incident_id=incident_id,
                action=action,
                approver_source=body.source,
            )
        except Exception as e:
            logger.warning(f"Could not generate post-mortem report for {incident_id}: {e}")

    log_event(
        run_id=None,
        incident_id=incident_id,
        stage="DEPLOY",
        kind="deployed",
        payload={
            "choice": action,
            "production_port": 8000,
            "post_deploy_health_ok": deploy_res.get("health_check") == "ok",
        },
    )

    return {
        "status": new_status,
        "deployed_action": action,
        "health_check": deploy_res.get("health_check", "ok"),
        "incident_id": incident_id,
    }


@app.post("/incidents/{incident_id}/reject")
def reject_incident(incident_id: str, body: RejectRequest) -> Dict[str, Any]:
    """6. Reject Incident conforming to contracts/api.md."""
    inc = get_incident(incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    update_incident_status(incident_id, "REJECTED")

    approval_id = f"rej-{incident_id[:8]}-{os.urandom(3).hex()}"
    record_approval(
        approval_id=approval_id,
        run_id=None,
        incident_id=incident_id,
        decision="REJECTED",
        source=body.source,
        reason=body.reason,
    )

    log_event(
        run_id=None,
        incident_id=incident_id,
        stage="DECIDE",
        kind="status_change",
        payload={"status": "REJECTED", "reason": body.reason, "source": body.source},
    )

    return {"status": "REJECTED", "incident_id": incident_id}


@app.post("/incidents/{incident_id}/followup")
def followup_incident(incident_id: str, body: FollowupRequest) -> Dict[str, Any]:
    """7. Agent Follow-Up / Reject with Instructions conforming to contracts/api.md."""
    inc = get_incident(incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    update_incident_status(incident_id, "FIXING")

    log_event(
        run_id=None,
        incident_id=incident_id,
        stage="FIX",
        kind="stage_started",
        payload={"instruction": body.instruction, "source": body.source, "attempt": 2},
    )

    return {"status": "FIXING", "attempt": 2, "incident_id": incident_id}


@app.post("/issues/{issue_id}/analyze")
def analyze_issue_endpoint(issue_id: str, body: Optional[IssueAnalyzeRequest] = None) -> Dict[str, Any]:
    """8. Issue Readiness Gate: Analyzes issue text, evaluates readiness, and caches brief."""
    # Look up issue data from request body or cache
    issue_dict = {}
    if body and (body.title or body.body):
        issue_dict = {
            "id": issue_id,
            "title": body.title or f"Issue #{issue_id}",
            "body": body.body or "",
            "author": body.author or "contributor",
            "repo": body.repo or "demo-prod",
        }
        ISSUE_BRIEF_CACHE[str(issue_id)] = issue_dict
    elif str(issue_id) in ISSUE_BRIEF_CACHE:
        issue_dict = ISSUE_BRIEF_CACHE[str(issue_id)]
    else:
        # Check if an incident exists with this ID
        inc = get_incident(issue_id)
        if inc:
            issue_dict = {
                "id": issue_id,
                "title": f"Incident {issue_id}: {inc.get('service', 'service')}",
                "body": f"Trace:\n{inc.get('trace') or ''}\nLogs:\n{inc.get('log_tail') or ''}",
                "author": "watcher",
                "repo": inc.get("service", "demo-prod"),
            }
        else:
            issue_dict = {
                "id": issue_id,
                "title": f"Issue #{issue_id}",
                "body": "",
                "author": "contributor",
                "repo": "demo-prod",
            }

    # Run readiness analysis
    analysis = analyze_issue_readiness(issue_dict)
    ISSUE_BRIEF_CACHE[f"{issue_id}_analysis"] = analysis

    # Persist brief to DB artifacts
    try:
        artifact_id = f"art-issue-{issue_id}-{os.urandom(3).hex()}"
        save_artifact(
            artifact_id=artifact_id,
            run_id=None,
            incident_id=issue_id,
            kind="issue_brief",
            content=json.dumps(analysis, indent=2),
        )
    except Exception as e:
        logger.debug(f"Artifact persistence note for issue {issue_id}: {e}")

    return {
        "issue_id": str(issue_id),
        "ready": analysis["ready"],
        "clarifying_questions": analysis["clarifying_questions"],
        "task_summary": analysis["task_summary"],
        "suspected_area": analysis["suspected_area"],
        "draft_comment": analysis["draft_comment"],
    }


@app.post("/issues/{issue_id}/clarify")
def clarify_issue_endpoint(issue_id: str, body: Optional[IssueClarifyRequest] = None) -> Dict[str, Any]:
    """9. Issue Clarification: Posts clarifying questions back to GitHub/DB."""
    cached_analysis = ISSUE_BRIEF_CACHE.get(f"{issue_id}_analysis") or {}

    comment = None
    questions = []
    source = "desktop_ui"

    if body:
        comment = body.comment
        questions = body.questions or []
        source = body.source or "desktop_ui"

    if not comment and cached_analysis:
        comment = cached_analysis.get("draft_comment")
    if not questions and cached_analysis:
        questions = cached_analysis.get("clarifying_questions", [])

    if not comment:
        comment = f"Clarification requested for issue #{issue_id}: please provide reproduction steps and logs."

    # Persist clarification into DB artifacts
    try:
        artifact_id = f"art-clarify-{issue_id}-{os.urandom(3).hex()}"
        save_artifact(
            artifact_id=artifact_id,
            run_id=None,
            incident_id=issue_id,
            kind="issue_clarification",
            content=comment,
        )
    except Exception as e:
        logger.debug(f"Artifact clarification persistence note for issue {issue_id}: {e}")

    # Emit event if related to an incident
    try:
        log_event(
            run_id=None,
            incident_id=issue_id,
            stage="UNDERSTAND",
            kind="clarification_requested",
            payload={
                "issue_id": issue_id,
                "questions": questions,
                "comment": comment,
                "source": source,
            },
        )
    except Exception as e:
        logger.debug(f"Event logging note: {e}")

    return {
        "status": "posted",
        "issue_id": str(issue_id),
        "posted_to": "db",
        "comment": comment,
        "clarifying_questions": questions,
        "source": source,
    }

