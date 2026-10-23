"""Comprehensive tests for ProdPilot Git Worktree Manager."""

import json
import os
from pathlib import Path
from backend.prodpilot.pipeline.worktree import (
    create_worktree,
    remove_worktree,
    list_active_worktrees,
    cleanup_stale_worktrees,
    cleanup_all_worktrees,
    WorktreeContext,
    WorktreeManager,
)


def get_repo_path() -> str:
    return str(Path(__file__).resolve().parent.parent.parent.parent)


def test_worktree_lifecycle():
    repo_path = get_repo_path()

    # 1. Test create_worktree with metadata
    wt_path = create_worktree(repo_path, prefix="test-wt-", incident_id="inc-test-123", auto_cleanup=False)
    assert os.path.exists(wt_path)
    assert os.path.isdir(wt_path)
    assert os.path.exists(os.path.join(wt_path, ".git"))

    # Verify metadata file
    meta_file = Path(wt_path) / ".prodpilot_worktree_meta.json"
    assert meta_file.exists()
    meta_data = json.loads(meta_file.read_text(encoding="utf-8"))
    assert meta_data.get("incident_id") == "inc-test-123"
    assert meta_data.get("prefix") == "test-wt-"

    # 2. Test list_active_worktrees
    active = list_active_worktrees(repo_path)
    assert len(active) >= 2  # Main + at least this test worktree
    matching = [w for w in active if w["path"] == str(Path(wt_path).resolve())]
    assert len(matching) == 1
    wt_info = matching[0]
    assert wt_info["is_temporary"] is True
    assert wt_info["is_main"] is False
    assert wt_info["incident_id"] == "inc-test-123"

    # 3. Test remove_worktree
    removed = remove_worktree(wt_path, repo_path=repo_path)
    assert removed is True
    assert not os.path.exists(wt_path)

    # Verify list no longer has it
    after_active = list_active_worktrees(repo_path)
    assert not any(w["path"] == str(Path(wt_path).resolve()) for w in after_active)


def test_worktree_context():
    repo_path = get_repo_path()
    created = None
    with WorktreeContext(repo_path, prefix="test-ctx-", incident_id="inc-ctx-456") as wt_path:
        created = wt_path
        assert os.path.exists(wt_path)
        meta_file = Path(wt_path) / ".prodpilot_worktree_meta.json"
        assert meta_file.exists()
        assert json.loads(meta_file.read_text(encoding="utf-8"))["incident_id"] == "inc-ctx-456"

    assert created is not None
    assert not os.path.exists(created)


def test_worktree_manager_lifecycle():
    repo_path = get_repo_path()

    with WorktreeManager(repo_path) as mgr:
        wt1 = mgr.allocate(prefix="test-mgr1-", incident_id="inc-m1")
        wt2 = mgr.allocate(prefix="test-mgr2-", incident_id="inc-m2")

        assert os.path.exists(wt1)
        assert os.path.exists(wt2)
        assert len(mgr.active_worktrees) == 2

        # Explicit release of one
        mgr.release(wt1)
        assert not os.path.exists(wt1)
        assert len(mgr.active_worktrees) == 1

    # On context exit, all remaining should be cleaned up
    assert not os.path.exists(wt2)
    assert len(mgr.active_worktrees) == 0


def test_cleanup_stale_and_all_worktrees():
    repo_path = get_repo_path()

    # Allocate two worktrees
    wt1 = create_worktree(repo_path, prefix="test-stale1-", auto_cleanup=False)
    wt2 = create_worktree(repo_path, prefix="test-stale2-", auto_cleanup=False)

    assert os.path.exists(wt1)
    assert os.path.exists(wt2)

    # Force cleanup of all temporary worktrees
    cleaned = cleanup_all_worktrees(repo_path)
    assert str(Path(wt1).resolve()) in cleaned or not os.path.exists(wt1)
    assert str(Path(wt2).resolve()) in cleaned or not os.path.exists(wt2)

    assert not os.path.exists(wt1)
    assert not os.path.exists(wt2)
