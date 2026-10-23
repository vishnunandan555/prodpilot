#!/usr/bin/env python3
"""ProdPilot Log Forwarder
Supports two modes:
1. Local mode: Tails a local log file (default: demo-prod/service.log) and batches
   new lines to POST http://127.0.0.1:8765/ingest.
2. Render mode: Polls GET https://api.render.com/v1/services/{serviceId}/logs using
   RENDER_API_KEY and forwards new entries.
"""

import argparse
import json
import logging
import os
import re
import signal
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

# Auto-activate local .venv if run with system python
repo_root = Path(__file__).resolve().parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))
venv_site = repo_root / ".venv"
if venv_site.exists():
    for site_pkg in venv_site.glob("lib*/python*/site-packages"):
        if str(site_pkg) not in sys.path:
            sys.path.insert(0, str(site_pkg))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("forwarder")

RUNNING = True


def signal_handler(signum, frame):
    global RUNNING
    logger.info("Shutdown signal received, exiting forwarder...")
    RUNNING = False


signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


def detect_log_level(line: str) -> str:
    """Extracts or infers log level from text."""
    line_upper = line.upper()
    if "CRITICAL" in line_upper or "FATAL" in line_upper:
        return "CRITICAL"
    if "ERROR" in line_upper or "TRACEBACK" in line_upper or "EXCEPTION" in line_upper:
        return "ERROR"
    if "WARNING" in line_upper or "WARN" in line_upper:
        return "WARNING"
    if "DEBUG" in line_upper:
        return "DEBUG"
    return "INFO"


def post_to_ingest(target_url: str, service: str, logs: List[Dict[str, Any]], timeout: float = 10.0) -> bool:
    """Sends log batch to ProdPilot ingest endpoint using standard library urllib."""
    if not logs:
        return True

    payload = {
        "service": service,
        "logs": logs,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        target_url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            status = resp.status
            logger.info(f"Forwarded {len(logs)} logs -> {target_url} (HTTP {status}) Response: {body[:120]}")
            return status < 400
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="replace")
        logger.error(f"HTTP error {e.code} forwarding to {target_url}: {err_msg}")
        return False
    except Exception as e:
        logger.error(f"Failed to connect to ingest endpoint at {target_url}: {e}")
        return False


def run_local_tail(
    log_path: Path,
    target_url: str,
    service: str,
    poll_interval: float = 2.0,
    batch_size: int = 25,
    once: bool = False,
):
    """Tails local log file and forwards new entries in batches."""
    logger.info(f"Starting Local Forwarder for {log_path} -> {target_url}")
    if not log_path.parent.exists():
        log_path.parent.mkdir(parents=True, exist_ok=True)
    if not log_path.exists():
        log_path.touch()

    # Start at current end of file if not running once
    offset = 0 if once else log_path.stat().st_size
    buffered_logs: List[Dict[str, Any]] = []

    while RUNNING:
        try:
            if not log_path.exists():
                time.sleep(poll_interval)
                continue

            current_size = log_path.stat().st_size
            if current_size < offset:
                # File was truncated or rotated
                logger.info("Log file truncation detected, resetting offset to 0")
                offset = 0

            if current_size > offset:
                with open(log_path, "r", encoding="utf-8", errors="replace") as f:
                    f.seek(offset)
                    new_lines = f.readlines()
                    offset = f.tell()

                for raw_line in new_lines:
                    line = raw_line.strip()
                    if not line:
                        continue
                    lvl = detect_log_level(line)
                    buffered_logs.append({
                        "timestamp": datetime.utcnow().isoformat(),
                        "level": lvl,
                        "message": line,
                    })

            # Flush batch if buffer reached batch_size or any logs arrived
            if buffered_logs:
                batch_to_send = buffered_logs[:batch_size]
                success = post_to_ingest(target_url, service, batch_to_send)
                if success:
                    buffered_logs = buffered_logs[len(batch_to_send):]

            if once:
                break

            time.sleep(poll_interval)
        except Exception as e:
            logger.error(f"Error in local tail loop: {e}")
            if once:
                break
            time.sleep(poll_interval)


def run_render_poll(
    service_id: str,
    api_key: str,
    target_url: str,
    service: str,
    poll_interval: float = 5.0,
    once: bool = False,
):
    """Polls Render REST API logs endpoint and forwards new entries."""
    logger.info(f"Starting Render Forwarder for service {service_id} -> {target_url}")
    render_url = f"https://api.render.com/v1/services/{service_id}/logs?limit=50"
    last_seen_timestamps = set()

    while RUNNING:
        try:
            req = urllib.request.Request(
                render_url,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Accept": "application/json",
                },
                method="GET",
            )
            with urllib.request.urlopen(req, timeout=10.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            entries = data if isinstance(data, list) else data.get("logs", [])
            new_logs: List[Dict[str, Any]] = []

            for entry in entries:
                if isinstance(entry, dict):
                    msg = entry.get("message", "")
                    ts = entry.get("timestamp", datetime.utcnow().isoformat())
                    entry_id = f"{ts}-{msg[:50]}"
                    if entry_id not in last_seen_timestamps:
                        last_seen_timestamps.add(entry_id)
                        lvl = entry.get("level") or detect_log_level(msg)
                        new_logs.append({
                            "timestamp": ts,
                            "level": lvl,
                            "message": msg,
                        })

            if new_logs:
                post_to_ingest(target_url, service, new_logs)

            if len(last_seen_timestamps) > 1000:
                last_seen_timestamps.clear()

            if once:
                break

            time.sleep(poll_interval)
        except urllib.error.HTTPError as e:
            logger.error(f"Render API error {e.code}: {e.read().decode('utf-8', errors='replace')}")
            if once:
                break
            time.sleep(poll_interval)
        except Exception as e:
            logger.error(f"Error in Render poll loop: {e}")
            if once:
                break
            time.sleep(poll_interval)


def main():
    parser = argparse.ArgumentParser(description="ProdPilot Log Forwarder (Local Tail & Render API)")
    parser.add_argument(
        "--mode",
        choices=["local", "render"],
        default=os.environ.get("FORWARDER_MODE", "local"),
        help="Forwarder mode: 'local' tails a file, 'render' polls Render REST API",
    )
    parser.add_argument(
        "--log-file",
        default=os.environ.get("LOG_FILE", str(repo_root / "demo-prod" / "service.log")),
        help="Path to local log file to tail (for local mode)",
    )
    parser.add_argument(
        "--target-url",
        default=os.environ.get("INGEST_URL", "http://127.0.0.1:8765/ingest"),
        help="ProdPilot ingest endpoint URL",
    )
    parser.add_argument(
        "--service",
        default=os.environ.get("SERVICE_NAME", "demo-prod"),
        help="Service identifier",
    )
    parser.add_argument(
        "--render-service-id",
        default=os.environ.get("RENDER_SERVICE_ID", ""),
        help="Render Service ID (for render mode)",
    )
    parser.add_argument(
        "--render-api-key",
        default=os.environ.get("RENDER_API_KEY", ""),
        help="Render API Key (for render mode)",
    )
    parser.add_argument(
        "--poll-interval",
        type=float,
        default=float(os.environ.get("POLL_INTERVAL", "2.0")),
        help="Poll interval in seconds",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=int(os.environ.get("BATCH_SIZE", "25")),
        help="Batch size for log forwarding",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run one batch forward and exit",
    )

    args = parser.parse_args()

    if args.mode == "local":
        run_local_tail(
            log_path=Path(args.log_file),
            target_url=args.target_url,
            service=args.service,
            poll_interval=args.poll_interval,
            batch_size=args.batch_size,
            once=args.once,
        )
    elif args.mode == "render":
        if not args.render_service_id or not args.render_api_key:
            logger.error("Render mode requires both --render-service-id and --render-api-key (or env vars RENDER_SERVICE_ID, RENDER_API_KEY)")
            sys.exit(1)
        run_render_poll(
            service_id=args.render_service_id,
            api_key=args.render_api_key,
            target_url=args.target_url,
            service=args.service,
            poll_interval=args.poll_interval,
            once=args.once,
        )


if __name__ == "__main__":
    main()
