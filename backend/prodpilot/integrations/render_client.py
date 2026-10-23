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

    def get_deploys(self, service_id: str, api_key: Optional[str] = None, limit: int = 15) -> Dict[str, Any]:
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
                        deploys.append({
                            "id": deploy_obj.get("id", ""),
                            "status": deploy_obj.get("status", "unknown").upper(),
                            "trigger": deploy_obj.get("trigger", "unknown"),
                            "commit_id": (commit.get("id") or "")[:8],
                            "commit_message": commit.get("message", "No commit message"),
                            "created_at": deploy_obj.get("createdAt", ""),
                            "finished_at": deploy_obj.get("finishedAt", ""),
                        })
                    return {"ok": True, "deploys": deploys}
                return {"ok": False, "error": f"Render API error {res.status_code}", "deploys": []}
        except Exception as e:
            return {"ok": False, "error": str(e), "deploys": []}

    def get_logs(self, service_id: str, api_key: Optional[str] = None, limit: int = 100) -> Dict[str, Any]:
        """Fetches live application stdout/stderr logs from Render API v1 with rate limit tracking."""
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
                if owner_id:
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
                        # Graceful handling for rate limit ceiling: return cached logs
                        logger.warning(f"Render API rate limit reached (429). Reset in {rate_limit.get('reset')}s")
                        last_cache = _LAST_LOGS_CACHE.get(sid, {})
                        return {
                            "ok": True,
                            "logs": last_cache.get("logs", []),
                            "count": len(last_cache.get("logs", [])),
                            "is_suspended": is_suspended,
                            "service_name": svc_name,
                            "rate_limit": rate_limit,
                            "rate_limited": True,
                        }

                    if logs_res.status_code == 200:
                        raw_logs = logs_res.json().get("logs", [])
                        for item in raw_logs:
                            raw_msg = item.get("message", "")
                            # Strip ANSI formatting codes
                            clean_msg = re.sub(r'\x1b\[[0-9;]*[a-zA-Z]|\x1b\([a-zA-Z]', '', raw_msg).strip()
                            if not clean_msg:
                                continue

                            labels = item.get("labels", [])
                            raw_lvl = next((l.get("value") for l in labels if l.get("name") == "level"), "INFO").upper()

                            msg_lower = clean_msg.lower()
                            if raw_lvl in ("CRITICAL", "ERROR") or "zerodivisionerror" in msg_lower or "fatal" in msg_lower or "traceback" in msg_lower:
                                lvl = "ERROR"
                            elif raw_lvl in ("WARN", "WARNING") or "warning" in msg_lower:
                                lvl = "WARN"
                            else:
                                lvl = "INFO"

                            logs.append({
                                "id": item.get("id"),
                                "timestamp": item.get("timestamp", ""),
                                "level": lvl,
                                "message": clean_msg,
                                "service": svc_name,
                            })

                # Sort logs by timestamp descending (newest first)
                logs.sort(key=lambda x: x.get("timestamp") or "", reverse=True)

                # Cache recent logs for rate limit fallbacks
                _LAST_LOGS_CACHE[sid] = {"logs": logs, "cached_at": now}

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
    def probe_health(health_url: str, timeout_sec: float = 4.0) -> Dict[str, Any]:
        """Pings a health endpoint and calculates live round-trip latency in ms."""
        url = health_url.strip()
        if not url:
            return {"status": "UNKNOWN", "latency_ms": 0.0, "code": None, "error": "No health URL provided"}

        t0 = time.perf_counter()
        try:
            with httpx.Client(timeout=timeout_sec, follow_redirects=True) as client:
                res = client.get(url)
                latency_ms = round((time.perf_counter() - t0) * 1000, 1)
                is_healthy = 200 <= res.status_code < 300
                return {
                    "status": "HEALTHY" if is_healthy else "ERROR",
                    "code": res.status_code,
                    "latency_ms": latency_ms,
                    "error": None if is_healthy else f"HTTP {res.status_code}",
                }
        except httpx.ConnectError:
            latency_ms = round((time.perf_counter() - t0) * 1000, 1)
            return {"status": "OFFLINE", "code": None, "latency_ms": latency_ms, "error": "Connection refused"}
        except httpx.TimeoutException:
            return {"status": "ERROR", "code": None, "latency_ms": round(timeout_sec * 1000, 1), "error": "Health probe timed out"}
        except Exception as e:
            return {"status": "ERROR", "code": None, "latency_ms": 0.0, "error": str(e)}
