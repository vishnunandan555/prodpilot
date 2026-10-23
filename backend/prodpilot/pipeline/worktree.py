"""ProdPilot Git Worktree Manager
Helper to create temporary git worktrees, track their lifecycle,
and cleanly remove and prune them.

Guarantees:
- Every created worktree is registered in an in-memory & on-disk registry.
- Uncaught exits and interrupts clean up active worktrees via atexit.
- Orphaned or stale worktrees from dead processes can be pruned on startup or on demand.
- Clean git worktree prune ensures no dangling worktree pointers in .git/worktrees/.
"""

import atexit
import json
import logging
import os
import shutil
import subprocess
import threading
import time
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

TEMPORARY_PREFIXES = ("wt-", "repro-", "stage-", "test-", "prodpilot-pr-", "prodpilot-")


@dataclass
class WorktreeRecord:
    path: str
    repo_path: str
    commit: str
    prefix: str
    incident_id: Optional[str] = None
    created_at: float = 0.0
    pid: int = 0
    auto_cleanup: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "WorktreeRecord":
        return cls(
            path=data.get("path", ""),
            repo_path=data.get("repo_path", ""),
            commit=data.get("commit", "HEAD"),
            prefix=data.get("prefix", "wt-"),
            incident_id=data.get("incident_id"),
            created_at=data.get("created_at", 0.0),
            pid=data.get("pid", 0),
            auto_cleanup=data.get("auto_cleanup", True),
        )


def _pid_is_running(pid: int) -> bool:
    """Checks if a process ID is currently running on the system."""
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


class WorktreeRegistry:
    """Thread-safe process-level registry for tracking and cleaning active worktrees."""

    def __init__(self):
        self._lock = threading.Lock()
        self._active: Dict[str, WorktreeRecord] = {}
        atexit.register(self.cleanup_process_worktrees)

    def register(self, record: WorktreeRecord) -> None:
        with self._lock:
            self._active[record.path] = record
        self._save_to_disk_registry(record)

    def unregister(self, worktree_path: str, repo_path: Optional[str] = None) -> Optional[WorktreeRecord]:
        resolved = str(Path(worktree_path).resolve())
        with self._lock:
            record = self._active.pop(resolved, None)
        effective_repo = repo_path or (record.repo_path if record else None)
        if effective_repo:
            self._remove_from_disk_registry(resolved, effective_repo)
        return record

    def get_all(self) -> List[WorktreeRecord]:
        with self._lock:
            return list(self._active.values())

    def _disk_registry_path(self, repo_path: str) -> Path:
        return Path(repo_path).resolve() / ".worktree" / ".registry.json"

    def _load_disk_registry(self, repo_path: str) -> Dict[str, Dict[str, Any]]:
        reg_file = self._disk_registry_path(repo_path)
        if not reg_file.exists():
            return {}
        try:
            data = json.loads(reg_file.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
        except Exception as e:
            logger.debug(f"Could not read disk registry {reg_file}: {e}")
        return {}

    def _save_to_disk_registry(self, record: WorktreeRecord) -> None:
        try:
            reg_file = self._disk_registry_path(record.repo_path)
            reg_file.parent.mkdir(parents=True, exist_ok=True)
            with self._lock:
                current = self._load_disk_registry(record.repo_path)
                current[record.path] = record.to_dict()
                reg_file.write_text(json.dumps(current, indent=2), encoding="utf-8")
        except Exception as e:
            logger.debug(f"Failed to save worktree {record.path} to disk registry: {e}")

    def _remove_from_disk_registry(self, worktree_path: str, repo_path: str) -> None:
        try:
            reg_file = self._disk_registry_path(repo_path)
            if reg_file.exists():
                with self._lock:
                    current = self._load_disk_registry(repo_path)
                    if worktree_path in current:
                        del current[worktree_path]
                        reg_file.write_text(json.dumps(current, indent=2), encoding="utf-8")
        except Exception as e:
            logger.debug(f"Failed to remove worktree {worktree_path} from disk registry: {e}")

    def cleanup_process_worktrees(self) -> None:
        """Called automatically at process exit to cleanup all worktrees owned by this PID."""
        with self._lock:
            records = list(self._active.values())
        current_pid = os.getpid()
        for rec in records:
            if rec.auto_cleanup and (rec.pid == current_pid or rec.pid == 0):
                try:
                    logger.info(f"Auto-cleaning worktree on process exit: {rec.path}")
                    remove_worktree(rec.path, repo_path=rec.repo_path)
                except Exception as e:
                    logger.warning(f"Error during atexit cleanup of {rec.path}: {e}")


# Global process registry
_global_registry = WorktreeRegistry()


def _resolve_repo_from_worktree(worktree_dir: str) -> Optional[str]:
    """Attempts to find the main git repository path from a worktree directory."""
    target = Path(worktree_dir).resolve()
    git_file = target / ".git"

    if git_file.is_file():
        try:
            content = git_file.read_text(encoding="utf-8").strip()
            # format: gitdir: /path/to/main/.git/worktrees/<name>
            if content.startswith("gitdir:"):
                gitdir_path = Path(content.split(":", 1)[1].strip()).resolve()
                # gitdir points to <repo>/.git/worktrees/<name>
                if "worktrees" in gitdir_path.parts:
                    # Traverses up from .git/worktrees/<name> to <repo>
                    main_git = gitdir_path.parent.parent
                    if main_git.name == ".git":
                        return str(main_git.parent.resolve())
        except Exception:
            pass

    # Check if target is inside .worktree/
    if target.parent.name == ".worktree":
        candidate = target.parent.parent
        if (candidate / ".git").exists():
            return str(candidate.resolve())

    # Fallback to parent
    if (target.parent / ".git").exists():
        return str(target.parent.resolve())

    return None


def list_active_worktrees(repo_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """Lists all git worktrees associated with the repo, enriched with metadata.
    
    Args:
        repo_path: Path to the main git repository (defaults to current directory).
        
    Returns:
        List of dicts representing worktrees:
        [
            {
                "path": "/path/to/worktree",
                "head": "7ee8d4a...",
                "branch": "refs/heads/main" or None,
                "bare": False,
                "detached": True,
                "is_main": False,
                "is_temporary": True,
                "incident_id": "...",
                "created_at": 1718000000.0,
                "age_seconds": 120.5,
                "owner_pid": 1234,
                "owner_alive": True,
                "exists": True
            }
        ]
    """
    repo = Path(repo_path or os.getcwd()).resolve()
    if not (repo / ".git").exists():
        return []

    try:
        proc = subprocess.run(
            ["git", "worktree", "list", "--porcelain"],
            cwd=str(repo),
            capture_output=True,
            text=True,
            timeout=10,
        )
    except Exception as e:
        logger.error(f"Failed to list git worktrees: {e}")
        return []

    if proc.returncode != 0:
        logger.error(f"git worktree list failed: {proc.stderr}")
        return []

    # Load disk registry if available
    disk_registry = _global_registry._load_disk_registry(str(repo))

    worktrees: List[Dict[str, Any]] = []
    current_wt: Dict[str, Any] = {}

    for line in proc.stdout.splitlines():
        line = line.strip()
        if not line:
            if current_wt.get("path"):
                worktrees.append(current_wt)
            current_wt = {}
            continue

        if line.startswith("worktree "):
            wt_path = str(Path(line.split(" ", 1)[1]).resolve())
            current_wt = {
                "path": wt_path,
                "head": "",
                "branch": None,
                "bare": False,
                "detached": False,
                "is_main": (wt_path == str(repo)),
            }
        elif line.startswith("HEAD ") and current_wt:
            current_wt["head"] = line.split(" ", 1)[1].strip()
        elif line.startswith("branch ") and current_wt:
            current_wt["branch"] = line.split(" ", 1)[1].strip()
        elif line == "bare" and current_wt:
            current_wt["bare"] = True
        elif line == "detached" and current_wt:
            current_wt["detached"] = True

    if current_wt.get("path"):
        worktrees.append(current_wt)

    now = time.time()
    for wt in worktrees:
        wt_path = wt["path"]
        target = Path(wt_path)
        wt["exists"] = target.exists()

        is_temp = (
            target.parent.name == ".worktree"
            or any(target.name.startswith(pfx) for pfx in TEMPORARY_PREFIXES)
        ) and not wt["is_main"]
        wt["is_temporary"] = is_temp

        meta = disk_registry.get(wt_path, {})
        meta_file = target / ".prodpilot_worktree_meta.json"
        if meta_file.exists():
            try:
                file_meta = json.loads(meta_file.read_text(encoding="utf-8"))
                meta = {**meta, **file_meta}
            except Exception:
                pass

        wt["incident_id"] = meta.get("incident_id")
        created_at = meta.get("created_at")
        if created_at:
            wt["created_at"] = created_at
            wt["age_seconds"] = max(0.0, now - created_at)
        else:
            wt["created_at"] = None
            wt["age_seconds"] = None

        pid = meta.get("pid")
        wt["owner_pid"] = pid
        wt["owner_alive"] = _pid_is_running(pid) if pid else None

    return worktrees


def create_worktree(
    repo_path: str,
    worktree_dir: Optional[str] = None,
    commit: str = "HEAD",
    prefix: str = "wt-",
    incident_id: Optional[str] = None,
    auto_cleanup: bool = True,
) -> str:
    """Creates a new isolated git worktree detached at commit and registers it.
    
    Args:
        repo_path: Path to the main git repository.
        worktree_dir: Target directory path for the worktree. If None, generated in .worktree/
        commit: Git commit, branch, or tag to check out (default 'HEAD').
        prefix: Prefix for randomly generated worktree directory names.
        incident_id: Optional incident ID to associate with this worktree.
        auto_cleanup: If True, automatically removes worktree when current process exits.
        
    Returns:
        Absolute path to the created worktree directory.
    """
    repo = Path(repo_path).resolve()
    if not repo.exists():
        raise FileNotFoundError(f"Repo directory does not exist: {repo_path}")
    if not (repo / ".git").exists():
        raise RuntimeError(f"Specified path is not a git repository: {repo_path}")

    if not worktree_dir:
        unique_id = uuid.uuid4().hex[:8]
        # .worktree/ is included in .gitignore
        base_dir = repo / ".worktree"
        base_dir.mkdir(parents=True, exist_ok=True)
        target = (base_dir / f"{prefix}{unique_id}").resolve()
    else:
        target = Path(worktree_dir).resolve()

    target_str = str(target)

    # If directory already exists or git has stale reference, clean it first
    if target.exists():
        remove_worktree(target_str, repo_path=str(repo))
    else:
        # Run prune in case git still has a worktree record for this path
        try:
            subprocess.run(["git", "worktree", "prune"], cwd=str(repo), capture_output=True, text=True, timeout=5)
        except Exception:
            pass

    logger.info(f"Creating git worktree at {target_str} pointing to {commit}")

    # Use --detach so we don't conflict with existing branches
    cmd = ["git", "worktree", "add", "--detach", target_str, commit]
    proc = subprocess.run(cmd, cwd=str(repo), capture_output=True, text=True, timeout=30)
    if proc.returncode != 0:
        # If worktree prune was needed, retry once after prune
        if "already exists" in proc.stderr or "is already a worktree" in proc.stderr:
            logger.warning(f"Git reported existing worktree reference; running prune and retrying: {proc.stderr.strip()}")
            subprocess.run(["git", "worktree", "prune"], cwd=str(repo), capture_output=True, text=True, timeout=5)
            shutil.rmtree(target_str, ignore_errors=True)
            proc = subprocess.run(cmd, cwd=str(repo), capture_output=True, text=True, timeout=30)

    if proc.returncode != 0:
        logger.error(f"Failed to create worktree: {proc.stderr}")
        raise RuntimeError(f"git worktree add failed: {proc.stderr.strip()}")

    # Persist metadata inside worktree
    record = WorktreeRecord(
        path=target_str,
        repo_path=str(repo),
        commit=commit,
        prefix=prefix,
        incident_id=incident_id,
        created_at=time.time(),
        pid=os.getpid(),
        auto_cleanup=auto_cleanup,
    )

    try:
        meta_file = target / ".prodpilot_worktree_meta.json"
        meta_file.write_text(json.dumps(record.to_dict(), indent=2), encoding="utf-8")
    except Exception as e:
        logger.debug(f"Could not write worktree metadata file: {e}")

    # Register in active registry
    _global_registry.register(record)

    return target_str


def remove_worktree(worktree_dir: str, repo_path: Optional[str] = None, force: bool = True) -> bool:
    """Cleanly removes a git worktree, prunes git records, and updates registries.
    
    Args:
        worktree_dir: Path to the worktree to remove.
        repo_path: Path to the main repository (optional, inferred if possible).
        force: Whether to pass --force to git worktree remove.
        
    Returns:
        True if removed successfully.
    """
    target = Path(worktree_dir).resolve()
    target_str = str(target)
    logger.info(f"Removing git worktree at {target_str}")

    cwd = repo_path or _resolve_repo_from_worktree(target_str) or str(target.parent)

    # 1. Unregister from registries
    _global_registry.unregister(target_str, repo_path=cwd)

    # 2. git worktree remove
    try:
        cmd = ["git", "worktree", "remove"]
        if force:
            cmd.append("--force")
        cmd.append(target_str)
        proc = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=15,
        )
        if proc.returncode != 0:
            logger.debug(f"git worktree remove reported: {proc.stderr.strip()}")
    except Exception as e:
        logger.debug(f"Error during git worktree remove command: {e}")

    # 3. Prune worktree metadata in repo
    try:
        subprocess.run(["git", "worktree", "prune"], cwd=cwd, capture_output=True, text=True, timeout=10)
    except Exception:
        pass

    # 4. Ensure physical directory is completely gone
    if target.exists():
        try:
            shutil.rmtree(target_str, ignore_errors=True)
        except Exception as e:
            logger.debug(f"Failed to remove physical directory {target_str}: {e}")

    return not target.exists()


def cleanup_stale_worktrees(
    repo_path: str,
    max_age_seconds: Optional[float] = 1800.0,
    force_all_temporary: bool = False,
) -> List[str]:
    """Finds and prunes stale or orphaned temporary worktrees.
    
    Args:
        repo_path: Path to the main git repository.
        max_age_seconds: If provided, worktrees older than this are cleaned (default 30m).
        force_all_temporary: If True, cleans all temporary worktrees regardless of age.
        
    Returns:
        List of paths of removed worktrees.
    """
    repo = Path(repo_path).resolve()
    cleaned: List[str] = []

    # 1. First run git worktree prune to clear dead git pointers
    try:
        subprocess.run(["git", "worktree", "prune"], cwd=str(repo), capture_output=True, text=True, timeout=10)
    except Exception:
        pass

    # 2. Inspect active worktrees
    worktrees = list_active_worktrees(str(repo))
    for wt in worktrees:
        if wt.get("is_main"):
            continue

        wt_path = wt["path"]
        is_temp = wt.get("is_temporary", False)
        if not is_temp:
            continue

        should_remove = False
        reason = ""

        if force_all_temporary:
            should_remove = True
            reason = "force_all_temporary requested"
        elif wt.get("owner_alive") is False:
            should_remove = True
            reason = f"owner process (PID {wt.get('owner_pid')}) is dead"
        elif max_age_seconds is not None and wt.get("age_seconds") is not None:
            if wt["age_seconds"] > max_age_seconds:
                should_remove = True
                reason = f"age ({wt['age_seconds']:.0f}s) exceeded limit ({max_age_seconds:.0f}s)"

        if should_remove:
            logger.info(f"Pruning stale worktree {wt_path}: {reason}")
            if remove_worktree(wt_path, repo_path=str(repo)):
                cleaned.append(wt_path)

    # 3. Check for any leftover untracked folders inside .worktree/
    base_dir = repo / ".worktree"
    if base_dir.is_dir():
        for child in list(base_dir.iterdir()):
            if child.is_dir() and not child.name.startswith("."):
                child_str = str(child.resolve())
                if child_str not in cleaned:
                    logger.info(f"Removing unindexed worktree directory in .worktree: {child_str}")
                    try:
                        shutil.rmtree(child_str, ignore_errors=True)
                        cleaned.append(child_str)
                    except Exception as e:
                        logger.warning(f"Failed to remove orphaned folder {child_str}: {e}")

    # Final prune
    try:
        subprocess.run(["git", "worktree", "prune"], cwd=str(repo), capture_output=True, text=True, timeout=10)
    except Exception:
        pass

    return cleaned


def cleanup_all_worktrees(repo_path: Optional[str] = None) -> List[str]:
    """Force cleans all temporary worktrees for the repository."""
    repo = repo_path or os.getcwd()
    return cleanup_stale_worktrees(repo, force_all_temporary=True)


class WorktreeContext:
    """Context manager for temporary isolated git worktree."""

    def __init__(
        self,
        repo_path: str,
        worktree_dir: Optional[str] = None,
        commit: str = "HEAD",
        prefix: str = "wt-",
        incident_id: Optional[str] = None,
    ):
        self.repo_path = repo_path
        self.worktree_dir = worktree_dir
        self.commit = commit
        self.prefix = prefix
        self.incident_id = incident_id
        self.created_path: Optional[str] = None

    def __enter__(self) -> str:
        self.created_path = create_worktree(
            self.repo_path,
            worktree_dir=self.worktree_dir,
            commit=self.commit,
            prefix=self.prefix,
            incident_id=self.incident_id,
            auto_cleanup=False,  # Managed by context manager __exit__
        )
        return self.created_path

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.created_path:
            remove_worktree(self.created_path, repo_path=self.repo_path)
            self.created_path = None


class WorktreeManager:
    """Tracks and manages multiple active worktrees for an incident or lifecycle."""

    def __init__(self, repo_path: str):
        self.repo_path = str(Path(repo_path).resolve())
        self.active_worktrees: List[str] = []

    def allocate(
        self,
        commit: str = "HEAD",
        prefix: str = "prodpilot-",
        incident_id: Optional[str] = None,
    ) -> str:
        wt_path = create_worktree(
            self.repo_path,
            commit=commit,
            prefix=prefix,
            incident_id=incident_id,
            auto_cleanup=False,
        )
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

    def __enter__(self) -> "WorktreeManager":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.cleanup_all()
