"""Tests for Worktree Manager."""

import os
from pathlib import Path
from backend.prodpilot.pipeline.worktree import create_worktree, remove_worktree, WorktreeContext


def test_worktree_lifecycle():
    repo_path = str(Path(__file__).resolve().parent.parent.parent.parent)
    
    # 1. Test create_worktree
    wt_path = create_worktree(repo_path, prefix="test-wt-")
    assert os.path.exists(wt_path)
    assert os.path.isdir(wt_path)
    assert os.path.exists(os.path.join(wt_path, ".git"))

    # 2. Test remove_worktree
    removed = remove_worktree(wt_path, repo_path=repo_path)
    assert removed is True
    assert not os.path.exists(wt_path)


def test_worktree_context():
    repo_path = str(Path(__file__).resolve().parent.parent.parent.parent)
    created = None
    with WorktreeContext(repo_path, prefix="test-ctx-") as wt_path:
        created = wt_path
        assert os.path.exists(wt_path)

    assert created is not None
    assert not os.path.exists(created)
