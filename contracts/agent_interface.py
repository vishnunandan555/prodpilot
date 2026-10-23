"""ProdPilot Agent Adapter Interface Contract
Version: 1.0 (Phase 0 Frozen Contract)
"""

from typing import Any, Callable, Dict, Optional, Protocol, TypedDict


class AgentEvent(TypedDict):
    stage: str
    kind: str
    payload: Dict[str, Any]


class AgentResult(TypedDict):
    diff: str
    summary: str
    ok: bool
    error: Optional[str]


class AgentAdapter(Protocol):
    """Protocol for pluggable coding agent backends (Antigravity, Codex, Raw Gemini loop)."""

    def run(
        self,
        task: str,
        workdir: str,
        on_event: Optional[Callable[[AgentEvent], None]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> AgentResult:
        """Execute agent task in the given workdir.
        
        Args:
            task: Instruction prompt (e.g. generate repro test, fix bug).
            workdir: Absolute or relative path to isolated git worktree.
            on_event: Callback for streaming events (tool calls, steps, edits).
            context: Optional dictionary containing incident trace, logs, hints.
            
        Returns:
            AgentResult dict with diff, summary, ok status and optional error.
        """
        ...
