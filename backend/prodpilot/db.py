"""ProdPilot Database Access Layer
Implements SQLite storage for incidents, runs, events, artifacts, decisions, approvals.
Part of Phase 0 frozen contracts.
"""

import json
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

DEFAULT_DB_PATH = os.environ.get(
    "PRODPILOT_DB_PATH",
    str(Path(__file__).resolve().parent.parent.parent / "prodpilot.db")
)
SCHEMA_PATH = Path(__file__).resolve().parent.parent.parent / "contracts" / "schema.sql"


def get_db(db_path: Optional[str] = None) -> sqlite3.Connection:
    path = db_path or DEFAULT_DB_PATH
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db(db_path: Optional[str] = None, schema_file: Optional[Path] = None) -> None:
    schema_path = schema_file or SCHEMA_PATH
    if not schema_path.exists():
        raise FileNotFoundError(f"Schema file not found at {schema_path}")
    with get_db(db_path) as conn:
        with open(schema_path, "r", encoding="utf-8") as f:
            conn.executescript(f.read())


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
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    commits_str = json.dumps(recent_commits) if isinstance(recent_commits, (list, dict)) else recent_commits
    suspect_str = json.dumps(suspect_commit) if isinstance(suspect_commit, (list, dict)) else suspect_commit

    with get_db(db_path) as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO incidents (
                id, service, detected_at, status, health_url, trace,
                log_tail, recent_commits, suspect_commit, suspected_area, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                incident_id, service, detected_at, status, health_url, trace,
                log_tail, commits_str, suspect_str, suspected_area, datetime.utcnow().isoformat()
            )
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
