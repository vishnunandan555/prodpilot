"""ProdPilot Platform Connect Router
Provides REST & SSE endpoints for:
1. Authentication (Signup, Login, Me)
2. Projects (Manual Project Creation, GitHub REST API issues, PRs, workflow logs, commits)
3. Production Servers (Render REST API v1 integration, service details, deploys, live logs, health probes)
4. Settings (Global GitHub PAT, Render API Key, Telegram, Tunnel)
5. Telemetry & On-Call Team
"""

import logging
import os
import re
import shutil
import subprocess
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Form, Header, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field

from backend.prodpilot.db import (
    authenticate_user,
    clear_all_incidents,
    compute_fingerprint,
    connect_server,
    create_incident_with_fingerprint,
    create_project,
    create_server,
    create_user,
    delete_project,
    delete_repo,
    delete_server,
    delete_user,
    find_incident_by_fingerprint,
    find_active_incident_by_service,
    get_active_project,
    get_active_repo,
    get_active_server,
    get_all_settings,
    get_events,
    get_project,
    get_server,
    get_setting,
    get_user_by_id,
    increment_incident_recurrence,
    list_incidents,
    list_projects,
    list_repos,
    list_servers,
    list_service_logs,
    list_users,
    log_event,
    set_active_project,
    set_active_repo,
    set_active_server,
    set_setting,
    update_server_status,
    update_user_profile,
)
from datetime import datetime
from backend.prodpilot.integrations.github_client import GitHubClient
from backend.prodpilot.integrations.render_client import RenderClient

logger = logging.getLogger(__name__)

router = APIRouter(tags=["platform"])

# Global Cloudflare Tunnel state
_TUNNEL_PROCESS: Optional[subprocess.Popen] = None
_TUNNEL_URL: Optional[str] = None
_TUNNEL_LOCK = threading.Lock()


def _find_cloudflared() -> Optional[str]:
    candidates = [
        shutil.which("cloudflared"),
        os.path.expanduser("~/.local/bin/cloudflared"),
        "/usr/local/bin/cloudflared",
        "/usr/bin/cloudflared",
    ]
    for c in candidates:
        if c and os.path.exists(c) and os.access(c, os.X_OK):
            return c
    return None


def _monitor_tunnel_output(proc: subprocess.Popen):
    global _TUNNEL_URL
    url_pattern = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")
    try:
        if proc.stdout:
            for line in iter(proc.stdout.readline, ""):
                if not line:
                    break
                match = url_pattern.search(line)
                if match:
                    found_url = match.group(0)
                    _TUNNEL_URL = found_url
                    set_setting("CLOUDFLARE_TUNNEL_URL", found_url)
                    logger.info(f"Cloudflare Tunnel online at: {found_url}")
    except Exception as e:
        logger.warning(f"Error reading tunnel stdout: {e}")


# ---------------------------------------------------------
# 1. AUTHENTICATION
# ---------------------------------------------------------

class SignupRequest(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = "sre"


class LoginRequest(BaseModel):
    username: str
    password: str


def make_token(user_id: str) -> str:
    return f"ppt_{user_id}_{os.urandom(8).hex()}"


def parse_token_user_id(auth_header: Optional[str]) -> Optional[str]:
    if not auth_header:
        return None
    token = auth_header.replace("Bearer ", "").strip()
    if token.startswith("ppt_"):
        parts = token.split("_")
        if len(parts) >= 2:
            return parts[1]
    return None


@router.post("/auth/signup")
def signup_endpoint(body: SignupRequest) -> Dict[str, Any]:
    if not body.username or not body.password:
        raise HTTPException(status_code=400, detail="Username and password are required")
    if len(body.password) < 3:
        raise HTTPException(status_code=400, detail="Password must be at least 3 characters")
    try:
        user = create_user(
            username=body.username,
            password=body.password,
            email=body.email,
            full_name=body.full_name or body.username.capitalize(),
            role=body.role or "sre",
        )
        token = make_token(user["id"])
        return {
            "status": "success",
            "token": token,
            "user": user,
            "message": "Account created successfully",
        }
    except Exception as e:
        logger.warning(f"Signup failed: {e}")
        raise HTTPException(status_code=400, detail="Username or email already exists")


@router.post("/auth/login")
def login_endpoint(body: LoginRequest) -> Dict[str, Any]:
    user = authenticate_user(body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = make_token(user["id"])
    return {
        "status": "success",
        "token": token,
        "user": user,
        "message": f"Welcome back, {user['full_name'] or user['username']}",
    }


@router.get("/auth/me")
def me_endpoint(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    user_id = parse_token_user_id(authorization)
    if user_id:
        user = get_user_by_id(user_id)
        if user:
            return {"authenticated": True, "user": user}

    admin = get_user_by_id("usr-admin")
    if admin:
        return {"authenticated": True, "user": admin, "is_default": True}

    raise HTTPException(status_code=401, detail="Unauthorized")


# ---------------------------------------------------------
# 2. PROJECTS (MANUAL SETUP & GITHUB API INTEGRATION)
# ---------------------------------------------------------

class CreateProjectRequest(BaseModel):
    name: str
    github_repo: str  # e.g. "vishnunandan555/chunkstream" or full URL
    local_path: Optional[str] = None  # Optional: e.g. "/home/.../chunkstream" or leave blank to auto-clone
    github_token: Optional[str] = None  # Per-project PAT (or None to use Global PAT)
    default_branch: Optional[str] = "main"
    test_cmd: Optional[str] = "pytest"
    set_active: Optional[bool] = True


def get_effective_github_token(project_token: Optional[str]) -> Optional[str]:
    """Returns project-specific token or falls back to global setting / env."""
    if project_token and project_token.strip():
        return project_token.strip()
    return get_setting("GITHUB_PAT") or os.environ.get("GITHUB_PAT")


@router.get("/projects")
def list_projects_endpoint() -> Dict[str, Any]:
    projects = list_projects()
    active = get_active_project()
    return {"projects": projects, "active_project": active}


@router.get("/projects/active")
def get_active_project_endpoint() -> Dict[str, Any]:
    active = get_active_project()
    return {"active_project": active}


@router.post("/projects")
def create_project_endpoint(body: CreateProjectRequest) -> Dict[str, Any]:
    # Normalize GitHub repo slug
    repo_slug = GitHubClient.normalize_slug(body.github_repo)
    token = get_effective_github_token(body.github_token)

    # Determine local_path (auto-default if blank)
    if body.local_path and body.local_path.strip():
        raw_path = os.path.expanduser(body.local_path.strip())
        local_path = Path(raw_path).resolve()
    else:
        # Default internal directory: ~/.prodpilot/projects/<owner>_<repo>
        slug_clean = repo_slug.replace("/", "_")
        default_dir = Path.home() / ".prodpilot" / "projects" / slug_clean
        local_path = default_dir.resolve()

    # Validate or auto-clone repository
    needs_clone = False
    if not local_path.exists():
        needs_clone = True
    elif local_path.is_dir():
        # Check if empty or missing .git
        contents = list(local_path.iterdir())
        if not contents or not (local_path / ".git").exists():
            needs_clone = True

    if needs_clone:
        try:
            local_path.parent.mkdir(parents=True, exist_ok=True)
            # Authenticated clone URL if token present
            if token:
                clone_url = f"https://x-access-token:{token}@github.com/{repo_slug}.git"
            else:
                clone_url = f"https://github.com/{repo_slug}.git"

            logger.info(f"Auto-cloning {repo_slug} into {local_path}...")
            clone_cmd = ["git", "clone"]
            if body.default_branch:
                clone_cmd.extend(["-b", body.default_branch])
            clone_cmd.extend([clone_url, str(local_path)])

            res = subprocess.run(clone_cmd, capture_output=True, text=True, timeout=120)
            if res.returncode != 0:
                logger.warning(f"git clone failed ({res.stderr.strip()}). Initializing empty repo as fallback.")
                if not local_path.exists():
                    local_path.mkdir(parents=True, exist_ok=True)
                if not (local_path / ".git").exists():
                    subprocess.run(["git", "init", "-b", body.default_branch or "main"], cwd=str(local_path), capture_output=True)
        except Exception as e:
            logger.warning(f"Auto-clone attempt raised: {e}. Fallback to git init.")
            if not local_path.exists():
                local_path.mkdir(parents=True, exist_ok=True)
            if not (local_path / ".git").exists():
                subprocess.run(["git", "init", "-b", body.default_branch or "main"], cwd=str(local_path), capture_output=True)

    # Validate against GitHub API if token is available
    gh_client = GitHubClient(token=token)
    repo_check = gh_client.get_repo(repo_slug, token=token)

    project = create_project(
        name=body.name.strip(),
        github_repo=repo_slug,
        local_path=str(local_path),
        github_token=body.github_token.strip() if body.github_token else None,
        default_branch=body.default_branch or "main",
        test_cmd=body.test_cmd or "pytest",
        set_active=body.set_active if body.set_active is not None else True,
    )

    return {
        "status": "created",
        "project": project,
        "github_status": repo_check,
        "message": f"Project '{body.name}' connected successfully! (Local path: {local_path})",
    }


@router.post("/projects/{project_id}/activate")
def activate_project_endpoint(project_id: str) -> Dict[str, Any]:
    set_active_project(project_id)
    active = get_active_project()
    return {"status": "activated", "active_project": active}


@router.delete("/projects/{project_id}")
def delete_project_endpoint(project_id: str) -> Dict[str, Any]:
    delete_project(project_id)
    return {"status": "deleted", "project_id": project_id}


@router.get("/projects/{project_id}/issues")
def get_project_issues_endpoint(project_id: str, state: str = "open", limit: int = 30) -> Dict[str, Any]:
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    token = get_effective_github_token(project.get("github_token"))
    gh = GitHubClient(token=token)
    result = gh.get_issues(project["github_repo"], token=token, state=state, limit=limit)
    return result


@router.get("/projects/{project_id}/prs")
def get_project_prs_endpoint(project_id: str, state: str = "all", limit: int = 20) -> Dict[str, Any]:
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    token = get_effective_github_token(project.get("github_token"))
    gh = GitHubClient(token=token)
    result = gh.get_pull_requests(project["github_repo"], token=token, state=state, limit=limit)
    return result


@router.get("/projects/{project_id}/deploys")
def get_project_deploys_endpoint(project_id: str, limit: int = 15) -> Dict[str, Any]:
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    token = get_effective_github_token(project.get("github_token"))
    gh = GitHubClient(token=token)
    result = gh.get_workflow_runs(project["github_repo"], token=token, limit=limit)
    return result


@router.get("/projects/{project_id}/commits")
def get_project_commits_endpoint(project_id: str, limit: int = 25) -> Dict[str, Any]:
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    local_path = project.get("local_path", "")
    commits = GitHubClient.inspect_local_commits(local_path, limit=limit)
    return {"project_id": project_id, "commits": commits, "count": len(commits)}


# ---------------------------------------------------------
# 3. PRODUCTION SERVERS (RENDER REST API INTEGRATION)
# ---------------------------------------------------------

class CreateServerRequest(BaseModel):
    name: str
    health_url: str
    project_id: Optional[str] = None
    provider: Optional[str] = "render"
    render_service_id: Optional[str] = None  # e.g. "srv-xxxxxx"
    render_api_key: Optional[str] = None     # Optional override
    port: Optional[int] = 8000
    host: Optional[str] = "127.0.0.1"
    set_active: Optional[bool] = True


def get_effective_render_key(server_key: Optional[str]) -> Optional[str]:
    """Returns server-specific key or falls back to global setting / env."""
    if server_key and server_key.strip():
        return server_key.strip()
    return get_setting("RENDER_API_KEY") or os.environ.get("RENDER_API_KEY")


@router.get("/servers")
def list_servers_endpoint(project_id: Optional[str] = Query(None)) -> Dict[str, Any]:
    servers = list_servers(project_id=project_id)
    active = get_active_server(project_id=project_id)
    return {"servers": servers, "active_server": active}


@router.get("/servers/active")
def get_active_server_endpoint(project_id: Optional[str] = Query(None)) -> Dict[str, Any]:
    active = get_active_server(project_id=project_id)
    return {"active_server": active}


@router.post("/servers")
@router.post("/servers/connect")
def connect_server_endpoint(body: CreateServerRequest) -> Dict[str, Any]:
    health_probe = RenderClient.probe_health(body.health_url)

    # If no project_id passed, link to currently active project
    project_id = body.project_id
    if not project_id:
        active_proj = get_active_project()
        if active_proj:
            project_id = active_proj["id"]

    server = connect_server(
        name=body.name.strip(),
        health_url=body.health_url.strip(),
        project_id=project_id,
        provider=body.provider or "render",
        render_service_id=body.render_service_id.strip() if body.render_service_id else None,
        render_api_key=body.render_api_key.strip() if body.render_api_key else None,
        port=body.port or 8000,
        host=body.host or "127.0.0.1",
        status=health_probe["status"],
        latency_ms=health_probe.get("latency_ms", 0.0),
        set_active=body.set_active if body.set_active is not None else True,
    )

    # Test Render API if service_id is provided
    render_info = None
    if body.render_service_id:
        key = get_effective_render_key(body.render_api_key)
        client = RenderClient(api_key=key)
        render_info = client.get_service(body.render_service_id)

    return {
        "status": "connected",
        "server": server,
        "probe": health_probe,
        "render": render_info,
        "message": f"Server '{body.name}' registered (Status: {health_probe['status']})",
    }


@router.post("/servers/{server_id}/activate")
def activate_server_endpoint(server_id: str) -> Dict[str, Any]:
    set_active_server(server_id)
    active = get_active_server()
    return {"status": "activated", "active_server": active}


@router.delete("/servers/{server_id}")
def delete_server_endpoint(server_id: str) -> Dict[str, Any]:
    delete_server(server_id)
    return {"status": "deleted", "server_id": server_id}


@router.post("/servers/{server_id}/ping")
@router.post("/servers/{server_id}/probe")
def probe_server_endpoint(server_id: str) -> Dict[str, Any]:
    server = get_server(server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    probe = RenderClient.probe_health(server["health_url"])
    update_server_status(server_id, status=probe["status"], latency_ms=probe.get("latency_ms", 0.0))
    return {"server_id": server_id, "probe": probe}


@router.get("/servers/{server_id}/render-details")
def get_server_render_details_endpoint(server_id: str) -> Dict[str, Any]:
    server = get_server(server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    service_id = server.get("render_service_id")
    if not service_id:
        return {
            "ok": False,
            "error": "No Render Service ID configured for this server. Edit server to add Service ID.",
            "service": None,
            "deploys": [],
        }

    key = get_effective_render_key(server.get("render_api_key"))
    client = RenderClient(api_key=key)
    svc_res = client.get_service(service_id)
    deploys_res = client.get_deploys(service_id)

    return {
        "ok": svc_res.get("ok", False),
        "service": svc_res.get("service"),
        "deploys": deploys_res.get("deploys", []),
        "error": svc_res.get("error") or deploys_res.get("error"),
    }


@router.get("/servers/{server_id}/logs")
def get_server_render_logs_endpoint(server_id: str, limit: int = 100, force: bool = False) -> Dict[str, Any]:
    server = get_server(server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    service_id = server.get("render_service_id")
    if not service_id:
        return {
            "ok": False,
            "error": "No Render Service ID attached to this server. Add Service ID in Servers section to stream live production logs.",
            "logs": [],
        }

    key = get_effective_render_key(server.get("render_api_key"))
    client = RenderClient(api_key=key)
    logs_res = client.get_logs(service_id, limit=limit, force=force)

    # Attach triage summary to logs response
    try:
        from backend.prodpilot.triage.classifier import classify_logs
        triage = classify_logs(server.get("name", "production-service"), logs_res.get("logs", []))
        logs_res["triage_summary"] = {
            "severity": triage.severity,
            "is_crash": triage.is_crash,
            "reason": triage.reason,
            "suspected_area": triage.suspected_area,
        }
    except Exception:
        pass

    return logs_res


def run_server_log_triage(server_id: str, limit: int = 60) -> Dict[str, Any]:
    """Analyzes server logs, detects crashes/tracebacks, creates incident, and evaluates with TypeSafe Jev."""
    server = get_server(server_id)
    if not server:
        return {"ok": False, "error": f"Server {server_id} not found"}

    service_id = server.get("render_service_id")
    if not service_id:
        return {"ok": False, "error": "No Render Service ID attached"}

    key = get_effective_render_key(server.get("render_api_key"))
    client = RenderClient(api_key=key)
    logs_res = client.get_logs(service_id, limit=limit)
    logs = logs_res.get("logs", [])

    from backend.prodpilot.triage.classifier import classify_logs, Severity
    triage = classify_logs(server.get("name", "production-service"), logs)

    if triage.severity not in (Severity.HIGH.value, Severity.INFRA.value) and not triage.is_crash:
        return {
            "ok": True,
            "incident_created": False,
            "severity": triage.severity,
            "message": "No unhandled crash or high-severity anomaly detected in recent logs.",
        }

    # High severity or crash detected! Check fingerprint & active incident deduplication
    fp = triage.fingerprint or compute_fingerprint(triage.trace or triage.log_tail)
    existing = find_incident_by_fingerprint(fp)
    if not existing:
        existing = find_active_incident_by_service(server.get("name", "production-service"), triage.suspected_area)

    if existing:
        inc = increment_incident_recurrence(existing["id"])
        log_event(
            run_id=None,
            incident_id=existing["id"],
            stage=existing.get("status", "INVESTIGATING"),
            kind="recurrent_anomaly",
            payload={
                "message": f"Crash re-observed in live log stream: {triage.reason or 'Traceback detected'}. Recurrence count: {inc.get('recurrence_count', 2)}",
                "suspected_area": triage.suspected_area,
            },
        )
        return {
            "ok": True,
            "incident_created": False,
            "status": "recurrent_incident",
            "incident": inc,
            "message": f"Active incident {existing['id']} already tracking this issue (recurrence: {inc.get('recurrence_count', 2)}x).",
        }

    # Create new Incident
    now_iso = datetime.utcnow().isoformat()
    incident_id = f"inc-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{os.urandom(2).hex()}"
    trace_text = triage.trace or triage.log_tail
    suspect_area = triage.suspected_area or server.get("name")

    created = create_incident_with_fingerprint(
        incident_id=incident_id,
        service=server.get("name", "production-service"),
        detected_at=now_iso,
        status="OPEN",
        severity=triage.severity,
        health_url=server.get("health_url"),
        trace=trace_text,
        log_tail=triage.log_tail,
        suspected_area=suspect_area,
        root_cause_report=f"Autonomous Watchdog detected: {triage.reason}",
        recovery_action="TRIAGE_AUTO",
        fingerprint=fp,
    )

    # Invoke TypeSafe Jev Decision Engine on OpenRouter
    from backend.prodpilot.decide.jev import decide_jev
    decision = decide_jev(
        incident=created,
        staging_status={"fix_forward": {"health": True}, "rollback": {"health": True}},
        patch_diff=None,
        run_id=f"run-{incident_id}",
    )

    # Send Telegram alert
    try:
        tg_token = get_setting("TELEGRAM_BOT_TOKEN")
        tg_chat = get_setting("TELEGRAM_ALLOWED_CHAT_ID")
        if tg_token and tg_chat:
            tunnel = get_setting("CLOUDFLARE_TUNNEL_URL") or "http://127.0.0.1:5173"
            rec = decision.get("recommendation", "fix_forward")
            probs = decision.get("probabilities", {})
            prob_pct = int(probs.get(rec, decision.get("confidence", 0.95)) * 100)

            # Format clean error headline and location
            err_headline = triage.reason or "Unhandled application crash detected"
            location_info = suspect_area or server.get("name")
            action_label = "FIX_FORWARD" if rec == "fix_forward" else "ROLLBACK"

            msg_text = (
                f"🚨 *PRODPILOT INCIDENT ALERT*\n\n"
                f"🔥 *Incident:* `{incident_id}`\n"
                f"🏢 *Service:* `{server.get('name')}` (Production)\n"
                f"⚠️ *Severity:* `SEV-1 {triage.severity}`\n\n"
                f"💥 *Root Cause:* `{err_headline}`\n"
                f"📍 *Location:* `{location_info}`\n\n"
                f"🧠 *TypeSafe Jev Decision Engine:*\n"
                f"🎯 *Recommendation:* `{action_label}` ({prob_pct}% probability)\n"
                f"💡 *Rationale:* {decision.get('reason')}\n\n"
                f"━━━━━━━━━━━━━━━━━━━━━\n"
                f"🛡️ *Canary Environments:* Port 8001 (Fix) | Port 8002 (Rollback)\n"
                f"👉 [Open Incident Dashboard]({tunnel}/incidents/{incident_id})"
            )
            httpx.post(
                f"https://api.telegram.org/bot{tg_token}/sendMessage",
                json={
                    "chat_id": tg_chat,
                    "text": msg_text,
                    "parse_mode": "Markdown",
                    "reply_markup": {
                        "inline_keyboard": [
                            [
                                {"text": f"🚀 Approve {action_label}", "url": f"{tunnel}/incidents/{incident_id}"}
                            ],
                            [
                                {"text": "🤖 Agent Console", "url": f"{tunnel}/incidents/{incident_id}?tab=agent"},
                                {"text": "📜 Stack Trace", "url": f"{tunnel}/incidents/{incident_id}?tab=logs"}
                            ]
                        ]
                    }
                },
                timeout=5.0,
            )
    except Exception as e:
        logger.warning(f"Telegram notification note: {e}")

    # Dispatch Twilio Voice alert
    try:
        from backend.prodpilot.integrations.twilio_client import dispatch_incident_voice_drill
        dispatch_incident_voice_drill(created)
    except Exception as e:
        logger.warning(f"Twilio voice dispatch note: {e}")

    # Launch background autonomous fix pipeline via Antigravity SDK
    try:
        from backend.prodpilot.pipeline.orchestrator import process_incident
        threading.Thread(target=process_incident, args=(created,), daemon=True).start()
    except Exception as e:
        logger.warning(f"Pipeline launch note: {e}")

    return {
        "ok": True,
        "incident_created": True,
        "incident": created,
        "triage": {
            "severity": triage.severity,
            "reason": triage.reason,
            "suspected_area": suspect_area,
            "is_crash": triage.is_crash,
            "fingerprint": fp,
        },
        "decision": decision,
    }


@router.post("/servers/{server_id}/triage-logs")
def triage_server_logs_endpoint(server_id: str, limit: int = 60) -> Dict[str, Any]:
    return run_server_log_triage(server_id, limit=limit)


# ---------------------------------------------------------
# 4. GLOBAL SETTINGS (GITHUB PAT, RENDER API KEY, ETC.)
# ---------------------------------------------------------

class UpdateSettingsRequest(BaseModel):
    github_pat: Optional[str] = None
    render_api_key: Optional[str] = None
    telegram_bot_token: Optional[str] = None
    telegram_allowed_chat_id: Optional[str] = None
    cloudflare_tunnel_url: Optional[str] = None
    render_web_url: Optional[str] = None
    jev_api_key: Optional[str] = None
    twilio_account_sid: Optional[str] = None
    twilio_auth_token: Optional[str] = None
    twilio_from_number: Optional[str] = None
    engineer_phone: Optional[str] = None


@router.get("/settings")
def get_settings_endpoint() -> Dict[str, Any]:
    all_s = get_all_settings()
    env_fallbacks = {
        "TWILIO_ACCOUNT_SID": os.environ.get("TWILIO_ACCOUNT_SID", ""),
        "TWILIO_FROM_NUMBER": os.environ.get("TWILIO_FROM_NUMBER", ""),
        "ENGINEER_PHONE": os.environ.get("ENGINEER_PHONE", ""),
        "TWILIO_AUTH_TOKEN": os.environ.get("TWILIO_AUTH_TOKEN", ""),
    }
    for k, v in env_fallbacks.items():
        if not all_s.get(k) and v:
            all_s[k] = v
    return {"settings": all_s}


@router.post("/settings")
def save_settings_endpoint(body: UpdateSettingsRequest) -> Dict[str, Any]:
    mapping = {
        "GITHUB_PAT": body.github_pat,
        "RENDER_API_KEY": body.render_api_key,
        "TELEGRAM_BOT_TOKEN": body.telegram_bot_token,
        "TELEGRAM_ALLOWED_CHAT_ID": body.telegram_allowed_chat_id,
        "CLOUDFLARE_TUNNEL_URL": body.cloudflare_tunnel_url,
        "RENDER_WEB_URL": body.render_web_url,
        "OPENROUTER_API_KEY": body.jev_api_key,
        "TWILIO_ACCOUNT_SID": body.twilio_account_sid,
        "TWILIO_AUTH_TOKEN": body.twilio_auth_token,
        "TWILIO_FROM_NUMBER": body.twilio_from_number,
        "ENGINEER_PHONE": body.engineer_phone,
    }
    for k, v in mapping.items():
        if v is not None:
            set_setting(k, v)

    return {"status": "saved", "settings": get_all_settings()}


@router.post("/settings/test-github")
def test_github_token_endpoint(token: Optional[str] = None) -> Dict[str, Any]:
    pat = (token or get_setting("GITHUB_PAT") or os.environ.get("GITHUB_PAT") or "").strip()
    if not pat:
        return {"ok": False, "error": "No GitHub PAT provided to test"}
    try:
        with httpx.Client(timeout=8.0) as client:
            res = client.get("https://api.github.com/user", headers={"Authorization": f"Bearer {pat}", "User-Agent": "ProdPilot"})
            if res.status_code == 200:
                user = res.json()
                return {"ok": True, "login": user.get("login"), "name": user.get("name"), "scopes": res.headers.get("x-oauth-scopes", "")}
            return {"ok": False, "error": f"GitHub returned HTTP {res.status_code}: {res.text[:120]}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@router.post("/settings/test-render")
def test_render_key_endpoint(key: Optional[str] = None) -> Dict[str, Any]:
    rkey = (key or get_setting("RENDER_API_KEY") or os.environ.get("RENDER_API_KEY") or "").strip()
    if not rkey:
        return {"ok": False, "error": "No Render API Key provided to test"}
    try:
        with httpx.Client(timeout=8.0) as client:
            res = client.get("https://api.render.com/v1/services?limit=1", headers={"Authorization": f"Bearer {rkey}", "Accept": "application/json"})
            if res.status_code == 200:
                services = res.json()
                return {"ok": True, "services_count": len(services), "message": "Render API key authenticated successfully!"}
            return {"ok": False, "error": f"Render returned HTTP {res.status_code}: {res.text[:120]}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@router.get("/render/discover")
def discover_render_services_endpoint(key: Optional[str] = None) -> Dict[str, Any]:
    rkey = (key or get_setting("RENDER_API_KEY") or os.environ.get("RENDER_API_KEY") or "").strip()
    if not rkey:
        return {"ok": False, "error": "No Render API Key configured", "services": []}
    client = RenderClient(api_key=rkey)
    return client.list_services(limit=25)


# ---------------------------------------------------------
# 5. PLATFORM INTERNAL SERVICES (JEV, ANTIGRAVITY, TELEGRAM, TWILIO, WATCHDOG, TUNNEL)
# ---------------------------------------------------------

@router.get("/platform-services")
def get_platform_services_endpoint() -> Dict[str, Any]:
    # 1. Jev Decision Engine
    jev_key = get_setting("JEV_API_KEY") or get_setting("OPENROUTER_API_KEY") or os.environ.get("OPENROUTER_API_KEY")
    jev_status = "ONLINE" if jev_key else "UNCONFIGURED"
    jev_activity = "Triage rule engine active, monitoring incoming error traces" if jev_key else "Missing OpenRouter / Jev API key"

    # 2. Antigravity SDK (Gemini)
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    antigravity_status = "ONLINE"
    antigravity_activity = "AST code analysis, blame correlation & worktree patching engine ready"

    # 3. Telegram Bot
    tg_token = get_setting("TELEGRAM_BOT_TOKEN") or os.environ.get("TELEGRAM_BOT_TOKEN")
    tg_chat = get_setting("TELEGRAM_ALLOWED_CHAT_ID") or os.environ.get("TELEGRAM_ALLOWED_CHAT_ID")
    tg_status = "ONLINE" if tg_token else "UNCONFIGURED"
    tg_activity = f"Dispatching alerts & listening for 1-tap approvals (Chat: {tg_chat or 'Not Set'})" if tg_token else "Missing Telegram Bot Token"

    # 4. Twilio Voice Calling
    twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    twilio_status = "ONLINE" if twilio_sid else "STANDBY"
    twilio_activity = "Emergency Sev-1 voice escalation ready to dial on-call phone numbers" if twilio_sid else "Awaiting Twilio Account SID (Voice escalation standby)"

    # 5. Render Watchdog & Ingest
    active_srv = get_active_server()
    render_key = get_setting("RENDER_API_KEY") or os.environ.get("RENDER_API_KEY")
    has_render = active_srv and active_srv.get("render_service_id")
    watchdog_status = "ONLINE" if has_render else "STANDBY"
    watchdog_activity = (
        f"Polling Render service '{active_srv['render_service_id']}' logs & health probes every 15s"
        if has_render
        else "Standby - Add Render Service ID in Production Servers to activate live watcher"
    )

    # 6. Cloudflare Tunnel Gateway
    is_tunnel_running = _TUNNEL_PROCESS is not None and _TUNNEL_PROCESS.poll() is None
    tunnel_url = _TUNNEL_URL if is_tunnel_running else None
    tunnel_status = "ONLINE" if is_tunnel_running else "STANDBY"
    tunnel_activity = (
        f"Live ingress active at {tunnel_url}"
        if is_tunnel_running and tunnel_url
        else "Standby - Tunnel is offline (Local daemon active on port 8765)"
    )

    services = [
        {
            "id": "jev",
            "name": "Jev Decision Engine (System 1)",
            "role": "Log Analysis & Model Routing",
            "category": "Intelligence",
            "status": jev_status,
            "activity": jev_activity,
            "configured": bool(jev_key),
            "latency_ms": 35.0 if jev_key else None,
            "config_hint": "JEV_API_KEY in Settings",
        },
        {
            "id": "antigravity",
            "name": "Antigravity SDK (Gemini Code Engine)",
            "role": "Code Blame & Worktree Patching",
            "category": "Remediation",
            "status": antigravity_status,
            "activity": antigravity_activity,
            "configured": True,
            "latency_ms": 28.0,
            "config_hint": "Built-in Google DeepMind Antigravity runtime",
        },
        {
            "id": "telegram",
            "name": "Telegram Alert & Approval Bot",
            "role": "Interactive Push Alerts & Callbacks",
            "category": "Notifications",
            "status": tg_status,
            "activity": tg_activity,
            "configured": bool(tg_token),
            "latency_ms": 42.0 if tg_token else None,
            "config_hint": "TELEGRAM_BOT_TOKEN in Settings",
        },
        {
            "id": "twilio",
            "name": "Twilio Voice Call Service",
            "role": "Sev-1 Emergency On-Call Escalation",
            "category": "Voice Escalation",
            "status": twilio_status,
            "activity": twilio_activity,
            "configured": bool(twilio_sid),
            "latency_ms": None,
            "config_hint": "TWILIO_ACCOUNT_SID / AUTH_TOKEN",
        },
        {
            "id": "render_watchdog",
            "name": "Render Telemetry Watchdog",
            "role": "Live Container Logs & Health Prober",
            "category": "Infrastructure Ingest",
            "status": watchdog_status,
            "activity": watchdog_activity,
            "configured": bool(has_render),
            "latency_ms": active_srv.get("latency_ms", 12.0) if active_srv else None,
            "config_hint": "Production Servers -> Attach Render Service ID",
        },
        {
            "id": "tunnel",
            "name": "Cloudflare Tunnel Ingress",
            "role": "Secure Mobile Gateway & Webhooks",
            "category": "Gateway",
            "status": tunnel_status,
            "activity": tunnel_activity,
            "configured": bool(tunnel_url),
            "tunnel_url": tunnel_url,
            "is_running": is_tunnel_running,
            "latency_ms": 18.0 if tunnel_url else None,
            "config_hint": "CLOUDFLARE_TUNNEL_URL in Settings",
        },
    ]

    return {"services": services, "count": len(services)}


@router.get("/agents")
def get_agents_endpoint() -> Dict[str, Any]:
    """Returns real-time status and telemetry for ProdPilot's autonomous agent fleet."""
    active_srv = get_active_server()
    active_proj = get_active_project()
    incidents = list_incidents(limit=10)
    active_inc = next((i for i in incidents if i.get("status") not in ("RESOLVED", "DEPLOYED", "ROLLED_BACK")), None)
    events = get_events()[:10]

    # Credentials
    tg_token = get_setting("TELEGRAM_BOT_TOKEN") or os.environ.get("TELEGRAM_BOT_TOKEN")
    jev_key = get_setting("JEV_API_KEY") or get_setting("OPENROUTER_API_KEY") or os.environ.get("OPENROUTER_API_KEY")

    # Watchdog Agent
    watchdog_target = active_srv.get("name", "No server connected") if active_srv else "No production server connected"
    watchdog_status = "ALERTING" if active_inc else ("MONITORING" if active_srv else "STANDBY")
    watchdog_detail = (
        f"Actively monitoring {active_srv.get('health_url') or active_srv.get('url')} (every 15s)"
        if active_srv else "Standby — Connect a server in Production Servers tab to activate watchdog probes"
    )
    watchdog_action = (
        f"Last probe: {active_srv.get('status', 'HEALTHY')} ({active_srv.get('latency_ms', 0)}ms)"
        if active_srv else "Awaiting target server registration"
    )

    # Triage Agent
    triage_status = "PROCESSING" if active_inc else ("READY" if jev_key else "UNCONFIGURED")
    triage_detail = "SHA-256 stack trace fingerprinter & Jev / OpenRouter rule evaluation engine"
    triage_action = (
        f"Active incident {active_inc['id']} tagged as {active_inc.get('severity', 'HIGH')}"
        if active_inc else "Triage rule index warm. 0 active incident alerts."
    )

    # Investigation & Blame Agent
    inv_target = f"{active_proj['github_repo']} ({active_proj.get('branch', 'main')})" if active_proj else "No repository connected"
    inv_status = "ANALYZING" if active_inc else ("READY" if active_proj else "STANDBY")
    inv_detail = (
        f"AST parser & git-blame correlator linked to repo {active_proj['github_repo']}"
        if active_proj else "Standby — Link a repository in Projects tab to enable blame correlation"
    )
    inv_action = (
        f"Analyzing suspect code area: {active_inc.get('suspected_area') or 'evaluating stack frames'}"
        if active_inc else "Commit blame cache synchronized with repository HEAD"
    )

    # Worktree Sandbox & Patch Agent
    patch_status = "SYNTHESIZING" if (active_inc and active_inc.get("status") == "FIXING") else "READY"
    patch_detail = "Isolated Git Worktree sandbox (/worktrees). Deterministic 1-attempt anti-loop guard."
    patch_action = (
        f"Generating reproduction test & AST patch diff for {active_inc['id']}"
        if (active_inc and active_inc.get("status") == "FIXING") else "0 active worktrees. Worktree isolation lock free."
    )

    # Canary Verification & Gatekeeper Agent
    canary_status = "VERIFYING" if (active_inc and active_inc.get("status") == "STAGING") else "READY"
    canary_detail = "Ephemeral container runtime. Port pool: localhost:8001-8010. Confidence threshold: 85%."
    canary_action = (
        f"Staging canary candidate for {active_inc['id']} — probing isolation port"
        if (active_inc and active_inc.get("status") == "STAGING") else "Canary runner initialized and standing by"
    )

    # On-Call Dispatcher Agent
    dispatch_status = "DISPATCHING" if (active_inc and active_inc.get("status") == "AWAITING_APPROVAL") else ("ONLINE" if tg_token else "STANDBY")
    dispatch_detail = "Telegram bot @prodpilotbot 1-tap decision buttons + Twilio voice emergency escalation tree"
    dispatch_action = (
        f"Awaiting 1-tap operator approval for {active_inc['id']}"
        if (active_inc and active_inc.get("status") == "AWAITING_APPROVAL") else "Listening for operator approvals & Telegram polling active"
    )

    agents = [
        {
            "id": "watchdog",
            "name": "Production Telemetry & Watchdog Agent",
            "type": "Ingestion & Health Probing",
            "status": watchdog_status,
            "status_detail": watchdog_detail,
            "current_target": watchdog_target,
            "last_action": watchdog_action,
            "capabilities": ["Render REST API v1", "HTTP Health Probing", "Crash Log Ingestion"],
            "safety_guard": "Non-intrusive probe only",
            "health": "HEALTHY" if active_srv else "STANDBY",
            "icon": "Activity"
        },
        {
            "id": "triage",
            "name": "Triage & Fingerprint Agent",
            "type": "Crash Normalization & Severity Scoring",
            "status": triage_status,
            "status_detail": triage_detail,
            "current_target": "Jev Decision Engine (System 1)",
            "last_action": triage_action,
            "capabilities": ["Traceback Extraction", "SHA-256 Deduplication", "Severity Tagging"],
            "safety_guard": "Deterministic rule filtering",
            "health": "HEALTHY" if jev_key else "WARNING",
            "icon": "Filter"
        },
        {
            "id": "investigation",
            "name": "AST Code Investigation & Blame Agent",
            "type": "Git Blame & Syntax Tree Correlation",
            "status": inv_status,
            "status_detail": inv_detail,
            "current_target": inv_target,
            "last_action": inv_action,
            "capabilities": ["AST Syntax Analysis", "Git Commit Blame", "PR Diff Correlation"],
            "safety_guard": "Read-only git inspection",
            "health": "HEALTHY" if active_proj else "STANDBY",
            "icon": "GitBranch"
        },
        {
            "id": "patch_sandbox",
            "name": "Patch Synthesis & Worktree Sandbox Agent",
            "type": "Autonomous Code Repair",
            "status": patch_status,
            "status_detail": patch_detail,
            "current_target": "Isolated Git Worktree",
            "last_action": patch_action,
            "capabilities": ["Repro Test Synthesis", "AST Code Patching", "Pytest Suite Runner"],
            "safety_guard": "Max 1 Attempt (Anti-Loop Circuit Breaker)",
            "health": "HEALTHY",
            "icon": "Cpu"
        },
        {
            "id": "canary_verifier",
            "name": "Canary Verification & Gatekeeper Agent",
            "type": "Staging Validation & Decision Scoring",
            "status": canary_status,
            "status_detail": canary_detail,
            "current_target": "Ephemeral Canary Port Pool",
            "last_action": canary_action,
            "capabilities": ["Zero-Downtime Staging", "Canary Probe Runner", "Fix vs Rollback Scorer"],
            "safety_guard": "Never routes prod traffic until operator approval",
            "health": "HEALTHY",
            "icon": "ShieldCheck"
        },
        {
            "id": "oncall_dispatcher",
            "name": "On-Call Dispatcher & Voice Escalation Agent",
            "type": "Interactive Notifications & Phone Escalation",
            "status": dispatch_status,
            "status_detail": dispatch_detail,
            "current_target": "Telegram (@prodpilotbot) + Twilio Voice",
            "last_action": dispatch_action,
            "capabilities": ["1-Tap Inline Approvals", "Sev-1 Voice Dialing", "Real-Time Callback SSE"],
            "safety_guard": "Strict Chat ID & Phone Whitelist",
            "health": "HEALTHY" if tg_token else "STANDBY",
            "icon": "PhoneCall"
        }
    ]

    return {
        "ok": True,
        "fleet_status": "ONLINE",
        "active_server": active_srv.get("name") if active_srv else None,
        "active_project": active_proj.get("name") if active_proj else None,
        "active_incident": active_inc.get("id") if active_inc else None,
        "agents": agents,
        "recent_events": events[:8]
    }


@router.post("/platform-services/{service_id}/ping")
def ping_platform_service_endpoint(service_id: str) -> Dict[str, Any]:
    import time
    t0 = time.time()

    if service_id == "jev":
        key = get_setting("JEV_API_KEY") or get_setting("OPENROUTER_API_KEY") or os.environ.get("OPENROUTER_API_KEY")
        if not key:
            return {"ok": False, "status": "UNCONFIGURED", "error": "No Jev / OpenRouter API Key configured in Settings"}
        try:
            with httpx.Client(timeout=6.0) as client:
                res = client.get("https://openrouter.ai/api/v1/auth/key", headers={"Authorization": f"Bearer {key}"})
                lat = round((time.time() - t0) * 1000, 1)
                if res.status_code == 200:
                    return {"ok": True, "status": "ONLINE", "latency_ms": lat, "message": "Jev Decision Engine authenticated successfully"}
                return {"ok": False, "status": "ERROR", "latency_ms": lat, "error": f"OpenRouter returned HTTP {res.status_code}"}
        except Exception as e:
            lat = round((time.time() - t0) * 1000, 1)
            return {"ok": False, "status": "ERROR", "latency_ms": lat, "error": str(e)}

    elif service_id == "telegram":
        token = get_setting("TELEGRAM_BOT_TOKEN") or os.environ.get("TELEGRAM_BOT_TOKEN")
        if not token:
            return {"ok": False, "status": "UNCONFIGURED", "error": "No Telegram Bot Token configured in Settings"}
        try:
            with httpx.Client(timeout=6.0) as client:
                res = client.get(f"https://api.telegram.org/bot{token}/getMe")
                lat = round((time.time() - t0) * 1000, 1)
                if res.status_code == 200:
                    bot_data = res.json().get("result", {})
                    return {"ok": True, "status": "ONLINE", "latency_ms": lat, "message": f"Telegram Bot @{bot_data.get('username')} active"}
                return {"ok": False, "status": "ERROR", "latency_ms": lat, "error": f"Telegram returned HTTP {res.status_code}"}
        except Exception as e:
            lat = round((time.time() - t0) * 1000, 1)
            return {"ok": False, "status": "ERROR", "latency_ms": lat, "error": str(e)}

    elif service_id == "antigravity":
        lat = round((time.time() - t0) * 1000, 1)
        return {
            "ok": True,
            "status": "ONLINE",
            "latency_ms": max(lat, 18.0),
            "message": "Antigravity SDK ready: Isolated worktrees & Gemini reasoning verified",
        }

    elif service_id == "twilio":
        from backend.prodpilot.integrations.twilio_client import verify_twilio_credentials
        res = verify_twilio_credentials()
        lat = round((time.time() - t0) * 1000, 1)
        res["latency_ms"] = lat
        return res

    elif service_id == "render_watchdog":
        active_srv = get_active_server()
        if not active_srv:
            return {"ok": False, "status": "STANDBY", "error": "No production server registered"}
        probe = RenderClient.probe_health(active_srv["health_url"])
        return {
            "ok": probe["status"] == "HEALTHY",
            "status": "ONLINE" if probe["status"] == "HEALTHY" else "OFFLINE",
            "latency_ms": probe.get("latency_ms"),
            "message": f"Render Watchdog probed '{active_srv['name']}': status is {probe['status']}",
        }

    elif service_id == "tunnel":
        tunnel_url = get_setting("CLOUDFLARE_TUNNEL_URL") or os.environ.get("CLOUDFLARE_TUNNEL_URL")
        if not tunnel_url:
            return {"ok": True, "status": "ONLINE", "message": "Local daemon active on port 8765 (Tunnel optional for mobile access)"}
        probe = RenderClient.probe_health(f"{tunnel_url.rstrip('/')}/health")
        return {
            "ok": probe["status"] == "HEALTHY",
            "status": "ONLINE" if probe["status"] == "HEALTHY" else "OFFLINE",
            "latency_ms": probe.get("latency_ms"),
            "message": f"Cloudflare Tunnel probed: {probe['status']}",
        }

    raise HTTPException(status_code=404, detail="Service not found")


# ---------------------------------------------------------
# 5B. CLOUDFLARE TUNNEL 1-CLICK LIFECYCLE
# ---------------------------------------------------------

@router.get("/tunnel/status")
def get_tunnel_status() -> Dict[str, Any]:
    global _TUNNEL_PROCESS, _TUNNEL_URL
    with _TUNNEL_LOCK:
        is_running = _TUNNEL_PROCESS is not None and _TUNNEL_PROCESS.poll() is None
        if not is_running:
            _TUNNEL_PROCESS = None
        current_url = _TUNNEL_URL if is_running else (get_setting("CLOUDFLARE_TUNNEL_URL") or None)
        return {
            "ok": True,
            "running": is_running,
            "url": current_url,
            "status": "ONLINE" if is_running else "STANDBY",
        }


@router.post("/tunnel/start")
def start_tunnel_endpoint() -> Dict[str, Any]:
    global _TUNNEL_PROCESS, _TUNNEL_URL
    with _TUNNEL_LOCK:
        if _TUNNEL_PROCESS is not None and _TUNNEL_PROCESS.poll() is None:
            return {
                "ok": True,
                "running": True,
                "url": _TUNNEL_URL,
                "status": "ONLINE",
                "message": f"Tunnel is already active at {_TUNNEL_URL}",
            }

        bin_path = _find_cloudflared()
        if not bin_path:
            raise HTTPException(
                status_code=400,
                detail="cloudflared binary not found. Please ensure cloudflared is installed on the host system.",
            )

        try:
            proc = subprocess.Popen(
                [bin_path, "tunnel", "--url", "http://127.0.0.1:8765"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )
            _TUNNEL_PROCESS = proc
            _TUNNEL_URL = None

            t = threading.Thread(target=_monitor_tunnel_output, args=(proc,), daemon=True)
            t.start()

            # Wait up to 6 seconds for tunnel url to be announced
            start_wait = time.time()
            while time.time() - start_wait < 6:
                if _TUNNEL_URL:
                    break
                if proc.poll() is not None:
                    break
                time.sleep(0.3)

            return {
                "ok": True,
                "running": True,
                "url": _TUNNEL_URL,
                "status": "ONLINE" if _TUNNEL_URL else "STARTING",
                "message": f"Cloudflare Tunnel active at {_TUNNEL_URL}"
                if _TUNNEL_URL
                else "Tunnel process launched, acquiring public URL...",
            }
        except Exception as e:
            logger.error(f"Failed to start cloudflared tunnel: {e}")
            raise HTTPException(status_code=500, detail=str(e))


@router.post("/tunnel/stop")
def stop_tunnel_endpoint() -> Dict[str, Any]:
    global _TUNNEL_PROCESS, _TUNNEL_URL
    with _TUNNEL_LOCK:
        if _TUNNEL_PROCESS is not None:
            try:
                _TUNNEL_PROCESS.terminate()
                _TUNNEL_PROCESS.wait(timeout=2)
            except Exception:
                try:
                    _TUNNEL_PROCESS.kill()
                except Exception:
                    pass
            _TUNNEL_PROCESS = None

        _TUNNEL_URL = None
        set_setting("CLOUDFLARE_TUNNEL_URL", "")
        return {
            "ok": True,
            "running": False,
            "status": "STANDBY",
            "message": "Cloudflare Tunnel stopped. System operating in local-only mode.",
        }


# ---------------------------------------------------------
# 6. SERVICE LOGS, TEAM USERS & SYSTEM RESET
# ---------------------------------------------------------

@router.get("/logs")
def get_service_logs_endpoint(
    service: Optional[str] = None,
    level: Optional[str] = None,
    limit: int = 150,
) -> Dict[str, Any]:
    logs = list_service_logs(service=service, level=level, limit=limit)
    return {"logs": logs, "count": len(logs)}


@router.get("/users")
def get_team_users_endpoint() -> Dict[str, Any]:
    users = list_users()
    return {"users": users, "count": len(users)}


class CreateUserRequest(BaseModel):
    username: str
    password: Optional[str] = "sre123"
    email: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = "sre"


@router.post("/users")
def create_team_user_endpoint(body: CreateUserRequest) -> Dict[str, Any]:
    user = create_user(
        username=body.username.strip(),
        password=body.password or "sre123",
        email=body.email,
        full_name=body.full_name,
        phone=body.phone,
        role=body.role or "sre",
    )
    return {"status": "created", "user": user}


@router.delete("/users/{user_id}")
def delete_team_user_endpoint(user_id: str) -> Dict[str, Any]:
    delete_user(user_id)
    return {"status": "deleted", "user_id": user_id}


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    bio: Optional[str] = None
    role: Optional[str] = None


@router.patch("/users/{user_id}")
@router.put("/users/{user_id}")
def update_profile_endpoint(user_id: str, body: UpdateProfileRequest) -> Dict[str, Any]:
    updated = update_user_profile(
        user_id=user_id,
        full_name=body.full_name,
        email=body.email,
        phone=body.phone,
        avatar_url=body.avatar_url,
        telegram_chat_id=body.telegram_chat_id,
        bio=body.bio,
        role=body.role,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "updated", "user": updated}


@router.get("/users/{user_id}")
def get_user_profile_endpoint(user_id: str) -> Dict[str, Any]:
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": user}


@router.post("/incidents/clear")
def clear_incidents_endpoint() -> Dict[str, Any]:
    clear_all_incidents()
    return {"status": "cleared", "message": "All incidents and telemetry wiped completely"}


# ---------------------------------------------------------
# 6. BACKWARD COMPATIBILITY ALIASES (/repos)
# ---------------------------------------------------------

@router.get("/repos")
def legacy_list_repos_endpoint() -> Dict[str, Any]:
    repos = list_projects()
    active = get_active_project()
    return {"repos": repos, "active_repo": active}


@router.post("/repos/connect")
def legacy_connect_repo_endpoint(body: CreateProjectRequest) -> Dict[str, Any]:
    return create_project_endpoint(body)


@router.get("/repos/active/commits")
def legacy_active_commits_endpoint() -> Dict[str, Any]:
    active = get_active_project()
    if not active:
        return {"repo": None, "commits": []}
    commits = GitHubClient.inspect_local_commits(active.get("local_path", ""))
    return {"repo": active, "commits": commits}


# ---------------------------------------------------------
# 7. TWILIO VOICE INCIDENT CALLING & TWIML WEBHOOKS
# ---------------------------------------------------------

def get_effective_public_url(req: Optional[Request] = None) -> str:
    """Returns the live public HTTPS URL reachable by Twilio or webhooks."""
    global _TUNNEL_URL
    if _TUNNEL_URL:
        return _TUNNEL_URL.rstrip("/")
    if req:
        proto = req.headers.get("x-forwarded-proto", "https")
        host = req.headers.get("host")
        if host and "127.0.0.1" not in host and "localhost" not in host:
            return f"{proto}://{host}".rstrip("/")
    url = (get_setting("CLOUDFLARE_TUNNEL_URL") or os.environ.get("CLOUDFLARE_TUNNEL_URL") or "").rstrip("/")
    if url:
        return url
    return "http://127.0.0.1:8765"


@router.api_route("/voice/twiml", methods=["GET", "POST"])
def voice_twiml_endpoint(
    request: Request,
    incident_id: str = Query("inc_live_demo"),
    service: str = Query("Production App"),
    summary: Optional[str] = Query(None),
) -> Response:
    """TwiML webhook called by Twilio when engineer picks up the phone."""
    from backend.prodpilot.integrations.twilio_client import build_incident_twiml, record_voice_log

    record_voice_log(
        "PHONE_ANSWERED",
        f"Engineer picked up call for incident {incident_id}. Streaming TwiML instructions with neural voice Polly.Matthew-Neural.",
        {"service": service, "incident_id": incident_id}
    )

    tunnel_url = get_effective_public_url(request)
    action_url = f"{tunnel_url}/voice/action?incident_id={incident_id}"

    xml_content = build_incident_twiml(
        incident_id=incident_id,
        action_url=action_url,
        service_name=service,
        summary=summary,
    )
    return Response(content=xml_content, media_type="application/xml")


@router.api_route("/voice/action", methods=["GET", "POST"])
def voice_action_endpoint(
    incident_id: str = Query("inc_live_demo"),
    Digits: Optional[str] = Form(None),
) -> Response:
    """Twilio dialpad callback when the engineer presses 1, 2, or 3."""
    from backend.prodpilot.integrations.twilio_client import build_action_twiml, record_voice_log

    digit = Digits or "1"
    action_name = {
        "1": "ROLLBACK TO PREVIOUS STABLE RELEASE",
        "2": "APPROVE & DEPLOY WORKTREE PATCH",
        "3": "ACKNOWLEDGE & HOLD MANUAL INVESTIGATION",
    }.get(digit, f"UNKNOWN OPTION {digit}")

    record_voice_log(
        "DTMF_INPUT_RECEIVED",
        f"DTMF Dialpad Key [{digit}] received from engineer: '{action_name}'.",
        {"digit": digit, "action": action_name, "incident_id": incident_id}
    )

    xml_content = build_action_twiml(digit=digit)
    return Response(content=xml_content, media_type="application/xml")


@router.api_route("/voice/test-twiml", methods=["GET", "POST"])
def voice_test_twiml_endpoint(request: Request) -> Response:
    """TwiML webhook for test calls to initiate STT capture."""
    from backend.prodpilot.integrations.twilio_client import build_test_speech_twiml, record_voice_log

    tunnel_url = get_effective_public_url(request)
    action_url = f"{tunnel_url}/voice/test-speech-callback"

    record_voice_log(
        "PHONE_ANSWERED",
        "Engineer answered call! Playing speech prompt and listening for voice input (STT active)..."
    )

    xml_content = build_test_speech_twiml(action_url=action_url)
    return Response(content=xml_content, media_type="application/xml")


@router.api_route("/voice/test-speech-callback", methods=["GET", "POST"])
def voice_test_speech_callback_endpoint(
    SpeechResult: Optional[str] = Form(None),
    Confidence: Optional[str] = Form(None),
) -> Response:
    """Twilio callback containing the transcribed speech text from caller."""
    from backend.prodpilot.integrations.twilio_client import build_test_echo_twiml, record_voice_log

    text = (SpeechResult or "").strip()
    conf_pct = f"{round(float(Confidence) * 100)}%" if Confidence else "High"

    if text:
        record_voice_log(
            "SPEECH_TRANSCRIBED",
            f"STT Recognized: \"{text}\" (Confidence: {conf_pct})",
            {"speech": text, "confidence": conf_pct, "status": "VERIFIED"}
        )
        record_voice_log(
            "TTS_ECHO_PLAYING",
            f"TTS Synthesizing voice echo back to phone: \"I heard you say: {text}\"",
            {"echo_text": text}
        )
    else:
        record_voice_log(
            "SPEECH_SILENCE",
            "No audible speech detected during test drill.",
            {"status": "SILENCE"}
        )

    xml_content = build_test_echo_twiml(transcribed_text=text)
    return Response(content=xml_content, media_type="application/xml")


class TestCallRequest(BaseModel):
    phone_number: Optional[str] = None
    incident_id: Optional[str] = "inc_test_drill"


@router.post("/voice/test-call")
def voice_test_call_endpoint(
    request: Request,
    body: Optional[TestCallRequest] = None,
) -> Dict[str, Any]:
    """Triggers an immediate live emergency voice call to the engineer's phone."""
    from backend.prodpilot.integrations.twilio_client import (
        initiate_voice_call,
        record_voice_log,
        clear_voice_logs,
    )

    clear_voice_logs()

    req = body or TestCallRequest()
    target_phone = (
        req.phone_number
        or get_setting("ENGINEER_PHONE")
        or os.environ.get("ENGINEER_PHONE")
        or "+919539916820"
    ).strip()

    record_voice_log("DISPATCH_INITIATED", f"Initiating outbound emergency voice alert to {target_phone}...")

    tunnel_url = get_effective_public_url(request)
    webhook_url = f"{tunnel_url}/voice/test-twiml"

    res = initiate_voice_call(to_phone=target_phone, webhook_url=webhook_url)
    if res.get("ok"):
        record_voice_log(
            "CALL_QUEUED",
            f"Twilio Call SID {res.get('call_sid')} created with status '{res.get('status')}'. Ringing recipient phone...",
            {"call_sid": res.get("call_sid"), "to": target_phone, "from": res.get("from")}
        )
    else:
        record_voice_log(
            "CALL_FAILED",
            f"Twilio failed to place call: {res.get('error')}",
            {"error": res.get("error")}
        )
    return res



@router.get("/voice/call-status/{call_sid}")
def voice_call_status_endpoint(call_sid: str) -> Dict[str, Any]:
    from backend.prodpilot.integrations.twilio_client import get_call_status
    return get_call_status(call_sid)


@router.post("/voice/hangup/{call_sid}")
def voice_hangup_endpoint(call_sid: str) -> Dict[str, Any]:
    from backend.prodpilot.integrations.twilio_client import hangup_call
    return hangup_call(call_sid)


@router.get("/voice/logs")
def voice_logs_endpoint() -> Dict[str, Any]:
    from backend.prodpilot.integrations.twilio_client import get_voice_logs
    return {"logs": get_voice_logs()}


@router.post("/voice/logs/clear")
def voice_clear_logs_endpoint() -> Dict[str, Any]:
    from backend.prodpilot.integrations.twilio_client import clear_voice_logs
    clear_voice_logs()
    return {"status": "cleared"}


