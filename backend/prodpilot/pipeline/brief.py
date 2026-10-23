"""ProdPilot Context Brief Extractor
Extracts structured brief from incident data, analyzing tracebacks, logs, and git commits.
Part of Task 3 (Stream A).
"""

import json
import logging
import re
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def extract_traceback_info(trace: Optional[str]) -> Dict[str, Any]:
    """Parses Python traceback string to extract error type, message, and target frame."""
    if not trace:
        return {"error_type": "Unknown", "error_message": "", "file": None, "line": None, "func": None}

    lines = trace.strip().splitlines()
    error_line = lines[-1] if lines else ""

    error_type = "Unknown"
    error_message = ""
    if ":" in error_line:
        parts = error_line.split(":", 1)
        error_type = parts[0].strip()
        error_message = parts[1].strip()
    else:
        error_type = error_line.strip()

    # Find the deepest frame: File "app.py", line 45, in calculate_order
    frame_pattern = re.compile(r'File\s+"([^"]+)",\s+line\s+(\d+)(?:,\s+in\s+(\w+))?')
    target_file = None
    target_line = None
    target_func = None

    for line in reversed(lines):
        match = frame_pattern.search(line)
        if match:
            target_file = match.group(1)
            target_line = int(match.group(2))
            target_func = match.group(3)
            break

    return {
        "error_type": error_type,
        "error_message": error_message,
        "file": target_file,
        "line": target_line,
        "func": target_func,
    }


def create_brief(incident: Dict[str, Any]) -> Dict[str, Any]:
    """Generates structured incident brief matching contracts/api.md.
    
    Args:
        incident: Incident dictionary containing trace, suspect_commit, log_tail, etc.
        
    Returns:
        Structured brief dictionary.
    """
    trace = incident.get("trace") or ""
    log_tail = incident.get("log_tail") or ""
    suspect_commit = incident.get("suspect_commit") or {}
    if isinstance(suspect_commit, str):
        try:
            suspect_commit = json.loads(suspect_commit)
        except Exception:
            suspect_commit = {}

    recent_commits = incident.get("recent_commits") or []
    if isinstance(recent_commits, str):
        try:
            recent_commits = json.loads(recent_commits)
        except Exception:
            recent_commits = []

    tb_info = extract_traceback_info(trace)

    # Determine suspect area
    suspect_file = suspect_commit.get("suspect_file") or tb_info["file"] or "unknown"
    suspect_line = suspect_commit.get("suspect_line") or tb_info["line"] or 0
    suspected_area = f"{suspect_file}:{suspect_line}" if suspect_line else suspect_file

    introduced_by = suspect_commit.get("hash") or (recent_commits[0].get("hash") if recent_commits else "unknown")

    error_type = tb_info["error_type"]
    error_msg = tb_info["error_message"]
    error_repr = f"{error_type}: {error_msg}" if error_msg else error_type

    # Extract key name if KeyError
    key_name = None
    if error_type == "KeyError":
        key_match = re.search(r"['\"](\w+)['\"]", error_msg)
        if key_match:
            key_name = key_match.group(1)

    # One sentence summary
    func_str = f" in {tb_info['func']}" if tb_info['func'] else ""
    summary = f"{error_repr}{func_str} in {suspect_file}:{suspect_line}."

    hypothesis = (
        f"Suspect commit '{introduced_by}' introduced direct access to '{key_name or 'a required field'}' "
        f"without fallback or null check, triggering unhandled {error_type} in {suspect_file}."
    )

    brief = {
        "summary": summary,
        "suspected_area": suspected_area,
        "introduced_by": introduced_by,
        "error_type": error_type,
        "error_message": error_msg,
        "key_name": key_name,
        "suspect_file": suspect_file,
        "suspect_line": suspect_line,
        "suspect_commit": suspect_commit,
        "hypothesis": hypothesis,
    }

    return brief


def analyze_issue_readiness(issue_data: Dict[str, Any]) -> Dict[str, Any]:
    """Evaluates whether an incoming GitHub issue has sufficient context for autonomous reproduction.

    Checks:
    1. Reproduction steps (commands, curl requests, endpoints, payloads, or clear steps).
    2. Error logs (traceback, exception type, HTTP 500, crash details, or service log snippet).
    3. Expected behavior (expected return values, status codes, or safe outcome).

    Returns:
        dict: {
            "ready": bool,
            "clarifying_questions": List[str],
            "task_summary": str,
            "suspected_area": str,
            "draft_comment": str
        }
    """
    title = str(issue_data.get("title") or "").strip()
    body = str(
        issue_data.get("body")
        or issue_data.get("description")
        or issue_data.get("content")
        or issue_data.get("text")
        or ""
    ).strip()
    author = issue_data.get("author") or "contributor"
    full_text = f"{title}\n{body}".strip()
    lower_text = full_text.lower()

    # 1. Check reproduction steps
    repro_indicators = [
        "steps to reproduce", "reproduction steps", "to reproduce",
        "how to reproduce", "repro:", "step 1", "curl ", "post /", "get /",
        "put /", "delete /", "payload", "when calling", "when sending",
        "steps:", "reproduce", "trigger"
    ]
    has_repro = any(k in lower_text for k in repro_indicators)

    # 2. Check error logs / trace
    error_indicators = [
        "traceback", "stack trace", "stacktrace", "error log", "error message",
        "error:", "exception:", "keyerror", "valueerror", "typeerror",
        "attributeerror", "runtimeerror", "500 internal server error",
        "status 500", "status code 500", "http 500", "crashed with",
        "crash:", "service.log", "failed with exception", "logs:"
    ]
    has_error = any(k in lower_text for k in error_indicators)

    # 3. Check expected behavior
    expected_indicators = [
        "expected behavior", "expected outcome", "expected:", "expected response",
        "should return", "should be", "should not", "instead of",
        "what should happen", "should safely", "expected that", "expected to"
    ]
    has_expected = any(k in lower_text for k in expected_indicators)

    clarifying_questions: List[str] = []
    if not has_repro:
        clarifying_questions.append(
            "Could you provide step-by-step reproduction instructions or a minimal payload (e.g. sample JSON or curl command) to trigger the issue?"
        )
    if not has_error:
        clarifying_questions.append(
            "Could you provide the exact error message, stack trace, or server log snippet when the failure occurs?"
        )
    if not has_expected:
        clarifying_questions.append(
            "Could you clarify the expected behavior or response status/payload when the request is valid?"
        )

    ready = bool(has_repro and has_error and has_expected)

    # Suspected area extraction
    suspected_area = "app.py"
    tb_info = extract_traceback_info(full_text)
    if tb_info.get("file"):
        if tb_info.get("line"):
            suspected_area = f"{tb_info['file']}:{tb_info['line']}"
        else:
            suspected_area = tb_info["file"]
    else:
        file_match = re.search(r'([a-zA-Z0-9_\-\./]+\.py)(?::(\d+))?', full_text)
        if file_match:
            f = file_match.group(1)
            line = file_match.group(2)
            suspected_area = f"{f}:{line}" if line else f
        elif "order" in lower_text:
            suspected_area = "app.py:calculate_order"

    task_summary = title if title else (body[:120] + "..." if len(body) > 120 else body)

    draft_comment = ""
    if not ready:
        questions_markdown = "\n".join(f"- {q}" for q in clarifying_questions)
        draft_comment = (
            f"Hi @{author}! 👋\n\n"
            f"Thank you for reporting this issue. To help ProdPilot autonomously reproduce, "
            f"verify, and fix this issue, could you please clarify the following details?\n\n"
            f"{questions_markdown}\n\n"
            f"Once these details are provided, our autonomous pipeline will create a minimal "
            f"reproduction test and verify the fix."
        )

    return {
        "ready": ready,
        "clarifying_questions": clarifying_questions,
        "task_summary": task_summary,
        "suspected_area": suspected_area,
        "draft_comment": draft_comment,
    }

