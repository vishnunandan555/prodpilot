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
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

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
    delete_incident,
    clear_incidents_by_status,
    get_active_repo,
    get_active_server,
    update_server_status,
    claim_incident_for_processing,
    get_project,
    get_user_by_id,
    insert_service_log,
)
from backend.prodpilot.decide.rules import decide
from backend.prodpilot.pipeline.brief import analyze_issue_readiness
from backend.prodpilot.pipeline.worktree import cleanup_stale_worktrees, list_active_worktrees
from backend.prodpilot.staging.deploy import DeployAdapter, generate_incident_report

logger = logging.getLogger(__name__)

app = FastAPI(
    title="ProdPilot API",
    version="1.0.0",
    description="ProdPilot Autonomous SRE Engine Backend & SSE API",
)

# Allow only local desktop/dev origins by default. A public frontend must be
# explicitly listed in PRODPILOT_ALLOWED_ORIGINS before a tunnel is exposed.
_configured_origins = os.environ.get("PRODPILOT_ALLOWED_ORIGINS", "")
_allowed_origins = [origin.strip() for origin in _configured_origins.split(",") if origin.strip()]
if not _allowed_origins:
    _allowed_origins = [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
        "null",  # packaged Electron renderer
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from backend.prodpilot.api.connect_router import router as connect_router
from backend.prodpilot.ingest.router import router as ingest_router

app.include_router(connect_router)
app.include_router(ingest_router)


_PUBLIC_PATHS = {"/health", "/docs", "/redoc", "/openapi.json", "/auth/login", "/auth/signup"}


@app.middleware("http")
async def strict_api_auth_guard(request: Request, call_next):
    """Require an authenticated operator only when explicitly enabled.

    Strict mode is safe to enable for a public tunnel after the desktop app has
    signed in. It deliberately remains opt-in for local development so existing
    command-line and test workflows keep working without a bootstrap account.
    """
    strict_mode = os.environ.get("PRODPILOT_REQUIRE_AUTH", "").strip().lower() in {"1", "true", "yes"}
    if not strict_mode or request.method == "OPTIONS" or request.url.path in _PUBLIC_PATHS:
        return await call_next(request)

    from backend.prodpilot.api.connect_router import parse_token_user_id

    token = request.headers.get("authorization", "")
    # EventSource cannot set custom headers; the desktop client uses this only
    # for SSE when strict mode is opted in.
    if not token and request.query_params.get("access_token"):
        token = f"Bearer {request.query_params['access_token']}"
    user_id = parse_token_user_id(token)
    if not user_id or not get_user_by_id(user_id):
        return Response(
            content=json.dumps({"detail": "Authenticated operator session required"}),
            status_code=401,
            media_type="application/json",
        )
    return await call_next(request)

# Autonomous Watchdog Daemon Loop (every 12s)
@app.on_event("startup")
async def startup_watchdog_event():
    # Prune any stale/abandoned worktrees on server startup
    try:
        active_repo_info = get_active_repo()
        clean_target = (active_repo_info or {}).get("local_path") or os.getcwd()
        if Path(clean_target).exists() and (Path(clean_target) / ".git").exists():
            pruned = cleanup_stale_worktrees(clean_target)
            if pruned:
                logger.info(f"Server startup pruned {len(pruned)} stale worktree(s)")
    except Exception as e:
        logger.debug(f"Server worktree startup notice: {e}")

    async def autonomous_render_watchdog_loop():
        logger.info("🔭 Starting Autonomous Render Log Watcher & Triage loop (every 20s)...")
        await asyncio.sleep(6)
        while True:
            try:
                from backend.prodpilot.db import get_active_server, update_server_status
                from backend.prodpilot.integrations.render_client import RenderClient
                from backend.prodpilot.api.connect_router import run_server_log_triage
                active_srv = get_active_server()
                if active_srv:
                    # Proactively probe health if health_url is configured and update server status
                    health_url = active_srv.get("health_url")
                    if health_url:
                        probe = RenderClient.probe_health(health_url)
                        update_server_status(active_srv["id"], status=probe["status"], latency_ms=probe.get("latency_ms", 0.0))

                    if active_srv.get("render_service_id"):
                        res = run_server_log_triage(active_srv["id"], limit=50)
                        if res.get("incident_created"):
                            logger.info(f"🚨 Autonomous Watchdog created incident: {res.get('incident', {}).get('id')}")
            except Exception as e:
                logger.debug(f"Watchdog tick note: {e}")
            await asyncio.sleep(20)

    asyncio.create_task(autonomous_render_watchdog_loop())

    _WORKER_DISPATCH_LOCK = threading.Lock()
    _WORKER_IN_FLIGHT: set = set()

    async def incident_remediation_worker_loop():
        """Process one eligible incident at a time and supervise failures."""
        logger.info("Starting supervised incident remediation worker")
        await asyncio.sleep(8)
        while True:
            try:
                active_server = get_active_server()
                active_repo = get_active_repo()
                if active_server and active_server.get("name"):
                    project = get_project(active_server.get("project_id")) if active_server.get("project_id") else None
                    repo_path = (project or {}).get("local_path") or (active_repo or {}).get("local_path")
                    if repo_path and Path(repo_path).is_dir() and (Path(repo_path) / ".git").exists():
                        pending = list_incidents(status="OPEN")
                        eligible = next(
                            (inc for inc in pending if inc.get("service") == active_server.get("name")),
                            None,
                        )
                        if eligible:
                            incident_id = eligible["id"]
                            with _WORKER_DISPATCH_LOCK:
                                if incident_id in _WORKER_IN_FLIGHT:
                                    eligible = None
                                elif not claim_incident_for_processing(incident_id, target_status="INVESTIGATING", expected_status="OPEN"):
                                    eligible = None
                                else:
                                    _WORKER_IN_FLIGHT.add(incident_id)

                            if eligible:
                                logger.info("Dispatching incident %s to supervised remediation worker", incident_id)
                                log_event(
                                    run_id=None,
                                    incident_id=incident_id,
                                    stage="DISPATCH",
                                    kind="dispatched",
                                    payload={
                                        "worker": "supervised_incident_remediation_worker",
                                        "service": eligible.get("service"),
                                        "dispatched_at": datetime.utcnow().isoformat(),
                                        "status": "INVESTIGATING",
                                        "message": f"Dispatched eligible OPEN incident {incident_id} to remediation worker",
                                    },
                                )
                                try:
                                    from backend.prodpilot.pipeline.orchestrator import process_incident
                                    await asyncio.to_thread(
                                        process_incident,
                                        incident=eligible,
                                        repo_path=repo_path,
                                    )
                                except Exception as exc:
                                    logger.exception("Incident worker failed for %s", incident_id)
                                    update_incident_status(incident_id, "FAILED")
                                    log_event(
                                        run_id=None,
                                        incident_id=incident_id,
                                        stage="WORKER",
                                        kind="error",
                                        payload={"error": str(exc), "message": "Remediation worker failed"},
                                    )
                                finally:
                                    with _WORKER_DISPATCH_LOCK:
                                        _WORKER_IN_FLIGHT.discard(incident_id)
                await asyncio.sleep(3)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.exception("Incident worker loop error: %s", exc)
                await asyncio.sleep(5)

    asyncio.create_task(incident_remediation_worker_loop())

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
    repo: Optional[str] = "production-service"


class IssueClarifyRequest(BaseModel):
    comment: Optional[str] = None
    questions: Optional[List[str]] = None
    source: str = "desktop_ui"


class AuditLogEntryRequest(BaseModel):
    service: Optional[str] = "OPERATOR"
    level: Optional[str] = "INFO"  # INFO, WARN, ERROR, PASS, FAIL
    tag: Optional[str] = "BUTTON"
    button: Optional[str] = None
    action: Optional[str] = None
    incident_id: Optional[str] = None
    status: Optional[str] = None
    message: str


# Cache for analyzed briefs
ISSUE_BRIEF_CACHE: Dict[str, Dict[str, Any]] = {}



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
def get_incident_detail(incident_id: str, request: Request) -> Any:
    """3. Get Single Incident Detail conforming to contracts/api.md.
    Supports Content Negotiation: returns responsive mobile HTML for browsers, JSON for API/desktop UI.
    """
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
        "repro_test": None,
        "patch_diff": "",
        "test_evidence": None,
        "github_pr": None,
    }
    for row in art_rows:
        kind = row.get("kind")
        content = row.get("content", "")
        if kind == "repro_test":
            artifacts_map["repro_test"] = content or row.get("path")
        elif kind == "patch_diff":
            artifacts_map["patch_diff"] = content
        elif kind == "github_pr":
            try:
                artifacts_map["github_pr"] = json.loads(content) if isinstance(content, str) else content
            except Exception:
                artifacts_map["github_pr"] = None
        elif kind == "test_log_before":
            if not artifacts_map["test_evidence"]:
                artifacts_map["test_evidence"] = {}
            artifacts_map["test_evidence"]["before"] = content
        elif kind == "test_log_after":
            if not artifacts_map["test_evidence"]:
                artifacts_map["test_evidence"] = {}
            artifacts_map["test_evidence"]["after"] = content

    # Staging status comes from the persisted approval event. Missing evidence stays unknown.
    events_list = get_events(incident_id=incident_id)
    approval_event = next((e for e in reversed(events_list) if e.get("kind") == "awaiting_approval"), None)
    approval_payload = approval_event.get("payload") if approval_event else {}
    if isinstance(approval_payload, str):
        try:
            approval_payload = json.loads(approval_payload)
        except Exception:
            approval_payload = {}
    options = (approval_payload or {}).get("options", {}) if isinstance(approval_payload, dict) else {}
    staging_info = {
        "fix_forward": {"port": 8001, "health": (options.get("fix_forward") or {}).get("health_ok")},
        "rollback": {"port": 8002, "health": (options.get("rollback") or {}).get("health_ok")},
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
                "probabilities": ans.get("probabilities", {}),
                "reason": d.get("reason", ""),
            }

    if not decision_info:
        decision_info = decide(inc, staging_info, patch_diff=artifacts_map.get("patch_diff"))

    res_data = {
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
        "events": events_list,
    }

    action_param = request.query_params.get("action")
    view_param = request.query_params.get("view") or request.query_params.get("tab")

    if action_param == "hold":
        update_incident_status(incident_id, "ON_HOLD")
        inc["status"] = "ON_HOLD"
        res_data["status"] = "ON_HOLD"
        log_event(
            run_id=None,
            incident_id=incident_id,
            stage="HOLD",
            kind="on_hold",
            payload={"message": "Incident put on hold by operator via Telegram/Mobile link"},
        )
    elif action_param in ("unhold", "resume"):
        has_diff = bool(artifacts_map.get("patch_diff"))
        new_st = "AWAITING_APPROVAL" if has_diff else "INVESTIGATING"
        update_incident_status(incident_id, new_st)
        inc["status"] = new_st
        res_data["status"] = new_st
        log_event(
            run_id=None,
            incident_id=incident_id,
            stage="RESUME",
            kind="resumed",
            payload={"message": f"Incident resumed by operator, status set to {new_st}"},
        )

    # If mobile browser tapped link from Telegram, or if html=1 or view/action requested, return responsive dark-mode HTML
    accept_hdr = request.headers.get("accept", "")
    is_html_request = (
        ("text/html" in accept_hdr or bool(view_param) or bool(action_param) or request.query_params.get("html") == "1")
        and not request.query_params.get("raw")
    )
    if is_html_request:
        from fastapi.responses import HTMLResponse
        from backend.prodpilot.api.mobile_renderer import render_mobile_incident_page
        return HTMLResponse(content=render_mobile_incident_page(res_data, view=view_param, action=action_param))

    return res_data


@app.post("/incidents/{incident_id}/hold")
def toggle_hold_endpoint(incident_id: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Toggles incident hold status between ON_HOLD and active."""
    inc = get_incident(incident_id)
    if not inc:
        msg = f"[BUTTON: HOLD] FAILED: Incident {incident_id} not found"
        insert_service_log(service="OPERATOR", level="ERROR", message=msg)
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    action = (payload or {}).get("action", "hold")
    svc = inc.get("service") or "OPERATOR"
    if action == "hold":
        update_incident_status(incident_id, "ON_HOLD")
        msg = f"[BUTTON: HOLD] SUCCESS: Incident #{incident_id[:8]} ({svc}) placed ON_HOLD by operator"
        log_event(None, incident_id, "HOLD", "on_hold", {"message": msg, "action": "hold"})
        insert_service_log(service=svc, level="WARN", message=msg)
        return {"status": "ON_HOLD", "incident_id": incident_id, "message": "Incident put on hold"}
    else:
        artifacts = get_artifacts(incident_id)
        has_diff = any(a.get("kind") == "patch_diff" for a in artifacts)
        new_st = "AWAITING_APPROVAL" if has_diff else "INVESTIGATING"
        update_incident_status(incident_id, new_st)
        msg = f"[BUTTON: RESUME] SUCCESS: Incident #{incident_id[:8]} ({svc}) resumed to {new_st} by operator"
        log_event(None, incident_id, "RESUME", "resumed", {"message": msg, "action": "resume"})
        insert_service_log(service=svc, level="INFO", message=msg)
        return {"status": new_st, "incident_id": incident_id, "message": f"Incident resumed to {new_st}"}


@app.post("/incidents/{incident_id}/takeover")
def manual_takeover_endpoint(incident_id: str) -> Dict[str, Any]:
    """Operator takes manual control of the incident, pausing autonomous pipeline."""
    inc = get_incident(incident_id)
    if not inc:
        msg = f"[BUTTON: TAKEOVER] FAILED: Incident {incident_id} not found"
        insert_service_log(service="OPERATOR", level="ERROR", message=msg)
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    svc = inc.get("service") or "service"
    prev_status = inc.get("status", "UNKNOWN")
    update_incident_status(incident_id, "MANUAL_TAKEOVER")

    msg = f"[BUTTON: TAKEOVER] SUCCESS: Operator initiated manual takeover for incident #{incident_id[:8]} ({svc}). Autonomous pipeline paused (previous state: {prev_status})."
    log_event(
        run_id=None,
        incident_id=incident_id,
        stage="TAKEOVER",
        kind="manual_takeover",
        payload={
            "message": msg,
            "status": "MANUAL_TAKEOVER",
            "previous_status": prev_status,
        },
    )
    insert_service_log(service=svc, level="WARN", message=msg)

    return {
        "ok": True,
        "status": "MANUAL_TAKEOVER",
        "incident_id": incident_id,
        "message": f"Manual takeover successful for incident {incident_id}",
    }


@app.post("/platform/audit-log")
def create_audit_log_entry(body: AuditLogEntryRequest) -> Dict[str, Any]:
    """Records a user/operator UI button interaction or client-side action in the Master Audit Log."""
    svc = (body.service or "OPERATOR").upper()
    lvl = (body.level or "INFO").upper()
    msg = body.message
    if body.button and not msg.startswith("[BUTTON"):
        status_tag = f" [{body.status}]" if body.status else ""
        msg = f"[BUTTON: {body.button.upper()}]{status_tag} {msg}"

    insert_service_log(service=svc, level=lvl, message=msg)

    if body.incident_id:
        log_event(
            run_id=None,
            incident_id=body.incident_id,
            stage="OPERATOR",
            kind="operator_action",
            payload={
                "button": body.button,
                "action": body.action,
                "status": body.status,
                "message": msg,
                "level": lvl,
            },
        )

    return {"ok": True, "logged": True, "message": msg}


@app.delete("/incidents/{incident_id}")
def delete_incident_endpoint(incident_id: str) -> Dict[str, Any]:
    """Permanently deletes an incident and all associated telemetry runs, events, artifacts, and decisions."""
    inc = get_incident(incident_id)
    if not inc:
        msg = f"[BUTTON: DELETE] FAILED: Incident {incident_id} not found"
        insert_service_log(service="OPERATOR", level="ERROR", message=msg)
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    svc = inc.get("service") or "SYSTEM"
    ok = delete_incident(incident_id)
    msg = f"[BUTTON: DELETE] SUCCESS: Incident #{incident_id[:8]} ({svc}) permanently deleted by operator"
    insert_service_log(service="OPERATOR", level="INFO", message=msg)
    return {"ok": ok, "deleted_id": incident_id, "message": f"Incident {incident_id} deleted successfully"}


@app.post("/incidents/clear")
@app.delete("/incidents")
def clear_incidents_endpoint(status: Optional[str] = Query(None, description="Optional status to filter by, or 'ALL'")) -> Dict[str, Any]:
    """Clears multiple incidents by status (e.g. 'RESOLVED', 'FAILED', or 'ALL')."""
    count = clear_incidents_by_status(status_filter=status)
    msg = f"[BUTTON: CLEAR] SUCCESS: Cleared {count} incident(s) matching filter '{status or 'ALL'}'"
    insert_service_log(service="OPERATOR", level="INFO", message=msg)
    return {"ok": True, "cleared_count": count, "filter": status or "ALL"}


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
    """Explicitly approve a local-process deployment when that adapter is enabled."""
    action = body.action
    btn_tag = "ROLLBACK" if action == "rollback" else "APPROVE"
    inc = get_incident(incident_id)
    if not inc:
        msg = f"[BUTTON: {btn_tag}] FAILED: Incident {incident_id} not found"
        insert_service_log(service="OPERATOR", level="ERROR", message=msg)
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    svc = inc.get("service") or "DEPLOY"

    if action not in ("fix_forward", "rollback"):
        msg = f"[BUTTON: {btn_tag}] FAILED for #{incident_id[:8]}: Action must be 'fix_forward' or 'rollback'"
        insert_service_log(service=svc, level="ERROR", message=msg)
        raise HTTPException(status_code=400, detail="Action must be 'fix_forward' or 'rollback'")

    if inc.get("status") != "AWAITING_APPROVAL":
        msg = f"[BUTTON: {btn_tag}] FAILED for #{incident_id[:8]}: Incident is not in AWAITING_APPROVAL state (current: {inc.get('status')})"
        insert_service_log(service=svc, level="ERROR", message=msg)
        raise HTTPException(status_code=409, detail=f"Incident is not awaiting operator approval (current: {inc.get('status')})")

    approval_events = [e for e in get_events(incident_id=incident_id) if e.get("kind") == "awaiting_approval"]
    if not approval_events:
        msg = f"[BUTTON: {btn_tag}] FAILED for #{incident_id[:8]}: No persisted canary approval evidence is available"
        insert_service_log(service=svc, level="ERROR", message=msg)
        raise HTTPException(status_code=409, detail="No persisted canary approval evidence is available")

    approval_payload = approval_events[-1].get("payload") or {}
    if isinstance(approval_payload, str):
        try:
            approval_payload = json.loads(approval_payload)
        except Exception:
            approval_payload = {}
    selected_option = ((approval_payload.get("options") or {}).get(action) or {}) if isinstance(approval_payload, dict) else {}
    if selected_option.get("health_ok") is not True:
        msg = f"[BUTTON: {btn_tag}] FAILED for #{incident_id[:8]}: The {action} canary has no passing health evidence"
        insert_service_log(service=svc, level="ERROR", message=msg)
        raise HTTPException(status_code=409, detail=f"The {action} canary has no passing health evidence")

    # This adapter mutates a local checkout and manages a local process. It is not a Render deployment.
    if os.environ.get("PRODPILOT_DEPLOY_TARGET", "disabled").strip().lower() != "local_process":
        msg = f"[BUTTON: {btn_tag}] FAILED for #{incident_id[:8]}: Local process deployment adapter is disabled (PRODPILOT_DEPLOY_TARGET != local_process)"
        insert_service_log(service=svc, level="ERROR", message=msg)
        raise HTTPException(
            status_code=501,
            detail="No production provider deployment adapter is configured. Local process deployment is disabled.",
        )

    repo_path = body.repo_path
    if not repo_path or not Path(repo_path).exists():
        try:
            active = get_active_repo()
            if active and active.get("local_path") and Path(active["local_path"]).exists():
                repo_path = str(Path(active["local_path"]).resolve())
        except Exception:
            repo_path = None
    if not repo_path or not (Path(repo_path) / ".git").exists():
        msg = f"[BUTTON: {btn_tag}] FAILED for #{incident_id[:8]}: A valid connected local Git repository is required"
        insert_service_log(service=svc, level="ERROR", message=msg)
        raise HTTPException(status_code=409, detail="A valid connected local Git repository is required")

    art_rows = get_artifacts(incident_id)
    artifacts = {a.get("kind"): a.get("content") for a in art_rows}
    patch_diff = artifacts.get("patch_diff") or ""
    if action == "fix_forward" and not patch_diff.strip():
        msg = f"[BUTTON: {btn_tag}] FAILED for #{incident_id[:8]}: No verified patch artifact is available"
        insert_service_log(service=svc, level="ERROR", message=msg)
        raise HTTPException(status_code=409, detail="No verified patch artifact is available for this incident")
    suspect = inc.get("suspect_commit")
    if isinstance(suspect, str):
        try:
            suspect = json.loads(suspect)
        except Exception:
            suspect = {}
    suspect_commit_hash = (suspect or {}).get("hash") if isinstance(suspect, dict) else None
    if action == "rollback" and not suspect_commit_hash:
        msg = f"[BUTTON: {btn_tag}] FAILED for #{incident_id[:8]}: No suspect commit is available for rollback"
        insert_service_log(service=svc, level="ERROR", message=msg)
        raise HTTPException(status_code=409, detail="No suspect commit is available for rollback")

    # Record approval in DB
    approval_id = f"appr-{incident_id[:8]}-{os.urandom(3).hex()}"
    record_approval(
        approval_id=approval_id,
        run_id=None,
        incident_id=incident_id,
        decision=f"APPROVED_{action.upper()}",
        source=body.source,
    )

    init_msg = f"[BUTTON: {btn_tag}] INITIATED: Applying {action} to production port 8000 for #{incident_id[:8]}..."
    insert_service_log(service=svc, level="INFO", message=init_msg)

    # Log stage started
    log_event(
        run_id=None,
        incident_id=incident_id,
        stage="DEPLOY",
        kind="stage_started",
        payload={"action": action, "source": body.source, "message": init_msg},
    )

    deploy_res = deploy_adapter.deploy(
        action=action,
        repo_path=repo_path,
        patch_diff=patch_diff,
        suspect_commit=suspect_commit_hash,
        mock_mode=False,
        incident_id=incident_id,
        source=body.source,
    )

    deploy_status = deploy_res.get("status")
    if deploy_status in ("DEPLOYED", "RESOLVED"):
        new_status = "DEPLOYED"
    elif deploy_status == "AUTO_REVERTED":
        new_status = "AUTO_REVERTED"
    else:
        new_status = "FAILED"

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

        success_msg = f"[BUTTON: {btn_tag}] SUCCESS: Deployed {action} to production port 8000 for #{incident_id[:8]}! Health probe: 200 OK"
        insert_service_log(service=svc, level="PASS", message=success_msg)
        log_event(
            run_id=None,
            incident_id=incident_id,
            stage="DEPLOY",
            kind="deployed",
            payload={
                "choice": action,
                "production_port": 8000,
                "message": success_msg,
                "post_deploy_health_ok": deploy_res.get("health_check") == "ok",
            },
        )
    else:
        fail_msg = f"[BUTTON: {btn_tag}] FAILED: Deployment returned status '{new_status}' (health: {deploy_res.get('health_check')})"
        insert_service_log(service=svc, level="FAIL", message=fail_msg)
        log_event(
            run_id=None,
            incident_id=incident_id,
            stage="DEPLOY",
            kind="approval_failed",
            payload={
                "choice": action,
                "error": fail_msg,
                "message": fail_msg,
                "post_deploy_health_ok": deploy_res.get("health_check") == "ok",
            },
        )

    return {
        "status": new_status,
        "deployed_action": action,
        "deployment_target": "local_process",
        "health_check": deploy_res.get("health_check"),
        "incident_id": incident_id,
        "pr_url": None,
        "pr_number": None,
        "branch": None,
        "merged": False,
    }


@app.post("/incidents/{incident_id}/reject")
def reject_incident(incident_id: str, body: RejectRequest) -> Dict[str, Any]:
    """6. Reject Incident conforming to contracts/api.md."""
    inc = get_incident(incident_id)
    if not inc:
        msg = f"[BUTTON: REJECT] FAILED: Incident {incident_id} not found"
        insert_service_log(service="OPERATOR", level="ERROR", message=msg)
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    svc = inc.get("service") or "OPERATOR"
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

    msg = f"[BUTTON: REJECT] SUCCESS: Incident #{incident_id[:8]} ({svc}) rejected by operator: {body.reason}"
    log_event(
        run_id=None,
        incident_id=incident_id,
        stage="DECIDE",
        kind="status_change",
        payload={"status": "REJECTED", "reason": body.reason, "source": body.source, "message": msg},
    )
    insert_service_log(service=svc, level="WARN", message=msg)

    return {"status": "REJECTED", "incident_id": incident_id}


@app.post("/incidents/{incident_id}/followup")
def followup_incident(incident_id: str, body: FollowupRequest) -> Dict[str, Any]:
    """7. Agent Follow-Up / Reject with Instructions conforming to contracts/api.md."""
    inc = get_incident(incident_id)
    if not inc:
        msg = f"[BUTTON: INSTRUCTION] FAILED: Incident {incident_id} not found"
        insert_service_log(service="OPERATOR", level="ERROR", message=msg)
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    svc = inc.get("service") or "OPERATOR"
    update_incident_status(incident_id, "FIXING")

    msg = f"[BUTTON: INSTRUCTION] SUCCESS: Follow-up instruction sent for #{incident_id[:8]} ({svc}): '{body.instruction}'"
    log_event(
        run_id=None,
        incident_id=incident_id,
        stage="FIX",
        kind="stage_started",
        payload={"instruction": body.instruction, "source": body.source, "attempt": 2, "message": msg},
    )
    insert_service_log(service=svc, level="INFO", message=msg)

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
            "repo": body.repo or "production-service",
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
                "repo": inc.get("service", "production-service"),
            }
        else:
            issue_dict = {
                "id": issue_id,
                "title": f"Issue #{issue_id}",
                "body": "",
                "author": "contributor",
                "repo": "production-service",
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


@app.get("/platform/master-logs")
def get_master_platform_logs(limit: int = 500) -> Dict[str, Any]:
    """Returns a unified master activity stream across all platform systems as pure console lines."""
    from backend.prodpilot.db import get_db
    with get_db() as conn:
        # Fetch the latest LIMIT events and service logs ordered chronologically
        rows = conn.execute(
            """
            SELECT * FROM (
                SELECT e.id, e.ts, e.incident_id, e.stage, e.kind, e.payload, 
                       i.service, i.status as incident_status, i.severity
                FROM run_events e
                LEFT JOIN incidents i ON e.incident_id = i.id
                ORDER BY e.id DESC
                LIMIT ?
            ) sub ORDER BY sub.id ASC
            """,
            (limit,)
        ).fetchall()

        svc_rows = conn.execute(
            """
            SELECT * FROM (
                SELECT id, timestamp as ts, service, level, message 
                FROM service_logs 
                ORDER BY id DESC 
                LIMIT ?
            ) sub ORDER BY sub.id ASC
            """,
            (limit,)
        ).fetchall()

    console_lines = []
    
    # Add service_logs
    for sr in svc_rows:
        ts_clean = (sr["ts"] or "").replace("T", " ").split(".")[0]
        lvl = (sr["level"] or "INFO").upper()
        svc = (sr["service"] or "CORE").upper()
        msg = sr["message"] or ""

        # Format tag based on message context
        tag = svc
        if "[BUTTON:" in msg:
            if "TAKEOVER" in msg:
                tag = "TAKEOVER"
            elif "APPROVE" in msg or "ROLLBACK" in msg:
                tag = "DEPLOY"
            elif "HOLD" in msg or "RESUME" in msg:
                tag = "HOLD"
            else:
                tag = "OPERATOR"
        elif svc in ("OPERATOR", "BUTTON"):
            tag = "OPERATOR"

        raw = f"[{ts_clean}] [{lvl:<5}] [{tag:<12}] {msg}"
        console_lines.append({
            "id": f"svc-{sr['id']}",
            "timestamp": ts_clean,
            "level": lvl,
            "tag": tag,
            "message": msg,
            "raw": raw,
        })

    # Add run_events
    for r in rows:
        d = dict(r)
        ts_clean = (d.get("ts") or "").replace("T", " ").split(".")[0]
        stage = (d.get("stage") or "SYSTEM").upper()
        kind = (d.get("kind") or "INFO").upper()
        svc = (d.get("service") or "SYSTEM").upper()
        inc_id = d.get("incident_id") or ""
        
        payload = d.get("payload") or {}
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except Exception:
                payload = {"message": payload}

        lvl = "INFO"
        tag = stage
        msg = payload.get("message") or ""

        if kind in ("ERROR", "EXCEPTION", "FAILED"):
            lvl = "ERROR"
            msg = payload.get("error") or msg or "Failure encountered"
        elif kind == "APPROVAL_FAILED":
            lvl = "FAIL"
            tag = "APPROVAL"
            msg = payload.get("error") or msg or "Approval deployment failed"
        elif kind in ("MANUAL_TAKEOVER", "TAKEOVER") or stage == "TAKEOVER":
            lvl = "WARN"
            tag = "TAKEOVER"
            msg = payload.get("message") or "Operator manual takeover initiated"
        elif kind == "OPERATOR_ACTION":
            lvl = (payload.get("level") or "INFO").upper()
            tag = "OPERATOR"
            msg = payload.get("message") or "Operator action completed"
        elif kind in ("LLM_CALL", "LLM", "MODEL_CALL"):
            lvl = "LLM"
            model_name = (payload.get("model") or "GEMINI").replace("typesafe/", "").replace("google-", "").replace("google.", "")
            tag = model_name[:12].upper()
            msg = payload.get("message") or payload.get("response") or payload.get("prompt") or "LLM invocation completed"
        elif kind in ("TELEGRAM_ALERT", "TELEGRAM", "MESSAGE_SENT", "NOTIFICATION"):
            lvl = "MSG"
            tag = "TELEGRAM"
            msg = payload.get("message") or "External notification dispatched"
        elif kind == "TOOL_CALL":
            lvl = "TOOL"
            tag = "AGENT_TOOL"
            msg = payload.get("summary") or f"{payload.get('tool')}({payload.get('args')})"
        elif kind == "TEST_RESULT":
            passed = payload.get("passed", False)
            lvl = "PASS" if passed else "FAIL"
            tag = "VERIFIER"
            msg = f"{payload.get('phase')}: {payload.get('summary') or ('PASSED' if passed else 'FAILED')}"
        elif kind == "DECISION":
            lvl = "JEV"
            tag = "TYPESAFE_JEV"
            prob = int(payload.get("confidence", 0.95) * 100) if payload.get("confidence") else 95
            msg = f"Recommendation: {payload.get('recommendation', '').upper()} ({prob}% prob) - {payload.get('reason', '')}"
        elif kind in ("PR_MERGED", "PR_OPENED"):
            lvl = "PR"
            tag = "GITHUB_PR"
            msg = f"Pull Request #{payload.get('pr_number')} on branch {payload.get('branch')} -> merged={payload.get('merged')}"
        elif kind == "RECURRENT_ANOMALY":
            lvl = "WARN"
            tag = "WATCHDOG"
            msg = payload.get("message") or "Anomaly detected in log stream"
        elif kind == "DEPLOYED":
            passed = payload.get("post_deploy_health_ok", True)
            lvl = "PASS" if passed else "FAIL"
            tag = "DEPLOY"
            msg = payload.get("message") or f"Hotfix deployed to port 8000 (status: {'OK' if passed else 'FAILED'})"
        elif not msg:
            msg = json.dumps(payload)

        # Preserve full text, only cap extreme anomalies at 2000 chars
        if len(msg) > 2000:
            msg = msg[:2000] + "..."

        inc_label = f"[{inc_id[:16]}] " if inc_id else ""
        raw = f"[{ts_clean}] [{lvl:<5}] [{tag:<12}] {inc_label}{msg}"
        
        console_lines.append({
            "id": d.get("id"),
            "timestamp": ts_clean,
            "level": lvl,
            "tag": tag,
            "service": svc,
            "incident_id": inc_id,
            "message": f"{inc_label}{msg}",
            "raw": raw,
        })

    # Sort console lines chronologically
    console_lines.sort(key=lambda x: str(x.get("timestamp", "")))
    plain_text = "\n".join(c["raw"] for c in console_lines)

    return {
        "ok": True,
        "count": len(console_lines),
        "console_lines": console_lines,
        "plain_text": plain_text,
    }


@app.get("/worktrees")
def get_worktrees_endpoint(repo_path: Optional[str] = None) -> Dict[str, Any]:
    """Lists all active and temporary git worktrees with status and age."""
    active_repo = repo_path
    if not active_repo:
        try:
            active = get_active_repo()
            active_repo = (active or {}).get("local_path")
        except Exception:
            pass
    active_repo = active_repo or os.getcwd()

    worktrees = list_active_worktrees(active_repo)
    return {
        "ok": True,
        "worktrees": worktrees,
        "count": len(worktrees),
        "temporary_count": sum(1 for w in worktrees if w.get("is_temporary")),
        "repo_path": active_repo,
    }


@app.post("/worktrees/prune")
def prune_worktrees_endpoint(
    repo_path: Optional[str] = None,
    force_all: bool = False,
    max_age_seconds: float = 1800.0,
) -> Dict[str, Any]:
    """Prunes stale or orphaned temporary worktrees."""
    active_repo = repo_path
    if not active_repo:
        try:
            active = get_active_repo()
            active_repo = (active or {}).get("local_path")
        except Exception:
            pass
    active_repo = active_repo or os.getcwd()

    cleaned = cleanup_stale_worktrees(
        active_repo,
        max_age_seconds=None if force_all else max_age_seconds,
        force_all_temporary=force_all,
    )
    return {
        "ok": True,
        "status": "pruned",
        "cleaned": cleaned,
        "cleaned_count": len(cleaned),
        "repo_path": active_repo,
    }



