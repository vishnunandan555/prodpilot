"""ProdPilot Repro-First Pipeline & Deterministic Verifier
Executes:
1. Agent writes minimal reproduction test (tests/test_repro.py).
2. Verifier runs test: MUST FAIL on baseline code (if it passes, re-prompt).
3. Agent modifies code in worktree to fix bug.
4. Verifier runs repro test AND full test suite.
5. Bounded retry: max 2 attempts on test failure with error logs fed back to agent.
Part of Task 3 (Stream A).
"""

import json
import logging
import os
import shutil
import subprocess
import sys
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, Optional

from contracts.agent_interface import AgentAdapter, AgentEvent
from backend.prodpilot.agents.factory import get_agent_adapter
from backend.prodpilot.db import (
    create_run,
    log_event,
    save_artifact,
    update_incident_brief,
    update_incident_status,
    update_run,
)
from backend.prodpilot.pipeline.brief import create_brief
from backend.prodpilot.pipeline.worktree import create_worktree, remove_worktree

logger = logging.getLogger(__name__)


@dataclass
class TestResult:
    passed: bool
    exit_code: int
    duration_sec: float
    summary: str
    output: str
    failure_snippet: Optional[str] = None


class DeterministicVerifier:
    """Runs test suites in an isolated, stripped environment with strict timeouts."""

    def __init__(self, timeout_sec: int = 30):
        self.timeout_sec = timeout_sec

    def run_tests(
        self,
        workdir: str,
        test_target: Optional[str] = None,
        test_cmd: Optional[str] = None,
    ) -> TestResult:
        """Runs test command deterministically in workdir."""
        start_time = time.time()

        # Build clean environment: strip API tokens and secrets
        env = {
            "PATH": os.environ.get("PATH", ""),
            "PYTHONPATH": f"{workdir}:.",
            "LANG": "en_US.UTF-8",
            "LC_ALL": "en_US.UTF-8",
        }
        # Locate python & pytest executables
        python_bin = sys.executable or "python3"
        pytest_candidate = Path(python_bin).parent / "pytest"
        pytest_bin = str(pytest_candidate) if pytest_candidate.exists() else shutil.which("pytest") or "pytest"

        # Ensure python and pytest directories are in PATH
        if pytest_candidate.exists():
            env["PATH"] = f"{pytest_candidate.parent}:{env['PATH']}"

        if test_cmd:
            cmd = test_cmd.split()
            if cmd[0] == "pytest":
                cmd[0] = pytest_bin
        elif test_target:
            cmd = [pytest_bin, "-v", test_target]
        else:
            cmd = [pytest_bin, "-v"]

        try:
            proc = subprocess.run(
                cmd,
                cwd=workdir,
                capture_output=True,
                text=True,
                env=env,
                timeout=self.timeout_sec,
            )
            duration = round(time.time() - start_time, 2)
            passed = proc.returncode == 0
            output = (proc.stdout or "") + ("\n" + proc.stderr if proc.stderr else "")

            # Extract failure snippet if failed
            failure_snippet = None
            if not passed:
                failure_lines = [l for l in output.splitlines() if "FAILED" in l or "ERROR" in l or "KeyError" in l or "assert" in l]
                failure_snippet = "\n".join(failure_lines[:5]) if failure_lines else output[-500:]

            # Summary line
            last_lines = [l.strip() for l in output.splitlines() if l.strip()]
            summary = last_lines[-1] if last_lines else (f"Exit code {proc.returncode} in {duration}s")

            return TestResult(
                passed=passed,
                exit_code=proc.returncode,
                duration_sec=duration,
                summary=summary,
                output=output,
                failure_snippet=failure_snippet,
            )

        except subprocess.TimeoutExpired:
            duration = round(time.time() - start_time, 2)
            return TestResult(
                passed=False,
                exit_code=-1,
                duration_sec=duration,
                summary=f"TimeoutExpired ({self.timeout_sec}s)",
                output="Test command exceeded maximum timeout limit.",
                failure_snippet="TimeoutExpired",
            )
        except Exception as e:
            duration = round(time.time() - start_time, 2)
            return TestResult(
                passed=False,
                exit_code=-2,
                duration_sec=duration,
                summary=f"Error running tests: {e}",
                output=str(e),
                failure_snippet=str(e),
            )


@dataclass
class PipelineResult:
    ok: bool
    run_id: str
    incident_id: str
    worktree_path: str
    patch_diff: str
    repro_test: str
    test_evidence: Dict[str, str]
    attempts: int
    brief: Dict[str, Any]
    error: Optional[str] = None


def run_repro_pipeline(
    incident: Dict[str, Any],
    repo_path: str,
    agent_adapter: Optional[AgentAdapter] = None,
    run_id: Optional[str] = None,
    db_path: Optional[str] = None,
) -> PipelineResult:
    """Executes the full Repro-First Pipeline.
    
    1. Extracts brief
    2. Spawns worktree
    3. Prompts agent for minimal reproduction test (tests/test_repro.py)
    4. Confirms repro test FAILS on baseline code
    5. Prompts agent to fix bug
    6. Runs repro test AND full test suite (bounded retry: 2 attempts)
    7. Stores artifacts and events
    """
    incident_id = incident["id"]
    run_id = run_id or f"run-{uuid.uuid4().hex[:6]}"
    adapter = agent_adapter or get_agent_adapter()
    verifier = DeterministicVerifier()

    create_run(run_id, incident_id, tier="fast", state="INGESTED", db_path=db_path)
    update_incident_status(incident_id, "INVESTIGATING", db_path=db_path)

    # 1. UNDERSTAND Stage
    log_event(
        run_id,
        incident_id,
        stage="UNDERSTAND",
        kind="stage_started",
        payload={"message": "Analyzing incident traceback, logs tail, and suspect commit..."},
        db_path=db_path,
    )

    brief = create_brief(incident)
    update_incident_brief(incident_id, brief, db_path=db_path)
    update_run(run_id, state="BRIEFED", db_path=db_path)

    # 2. Setup isolated worktree
    worktree_path = create_worktree(repo_path, prefix=f"repro-{incident_id[:8]}-")
    logger.info(f"Initialized isolated pipeline worktree: {worktree_path}")

    evidence: Dict[str, str] = {}
    repro_test_code = ""
    patch_diff = ""

    def on_agent_event(evt: AgentEvent):
        log_event(
            run_id,
            incident_id,
            stage=evt.get("stage", "FIX"),
            kind=evt.get("kind", "tool_call"),
            payload=evt.get("payload", {}),
            db_path=db_path,
        )

    # 3. REPRODUCE Stage
    update_run(run_id, state="REPRO_TEST", db_path=db_path)
    log_event(
        run_id,
        incident_id,
        stage="REPRODUCE",
        kind="stage_started",
        payload={"stage": "REPRODUCE", "message": "Synthesizing minimal reproduction test from traceback..."},
        db_path=db_path,
    )

    repro_task = (
        f"Generate a minimal reproduction test in tests/test_repro.py that reproduces this bug:\n"
        f"Summary: {brief['summary']}\n"
        f"Suspect Area: {brief['suspected_area']}\n"
        f"Traceback:\n{incident.get('trace')}\n"
        f"The test MUST reproduce the error and FAIL on baseline code."
    )

    repro_attempts = 0
    repro_passed_on_baseline = True

    while repro_attempts < 2 and repro_passed_on_baseline:
        repro_attempts += 1
        adapter_res = adapter.run(
            task=repro_task,
            workdir=worktree_path,
            on_event=on_agent_event,
            context={"stage": "REPRODUCE", "brief": brief, "trace": incident.get("trace"), **brief},
        )

        repro_file = Path(worktree_path) / "tests" / "test_repro.py"
        if repro_file.exists():
            repro_test_code = repro_file.read_text(encoding="utf-8")
        else:
            repro_test_code = adapter_res.get("diff", "")

        # Deterministic Verifier: MUST FAIL on baseline code!
        test_res = verifier.run_tests(worktree_path, test_target="tests/test_repro.py")
        log_event(
            run_id,
            incident_id,
            stage="REPRODUCE",
            kind="test_result",
            payload={
                "phase": "repro_baseline",
                "passed": test_res.passed,
                "exit_code": test_res.exit_code,
                "duration_sec": test_res.duration_sec,
                "summary": test_res.summary,
                "failure_snippet": test_res.failure_snippet,
            },
            db_path=db_path,
        )

        if not test_res.passed:
            # Bug reproduced successfully!
            repro_passed_on_baseline = False
            evidence["before"] = f"FAILED ({brief['error_type']}: {brief['error_message']})"
            logger.info("Reproduction test confirmed failing on baseline code.")
        else:
            logger.warning("Repro test unexpectedly passed on baseline! Re-prompting agent...")
            repro_task = (
                f"Your previous reproduction test PASSED on baseline code! A valid reproduction test "
                f"MUST fail by reproducing the crash. Traceback was:\n{incident.get('trace')}\n"
                f"Please update tests/test_repro.py so it exercises the crashing path and fails."
            )

    save_artifact(
        f"art-repro-{run_id}",
        run_id,
        incident_id,
        kind="repro_test",
        content=repro_test_code,
        path="tests/test_repro.py",
        db_path=db_path,
    )
    save_artifact(
        f"art-log-before-{run_id}",
        run_id,
        incident_id,
        kind="test_log_before",
        content=test_res.output,
        db_path=db_path,
    )

    # 4. FIX & VERIFY Stage (Bounded Retry: max 2 attempts)
    update_run(run_id, state="FIX", db_path=db_path)
    update_incident_status(incident_id, "FIXING", db_path=db_path)
    log_event(
        run_id,
        incident_id,
        stage="FIX",
        kind="stage_started",
        payload={"stage": "FIX", "message": "Agent modifying code in git worktree to resolve failure..."},
        db_path=db_path,
    )

    fix_attempts = 0
    max_fix_attempts = 2
    suite_passed = False
    last_error_log = ""

    while fix_attempts < max_fix_attempts and not suite_passed:
        fix_attempts += 1
        update_run(run_id, attempts=fix_attempts, db_path=db_path)

        fix_task = (
            f"Fix the bug in {brief['suspect_file']} causing the reproduction test to fail.\n"
            f"Error: {brief['summary']}\n"
            f"Suspect line: {brief['suspect_line']}\n"
        )
        if last_error_log:
            fix_task += f"\nPrevious attempt failed with logs:\n{last_error_log[-600:]}\nFix the remaining errors."

        fix_res = adapter.run(
            task=fix_task,
            workdir=worktree_path,
            on_event=on_agent_event,
            context={"stage": "FIX", "brief": brief, "trace": incident.get("trace"), **brief},
        )

        patch_diff = fix_res.get("diff", "")

        # Run Verifier: 1. Repro test, 2. Full test suite
        update_run(run_id, state="VERIFY", db_path=db_path)
        log_event(
            run_id,
            incident_id,
            stage="VERIFY",
            kind="stage_started",
            payload={"message": f"Deterministic verifier running repro test and full suite (attempt {fix_attempts})..."},
            db_path=db_path,
        )

        repro_verify_res = verifier.run_tests(worktree_path, test_target="tests/test_repro.py")
        suite_verify_res = verifier.run_tests(worktree_path)

        suite_passed = repro_verify_res.passed and suite_verify_res.passed
        last_error_log = suite_verify_res.output if not suite_verify_res.passed else repro_verify_res.output

        log_event(
            run_id,
            incident_id,
            stage="VERIFY",
            kind="test_result",
            payload={
                "phase": "full_suite",
                "passed": suite_passed,
                "exit_code": suite_verify_res.exit_code,
                "duration_sec": suite_verify_res.duration_sec,
                "summary": suite_verify_res.summary,
                "failure_snippet": suite_verify_res.failure_snippet,
            },
            db_path=db_path,
        )

    evidence["after"] = "PASSED" if suite_passed else f"FAILED: {last_error_log[-100:]}"

    save_artifact(
        f"art-patch-{run_id}",
        run_id,
        incident_id,
        kind="patch_diff",
        content=patch_diff,
        db_path=db_path,
    )
    save_artifact(
        f"art-log-after-{run_id}",
        run_id,
        incident_id,
        kind="test_log_after",
        content=suite_verify_res.output,
        db_path=db_path,
    )

    if suite_passed:
        update_run(run_id, state="STAGED", db_path=db_path)
        update_incident_status(incident_id, "AWAITING_APPROVAL", db_path=db_path)
    else:
        update_run(run_id, state="FAILED", ended=True, db_path=db_path)

    return PipelineResult(
        ok=suite_passed,
        run_id=run_id,
        incident_id=incident_id,
        worktree_path=worktree_path,
        patch_diff=patch_diff,
        repro_test=repro_test_code,
        test_evidence=evidence,
        attempts=fix_attempts,
        brief=brief,
        error=None if suite_passed else f"Tests failed after {fix_attempts} attempts: {last_error_log[-200:]}",
    )
