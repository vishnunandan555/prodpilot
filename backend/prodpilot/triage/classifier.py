"""Lightweight Triage & Severity Classifier
Scans log batches for HTTP 5xx responses, unhandled exceptions/tracebacks,
fatal exit crashes, and infrastructure failures.
Part of Stream A: Triage Tier.
"""

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from backend.prodpilot.db import compute_fingerprint


class Severity(str, Enum):
    HIGH = "HIGH"
    LOW = "LOW"
    INFRA = "INFRA"
    INFO = "INFO"


@dataclass
class TriageResult:
    severity: str  # HIGH, LOW, INFRA, INFO
    reason: str
    trace: Optional[str] = None
    log_tail: str = ""
    suspected_area: Optional[str] = None
    fingerprint: Optional[str] = None
    is_crash: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)


# Regex Patterns
RE_CRASH_OVERRIDE = re.compile(
    r"\b(fatal|critical|core dumped|segmentation fault|process exited with code [1-9]\d*|"
    r"systemexit|sigkill|sigterm|killed by signal|fatal error|uncaught exception)\b",
    re.IGNORECASE,
)

RE_INFRA = re.compile(
    r"\b(database connection (?:timeout|refused|failed|reset)|connection refused|"
    r"could not connect to (?:postgres|mysql|redis|database)|out of memory|oomkilled|"
    r"java\.lang\.outofmemoryerror|missing environment variable|environment variable not set|"
    r"dns resolution failed|enotfound|etimedout|operationalerror: could not connect)\b",
    re.IGNORECASE,
)

RE_5XX = re.compile(
    r"\b(HTTP[/\d.]*\s+5\d{2}|5\d{2}\s+(?:Internal Server Error|Bad Gateway|Service Unavailable|Gateway Timeout)|"
    r"status(?:_code)?[:= ]+5\d{2}|\"\s+5\d{2}\s+|500 Internal Server Error)\b",
    re.IGNORECASE,
)

# Real exception class name in Python (e.g., TypeError, ZeroDivisionError, package.module.CustomError)
EXC_CLASS_REGEX = (
    r"(?:[a-zA-Z_][a-zA-Z0-9_]*\.)*"
    r"([A-Z][a-zA-Z0-9_]*(?:Error|Exception|Exit|Interrupt|Warning|Fault)"
    r"|StopIteration|KeyboardInterrupt|SystemExit|GeneratorExit)"
)

RE_TRACEBACK = re.compile(
    r"(Traceback \(most recent call last\):[\s\S]*?^\s*" + EXC_CLASS_REGEX + r"(?::\s*[^\n]*)?)",
    re.MULTILINE,
)

RE_STANDALONE_EXCEPTION = re.compile(
    r"\b((?:KeyError|ValueError|TypeError|AttributeError|ZeroDivisionError|IndexError|"
    r"NameError|RuntimeError|AssertionError|ImportError|FileNotFoundError|UnboundLocalError|"
    r"NotImplementedError|Exception):\s*[^\n]+)",
    re.IGNORECASE,
)

RE_HEALTH_FAIL = re.compile(
    r"(/health\b.*?(?:failed|down|unhealthy|5\d{2}|error)|health check failed|"
    r"health endpoint returned (?:5\d{2}|error))",
    re.IGNORECASE,
)

RE_LOW_SEVERITY = re.compile(
    r"\b(warning|warn|userwarning|deprecationwarning|syntaxwarning|futurewarning|"
    r"failed to refresh cache|retry(?:ing)? (?:attempt|in \d+s)?|transient error|"
    r"HTTP[/\d.]*\s+4\d{2}|404\s+Not Found|400\s+Bad Request|422\s+Unprocessable|"
    r"status(?:_code)?[:= ]+4\d{2}|\"\s+4\d{2}\s+|background task warning)\b",
    re.IGNORECASE,
)

RE_CLIENT_DISCONNECT = re.compile(
    r"\b(ClientAbruptDisconnectError|WebSocketDisconnect|ClientDisconnect|"
    r"ConnectionResetError.*(?:code=100[0-6]|mid-transfer|disconnected)|"
    r"code=1005|code=1000|code=1001|code=1006|"
    r"abruptly disconnected|unexpectedly disconnected / refreshed|"
    r"connection reset by peer|connection aborted|"
    r"asyncio\.exceptions\.CancelledError|starlette\.websockets\.WebSocketDisconnect)\b",
    re.IGNORECASE,
)

RE_SUSPECT_AREA = re.compile(r'File "([^"]+)", line \d+, in (\w+)')

IGNORED_FRAME_SUBSTRINGS = (
    "logging/__init__.py",
    "logging_config.py",
    "site-packages/uvicorn",
    "site-packages/starlette",
    "site-packages/fastapi",
    "/lib/python",
    "/lib64/python",
)


def extract_suspected_area(trace: Optional[str], fallback_text: Optional[str] = None) -> Optional[str]:
    if not trace and not fallback_text:
        return None
    matches = RE_SUSPECT_AREA.findall(trace or "")
    if matches:
        # Prioritize innermost application frame (not logging or framework internals)
        for last_file, last_func in reversed(matches):
            if not any(ign in last_file for ign in IGNORED_FRAME_SUBSTRINGS):
                filename = last_file.split("/")[-1]
                return f"{filename}:{last_func}"

    # If all frames in trace were ignored or trace had no frames, check fallback_text
    if fallback_text:
        fb_matches = RE_SUSPECT_AREA.findall(fallback_text)
        for last_file, last_func in reversed(fb_matches):
            if not any(ign in last_file for ign in IGNORED_FRAME_SUBSTRINGS):
                filename = last_file.split("/")[-1]
                return f"{filename}:{last_func}"

    if matches:
        last_file, last_func = matches[-1]
        filename = last_file.split("/")[-1]
        return f"{filename}:{last_func}"
    return None


def classify_logs(
    service: str,
    logs: List[Union[Dict[str, Any], str, Any]],
) -> TriageResult:
    """Fast Rule Filter: scans log batches for HTTP 5xx responses, unhandled exceptions/tracebacks,
    failed /health endpoints, fatal crashes, infra failures, and warnings.
    """
    if not logs:
        return TriageResult(
            severity=Severity.INFO.value,
            reason="Empty log batch",
            log_tail="",
        )

    # Convert all logs to string entries and aggregated tail
    log_lines: List[str] = []
    has_explicit_warning_level = False
    has_explicit_error_level = False

    for item in logs:
        if isinstance(item, dict):
            lvl = str(item.get("level", "")).upper()
            msg = str(item.get("message", ""))
            ts = item.get("timestamp", "")
            if lvl in ("WARNING", "WARN"):
                has_explicit_warning_level = True
            elif lvl in ("ERROR", "CRITICAL", "FATAL"):
                has_explicit_error_level = True
            log_lines.append(f"{f'[{ts}] ' if ts else ''}[{lvl or 'INFO'}] {msg}")
        elif isinstance(item, str):
            log_lines.append(item)
            if "WARNING" in item.upper() or "WARN" in item.upper():
                has_explicit_warning_level = True
            if "ERROR" in item.upper() or "CRITICAL" in item.upper():
                has_explicit_error_level = True
        else:
            log_lines.append(str(item))

    combined_text = "\n".join(log_lines)
    full_tail = "\n".join(log_lines[-20:])

    # Extract traceback if present
    matches = [m.group(1).strip() for m in RE_TRACEBACK.finditer(combined_text)]
    extracted_trace = None
    if matches:
        # If multiple tracebacks exist (e.g. app exception vs secondary logging handler crash),
        # prioritize the one touching user application code
        app_matches = [
            m for m in matches 
            if not any(ign in m for ign in ("logging_config.py", "logging/__init__.py"))
        ]
        extracted_trace = app_matches[0] if app_matches else matches[-1]

    if not extracted_trace:
        # Check for standalone exception like KeyError: 'discount'
        exc_match = RE_STANDALONE_EXCEPTION.search(combined_text)
        if exc_match:
            extracted_trace = exc_match.group(1).strip()

    suspected_area = extract_suspected_area(extracted_trace, fallback_text=combined_text) or service

    # 0. CLIENT DISCONNECTION FILTER: normal client refreshes or disconnects are LOW severity
    client_disconnect_match = RE_CLIENT_DISCONNECT.search(combined_text)
    real_app_crash = bool(re.search(r"\b(ZeroDivisionError|KeyError|ValueError|TypeError|AttributeError|IndexError|NameError|ImportError|SyntaxError)\b", combined_text))
    if client_disconnect_match and not real_app_crash:
        fp = compute_fingerprint(extracted_trace or combined_text)
        return TriageResult(
            severity=Severity.LOW.value,
            reason="Client network disconnect or browser refresh (non-critical)",
            trace=extracted_trace or full_tail,
            log_tail=full_tail,
            suspected_area=suspected_area,
            fingerprint=fp,
            is_crash=False,
            metadata={"rule": "client_disconnect_filter", "matched": client_disconnect_match.group(0)},
        )

    # 1. CRASH OVERRIDE: any fatal exit is forced to HIGH
    if RE_CRASH_OVERRIDE.search(combined_text):
        fp = compute_fingerprint(extracted_trace or combined_text)

        # Extract specific error name and line if available
        specific_reason = None
        source_text = (extracted_trace or "") + "\n" + combined_text
        if "FATAL APPLICATION CRASH:" in source_text:
            fc_m = re.search(r"FATAL APPLICATION CRASH:\s*([^\n']+)", source_text)
            if fc_m:
                specific_reason = re.sub(r"\s+for transfer.*", "", fc_m.group(1).strip())

        if not specific_reason:
            exc_match = re.search(
                r"\b(ZeroDivisionError|KeyError|ValueError|TypeError|AttributeError|IndexError|NameError|RuntimeError)(?::\s*[^\n]+|\s+[^\n]+|\([^\n]+\))",
                source_text,
            )
            if exc_match:
                specific_reason = exc_match.group(0).strip()
                specific_reason = re.sub(r"\s+for transfer\s+%.*", "", specific_reason)

        if not specific_reason and suspected_area and suspected_area != service:
            specific_reason = f"Fatal unhandled exception in {suspected_area}"

        final_reason = specific_reason or "Fatal application crash detected"
        if suspected_area and suspected_area != service and specific_reason and suspected_area not in specific_reason:
            final_reason = f"{specific_reason} ({suspected_area})"

        return TriageResult(
            severity=Severity.HIGH.value,
            reason=final_reason,
            trace=extracted_trace or full_tail,
            log_tail=full_tail,
            suspected_area=suspected_area,
            fingerprint=fp,
            is_crash=True,
            metadata={"rule": "crash_override"},
        )

    # 2. INFRASTRUCTURE: Database timeout, OOM, missing env vars
    infra_match = RE_INFRA.search(combined_text)
    if infra_match and not extracted_trace:
        # Pure infrastructure without application traceback
        return TriageResult(
            severity=Severity.INFRA.value,
            reason=f"Infrastructure failure: {infra_match.group(0)}",
            trace=None,
            log_tail=full_tail,
            suspected_area=suspected_area,
            fingerprint=None,
            is_crash=False,
            metadata={"infra_keyword": infra_match.group(0)},
        )

    # 3. HIGH SEVERITY: HTTP 5xx, unhandled exceptions/traceback, health failure
    has_5xx = bool(RE_5XX.search(combined_text))
    has_health_fail = bool(RE_HEALTH_FAIL.search(combined_text))

    if extracted_trace or has_5xx or has_health_fail or (has_explicit_error_level and "error" in combined_text.lower()):
        reasons = []
        if extracted_trace:
            reasons.append("Unhandled exception/traceback")
        if has_5xx:
            reasons.append("HTTP 5xx response")
        if has_health_fail:
            reasons.append("Health endpoint failure")
        if not reasons:
            reasons.append("Application error log")

        fp = compute_fingerprint(extracted_trace or combined_text)
        return TriageResult(
            severity=Severity.HIGH.value,
            reason="; ".join(reasons),
            trace=extracted_trace or full_tail,
            log_tail=full_tail,
            suspected_area=suspected_area,
            fingerprint=fp,
            is_crash=bool(extracted_trace),
            metadata={"has_5xx": has_5xx, "has_health_fail": has_health_fail},
        )

    # 4. LOW SEVERITY: Recoverable warnings, single 404/4xx spikes, non-critical background task errors
    low_match = RE_LOW_SEVERITY.search(combined_text)
    if low_match or has_explicit_warning_level:
        reason = f"Recoverable warning or non-critical issue: {low_match.group(0) if low_match else 'Warning level'}"
        fp = compute_fingerprint(combined_text)
        return TriageResult(
            severity=Severity.LOW.value,
            reason=reason,
            trace=None,
            log_tail=full_tail,
            suspected_area=suspected_area or "warning_logs",
            fingerprint=fp,
            is_crash=False,
            metadata={"matched": low_match.group(0) if low_match else "warning_level"},
        )

    # 5. Normal / INFO
    return TriageResult(
        severity=Severity.INFO.value,
        reason="Normal operation logs",
        trace=None,
        log_tail=full_tail,
        suspected_area=None,
        fingerprint=None,
        is_crash=False,
    )
