"""Antigravity Agent Adapter
Implements contracts/agent_interface.py using the native google.antigravity Python SDK
and the authenticated Antigravity runtime with full live streaming.
"""

import json
import logging
import os
import shutil
import subprocess
import asyncio
from pathlib import Path
from typing import Any, Callable, Dict, Optional

try:
    from contracts.agent_interface import AgentAdapter, AgentEvent, AgentResult
except ImportError:
    import sys
    sys.path.append(str(Path(__file__).resolve().parent.parent.parent.parent))
    from contracts.agent_interface import AgentAdapter, AgentEvent, AgentResult

logger = logging.getLogger(__name__)


class AntigravityAdapter:
    """Agent adapter leveraging Antigravity SDK and runtime for automated code repair."""

    def __init__(self, agy_path: Optional[str] = None):
        self.agy_path = agy_path or os.environ.get("AGY_PATH") or shutil.which("agy") or "/home/vishnunandan555/.local/bin/agy"

    def is_available(self) -> bool:
        if os.environ.get("PRODPILOT_AGENT_ADAPTER", "").lower() == "gemini":
            return False
        # Check either google.antigravity package or agy runtime binary
        try:
            import google.antigravity
            return True
        except ImportError:
            pass
        return bool(self.agy_path and os.path.exists(self.agy_path) and os.access(self.agy_path, os.X_OK))

    def _run_with_python_sdk(
        self,
        task: str,
        workdir: str,
        on_event: Optional[Callable[[AgentEvent], None]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Optional[AgentResult]:
        """Attempts execution using the in-process google.antigravity Python SDK if GEMINI_API_KEY is available."""
        gemini_api_key = os.environ.get("GEMINI_API_KEY")
        if not gemini_api_key:
            return None

        try:
            from google.antigravity import Agent, LocalAgentConfig, CapabilitiesConfig

            stage = (context or {}).get("stage", "FIX")
            if on_event:
                on_event({
                    "stage": stage,
                    "kind": "stage_started",
                    "payload": {"message": f"Antigravity Python SDK initializing agent in {workdir}..."},
                })

            async def _execute():
                config = LocalAgentConfig(
                    system_instructions=(
                        "You are an expert autonomous SRE repair agent. "
                        "Investigate the reported crash in the repository, locate the bug, "
                        "modify the code to fix the root cause, and ensure tests pass cleanly."
                    ),
                    workspaces=[workdir],
                    capabilities=CapabilitiesConfig(),
                    api_key=gemini_api_key,
                )
                async with Agent(config) as agent:
                    response = await agent.chat(task)
                    summary_text = ""
                    async for token in response:
                        summary_text += token

                    return summary_text

            # Run SDK loop
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor() as pool:
                        summary = pool.submit(asyncio.run, _execute()).result(timeout=180)
                else:
                    summary = asyncio.run(_execute())
            except Exception as e:
                logger.warning(f"Python SDK async execution note: {e}")
                return None

            diff = self._extract_git_diff(workdir)
            return {
                "diff": diff,
                "summary": summary or "Patch generated via Antigravity Python SDK",
                "ok": bool(diff),
                "error": None if diff else "No git changes produced by SDK agent",
            }
        except Exception as e:
            logger.warning(f"Python SDK attempt skipped: {e}")
            return None

    def _extract_git_diff(self, workdir: str) -> str:
        """Extracts unified git diff including newly created untracked files."""
        diff_proc = subprocess.run(
            ["git", "diff", "HEAD"],
            cwd=workdir,
            capture_output=True,
            text=True,
            check=False,
        )
        untracked_proc = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=workdir,
            capture_output=True,
            text=True,
            check=False,
        )

        diff = diff_proc.stdout or ""
        for status_line in untracked_proc.stdout.splitlines():
            if status_line.startswith("?? "):
                untracked_file = status_line[3:].strip()
                file_path = Path(workdir) / untracked_file
                if file_path.is_file():
                    try:
                        content = file_path.read_text(encoding="utf-8")
                        diff += f"\n--- /dev/null\n+++ b/{untracked_file}\n@@ -0,0 +1,{len(content.splitlines())} @@\n"
                        diff += "".join(f"+{l}\n" for l in content.splitlines())
                    except Exception as e:
                        logger.debug(f"Failed to read untracked file {file_path}: {e}")
        return diff

    def run(
        self,
        task: str,
        workdir: str,
        on_event: Optional[Callable[[AgentEvent], None]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> AgentResult:
        """Execute agent task in the given workdir with real-time stream feedback."""
        context = context or {}
        stage = context.get("stage", "FIX")

        # 1. Try native Python SDK if configured with API key
        sdk_res = self._run_with_python_sdk(task=task, workdir=workdir, on_event=on_event, context=context)
        if sdk_res and sdk_res.get("ok"):
            return sdk_res

        # 2. Execute via Antigravity authenticated runtime with full streaming
        if not (self.agy_path and os.path.exists(self.agy_path) and os.access(self.agy_path, os.X_OK)):
            err_msg = f"Antigravity CLI (agy) not found at {self.agy_path}"
            logger.warning(err_msg)
            from backend.prodpilot.agents.gemini_adapter import GeminiAdapter
            return GeminiAdapter().run(task=task, workdir=workdir, on_event=on_event, context=context)

        cmd = [
            self.agy_path,
            "-p",
            task,
            "--dangerously-skip-permissions",
            "--output-format",
            "stream-json",
        ]

        logger.info(f"Running Antigravity streaming agent in {workdir} with task: {task[:80]}...")

        if on_event:
            on_event({
                "stage": stage,
                "kind": "stage_started",
                "payload": {"message": f"Antigravity agent starting task in {workdir}: {task[:100]}..."},
            })

        env = os.environ.copy()
        summary_lines = []

        try:
            proc = subprocess.Popen(
                cmd,
                cwd=workdir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=env,
                bufsize=1,
            )

            # Stream NDJSON lines in real time as they are generated
            for line in proc.stdout:
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                    ev = record.get("event")

                    if ev == "step_update":
                        su = record.get("step_update", {})
                        stype = su.get("step_type")
                        sstate = su.get("state")

                        # Live tool execution stream
                        if stype == "tool":
                            tool_name = su.get("tool_name", "tool")
                            tool_info = su.get("tool_info", {})
                            params = tool_info.get("parameters") or tool_info.get("args") or {}
                            tool_result = tool_info.get("result") or tool_info.get("output") or su.get("output") or ""
                            duration = su.get("duration_seconds")

                            # Build rich, human-readable summary
                            if tool_name == "run_command":
                                cmd_str = params.get("CommandLine") or params.get("command") or ""
                                summary = f"$ {cmd_str}" if cmd_str else "Executed shell command"
                            elif tool_name in ("read_file", "view_file"):
                                path = params.get("Path") or params.get("AbsolutePath") or ""
                                start = params.get("StartLine")
                                end = params.get("EndLine")
                                line_info = f" L{start}-{end}" if start and end else ""
                                summary = f"Inspecting {Path(path).name if path else 'file'}{line_info}"
                            elif tool_name in ("write_to_file", "replace_file_content", "edit_file"):
                                path = params.get("TargetFile") or params.get("Path") or ""
                                summary = f"Modifying {Path(path).name if path else 'code'}"
                            elif tool_name == "grep_search":
                                query = params.get("Query") or ""
                                summary = f"Grep for '{query}'"
                            else:
                                summary = f"Executed {tool_name}"

                            summary_lines.append(f"{summary} [{sstate}]")
                            if on_event:
                                on_event({
                                    "stage": stage,
                                    "kind": "tool_call",
                                    "payload": {
                                        "tool": tool_name,
                                        "args": params,
                                        "parameters": params,
                                        "summary": summary,
                                        "state": sstate,
                                        "result": tool_result,
                                        "duration_seconds": duration,
                                    },
                                })

                        # Live thoughts & monologue streaming
                        elif stype == "agent_response" and su.get("text_delta"):
                            delta = su["text_delta"]
                            summary_lines.append(delta)
                            if on_event:
                                on_event({
                                    "stage": stage,
                                    "kind": "thought",
                                    "payload": {"thought": delta, "message": delta},
                                })

                    elif ev == "result":
                        res_obj = record.get("result", {})
                        resp_msg = res_obj.get("response", "")
                        if resp_msg:
                            summary_lines.append(resp_msg)

                except json.JSONDecodeError:
                    summary_lines.append(line)

            # Allow up to 180s for complex code analysis & patching
            proc.wait(timeout=180)

            diff = self._extract_git_diff(workdir)
            ok = proc.returncode == 0 and bool(diff)

            if not ok or not diff:
                logger.warning(f"Antigravity runtime returned ok={ok}, diff_len={len(diff)}. Falling back to GeminiAdapter...")
                from backend.prodpilot.agents.gemini_adapter import GeminiAdapter
                return GeminiAdapter().run(task=task, workdir=workdir, on_event=on_event, context=context)

            summary = "\n".join(summary_lines[-5:]) if summary_lines else "Antigravity task completed."
            return {
                "diff": diff,
                "summary": summary,
                "ok": True,
                "error": None,
            }

        except subprocess.TimeoutExpired:
            proc.kill()
            logger.warning("Antigravity process exceeded 180s timeout. Falling back to GeminiAdapter...")
            from backend.prodpilot.agents.gemini_adapter import GeminiAdapter
            return GeminiAdapter().run(task=task, workdir=workdir, on_event=on_event, context=context)

        except Exception as e:
            logger.warning(f"Error executing Antigravity adapter: {e}. Falling back to GeminiAdapter...")
            from backend.prodpilot.agents.gemini_adapter import GeminiAdapter
            return GeminiAdapter().run(task=task, workdir=workdir, on_event=on_event, context=context)
