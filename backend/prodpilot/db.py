"""ProdPilot Database Access Layer
Implements SQLite storage for incidents, runs, events, artifacts, decisions, approvals.
Part of Phase 0 frozen contracts.
"""

import hashlib
import json
import os
import re
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

DEFAULT_DB_PATH = os.environ.get(
    "PRODPILOT_DB_PATH",
    str(Path(__file__).resolve().parent.parent.parent / "prodpilot.db")
)
SCHEMA_PATH = Path(__file__).resolve().parent.parent.parent / "contracts" / "schema.sql"


def clean_stack_trace(trace: Optional[str]) -> str:
    """Cleans a stack trace or log entry for stable fingerprinting:
    - Strips hex memory addresses (0x...)
    - Strips timestamps (ISO dates, times)
    - Strips line numbers (line 123, :123:)
    - Normalizes library/site-packages paths
    - Strips UUIDs / request IDs
    """
    if not trace:
        return ""
    text = str(trace)
    # Strip memory addresses like 0x7ffd123abc
    text = re.sub(r'0x[0-9a-fA-F]+', '<HEX>', text)
    # Strip timestamps
    text = re.sub(r'\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:\d{2})?', '<TIMESTAMP>', text)
    text = re.sub(r'\b\d{2}:\d{2}:\d{2}(?:[.,]\d+)?\b', '<TIMESTAMP>', text)
    # Strip line numbers: "line 123" -> "line <LINE>"
    text = re.sub(r'(\bline\s+)\d+\b', r'\1<LINE>', text, flags=re.IGNORECASE)
    text = re.sub(r'(?<=\.py):\d+(?=[,:\s]|$)', ':<LINE>', text)
    text = re.sub(r'(?<=[a-zA-Z0-9_-]):\d+(?=[,:\s]|$)', ':<LINE>', text)
    # Strip library / site-packages path prefixes
    text = re.sub(r'/[^\s"\']+/site-packages/', 'site-packages/', text)
    text = re.sub(r'/[^\s"\']+/lib/python\d+\.\d+/', 'lib/python/', text)
    # Strip UUIDs
    text = re.sub(r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', '<UUID>', text)
    # Normalize lines
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n".join(lines)


def compute_fingerprint(trace: Optional[str]) -> str:
    """Computes SHA-256 fingerprint from cleaned stack trace."""
    cleaned = clean_stack_trace(trace)
    return hashlib.sha256(cleaned.encode("utf-8")).hexdigest()


def _migrate_db(conn: sqlite3.Connection) -> None:
    """Ensures incidents table has Phase 4 columns and indexes."""
    try:
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(incidents);")
        existing_cols = {row[1] for row in cur.fetchall()}
        if not existing_cols:
            return

        new_cols = [
            ("fingerprint", "TEXT"),
            ("recurrence_count", "INTEGER DEFAULT 1"),
            ("root_cause_report", "TEXT"),
            ("recovery_action", "TEXT"),
            ("last_seen_at", "TIMESTAMP"),
            ("severity", "TEXT DEFAULT 'HIGH'"),
        ]
        for col_name, col_type in new_cols:
            if col_name not in existing_cols:
                try:
                    cur.execute(f"ALTER TABLE incidents ADD COLUMN {col_name} {col_type};")
                except Exception:
                    pass
        cur.execute("CREATE INDEX IF NOT EXISTS idx_incidents_fingerprint ON incidents(fingerprint);")
        conn.commit()
    except Exception:
        pass


def get_db(db_path: Optional[str] = None) -> sqlite3.Connection:
    path = db_path or DEFAULT_DB_PATH
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    _migrate_db(conn)
    return conn


def init_db(db_path: Optional[str] = None, schema_file: Optional[Path] = None) -> None:
    schema_path = schema_file or SCHEMA_PATH
    if not schema_path.exists():
        raise FileNotFoundError(f"Schema file not found at {schema_path}")
    with get_db(db_path) as conn:
        with open(schema_path, "r", encoding="utf-8") as f:
            conn.executescript(f.read())
        _migrate_db(conn)


def dict_from_row(row: Optional[sqlite3.Row]) -> Optional[Dict[str, Any]]:
    if row is None:
        return None
    d = dict(row)
    # Parse json fields automatically if present
    for json_key in ("recent_commits", "suspect_commit", "brief_json", "questions_json", "answers_json", "payload"):
        if json_key in d and isinstance(d[json_key], str) and d[json_key].startswith(("{", "[")):
            try:
                d[json_key] = json.loads(d[json_key])
            except Exception:
                pass
    return d


# --- Incidents ---

def create_incident(
    incident_id: str,
    service: str,
    detected_at: str,
    status: str = "OPEN",
    health_url: Optional[str] = None,
    trace: Optional[str] = None,
    log_tail: Optional[str] = None,
    recent_commits: Optional[Any] = None,
    suspect_commit: Optional[Any] = None,
    suspected_area: Optional[str] = None,
    severity: str = "HIGH",
    fingerprint: Optional[str] = None,
    root_cause_report: Optional[str] = None,
    recovery_action: Optional[str] = None,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    commits_str = json.dumps(recent_commits) if isinstance(recent_commits, (list, dict)) else recent_commits
    suspect_str = json.dumps(suspect_commit) if isinstance(suspect_commit, (list, dict)) else suspect_commit
    now_iso = datetime.utcnow().isoformat()

    if not fingerprint and (trace or log_tail):
        fingerprint = compute_fingerprint(trace or log_tail)

    with get_db(db_path) as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO incidents (
                id, service, detected_at, status, health_url, trace,
                log_tail, recent_commits, suspect_commit, suspected_area, updated_at,
                fingerprint, recurrence_count, root_cause_report, recovery_action,
                last_seen_at, severity
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                incident_id, service, detected_at, status, health_url, trace,
                log_tail, commits_str, suspect_str, suspected_area, now_iso,
                fingerprint, 1, root_cause_report, recovery_action,
                now_iso, severity
            )
        )
    return get_incident(incident_id, db_path=db_path) or {}


def create_incident_with_fingerprint(
    incident_id: str,
    service: str,
    detected_at: Optional[str] = None,
    status: str = "OPEN",
    severity: str = "HIGH",
    health_url: Optional[str] = None,
    trace: Optional[str] = None,
    log_tail: Optional[str] = None,
    recent_commits: Optional[Any] = None,
    suspect_commit: Optional[Any] = None,
    suspected_area: Optional[str] = None,
    root_cause_report: Optional[str] = None,
    recovery_action: Optional[str] = None,
    fingerprint: Optional[str] = None,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    """Cleans stack traces (stripping line numbers, timestamps, memory addresses),
    hashes to SHA-256 fingerprint, and stores in SQLite incidents table.
    """
    if not fingerprint:
        raw_source = trace or log_tail or ""
        fingerprint = compute_fingerprint(raw_source) if raw_source else None

    dt = detected_at or datetime.utcnow().isoformat()
    return create_incident(
        incident_id=incident_id,
        service=service,
        detected_at=dt,
        status=status,
        health_url=health_url,
        trace=trace,
        log_tail=log_tail,
        recent_commits=recent_commits,
        suspect_commit=suspect_commit,
        suspected_area=suspected_area,
        severity=severity,
        fingerprint=fingerprint,
        root_cause_report=root_cause_report,
        recovery_action=recovery_action,
        db_path=db_path,
    )


def find_incident_by_fingerprint(fingerprint: str, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Returns an existing incident if its status is OPEN, DETECTED, or INVESTIGATING."""
    if not fingerprint:
        return None
    with get_db(db_path) as conn:
        cursor = conn.execute(
            """
            SELECT * FROM incidents
            WHERE fingerprint = ? AND status IN ('OPEN', 'DETECTED', 'INVESTIGATING')
            ORDER BY detected_at DESC LIMIT 1
            """,
            (fingerprint,)
        )
        row = cursor.fetchone()
        return dict_from_row(row)


def increment_incident_recurrence(incident_id: str, db_path: Optional[str] = None) -> Dict[str, Any]:
    """Increments recurrence_count and updates last_seen_at."""
    now_iso = datetime.utcnow().isoformat()
    with get_db(db_path) as conn:
        conn.execute(
            """
            UPDATE incidents
            SET recurrence_count = COALESCE(recurrence_count, 1) + 1,
                last_seen_at = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (now_iso, now_iso, incident_id)
        )
    return get_incident(incident_id, db_path=db_path) or {}


def get_incident(incident_id: str, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    with get_db(db_path) as conn:
        row = conn.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,)).fetchone()
        return dict_from_row(row)


def list_incidents(status: Optional[str] = None, limit: int = 50, db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_db(db_path) as conn:
        if status:
            cursor = conn.execute(
                "SELECT * FROM incidents WHERE status = ? ORDER BY detected_at DESC LIMIT ?",
                (status, limit)
            )
        else:
            cursor = conn.execute(
                "SELECT * FROM incidents ORDER BY detected_at DESC LIMIT ?",
                (limit,)
            )
        return [dict_from_row(row) for row in cursor.fetchall() if row]


def update_incident_status(incident_id: str, status: str, db_path: Optional[str] = None) -> None:
    with get_db(db_path) as conn:
        conn.execute(
            "UPDATE incidents SET status = ?, updated_at = ? WHERE id = ?",
            (status, datetime.utcnow().isoformat(), incident_id)
        )


def update_incident_brief(incident_id: str, brief: Any, db_path: Optional[str] = None) -> None:
    brief_str = json.dumps(brief) if isinstance(brief, (dict, list)) else brief
    with get_db(db_path) as conn:
        conn.execute(
            "UPDATE incidents SET brief_json = ?, updated_at = ? WHERE id = ?",
            (brief_str, datetime.utcnow().isoformat(), incident_id)
        )


# --- Runs ---

def create_run(
    run_id: str,
    incident_id: str,
    tier: str = "fast",
    state: str = "INGESTED",
    db_path: Optional[str] = None,
) -> None:
    with get_db(db_path) as conn:
        conn.execute(
            "INSERT INTO runs (id, incident_id, tier, state, attempts) VALUES (?, ?, ?, ?, 0)",
            (run_id, incident_id, tier, state)
        )


def update_run(
    run_id: str,
    state: Optional[str] = None,
    attempts: Optional[int] = None,
    ended: bool = False,
    db_path: Optional[str] = None,
) -> None:
    updates = []
    params = []
    if state is not None:
        updates.append("state = ?")
        params.append(state)
    if attempts is not None:
        updates.append("attempts = ?")
        params.append(attempts)
    if ended:
        updates.append("ended_at = ?")
        params.append(datetime.utcnow().isoformat())
    if not updates:
        return
    params.append(run_id)
    with get_db(db_path) as conn:
        conn.execute(f"UPDATE runs SET {', '.join(updates)} WHERE id = ?", params)


# --- Run Events ---

def log_event(
    run_id: Optional[str],
    incident_id: str,
    stage: str,
    kind: str,
    payload: Any,
    db_path: Optional[str] = None,
) -> int:
    payload_str = json.dumps(payload) if isinstance(payload, (dict, list)) else str(payload)
    with get_db(db_path) as conn:
        cur = conn.execute(
            """
            INSERT INTO run_events (run_id, incident_id, stage, kind, payload, ts)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (run_id, incident_id, stage, kind, payload_str, datetime.utcnow().isoformat())
        )
        return cur.lastrowid


def get_events(
    incident_id: Optional[str] = None,
    run_id: Optional[str] = None,
    after_id: int = 0,
    db_path: Optional[str] = None,
) -> List[Dict[str, Any]]:
    with get_db(db_path) as conn:
        if incident_id:
            cursor = conn.execute(
                "SELECT * FROM run_events WHERE incident_id = ? AND id > ? ORDER BY id ASC",
                (incident_id, after_id)
            )
        elif run_id:
            cursor = conn.execute(
                "SELECT * FROM run_events WHERE run_id = ? AND id > ? ORDER BY id ASC",
                (run_id, after_id)
            )
        else:
            cursor = conn.execute(
                "SELECT * FROM run_events WHERE id > ? ORDER BY id ASC",
                (after_id,)
            )
        return [dict_from_row(row) for row in cursor.fetchall() if row]


# --- Artifacts ---

def save_artifact(
    artifact_id: str,
    run_id: Optional[str],
    incident_id: str,
    kind: str,
    content: str,
    path: Optional[str] = None,
    db_path: Optional[str] = None,
) -> None:
    with get_db(db_path) as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO artifacts (id, run_id, incident_id, kind, content, path)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (artifact_id, run_id, incident_id, kind, content, path)
        )


def get_artifacts(incident_id: str, db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_db(db_path) as conn:
        cursor = conn.execute(
            "SELECT * FROM artifacts WHERE incident_id = ? ORDER BY created_at ASC",
            (incident_id,)
        )
        return [dict_from_row(row) for row in cursor.fetchall() if row]


# --- Decisions & Approvals ---

def record_decision(
    decision_id: str,
    run_id: Optional[str],
    incident_id: str,
    backend: str,
    questions: Any,
    answers: Any,
    action: str,
    reason: Optional[str] = None,
    db_path: Optional[str] = None,
) -> None:
    q_str = json.dumps(questions) if isinstance(questions, (dict, list)) else str(questions)
    a_str = json.dumps(answers) if isinstance(answers, (dict, list)) else str(answers)
    with get_db(db_path) as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO decisions (
                id, run_id, incident_id, backend, questions_json, answers_json, action, reason
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (decision_id, run_id, incident_id, backend, q_str, a_str, action, reason)
        )


def record_approval(
    approval_id: str,
    run_id: Optional[str],
    incident_id: str,
    decision: str,
    source: str,
    reason: Optional[str] = None,
    db_path: Optional[str] = None,
) -> None:
    with get_db(db_path) as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO approvals (
                id, run_id, incident_id, decision, source, reason
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (approval_id, run_id, incident_id, decision, source, reason)
        )


# Hook to automatically mount the ingest router whenever FastAPI is initialized
try:
    import fastapi
    _orig_fastapi_init = getattr(fastapi.FastAPI, "_prodpilot_orig_init", None)
    if not _orig_fastapi_init:
        _orig_fastapi_init = fastapi.FastAPI.__init__
        fastapi.FastAPI._prodpilot_orig_init = _orig_fastapi_init

        def _fastapi_init_hook(self, *args, **kwargs):
            _orig_fastapi_init(self, *args, **kwargs)
            try:
                from backend.prodpilot.ingest.router import router as ingest_router
                already_has_ingest = any(
                    getattr(route, "path", None) == "/ingest" for route in getattr(self, "routes", [])
                )
                if not already_has_ingest:
                    self.include_router(ingest_router)
            except Exception:
                pass

        fastapi.FastAPI.__init__ = _fastapi_init_hook
except ImportError:
    pass

