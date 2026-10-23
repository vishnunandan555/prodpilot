"""ProdPilot Git Worktree Manager
Helper to create temporary git worktrees (git worktree add <dir> HEAD) and cleanly remove them.
Part of Task 2 (Stream A).
"""

import logging
import os
import shutil
import subprocess
import uuid
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger(__name__)


def create_worktree(
    repo_path: str,
    worktree_dir: Optional[str] = None,
    commit: str = "HEAD",
    prefix: str = "wt-",
) -> str:
    """Creates a new isolated git worktree detached at commit.
    
    Args:
        repo_path: Path to the main git repository.
        worktree_dir: Target directory path for the worktree. If None, generated in .worktree/
        commit: Git commit, branch, or tag to check out (default 'HEAD').
        prefix: Prefix for randomly generated worktree directory names.
        
    Returns:
        Absolute path to the created worktree directory.
    """
    repo = Path(repo_path).resolve()
    if not repo.exists():
        raise FileNotFoundError(f"Repo directory does not exist: {repo_path}")

    if not worktree_dir:
        unique_id = uuid.uuid4().hex[:8]
        # .worktree/ is included in .gitignore
        base_dir = repo / ".worktree"
        base_dir.mkdir(parents=True, exist_ok=True)
        target = (base_dir / f"{prefix}{unique_id}").resolve()
    else:
        target = Path(worktree_dir).resolve()

    target_str = str(target)

    # If directory already exists, clean it up first
    if target.exists():
        remove_worktree(target_str, repo_path=str(repo))

    logger.info(f"Creating git worktree at {target_str} pointing to {commit}")

    # Use --detach so we don't conflict with existing branches
    cmd = ["git", "worktree", "add", "--detach", target_str, commit]
    proc = subprocess.run(cmd, cwd=str(repo), capture_output=True, text=True)
    if proc.returncode != 0:
        logger.error(f"Failed to create worktree: {proc.stderr}")
        raise RuntimeError(f"git worktree add failed: {proc.stderr.strip()}")

    return target_str


def remove_worktree(worktree_dir: str, repo_path: Optional[str] = None) -> bool:
    """Cleanly removes a git worktree and prunes git records.
    
    Args:
        worktree_dir: Path to the worktree to remove.
        repo_path: Path to the main repository (optional, inferred if possible).
        
    Returns:
        True if removed successfully.
    """
    target = Path(worktree_dir).resolve()
    target_str = str(target)
    logger.info(f"Removing git worktree at {target_str}")

    cwd = repo_path or str(target.parent.parent if target.parent.name == ".worktree" else target.parent)

    try:
        proc = subprocess.run(
            ["git", "worktree", "remove", "--force", target_str],
            cwd=cwd,
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            logger.debug(f"git worktree remove reported: {proc.stderr.strip()}")
    except Exception as e:
        logger.debug(f"Error during git worktree remove command: {e}")

    # Prune worktree list in repo
    try:
        subprocess.run(["git", "worktree", "prune"], cwd=cwd, capture_output=True, text=True)
    except Exception:
        pass

    # Ensure physical directory is gone
    if target.exists():
        shutil.rmtree(target_str, ignore_errors=True)

    return not target.exists()


class WorktreeContext:
    """Context manager for temporary isolated git worktree."""

    def __init__(
        self,
        repo_path: str,
        worktree_dir: Optional[str] = None,
        commit: str = "HEAD",
        prefix: str = "wt-",
    ):
        self.repo_path = repo_path
        self.worktree_dir = worktree_dir
        self.commit = commit
        self.prefix = prefix
        self.created_path: Optional[str] = None

    def __enter__(self) -> str:
        self.created_path = create_worktree(
            self.repo_path,
            worktree_dir=self.worktree_dir,
            commit=self.commit,
            prefix=self.prefix,
        )
        return self.created_path

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.created_path:
            remove_worktree(self.created_path, repo_path=self.repo_path)


class WorktreeManager:
    """Tracks and manages multiple active worktrees."""

    def __init__(self, repo_path: str):
        self.repo_path = str(Path(repo_path).resolve())
        self.active_worktrees: List[str] = []

    def allocate(self, commit: str = "HEAD", prefix: str = "prodpilot-") -> str:
        wt_path = create_worktree(self.repo_path, commit=commit, prefix=prefix)
        self.active_worktrees.append(wt_path)
        return wt_path

    def release(self, wt_path: str) -> None:
        if wt_path in self.active_worktrees:
            self.active_worktrees.remove(wt_path)
        remove_worktree(wt_path, repo_path=self.repo_path)

    def cleanup_all(self) -> None:
        for wt in list(self.active_worktrees):
            try:
                remove_worktree(wt, repo_path=self.repo_path)
            except Exception as e:
                logger.warning(f"Failed to cleanup worktree {wt}: {e}")
        self.active_worktrees.clear()
