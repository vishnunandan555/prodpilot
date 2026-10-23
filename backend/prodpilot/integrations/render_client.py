"""ProdPilot Render REST API Client
Communicates directly with the Render API (https://api.render.com/v1)
to inspect production services, fetch deployment history, probe endpoints,
and stream live production logs.
"""

import logging
import time
from typing import Any, Dict, List, Optional
import httpx

logger = logging.getLogger(__name__)

RENDER_API_BASE = "https://api.render.com/v1"


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
        """Fetches recent logs from Render REST API or stream endpoint."""
        sid = service_id.strip()
        url = f"{RENDER_API_BASE}/services/{sid}/logs?limit={limit}"
        headers = self._headers(api_key)

        if not headers.get("Authorization"):
            return {
                "ok": False,
                "error": "Render API key not provided. Add your key in Settings to stream live logs from Render.",
                "logs": [],
            }

        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(url, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    logs = []
                    # Render logs format: list of log entries or text lines
                    if isinstance(data, list):
                        for entry in data:
                            if isinstance(entry, dict):
                                logs.append({
                                    "timestamp": entry.get("timestamp", entry.get("createdAt", "")),
                                    "message": entry.get("message", entry.get("text", "")),
                                    "level": entry.get("level", "INFO").upper(),
                                })
                            elif isinstance(entry, str):
                                logs.append({
                                    "timestamp": "",
                                    "message": entry,
                                    "level": "ERROR" if any(w in entry.lower() for w in ["error", "traceback", "exception", "failed"]) else "INFO",
                                })
                    return {"ok": True, "logs": logs, "count": len(logs)}
                elif res.status_code == 401:
                    return {"ok": False, "error": "Invalid Render API Key (401 Unauthorized)", "logs": []}
                elif res.status_code == 404:
                    return {"ok": False, "error": f"Service '{sid}' not found on Render (404)", "logs": []}
                else:
                    return {"ok": False, "error": f"Render log query failed: HTTP {res.status_code}", "logs": []}
        except Exception as e:
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
