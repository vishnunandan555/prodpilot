"""ProdPilot Staging Canary Manager
Manages side-port canary instances:
- Fix-forward: Runs patched build on side port 8001, verifies canary http://127.0.0.1:8001/health.
- Rollback: In a worktree, runs git revert <suspect_commit> without committing, runs tests, starts on side port 8002, verifies canary http://127.0.0.1:8002/health.
Part of Task 4 (Stream A).
"""

import logging
import os
import signal
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

import httpx

from backend.prodpilot.pipeline.repro_runner import DeterministicVerifier
from backend.prodpilot.pipeline.worktree import create_worktree, remove_worktree

logger = logging.getLogger(__name__)


@dataclass
class StagingInstance:
    name: str
    port: int
    health_url: str
    workdir: str
    pid: Optional[int] = None
    health_ok: bool = False
    proc: Optional[subprocess.Popen] = None
    error: Optional[str] = None


class StagingManager:
    """Manages fix-forward and rollback staging instances on side ports 8001 & 8002."""

    def __init__(self, repo_path: str):
        self.repo_path = str(Path(repo_path).resolve())
        self.instances: Dict[str, StagingInstance] = {}
        self.rollback_worktree: Optional[str] = None

    def _find_python_executable(self) -> str:
        import sys
        if sys.executable and Path(sys.executable).exists():
            return sys.executable
        if Path("/home/vishnunandan555/Projects/prodpilot/.venv/bin/python").exists():
            return "/home/vishnunandan555/Projects/prodpilot/.venv/bin/python"
        repo_venv = Path(self.repo_path).parent / ".venv" / "bin" / "python"
        if repo_venv.exists():
            return str(repo_venv)
        local_venv = Path(self.repo_path) / ".venv" / "bin" / "python"
        if local_venv.exists():
            return str(local_venv)
        return "python3"

    def _start_service_proc(self, workdir: str, port: int) -> subprocess.Popen:
        """Launches service process on specified port."""
        python_bin = self._find_python_executable()

        env = os.environ.copy()
        env["PORT"] = str(port)
        env["PYTHONPATH"] = f"{workdir}:."

        # Detect app runner
        app_py = Path(workdir) / "app.py"
        main_py = Path(workdir) / "main.py"

        if app_py.exists():
            cmd = [python_bin, "-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", str(port)]
        elif main_py.exists():
            cmd = [python_bin, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", str(port)]
        else:
            # Fallback direct script execution
            cmd = [python_bin, "app.py"]

        logger.info(f"Starting staging process on port {port} in {workdir}: {' '.join(cmd)}")
        proc = subprocess.Popen(
            cmd,
            cwd=workdir,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        return proc

    def poll_health(self, health_url: str, timeout_sec: float = 10.0) -> bool:
        """Polls health check URL until 200 OK or timeout."""
        start_time = time.time()
        while time.time() - start_time < timeout_sec:
            try:
                with httpx.Client(timeout=1.5) as client:
                    resp = client.get(health_url)
                    if resp.status_code == 200:
                        return True
            except Exception:
                pass
            time.sleep(0.5)
        return False

    def stage_fix_forward(
        self,
        patched_worktree: str,
        port: int = 8001,
        mock_mode: bool = False,
    ) -> StagingInstance:
        """Stages the fix-forward build on port 8001 and probes health."""
        health_url = f"http://127.0.0.1:{port}/health"
        instance = StagingInstance(
            name="fix_forward",
            port=port,
            health_url=health_url,
            workdir=patched_worktree,
        )

        if mock_mode:
            instance.health_ok = True
            self.instances["fix_forward"] = instance
            return instance

        try:
            proc = self._start_service_proc(patched_worktree, port)
            instance.proc = proc
            instance.pid = proc.pid

            # Canary health verification
            health_ok = self.poll_health(health_url, timeout_sec=10.0)
            instance.health_ok = health_ok

            if not health_ok:
                err_tail = ""
                if proc.poll() is not None:
                    _, stderr = proc.communicate(timeout=1)
                    err_tail = stderr[-300:] if stderr else f"Process exited with {proc.returncode}"
                instance.error = f"Canary health check failed on {health_url}. {err_tail}"
                logger.warning(instance.error)
            else:
                logger.info(f"Fix-forward canary 200 OK on {health_url}")

        except Exception as e:
            instance.error = str(e)
            instance.health_ok = False
            logger.error(f"Failed to start fix-forward staging: {e}")

        self.instances["fix_forward"] = instance
        return instance

    def stage_rollback(
        self,
        suspect_commit: str,
        port: int = 8002,
        mock_mode: bool = False,
    ) -> StagingInstance:
        """Stages rollback build on port 8002 by reverting suspect commit without committing."""
        health_url = f"http://127.0.0.1:{port}/health"

        # 1. Allocate isolated rollback worktree
        self.rollback_worktree = create_worktree(self.repo_path, prefix="stage-rollback-")
        workdir = self.rollback_worktree

        instance = StagingInstance(
            name="rollback",
            port=port,
            health_url=health_url,
            workdir=workdir,
        )

        if mock_mode:
            instance.health_ok = True
            self.instances["rollback"] = instance
            return instance

        try:
            # 2. Git revert without committing
            logger.info(f"Reverting suspect commit {suspect_commit} in rollback worktree")
            revert_proc = subprocess.run(
                ["git", "revert", "--no-commit", suspect_commit],
                cwd=workdir,
                capture_output=True,
                text=True,
            )
            if revert_proc.returncode != 0:
                instance.error = f"git revert failed: {revert_proc.stderr.strip()}"
                logger.error(instance.error)
                self.instances["rollback"] = instance
                return instance

            # 3. Deterministic verifier runs tests on reverted code
            verifier = DeterministicVerifier()
            test_res = verifier.run_tests(workdir)
            if not test_res.passed:
                logger.warning(f"Rollback test suite warning: {test_res.summary}")

            # 4. Start rollback build on port 8002
            proc = self._start_service_proc(workdir, port)
            instance.proc = proc
            instance.pid = proc.pid

            # 5. Canary health verification
            health_ok = self.poll_health(health_url, timeout_sec=10.0)
            instance.health_ok = health_ok

            if not health_ok:
                err_tail = ""
                if proc.poll() is not None:
                    _, stderr = proc.communicate(timeout=1)
                    err_tail = stderr[-300:] if stderr else f"Process exited with {proc.returncode}"
                instance.error = f"Rollback canary health failed on {health_url}. {err_tail}"
            else:
                logger.info(f"Rollback canary 200 OK on {health_url}")

        except Exception as e:
            instance.error = str(e)
            instance.health_ok = False
            logger.error(f"Failed to stage rollback: {e}")

        self.instances["rollback"] = instance
        return instance

    def get_status(self) -> Dict[str, Any]:
        """Returns staging status dictionary matching contracts/api.md."""
        fix = self.instances.get("fix_forward")
        rb = self.instances.get("rollback")
        return {
            "fix_forward": {
                "port": fix.port if fix else 8001,
                "health": fix.health_ok if fix else False,
            },
            "rollback": {
                "port": rb.port if rb else 8002,
                "health": rb.health_ok if rb else False,
            },
        }

    def stop_all(self) -> None:
        """Cleanly stops all running staging processes and cleans rollback worktree."""
        for name, inst in self.instances.items():
            if inst.proc and inst.proc.poll() is None:
                logger.info(f"Stopping staging process {name} (pid {inst.pid})")
                try:
                    inst.proc.terminate()
                    inst.proc.wait(timeout=3)
                except Exception:
                    try:
                        inst.proc.kill()
                    except Exception:
                        pass

        if self.rollback_worktree:
            remove_worktree(self.rollback_worktree, repo_path=self.repo_path)
            self.rollback_worktree = None
        self.instances.clear()
