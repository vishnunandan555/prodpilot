"""Tests for Agent Adapters and Tool Gating."""

import tempfile
import pytest
from backend.prodpilot.agents.gemini_adapter import GeminiAdapter, GatedToolbox
from backend.prodpilot.agents.antigravity_adapter import AntigravityAdapter


def test_gated_toolbox():
    with tempfile.TemporaryDirectory() as tmpdir:
        tb = GatedToolbox(tmpdir)

        # 1. write_file
        res = tb.write_file("foo.txt", "hello world\nline 2")
        assert "Successfully wrote" in res

        # 2. read_file
        content = tb.read_file("foo.txt")
        assert "1: hello world" in content
        assert "2: line 2" in content

        # 3. list_dir
        listing = tb.list_dir(".")
        assert "foo.txt" in listing

        # 4. grep_search
        grep_res = tb.grep_search("hello", ".")
        assert "foo.txt:1: hello world" in grep_res

        # 5. Shell execution MUST be gated and raise PermissionError
        with pytest.raises(PermissionError):
            tb.execute_command("rm -rf /")


def test_antigravity_adapter_interface():
    adapter = AntigravityAdapter()
    assert hasattr(adapter, "run")
    assert hasattr(adapter, "is_available")
