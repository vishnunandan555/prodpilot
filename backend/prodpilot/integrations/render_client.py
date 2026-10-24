"""ProdPilot Render REST API Client
Communicates directly with the Render API (https://api.render.com/v1)
to inspect production services, fetch deployment history, probe endpoints,
and stream live production logs.
"""

import logging
import re
import time
from typing import Any, Dict, List, Optional
import httpx

logger = logging.getLogger(__name__)

RENDER_API_BASE = "https://api.render.com/v1"

# In-memory caches to respect Render API rate limits (30 req/min on /v1/logs)
_SERVICE_META_CACHE: Dict[str, Dict[str, Any]] = {}
_OWNER_ID_CACHE: Dict[str, str] = {}
_LAST_LOGS_CACHE: Dict[str, Dict[str, Any]] = {}


class RenderClient:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = (api_key or "").strip()

    def _headers(self, custom_key: Optional[str] = None) -> Dict[str, str]:
        key = (custom_key or self.api_key or "").strip()
        headers = {
            "Accept": "application/json",
            "User-Agent": "ProdPilot-Autonomous-SRE/1.0",
        }
        if key:
            headers["Authorization"] = f"Bearer {key}"
        return headers

    def get_service(self, service_id: str, api_key: Optional[str] = None) -> Dict[str, Any]:
        """Fetches live service metadata from Render API v1."""
        sid = service_id.strip()
        url = f"{RENDER_API_BASE}/services/{sid}"
        headers = self._headers(api_key)

        if not headers.get("Authorization"):
            return {
                "ok": False,
                "error": "Render API key not configured. Add your Render API Key in Settings or Server configuration.",
                "service": None,
            }

        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(url, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    details = data.get("serviceDetails") or {}
                    return {
                        "ok": True,
                        "service": {
                            "id": data.get("id", sid),
                            "name": data.get("name", "Unknown Service"),
                            "type": data.get("type", "web_service"),
                            "repo": data.get("repo", ""),
                            "branch": data.get("branch", "main"),
                            "url": details.get("url", ""),
                            "region": details.get("region", "oregon"),
                            "env": details.get("env", "python"),
                            "status": data.get("suspended", "not_suspended"),
                            "plan": details.get("plan", "free"),
                            "suspended": data.get("suspended", "not_suspended"),
                            "dashboardUrl": data.get("dashboardUrl", ""),
                            "autoDeploy": data.get("autoDeploy", "yes"),
                            "updated_at": data.get("updatedAt", ""),
                        },
                    }
                elif res.status_code == 401:
                    return {"ok": False, "error": "Invalid Render API Key (Unauthorized 401)", "service": None}
                elif res.status_code == 404:
                    return {"ok": False, "error": f"Render service ID '{sid}' not found (404)", "service": None}
                else:
                    return {"ok": False, "error": f"Render API returned HTTP {res.status_code}: {res.text[:200]}", "service": None}
        except Exception as e:
            logger.warning(f"Failed to fetch Render service {sid}: {e}")
            return {"ok": False, "error": str(e), "service": None}

    def list_services(self, limit: int = 25, api_key: Optional[str] = None) -> Dict[str, Any]:
        """Queries Render API v1 for all services associated with the API key."""
        url = f"{RENDER_API_BASE}/services?limit={limit}"
        headers = self._headers(api_key)
        if not headers.get("Authorization"):
            return {"ok": False, "error": "Render API key not provided", "services": []}
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(url, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    services = []
                    for item in data:
                        svc = item.get("service") if isinstance(item, dict) and "service" in item else item
                        details = svc.get("serviceDetails") or {}
                        services.append({
                            "id": svc.get("id"),
                            "name": svc.get("name"),
                            "type": svc.get("type"),
                            "repo": svc.get("repo", ""),
                            "branch": svc.get("branch", "main"),
                            "url": details.get("url", ""),
                            "healthCheckPath": details.get("healthCheckPath", ""),
                            "suspended": svc.get("suspended", "not_suspended"),
                            "dashboardUrl": svc.get("dashboardUrl", ""),
                        })
                    return {"ok": True, "services": services}
                return {"ok": False, "error": f"Render API returned HTTP {res.status_code}: {res.text[:120]}", "services": []}
        except Exception as e:
            return {"ok": False, "error": str(e), "services": []}

    def get_deploys(self, service_id: str, api_key: Optional[str] = None, limit: int = 20) -> Dict[str, Any]:
        """Fetches deployment history for a Render service."""
        sid = service_id.strip()
        url = f"{RENDER_API_BASE}/services/{sid}/deploys?limit={limit}"
        headers = self._headers(api_key)

        if not headers.get("Authorization"):
            return {"ok": False, "error": "Render API key not provided", "deploys": []}

        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(url, headers=headers)
                if res.status_code == 200:
                    raw_deploys = res.json()
                    deploys = []
                    for d in raw_deploys:
                        deploy_obj = d.get("deploy") if "deploy" in d else d
                        commit = deploy_obj.get("commit") or {}
                        full_commit_id = commit.get("id") or ""
                        deploys.append({
                            "id": deploy_obj.get("id", ""),
                            "status": deploy_obj.get("status", "unknown").upper(),
                            "trigger": deploy_obj.get("trigger", "unknown"),
                            "commit_id": full_commit_id[:8] if full_commit_id else "HEAD",
                            "commit_hash": full_commit_id,
                            "commit_message": commit.get("message", "No commit message"),
                            "created_at": deploy_obj.get("createdAt", ""),
                            "updated_at": deploy_obj.get("updatedAt", ""),
                            "finished_at": deploy_obj.get("finishedAt", ""),
                        })
                    return {"ok": True, "deploys": deploys}
                return {"ok": False, "error": f"Render API error {res.status_code}", "deploys": []}
        except Exception as e:
            return {"ok": False, "error": str(e), "deploys": []}

    def get_deploy(self, service_id: str, deploy_id: str, api_key: Optional[str] = None) -> Dict[str, Any]:
        """Fetches status of a specific deployment."""
        sid = service_id.strip()
        did = deploy_id.strip()
        url = f"{RENDER_API_BASE}/services/{sid}/deploys/{did}"
        headers = self._headers(api_key)

        if not headers.get("Authorization"):
            return {"ok": False, "error": "Render API key not provided"}

        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(url, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    deploy_obj = data.get("deploy") if "deploy" in data else data
                    commit = deploy_obj.get("commit") or {}
                    return {
                        "ok": True,
                        "deploy": {
                            "id": deploy_obj.get("id"),
                            "status": deploy_obj.get("status", "unknown").upper(),
                            "trigger": deploy_obj.get("trigger", "unknown"),
                            "commit_id": (commit.get("id") or "")[:8],
                            "commit_hash": commit.get("id") or "",
                            "commit_message": commit.get("message", "No commit message"),
                            "created_at": deploy_obj.get("createdAt", ""),
                            "finished_at": deploy_obj.get("finishedAt", ""),
                        },
                    }
                return {"ok": False, "error": f"Render API error {res.status_code}: {res.text}"}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def trigger_deploy(
        self,
        service_id: str,
        api_key: Optional[str] = None,
        clear_cache: bool = False,
        commit_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Triggers an automated redeployment for a Render service, optionally targeting a specific commit."""
        sid = service_id.strip()
        url = f"{RENDER_API_BASE}/services/{sid}/deploys"
        headers = self._headers(api_key)

        if not headers.get("Authorization"):
            return {"ok": False, "error": "Render API key not provided"}

        body: Dict[str, Any] = {"clearCache": "clear" if clear_cache else "do_not_clear"}
        if commit_id and commit_id.strip():
            body["commitId"] = commit_id.strip()

        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, headers=headers, json=body)
                if res.status_code in (200, 201):
                    data = res.json()
                    deploy_obj = data.get("deploy") if "deploy" in data else data
                    commit = deploy_obj.get("commit") or {}
                    return {
                        "ok": True,
                        "deploy_id": deploy_obj.get("id"),
                        "status": deploy_obj.get("status", "created").upper(),
                        "commit_id": (commit.get("id") or (commit_id or ""))[:8],
                        "commit_hash": commit.get("id") or commit_id or "",
                        "raw": deploy_obj,
                    }
                return {"ok": False, "error": f"Render API error {res.status_code}: {res.text}"}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def cancel_deploy(self, service_id: str, deploy_id: str, api_key: Optional[str] = None) -> Dict[str, Any]:
        """Cancels an in-progress deployment on Render."""
        sid = service_id.strip()
        did = deploy_id.strip()
        url = f"{RENDER_API_BASE}/services/{sid}/deploys/{did}/cancel"
        headers = self._headers(api_key)

        if not headers.get("Authorization"):
            return {"ok": False, "error": "Render API key not provided"}

        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.post(url, headers=headers)
                if res.status_code in (200, 204):
                    return {"ok": True, "message": f"Deployment {did} canceled."}
                return {"ok": False, "error": f"Render API error {res.status_code}: {res.text}"}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def get_logs(self, service_id: str, api_key: Optional[str] = None, limit: int = 100, force: bool = False) -> Dict[str, Any]:
        """Fetches live application stdout/stderr logs from Render API v1 with intelligent rate limit quota conservation."""
        sid = service_id.strip()
        headers = self._headers(api_key)

        if not headers.get("Authorization"):
            return {
                "ok": False,
                "error": "Render API key not provided. Add your key in Settings to stream live telemetry from Render.",
                "logs": [],
                "is_suspended": False,
            }

        now = time.time()

        # In-memory shared cache to guarantee Render API 30 req/min limit is never violated
        cached_entry = _LAST_LOGS_CACHE.get(sid)
        if cached_entry:
            cache_age = now - cached_entry.get("cached_at", 0)
            last_rate = cached_entry.get("rate_limit", {})
            remaining = last_rate.get("remaining", 30)

            # If quota is dangerously low (remaining <= 3), never hit Render even if forced
            if remaining <= 3:
                reset_sec = max(0, int(last_rate.get("reset", 0) - cache_age))
                return {
                    "ok": True,
                    "logs": cached_entry.get("logs", []),
                    "count": len(cached_entry.get("logs", [])),
                    "is_suspended": cached_entry.get("is_suspended", False),
                    "service_name": cached_entry.get("service_name", "production-service"),
                    "rate_limit": {**last_rate, "reset": reset_sec},
                    "rate_limited": True,
                    "cached": True,
                    "rate_conserved": True,
                }

            # Adaptive TTL:
            # - Normal: 5.0s (max 12 calls/min to Render across all clients & background watchdogs)
            # - Low quota (remaining <= 10): 15.0s (max 4 calls/min)
            ttl = 15.0 if remaining <= 10 else 5.0
            if not force and cache_age < ttl:
                reset_sec = max(0, int(last_rate.get("reset", 0) - cache_age))
                return {
                    "ok": True,
                    "logs": cached_entry.get("logs", []),
                    "count": len(cached_entry.get("logs", [])),
                    "is_suspended": cached_entry.get("is_suspended", False),
                    "service_name": cached_entry.get("service_name", "production-service"),
                    "rate_limit": {**last_rate, "reset": reset_sec},
                    "rate_limited": False,
                    "cached": True,
                    "cache_age": round(cache_age, 1),
                }

        try:
            with httpx.Client(timeout=10.0) as client:
                # 1. Resolve service metadata with 60s cache to preserve Render API quota
                cached_meta = _SERVICE_META_CACHE.get(sid)
                if not cached_meta or (now - cached_meta.get("cached_at", 0)) > 60:
                    s_res = client.get(f"{RENDER_API_BASE}/services/{sid}", headers=headers)
                    if s_res.status_code == 200:
                        svc = s_res.json()
                        cached_meta = {
                            "is_suspended": svc.get("suspended") == "suspended",
                            "svc_name": svc.get("name", "production-service"),
                            "owner_id": svc.get("ownerId"),
                            "cached_at": now,
                        }
                        _SERVICE_META_CACHE[sid] = cached_meta
                    else:
                        cached_meta = cached_meta or {
                            "is_suspended": False,
                            "svc_name": "production-service",
                            "owner_id": None,
                            "cached_at": now,
                        }

                is_suspended = cached_meta.get("is_suspended", False)
                svc_name = cached_meta.get("svc_name", "production-service")
                owner_id = cached_meta.get("owner_id")

                # Resolve owner_id with long-lived cache
                cache_key = headers.get("Authorization", "")
                if not owner_id:
                    owner_id = _OWNER_ID_CACHE.get(cache_key)
                if not owner_id:
                    owners_res = client.get(f"{RENDER_API_BASE}/owners", headers=headers)
                    if owners_res.status_code == 200:
                        raw_owners = owners_res.json()
                        if raw_owners and isinstance(raw_owners, list):
                            owner_id = raw_owners[0].get("owner", {}).get("id")
                            if owner_id:
                                _OWNER_ID_CACHE[cache_key] = owner_id
                                cached_meta["owner_id"] = owner_id

                logs = []
                rate_limit = {"limit": 30, "remaining": 30, "reset": 0}

                # 2. Query official Render application runtime logs endpoint (GET /v1/logs)
                if not owner_id:
                    return {
                        "ok": False,
                        "error": f"Could not determine Render owner ID for service '{sid}'",
                        "logs": [],
                        "is_suspended": is_suspended,
                        "service_name": svc_name,
                        "rate_limit": rate_limit,
                        "rate_limited": False,
                    }

                logs_url = f"{RENDER_API_BASE}/logs?ownerId={owner_id}&resource={sid}&limit={limit}&direction=backward"
                logs_res = client.get(logs_url, headers=headers)

                # Extract rate limit headers from Render response
                try:
                    rate_limit = {
                        "limit": int(logs_res.headers.get("ratelimit-limit", 30)),
                        "remaining": int(logs_res.headers.get("ratelimit-remaining", 30)),
                        "reset": int(logs_res.headers.get("ratelimit-reset", 0)),
                    }
                except Exception:
                    pass

                if logs_res.status_code == 429:
                    logger.warning(f"Render API rate limit reached (429). Reset in {rate_limit.get('reset')}s")
                    last_cache = _LAST_LOGS_CACHE.get(sid, {})
                    return {
                        "ok": False,
                        "logs": last_cache.get("logs", []),
                        "count": len(last_cache.get("logs", [])),
                        "is_suspended": is_suspended,
                        "service_name": svc_name,
                        "rate_limit": rate_limit,
                        "rate_limited": True,
                        "error": f"Render API rate limit reached (429). Reset in {rate_limit.get('reset', 60)}s",
                    }

                if logs_res.status_code != 200:
                    err_msg = f"Render API returned HTTP {logs_res.status_code}: {logs_res.text[:120]}"
                    logger.warning(f"Failed to fetch logs for {sid}: {err_msg}")
                    return {
                        "ok": False,
                        "logs": [],
                        "count": 0,
                        "is_suspended": is_suspended,
                        "service_name": svc_name,
                        "rate_limit": rate_limit,
                        "rate_limited": False,
                        "error": err_msg,
                    }

                if logs_res.status_code == 200:
                    raw_logs = logs_res.json().get("logs", [])

                    def is_caret_or_frame_fragment(s: str) -> bool:
                        s_strip = s.strip()
                        return bool(re.match(r"^[\s\^~|().\-]+$", s_strip) or "...<" in s_strip)

                    def is_new_log_boundary(s: str) -> bool:
                        if is_caret_or_frame_fragment(s):
                            return False
                        return bool(
                            re.match(r"^(INFO|DEBUG|WARNING|WARN|ERROR|CRITICAL|FATAL):", s, re.IGNORECASE)
                            or re.match(r"^\[\d{4}-\d{2}-\d{2}", s)
                            or re.match(r"^\d{4}-\d{2}-\d{2}", s)
                            or re.match(r"^\[(INFO|DEBUG|WARN|WARNING|ERROR|CRITICAL|FATAL)\]", s, re.IGNORECASE)
                            or re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?\s+-\s+\"(?:GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH)", s)
                            or s.startswith("==>")
                        )

                    def is_traceback_start(s: str) -> bool:
                        s_low = s.lower()
                        return (
                            s.startswith("Traceback (most recent call last):")
                            or s.startswith("--- Logging error ---")
                            or s.startswith('File "')
                            or s.startswith("await ")
                            or "fatal application crash:" in s_low
                            or "zerodivisionerror" in s_low
                            or "during handling of the above exception" in s_low
                            or "call stack:" in s_low
                            or bool(re.match(r"^[A-Z][a-zA-Z0-9_]*(?:Error|Exception):", s))
                        )

                    tb_buffer = []
                    tb_start_item = None

                    def flush_tb():
                        nonlocal tb_buffer, tb_start_item
                        if not tb_buffer or not tb_start_item:
                            tb_buffer = []
                            tb_start_item = None
                            return

                        combined_text = "\n".join(tb_buffer)
                        err_summary = "Application Exception"
                        err_m = re.search(r"((?:ZeroDivisionError|KeyError|ValueError|TypeError|AttributeError|ConnectionResetError|Exception|Error):[^\n]+)", combined_text)
                        if err_m:
                            err_summary = err_m.group(1).strip()
                        elif "FATAL APPLICATION CRASH" in combined_text:
                            crash_m = re.search(r"FATAL APPLICATION CRASH:[^\n']+", combined_text)
                            if crash_m:
                                err_summary = crash_m.group(0).strip()

                        logs.append({
                            "id": tb_start_item.get("id"),
                            "timestamp": tb_start_item.get("timestamp", ""),
                            "level": "ERROR",
                            "message": combined_text,
                            "service": svc_name,
                            "is_traceback": True,
                            "error_summary": err_summary,
                        })
                        tb_buffer = []
                        tb_start_item = None

                    for item in raw_logs:
                        raw_msg = item.get("message", "")
                        clean_msg = re.sub(r'\x1b\[[0-9;]*[a-zA-Z]|\x1b\([a-zA-Z]', '', raw_msg).strip()
                        if not clean_msg:
                            continue

                        labels = item.get("labels", [])
                        raw_lvl = next((l.get("value") for l in labels if l.get("name") == "level"), "INFO").upper()

                        if tb_buffer:
                            if is_new_log_boundary(clean_msg):
                                flush_tb()
                                logs.append({
                                    "id": item.get("id"),
                                    "timestamp": item.get("timestamp", ""),
                                    "level": raw_lvl,
                                    "message": clean_msg,
                                    "service": svc_name,
                                    "is_traceback": False,
                                })
                            else:
                                tb_buffer.append(clean_msg)
                        else:
                            if is_traceback_start(clean_msg):
                                tb_buffer.append(clean_msg)
                                tb_start_item = item
                            elif is_caret_or_frame_fragment(clean_msg):
                                # Fragment/caret line from truncated log batch - attach to previous traceback if exists
                                if logs and logs[-1].get("is_traceback"):
                                    logs[-1]["message"] += "\n" + clean_msg
                            else:
                                logs.append({
                                    "id": item.get("id"),
                                    "timestamp": item.get("timestamp", ""),
                                    "level": raw_lvl,
                                    "message": clean_msg,
                                    "service": svc_name,
                                    "is_traceback": False,
                                })

                    if tb_buffer:
                        flush_tb()

                # Sort logs chronologically (oldest first at top, newest streaming at bottom)
                logs.sort(key=lambda x: x.get("timestamp") or "", reverse=False)

                # Cache recent logs for rate limit fallbacks
                _LAST_LOGS_CACHE[sid] = {
                    "logs": logs,
                    "cached_at": now,
                    "is_suspended": is_suspended,
                    "service_name": svc_name,
                    "rate_limit": rate_limit,
                }

                # If suspended (Render free-tier inactivity spin-down), inject banner at top
                if is_suspended:
                    logs.insert(0, {
                        "id": "banner-standby",
                        "timestamp": "",
                        "level": "WARN",
                        "message": f"[STANDBY] Service '{svc_name}' is currently in sleep / suspended state (Render free-tier inactivity). Send an HTTP request to cold-start it.",
                        "service": svc_name,
                    })

                return {
                    "ok": True,
                    "logs": logs,
                    "count": len(logs),
                    "is_suspended": is_suspended,
                    "service_name": svc_name,
                    "rate_limit": rate_limit,
                    "rate_limited": False,
                }
        except Exception as e:
            logger.warning(f"Failed to query Render service logs/events: {e}")
            return {"ok": False, "error": str(e), "logs": []}

    @staticmethod
    def probe_health(health_url: str, timeout_sec: Optional[float] = None) -> Dict[str, Any]:
        """Pings a health endpoint and calculates live round-trip latency in ms."""
        url = (health_url or "").strip()
        if not url:
            return {"status": "UNKNOWN", "latency_ms": 0.0, "code": None, "error": "No health URL provided"}

        if not url.startswith(("http://", "https://")):
            return {"status": "ERROR", "latency_ms": 0.0, "code": None, "error": f"Invalid health URL scheme: '{url}'"}

        if timeout_sec is None:
            try:
                import os
                from backend.prodpilot.db import get_setting
                timeout_val = (
                    os.environ.get("HEALTH_PROBE_TIMEOUT_SEC")
                    or os.environ.get("RENDER_HEALTH_TIMEOUT_SEC")
                    or get_setting("HEALTH_PROBE_TIMEOUT_SEC")
                    or get_setting("RENDER_HEALTH_TIMEOUT_SEC")
                )
                timeout_sec = float(timeout_val) if timeout_val else 4.0
            except Exception:
                timeout_sec = 4.0

        t0 = time.perf_counter()
        is_render_domain = "onrender.com" in url or "render" in url.lower()
        try:
            with httpx.Client(timeout=timeout_sec, follow_redirects=True) as client:
                res = client.get(url)
                latency_ms = round((time.perf_counter() - t0) * 1000, 1)
                is_healthy = 200 <= res.status_code < 300

                text_lower = (res.text or "").lower() if hasattr(res, "text") and res.text else ""
                headers_lower = {k.lower(): v.lower() for k, v in res.headers.items()} if hasattr(res, "headers") and res.headers else {}

                is_explicit_spin_down = (
                    headers_lower.get("x-render-routing") in ("spin-down", "starting")
                    or "spinning up" in text_lower
                    or "spin up" in text_lower
                    or "cold start" in text_lower
                    or "sleeping" in text_lower
                )

                if is_healthy:
                    status = "HEALTHY"
                    error = None
                elif is_explicit_spin_down:
                    status = "SLEEPING"
                    error = "Server is sleeping (Render free-tier inactivity spin-down)"
                elif res.status_code in (502, 503, 504) and is_render_domain:
                    status = "SLEEPING"
                    error = f"HTTP {res.status_code} - Render instance is sleeping or spinning up"
                else:
                    status = "ERROR"
                    error = f"HTTP {res.status_code}"

                return {
                    "status": status,
                    "code": res.status_code,
                    "latency_ms": latency_ms,
                    "error": error,
                    "is_sleeping": status == "SLEEPING",
                }
        except httpx.ConnectError:
            latency_ms = round((time.perf_counter() - t0) * 1000, 1)
            return {"status": "OFFLINE", "code": None, "latency_ms": latency_ms, "error": "Connection refused", "is_sleeping": False}
        except httpx.TimeoutException:
            latency_ms = round((time.perf_counter() - t0) * 1000, 1)
            return {
                "status": "ERROR",
                "code": None,
                "latency_ms": latency_ms,
                "error": f"Health probe timed out after {timeout_sec:.1f}s",
                "is_sleeping": is_render_domain,
            }
        except Exception as e:
            latency_ms = round((time.perf_counter() - t0) * 1000, 1)
            return {"status": "ERROR", "code": None, "latency_ms": latency_ms, "error": str(e), "is_sleeping": False}
