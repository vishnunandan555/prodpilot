"""ProdPilot Pipeline Package (Stream A)"""

from backend.prodpilot.pipeline.worktree import (
    create_worktree,
    remove_worktree,
    WorktreeContext,
    WorktreeManager,
)
from backend.prodpilot.pipeline.brief import create_brief, extract_traceback_info
from backend.prodpilot.pipeline.repro_runner import (
    DeterministicVerifier,
    PipelineResult,
    TestResult,
    run_repro_pipeline,
)

__all__ = [
    "create_worktree",
    "remove_worktree",
    "WorktreeContext",
    "WorktreeManager",
    "create_brief",
    "extract_traceback_info",
    "DeterministicVerifier",
    "PipelineResult",
    "TestResult",
    "run_repro_pipeline",
]
