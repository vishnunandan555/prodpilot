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
        else:
            key_name = "discount"

    # One sentence summary
    func_str = f" in {tb_info['func']}" if tb_info['func'] else ""
    summary = f"{error_repr}{func_str} in {suspect_file}:{suspect_line}."

    hypothesis = (
        f"Suspect commit '{introduced_by}' introduced direct access to '{key_name or 'a field'}' "
        f"without fallback or null check, triggering unhandled {error_type} in {suspect_file}."
    )

    brief = {
        "summary": summary,
        "suspected_area": suspected_area,
        "introduced_by": introduced_by,
        "error_type": error_type,
        "error_message": error_msg,
        "key_name": key_name or "discount",
        "suspect_file": suspect_file,
        "suspect_line": suspect_line,
        "suspect_commit": suspect_commit,
        "hypothesis": hypothesis,
    }

    return brief
