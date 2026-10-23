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

RE_TRACEBACK = re.compile(
    r"(Traceback \(most recent call last\):[\s\S]*?(?:^[a-zA-Z_]\w*(?:Error|Exception|Exit|Interrupt|Fault|Warning)?:[^\n]*))",
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

RE_SUSPECT_AREA = re.compile(r'File "([^"]+)", line \d+, in (\w+)')


def extract_suspected_area(trace: Optional[str]) -> Optional[str]:
    if not trace:
        return None
    matches = RE_SUSPECT_AREA.findall(trace)
    if matches:
        # Pick the last file & function in the traceback (closest to crash)
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
    trace_match = RE_TRACEBACK.search(combined_text)
    extracted_trace = trace_match.group(1).strip() if trace_match else None

    if not extracted_trace:
        # Check for standalone exception like KeyError: 'discount'
        exc_match = RE_STANDALONE_EXCEPTION.search(combined_text)
        if exc_match:
            extracted_trace = exc_match.group(1).strip()

    suspected_area = extract_suspected_area(extracted_trace) or service

    # 1. CRASH OVERRIDE: any fatal exit is forced to HIGH
    if RE_CRASH_OVERRIDE.search(combined_text):
        fp = compute_fingerprint(extracted_trace or combined_text)
        return TriageResult(
            severity=Severity.HIGH.value,
            reason="Fatal exit / crash override detected",
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
