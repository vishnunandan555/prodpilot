"""Mock Agent Adapter for Fast, Deterministic Unit & Integration Testing.
Implements contracts/agent_interface.py without external LLM network latency.
"""

import subprocess
from pathlib import Path
from typing import Any, Callable, Dict, Optional

from contracts.agent_interface import AgentEvent, AgentResult


class MockAgentAdapter:
    """Fast, deterministic agent adapter for automated testing."""

    def __init__(self):
        self.name = "mock"

    def is_available(self) -> bool:
        return True

    def run(
        self,
        task: str,
        workdir: str,
        on_event: Optional[Callable[[AgentEvent], None]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> AgentResult:
        workdir_path = Path(workdir).resolve()
        ctx = context or {}
        stage = ctx.get("stage", "FIX")

        if on_event:
            on_event({
                "stage": stage,
                "kind": "tool_call",
                "payload": {"tool": "mock_agent", "action": f"Executing {stage} stage"},
            })

        if stage == "REPRODUCE" or "minimal reproduction test" in task.lower():
            tests_dir = workdir_path / "tests"
            tests_dir.mkdir(parents=True, exist_ok=True)
            repro_code = '''import pytest
from fastapi.testclient import TestClient

try:
    from app import app
except ImportError:
    from main import app

client = TestClient(app)

def test_reproduce_order_without_discount_fails():
    payload = {"items": [{"id": "item-1", "price": 20.0, "qty": 2}]}
    response = client.post("/orders", json=payload)
    assert response.status_code == 200, f"Expected 200 OK but got {response.status_code}: {response.text}"
    data = response.json()
    assert "total" in data
'''
            (tests_dir / "test_repro.py").write_text(repro_code, encoding="utf-8")
            if on_event:
                on_event({
                    "stage": "REPRODUCE",
                    "kind": "tool_call",
                    "payload": {"tool": "write_file", "path": "tests/test_repro.py"},
                })
            return {
                "diff": "",
                "summary": "Synthesized minimal reproduction test verifying failure on baseline code",
                "ok": True,
                "error": None,
            }

        # Default: FIX stage
        app_file = workdir_path / "app.py"
        if not app_file.exists():
            app_file = workdir_path / "main.py"

        if app_file.exists():
            content = app_file.read_text(encoding="utf-8")
            if 'discount = order["discount"]' in content:
                content = content.replace('discount = order["discount"]', 'discount = order.get("discount", 0)')
                app_file.write_text(content, encoding="utf-8")
            elif "order['discount']" in content:
                content = content.replace("order['discount']", "order.get('discount', 0)")
                app_file.write_text(content, encoding="utf-8")

        diff_proc = subprocess.run(
            ["git", "diff", "HEAD", "--", ".", ":(exclude)tests", ":(exclude).worktree*", ":(exclude).prodpilot*"],
            cwd=str(workdir_path),
            capture_output=True,
            text=True,
        )
        diff = diff_proc.stdout or ""
        if diff and not diff.endswith("\n"):
            diff += "\n"

        if on_event:
            on_event({
                "stage": "FIX",
                "kind": "tool_call",
                "payload": {"tool": "edit_file", "path": "app.py", "diff_len": len(diff)},
            })

        return {
            "diff": diff,
            "summary": "Safely extracted optional discount using order.get('discount', 0)",
            "ok": True,
            "error": None,
        }
