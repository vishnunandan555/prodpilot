"""Antigravity Agent Adapter
Implements contracts/agent_interface.py using the agy CLI tool or Python SDK.
"""

import json
import logging
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any, Callable, Dict, Optional

try:
    from contracts.agent_interface import AgentAdapter, AgentEvent, AgentResult
except ImportError:
    # Support relative import when running as module
    import sys
    sys.path.append(str(Path(__file__).resolve().parent.parent.parent.parent))
    from contracts.agent_interface import AgentAdapter, AgentEvent, AgentResult

logger = logging.getLogger(__name__)


class AntigravityAdapter:
    """Agent adapter wrapping the Antigravity (agy) CLI."""

    def __init__(self, agy_path: Optional[str] = None):
        self.agy_path = agy_path or os.environ.get("AGY_PATH") or shutil.which("agy") or "/home/vishnunandan555/.local/bin/agy"

    def is_available(self) -> bool:
        if os.environ.get("PRODPILOT_AGENT_ADAPTER", "").lower() == "gemini":
            return False
        if os.environ.get("PRODPILOT_AGENT_ADAPTER", "").lower() == "antigravity":
            return bool(self.agy_path and os.path.exists(self.agy_path) and os.access(self.agy_path, os.X_OK))
        # By default in headless environments, use gemini deterministic adapter unless AGY_ENABLED is set
        return bool(os.environ.get("AGY_ENABLED") and self.agy_path and os.path.exists(self.agy_path))

    def run(
        self,
        task: str,
        workdir: str,
        on_event: Optional[Callable[[AgentEvent], None]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> AgentResult:
        """Execute agent task in the given workdir using agy CLI."""
        context = context or {}
        stage = context.get("stage", "FIX")

        if not self.is_available():
            err_msg = f"Antigravity CLI (agy) not found at {self.agy_path}"
            logger.warning(err_msg)
            return {
                "diff": "",
                "summary": "",
                "ok": False,
                "error": err_msg,
            }

        cmd = [
            self.agy_path,
            "-p",
            task,
            "--dangerously-skip-permissions",
            "--output-format",
            "stream-json",
        ]

        logger.info(f"Running Antigravity in {workdir} with task: {task[:80]}...")

        if on_event:
            on_event({
                "stage": stage,
                "kind": "stage_started",
                "payload": {"message": f"Antigravity agent starting task in {workdir}: {task[:100]}..."},
            })

        env = os.environ.copy()

        summary_lines = []
        try:
            proc = subprocess.Popen(
                cmd,
                cwd=workdir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=env,
                bufsize=1,
            )

            if proc.stdout:
                for line in proc.stdout:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        record = json.loads(line)
                        summary_lines.append(str(record))
                        # Check for tool call or step event in stream-json
                        if on_event:
                            kind = record.get("type", "tool_call")
                            on_event({
                                "stage": stage,
                                "kind": "tool_call" if "tool" in kind or "call" in kind else "agent_step",
                                "payload": record if isinstance(record, dict) else {"raw": record},
                            })
                    except json.JSONDecodeError:
                        summary_lines.append(line)

            stdout, stderr = proc.communicate(timeout=180)
            if stdout:
                summary_lines.append(stdout)

            # Extract git diff in workdir
            diff_proc = subprocess.run(
                ["git", "diff", "HEAD"],
                cwd=workdir,
                capture_output=True,
                text=True,
                check=False,
            )
            # If untracked files like tests/test_repro.py were added, include them in diff
            untracked_proc = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=workdir,
                capture_output=True,
                text=True,
                check=False,
            )

            diff = diff_proc.stdout or ""
            # If there are untracked files, add them to diff representation
            for status_line in untracked_proc.stdout.splitlines():
                if status_line.startswith("?? "):
                    untracked_file = status_line[3:].strip()
                    file_path = Path(workdir) / untracked_file
                    if file_path.is_file():
                        try:
                            content = file_path.read_text(encoding="utf-8")
                            diff += f"\n--- /dev/null\n+++ b/{untracked_file}\n@@ -0,0 +1,{len(content.splitlines())} @@\n"
                            diff += "".join(f"+{l}\n" for l in content.splitlines())
                        except Exception as e:
                            logger.debug(f"Failed to read untracked file {file_path}: {e}")

            ok = proc.returncode == 0
            summary = "\n".join(summary_lines[-5:]) if summary_lines else "Antigravity task completed."
            error = None if ok else (stderr or f"Exit code {proc.returncode}")

            return {
                "diff": diff,
                "summary": summary,
                "ok": ok,
                "error": error,
            }

        except subprocess.TimeoutExpired:
            proc.kill()
            return {
                "diff": "",
                "summary": "Timeout expired while executing Antigravity task",
                "ok": False,
                "error": "TimeoutExpired (180s)",
            }
        except Exception as e:
            return {
                "diff": "",
                "summary": f"Failed to execute Antigravity adapter: {e}",
                "ok": False,
                "error": str(e),
            }
