"""ProdPilot Platform Connect Router
Provides endpoints for:
1. Authentication (Signup, Login, Me)
2. Repository Connection (Validate local path, inspect git status, connect)
3. Server Connection (Probe health URL, measure latency, track status)
"""

import logging
import os
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from backend.prodpilot.db import (
    authenticate_user,
    connect_repo,
    connect_server,
    create_user,
    delete_repo,
    delete_server,
    get_active_repo,
    get_active_server,
    get_user_by_id,
    list_repos,
    list_servers,
    set_active_repo,
    set_active_server,
    update_server_status,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["platform"])


# ---------------------------------------------------------
# 1. AUTHENTICATION MODELS & ENDPOINTS
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
    """Simple bearer session token encoding user_id."""
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

    # Fallback to default admin for zero-friction local workflow
    admin = get_user_by_id("usr-admin")
    if admin:
        return {"authenticated": True, "user": admin, "is_default": True}

    raise HTTPException(status_code=401, detail="Unauthorized")


# ---------------------------------------------------------
# 2. REPOSITORY CONNECTION MODELS & ENDPOINTS
# ---------------------------------------------------------

class ConnectRepoRequest(BaseModel):
    name: str
    local_path: str
    test_cmd: Optional[str] = "pytest"
    health_url: Optional[str] = "http://127.0.0.1:8000/health"
    start_cmd: Optional[str] = ""
    port: Optional[int] = 8000
    set_active: Optional[bool] = True


@router.get("/repos")
def list_repos_endpoint() -> Dict[str, Any]:
    repos = list_repos()
    active = get_active_repo()
    return {"repos": repos, "active_repo": active}


@router.post("/repos/connect")
def connect_repo_endpoint(body: ConnectRepoRequest) -> Dict[str, Any]:
    raw_path = os.path.expanduser(body.local_path.strip())
    repo_path = Path(raw_path).resolve()

    if not repo_path.exists():
        raise HTTPException(
            status_code=400,
            detail=f"Local path does not exist on disk: {repo_path}"
        )
    if not repo_path.is_dir():
        raise HTTPException(
            status_code=400,
            detail=f"Path is not a directory: {repo_path}"
        )

    # Check git repository validity
    git_dir = repo_path / ".git"
    is_git = git_dir.exists()
    branch = "unknown"
    commit_hash = "none"

    if is_git:
        try:
            res_b = subprocess.run(
                ["git", "rev-parse", "--abbrev-ref", "HEAD"],
                cwd=str(repo_path),
                capture_output=True,
                text=True,
                timeout=3,
            )
            if res_b.returncode == 0:
                branch = res_b.stdout.strip()
            res_c = subprocess.run(
                ["git", "rev-parse", "--short", "HEAD"],
                cwd=str(repo_path),
                capture_output=True,
                text=True,
                timeout=3,
            )
            if res_c.returncode == 0:
                commit_hash = res_c.stdout.strip()
        except Exception as e:
            logger.debug(f"Git inspection note: {e}")
    else:
        # Auto initialize git if requested or needed
        try:
            subprocess.run(["git", "init", "-b", "main"], cwd=str(repo_path), capture_output=True, timeout=5)
            branch = "main"
        except Exception:
            pass

    # Save to database
    record = connect_repo(
        name=body.name.strip(),
        local_path=str(repo_path),
        test_cmd=body.test_cmd or "pytest",
        health_url=body.health_url or "http://127.0.0.1:8000/health",
        start_cmd=body.start_cmd or "",
        port=body.port or 8000,
        set_active=body.set_active if body.set_active is not None else True,
    )

    return {
        "status": "connected",
        "repo": record,
        "git": {
            "is_git": is_git,
            "branch": branch,
            "commit": commit_hash,
            "local_path": str(repo_path),
        },
        "message": f"Repository '{body.name}' connected successfully!",
    }


@router.post("/repos/{repo_id}/activate")
def activate_repo_endpoint(repo_id: str) -> Dict[str, Any]:
    set_active_repo(repo_id)
    active = get_active_repo()
    return {"status": "activated", "active_repo": active}


@router.delete("/repos/{repo_id}")
def delete_repo_endpoint(repo_id: str) -> Dict[str, Any]:
    delete_repo(repo_id)
    return {"status": "deleted", "repo_id": repo_id}


# ---------------------------------------------------------
# 3. SERVER CONNECTION MODELS & ENDPOINTS
# ---------------------------------------------------------

class ConnectServerRequest(BaseModel):
    name: str
    health_url: str
    port: Optional[int] = 8000
    host: Optional[str] = "127.0.0.1"
    repo_id: Optional[str] = None
    set_active: Optional[bool] = True


def probe_health_endpoint(url: str, timeout_sec: float = 2.5) -> Dict[str, Any]:
    """Sends an HTTP GET to probe the server health endpoint and records latency."""
    t0 = time.time()
    try:
        with httpx.Client(timeout=timeout_sec) as client:
            resp = client.get(url)
            elapsed_ms = round((time.time() - t0) * 1000, 2)
            if resp.status_code == 200:
                return {
                    "status": "HEALTHY",
                    "status_code": resp.status_code,
                    "latency_ms": elapsed_ms,
                    "body": resp.text[:200],
                }
            elif resp.status_code >= 500:
                return {
                    "status": "DEGRADED",
                    "status_code": resp.status_code,
                    "latency_ms": elapsed_ms,
                    "body": resp.text[:200],
                }
            else:
                return {
                    "status": "WARNING",
                    "status_code": resp.status_code,
                    "latency_ms": elapsed_ms,
                    "body": resp.text[:200],
                }
    except httpx.ConnectError:
        return {
            "status": "OFFLINE",
            "status_code": 0,
            "latency_ms": 0.0,
            "error": "Connection refused (Server is not running on this port)",
        }
    except httpx.TimeoutException:
        return {
            "status": "TIMEOUT",
            "status_code": 0,
            "latency_ms": timeout_sec * 1000,
            "error": f"Connection timed out after {timeout_sec}s",
        }
    except Exception as e:
        return {
            "status": "ERROR",
            "status_code": 0,
            "latency_ms": 0.0,
            "error": str(e),
        }


@router.get("/servers")
def list_servers_endpoint() -> Dict[str, Any]:
    servers = list_servers()
    active = get_active_server()
    return {"servers": servers, "active_server": active}


@router.post("/servers/connect")
def connect_server_endpoint(body: ConnectServerRequest) -> Dict[str, Any]:
    probe = probe_health_endpoint(body.health_url.strip())

    record = connect_server(
        name=body.name.strip(),
        health_url=body.health_url.strip(),
        port=body.port or 8000,
        host=body.host or "127.0.0.1",
        repo_id=body.repo_id,
        status=probe["status"],
        latency_ms=probe.get("latency_ms", 0.0),
        set_active=body.set_active if body.set_active is not None else True,
    )

    return {
        "status": "connected",
        "server": record,
        "probe": probe,
        "message": f"Server '{body.name}' registered. Live status: {probe['status']}",
    }


@router.post("/servers/{server_id}/ping")
def ping_server_endpoint(server_id: str) -> Dict[str, Any]:
    servers = list_servers()
    target = next((s for s in servers if s["id"] == server_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Server not found")

    probe = probe_health_endpoint(target["health_url"])
    update_server_status(
        server_id=server_id,
        status=probe["status"],
        latency_ms=probe.get("latency_ms", 0.0),
    )

    return {
        "server_id": server_id,
        "name": target["name"],
        "health_url": target["health_url"],
        "probe": probe,
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
