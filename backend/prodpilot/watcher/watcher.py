"""ProdPilot Health Watcher & Git Blame Capture Engine
Monitors service health endpoint, detects failures or crashes,
extracts tracebacks and git blame information, and registers incidents in SQLite.
"""

import argparse
import logging
import os
import re
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

# Ensure repository root is on sys.path for db import
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

try:
    from backend.prodpilot.db import create_incident, init_db, get_incident
except ImportError:
    from prodpilot.db import create_incident, init_db, get_incident  # type: ignore

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [Watcher] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("prodpilot.watcher")


class HealthWatcher:
    def __init__(
        self,
        health_url: str = "http://127.0.0.1:8000/health",
        poll_interval: float = 5.0,
        consecutive_threshold: int = 2,
        log_file: Optional[str] = None,
        repo_path: Optional[str] = None,
        service_name: str = "demo-prod",
        db_path: Optional[str] = None,
    ):
        self.health_url = health_url
        self.poll_interval = poll_interval
        self.consecutive_threshold = consecutive_threshold
        self.service_name = service_name
        self.db_path = db_path

        # Resolve paths
        default_demo = ROOT_DIR / "demo-prod"
        self.repo_path = Path(repo_path) if repo_path else default_demo
        self.log_file = (
            Path(log_file)
            if log_file
            else (self.repo_path / "service.log" if self.repo_path.exists() else ROOT_DIR / "service.log")
        )

        self.consecutive_failures = 0
        self.active_incident_id: Optional[str] = None
        self.is_outage_active = False

        # Initialize db tables if needed
        try:
            init_db(db_path=self.db_path)
        except Exception as e:
            logger.debug(f"DB init check: {e}")

    def check_health(self) -> Tuple[bool, Optional[str]]:
        """Probes the health URL and returns (is_healthy, reason_if_unhealthy)."""
        try:
            resp = requests.get(self.health_url, timeout=3.0)
            if resp.status_code == 200:
                return True, None
            else:
                return False, f"HTTP {resp.status_code} ({resp.text[:100].strip()})"
        except requests.exceptions.ConnectionError:
            return False, "Connection refused / Process unreachable"
        except requests.exceptions.Timeout:
            return False, "Probe timeout after 3s"
        except Exception as e:
            return False, f"Network probe error: {e}"

    def extract_traceback(self, log_content: str) -> str:
        """Finds the most recent Python traceback block in the log content."""
        pattern = re.compile(
            r"(Traceback \(most recent call last\):.*?(?:KeyError|ValueError|TypeError|AttributeError|Exception|Error):[^\n]+)",
            re.DOTALL,
        )
        matches = pattern.findall(log_content)
        if matches:
            return matches[-1].strip()

        # Fallback: return last lines with Error
        error_lines = [
            line for line in log_content.splitlines()
            if "ERROR" in line or "Traceback" in line or "Exception" in line
        ]
        return "\n".join(error_lines[-20:]) if error_lines else "No traceback found in service.log"

    def get_recent_commits(self, limit: int = 5) -> List[Dict[str, Any]]:
        """Extracts recent commits from the target git repo."""
        if not (self.repo_path / ".git").exists():
            return []
        try:
            cmd = f'git log -n {limit} --format="%H|%an|%aI|%s"'
            res = subprocess.run(
                cmd,
                shell=True,
                cwd=str(self.repo_path),
                capture_output=True,
                text=True,
                check=True,
            )
            commits = []
            for line in res.stdout.strip().splitlines():
                if not line or "|" not in line:
                    continue
                parts = line.split("|", 3)
                if len(parts) == 4:
                    chash, author, date_iso, msg = parts
                    commits.append({
                        "hash": chash[:7],
                        "full_hash": chash,
                        "author": author,
                        "date": date_iso,
                        "message": msg,
                    })
            return commits
        except Exception as e:
            logger.warning(f"Failed to fetch git log: {e}")
            return []

    def perform_git_blame(
        self, suspect_file: str, suspect_line: int
    ) -> Optional[Dict[str, Any]]:
        """Runs git blame on the suspect file and line in the repo."""
        if not (self.repo_path / ".git").exists():
            return None
        try:
            cmd = f"git blame --line-porcelain -L {suspect_line},{suspect_line} {suspect_file}"
            res = subprocess.run(
                cmd,
                shell=True,
                cwd=str(self.repo_path),
                capture_output=True,
                text=True,
            )
            if res.returncode != 0:
                logger.warning(f"git blame failed: {res.stderr}")
                return None

            lines = res.stdout.splitlines()
            if not lines:
                return None

            commit_hash = lines[0].split()[0]
            author = "Unknown"
            author_time = 0

            for bl in lines:
                if bl.startswith("author "):
                    author = bl[len("author ") :].strip()
                elif bl.startswith("author-time "):
                    try:
                        author_time = int(bl[len("author-time ") :].strip())
                    except ValueError:
                        pass

            # Fetch commit message
            msg_res = subprocess.run(
                f'git log -1 --format="%s" {commit_hash}',
                shell=True,
                cwd=str(self.repo_path),
                capture_output=True,
                text=True,
            )
            commit_msg = msg_res.stdout.strip() if msg_res.returncode == 0 else ""

            # Calculate minutes ago
            commit_dt = (
                datetime.fromtimestamp(author_time, tz=timezone.utc)
                if author_time > 0
                else datetime.now(timezone.utc)
            )
            now_dt = datetime.now(timezone.utc)
            minutes_ago = max(0, int((now_dt - commit_dt).total_seconds() / 60))

            return {
                "hash": commit_hash[:7],
                "full_hash": commit_hash,
                "author": author,
                "date": commit_dt.isoformat(),
                "message": commit_msg,
                "suspect_file": suspect_file,
                "suspect_line": suspect_line,
                "minutes_ago": minutes_ago,
            }
        except Exception as e:
            logger.warning(f"Failed git blame analysis: {e}")
            return None

    def capture_incident(self, reason: str) -> Dict[str, Any]:
        """Captures logs, traceback, git commits, blame, and saves incident to SQLite."""
        logger.info(f"🚨 CAPTURING INCIDENT triggered by: {reason}")
        now_iso = datetime.now(timezone.utc).isoformat()
        incident_id = f"inc-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6]}"

        # 1. Read last 200 lines of service.log
        log_tail = ""
        full_log = ""
        if self.log_file.exists():
            try:
                full_log = self.log_file.read_text(encoding="utf-8", errors="replace")
                lines = full_log.splitlines()
                log_tail = "\n".join(lines[-200:])
            except Exception as e:
                log_tail = f"Failed to read {self.log_file}: {e}"
        else:
            log_tail = f"Service log file not found at {self.log_file}"

        # 2. Extract traceback
        trace = self.extract_traceback(full_log) if full_log else "No service log available"

        # 3. Locate suspect file & line
        suspect_file = "app.py"
        suspect_line = 45
        file_line_matches = re.findall(r'File \"([^\"]+)\", line (\d+)', trace)
        if file_line_matches:
            last_file_path, last_line_num = file_line_matches[-1]
            suspect_file = os.path.basename(last_file_path)
            try:
                suspect_line = int(last_line_num)
            except ValueError:
                suspect_line = 45

        suspected_area = f"{suspect_file}:{suspect_line}"

        # 4. Pull recent commits
        recent_commits = self.get_recent_commits(limit=5)

        # 5. Git blame suspect commit
        suspect_commit = self.perform_git_blame(suspect_file, suspect_line)
        if not suspect_commit and recent_commits:
            # Fallback to HEAD commit
            head = recent_commits[0]
            suspect_commit = {
                "hash": head["hash"],
                "author": head["author"],
                "date": head["date"],
                "message": head["message"],
                "suspect_file": suspect_file,
                "suspect_line": suspect_line,
                "minutes_ago": 5,
            }

        # 6. Save incident to SQLite
        try:
            created = create_incident(
                incident_id=incident_id,
                service=self.service_name,
                detected_at=now_iso,
                status="OPEN",
                health_url=self.health_url,
                trace=trace,
                log_tail=log_tail,
                recent_commits=recent_commits,
                suspect_commit=suspect_commit,
                suspected_area=suspected_area,
                db_path=self.db_path,
            )
            logger.info(
                f"✅ INCIDENT SAVED: ID={incident_id} | Area={suspected_area} | SuspectCommit={suspect_commit.get('hash') if suspect_commit else 'None'}"
            )
            return created
        except Exception as e:
            logger.error(f"Failed to save incident to SQLite: {e}", exc_info=True)
            return {
                "id": incident_id,
                "service": self.service_name,
                "status": "OPEN",
                "suspect_commit": suspect_commit,
                "error": str(e),
            }

    def run_once(self) -> Optional[Dict[str, Any]]:
        """Performs a single poll step. Returns created incident dict if triggered."""
        is_healthy, reason = self.check_health()
        if is_healthy:
            if self.consecutive_failures > 0 or self.is_outage_active:
                logger.info("🟢 Service health check PASSED (Recovered to 200 OK).")
            self.consecutive_failures = 0
            self.is_outage_active = False
            return None
        else:
            self.consecutive_failures += 1
            logger.warning(
                f"⚠️ Health check failure #{self.consecutive_failures}/{self.consecutive_threshold}: {reason}"
            )

            if (
                self.consecutive_failures >= self.consecutive_threshold
                and not self.is_outage_active
            ):
                self.is_outage_active = True
                incident = self.capture_incident(reason=reason or "Healthcheck failure")
                self.active_incident_id = incident.get("id")
                return incident
            return None

    def start(self):
        """Runs the continuous watcher polling loop."""
        logger.info(
            f"🔭 Starting ProdPilot Watcher on {self.health_url} (Poll interval: {self.poll_interval}s, Threshold: {self.consecutive_threshold})"
        )
        logger.info(f"Watching log file: {self.log_file}")
        logger.info(f"Target repository: {self.repo_path}")
        try:
            while True:
                self.run_once()
                time.sleep(self.poll_interval)
        except KeyboardInterrupt:
            logger.info("🛑 Watcher stopped by user.")


def main():
    parser = argparse.ArgumentParser(description="ProdPilot Health Watcher")
    parser.add_argument("--url", default="http://127.0.0.1:8000/health", help="Healthcheck URL")
    parser.add_argument("--interval", type=float, default=5.0, help="Polling interval in seconds")
    parser.add_argument("--threshold", type=int, default=2, help="Consecutive failure threshold")
    parser.add_argument("--repo", default=None, help="Path to demo-prod repository")
    parser.add_argument("--log-file", default=None, help="Path to service.log")
    parser.add_argument("--db-path", default=None, help="Path to SQLite database")
    parser.add_argument("--once", action="store_true", help="Run single poll check and exit")

    args = parser.parse_args()

    watcher = HealthWatcher(
        health_url=args.url,
        poll_interval=args.interval,
        consecutive_threshold=args.threshold,
        repo_path=args.repo,
        log_file=args.log_file,
        db_path=args.db_path,
    )

    if args.once:
        res = watcher.run_once()
        if res:
            print(f"Incident triggered: {res.get('id')}")
        else:
            print("No incident triggered.")
    else:
        watcher.start()


if __name__ == "__main__":
    main()
