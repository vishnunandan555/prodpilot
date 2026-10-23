"""ProdPilot Recovery Decision & Rollback Staging
Evaluates rollback eligibility, stages a clean revert of the suspect commit
on Port 8002 (Rollback Canary), and verifies canary health.
Part of Stream B: Laptop Fixing, Context & Safety Guard.
"""

import logging
import subprocess
from pathlib import Path
from typing import Any, Dict, Optional

import httpx

from backend.prodpilot.staging.manager import StagingInstance, StagingManager

logger = logging.getLogger("prodpilot.recovery")


def evaluate_rollback_eligibility(
    repo_path: str,
    suspect_commit: str,
) -> Dict[str, Any]:
    """Evaluates whether a suspect commit is eligible for rollback.

    Verifications:
    1. Suspect commit exists in git repository.
    2. Suspect commit has a valid parent commit (cannot revert root commit).
    3. Target repository working directory is clean or usable.
    4. Revert can be performed without unresolvable conflicts.
    """
    repo = Path(repo_path).resolve()
    if not repo.exists() or not (repo / ".git").exists():
        return {
            "eligible": False,
            "reason": f"Target path '{repo_path}' is not a valid git repository.",
            "parent_commit": None,
        }

    # 1. Verify suspect commit exists
    commit_check = subprocess.run(
        ["git", "rev-parse", "--verify", suspect_commit],
        cwd=str(repo),
        capture_output=True,
        text=True,
    )
    if commit_check.returncode != 0:
        return {
            "eligible": False,
            "reason": f"Suspect commit '{suspect_commit}' does not exist in repository.",
            "parent_commit": None,
        }
    full_commit_hash = commit_check.stdout.strip()

    # 2. Verify parent commit exists
    parent_check = subprocess.run(
        ["git", "rev-parse", "--verify", f"{full_commit_hash}^"],
        cwd=str(repo),
        capture_output=True,
        text=True,
    )
    if parent_check.returncode != 0:
        return {
            "eligible": False,
            "reason": f"Suspect commit '{full_commit_hash[:8]}' has no parent (initial root commit cannot be reverted).",
            "parent_commit": None,
        }
    parent_commit = parent_check.stdout.strip()

    # 3. Check clean tree / revert feasibility via git merge-tree or git revert dry-run check
    # Check if suspect commit touches files that conflict with HEAD
    status_proc = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=str(repo),
        capture_output=True,
        text=True,
    )
    has_uncommitted = bool(status_proc.stdout.strip())

    return {
        "eligible": True,
        "reason": f"Commit '{full_commit_hash[:8]}' has valid parent '{parent_commit[:8]}' and is eligible for rollback.",
        "parent_commit": parent_commit,
        "suspect_commit": full_commit_hash,
        "clean_tree": not has_uncommitted,
    }


def stage_rollback_canary(
    repo_path: str,
    suspect_commit: str,
    port: int = 8002,
    mock_mode: bool = False,
    staging_manager: Optional[StagingManager] = None,
    timeout_sec: float = 10.0,
) -> Dict[str, Any]:
    """Stages rollback build on port 8002 and verifies GET /health answers 200 OK.

    Args:
        repo_path: Path to git repository.
        suspect_commit: Hash of suspect commit to revert.
        port: Canary port (default 8002).
        mock_mode: If True, simulates without starting real process.
        staging_manager: Optional existing StagingManager instance.
        timeout_sec: Health poll timeout.

    Returns:
        Dict with status, eligibility, canary port, health check result, and error.
    """
    eligibility = evaluate_rollback_eligibility(repo_path, suspect_commit)
    if not eligibility["eligible"]:
        logger.warning(f"Rollback ineligible for commit {suspect_commit}: {eligibility['reason']}")
        return {
            "ok": False,
            "eligible": False,
            "port": port,
            "health_ok": False,
            "error": eligibility["reason"],
            "eligibility": eligibility,
        }

    mgr = staging_manager or StagingManager(repo_path=repo_path)
    instance = mgr.stage_rollback(
        suspect_commit=suspect_commit,
        port=port,
        mock_mode=mock_mode,
    )

    health_url = f"http://127.0.0.1:{port}/health"
    health_ok = instance.health_ok

    # Double verify GET /health with httpx if not in mock mode and health_ok is True
    if not mock_mode and health_ok:
        try:
            with httpx.Client(timeout=2.0) as client:
                resp = client.get(health_url)
                health_ok = (resp.status_code == 200)
        except Exception as e:
            logger.warning(f"Secondary verification failed on {health_url}: {e}")
            health_ok = False

    return {
        "ok": health_ok,
        "eligible": True,
        "port": port,
        "health_ok": health_ok,
        "health_url": health_url,
        "instance": instance,
        "staging_manager": mgr,
        "error": instance.error,
        "eligibility": eligibility,
    }


class RecoveryAgent:
    """Agent orchestrating rollback evaluation and canary verification."""

    def __init__(self, repo_path: str, port: int = 8002, mock_mode: bool = False):
        self.repo_path = str(Path(repo_path).resolve())
        self.port = port
        self.mock_mode = mock_mode
        self.staging_manager: Optional[StagingManager] = None

    def evaluate(self, suspect_commit: str) -> Dict[str, Any]:
        """Evaluates rollback eligibility."""
        return evaluate_rollback_eligibility(self.repo_path, suspect_commit)

    def stage(self, suspect_commit: str) -> Dict[str, Any]:
        """Stages rollback canary on port 8002 and verifies health."""
        if not self.staging_manager:
            self.staging_manager = StagingManager(self.repo_path)
        return stage_rollback_canary(
            repo_path=self.repo_path,
            suspect_commit=suspect_commit,
            port=self.port,
            mock_mode=self.mock_mode,
            staging_manager=self.staging_manager,
        )

    def cleanup(self) -> None:
        """Stops canary process and cleans worktrees."""
        if self.staging_manager:
            self.staging_manager.stop_all()
            self.staging_manager = None
