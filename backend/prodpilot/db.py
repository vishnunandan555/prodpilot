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


def hash_password(password: str, salt: Optional[str] = None) -> str:
    if not salt:
        salt = os.urandom(16).hex()
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return f"{salt}${dk.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        if not password_hash or "$" not in password_hash:
            return False
        salt, h = password_hash.split("$", 1)
        check = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000).hex()
        return h == check
    except Exception:
        return False


def _migrate_db(conn: sqlite3.Connection) -> None:
    """Ensures database has incidents, users, repos, and servers tables."""
    try:
        cur = conn.cursor()

        # 1. Ensure incidents table has Phase 4 columns
        cur.execute("PRAGMA table_info(incidents);")
        existing_cols = {row[1] for row in cur.fetchall()}
        if existing_cols:
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

        # 2. Users table
        cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE,
            password_hash TEXT NOT NULL,
            full_name TEXT,
            role TEXT DEFAULT 'sre',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # Seed default admin user if users table is empty
        cur.execute("SELECT COUNT(*) FROM users;")
        if cur.fetchone()[0] == 0:
            admin_hash = hash_password("admin")
            cur.execute(
                "INSERT INTO users (id, username, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?, ?)",
                ("usr-admin", "admin", "admin@prodpilot.io", admin_hash, "SRE Administrator", "admin")
            )

        # 3. Repositories table
        cur.execute("""
        CREATE TABLE IF NOT EXISTS repos (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            local_path TEXT NOT NULL,
            test_cmd TEXT DEFAULT 'pytest',
            health_url TEXT DEFAULT 'http://127.0.0.1:8000/health',
            start_cmd TEXT DEFAULT '',
            port INTEGER DEFAULT 8000,
            is_active INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
        cur.execute("PRAGMA table_info(repos);")
        repo_cols = {row[1] for row in cur.fetchall()}
        if "is_active" not in repo_cols:
            try:
                cur.execute("ALTER TABLE repos ADD COLUMN is_active INTEGER DEFAULT 0;")
            except Exception:
                pass

        # 4. Servers table
        cur.execute("""
        CREATE TABLE IF NOT EXISTS servers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            repo_id TEXT,
            host TEXT DEFAULT '127.0.0.1',
            port INTEGER DEFAULT 8000,
            health_url TEXT NOT NULL,
            status TEXT DEFAULT 'UNKNOWN',
            latency_ms REAL DEFAULT 0.0,
            last_checked_at TIMESTAMP,
            is_active INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
        cur.execute("PRAGMA table_info(servers);")
        server_cols = {row[1] for row in cur.fetchall()}
        if "is_active" not in server_cols:
            try:
                cur.execute("ALTER TABLE servers ADD COLUMN is_active INTEGER DEFAULT 0;")
            except Exception:
                pass

        conn.commit()
    except Exception as e:
        logger.debug(f"Migration error: {e}")


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


# --- Users & Auth ---

def create_user(
    username: str,
    password: str,
    email: Optional[str] = None,
    full_name: Optional[str] = None,
    role: str = "sre",
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    user_id = f"usr-{os.urandom(4).hex()}"
    p_hash = hash_password(password)
    with get_db(db_path) as conn:
        conn.execute(
            """
            INSERT INTO users (id, username, email, password_hash, full_name, role)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user_id, username.strip(), email.strip() if email else None, p_hash, full_name, role)
        )
    return {
        "id": user_id,
        "username": username,
        "email": email,
        "full_name": full_name,
        "role": role,
    }


def authenticate_user(
    username_or_email: str,
    password: str,
    db_path: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    clean = username_or_email.strip()
    with get_db(db_path) as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, username, email, password_hash, full_name, role, created_at FROM users WHERE username = ? OR email = ?",
            (clean, clean)
        )
        row = cur.fetchone()
        if not row:
            return None
        d = dict(row)
        if verify_password(password, d["password_hash"]):
            return {
                "id": d["id"],
                "username": d["username"],
                "email": d["email"],
                "full_name": d["full_name"],
                "role": d["role"],
                "created_at": d["created_at"],
            }
        return None


def get_user_by_id(user_id: str, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    with get_db(db_path) as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, username, email, full_name, role, created_at FROM users WHERE id = ?", (user_id,))
        row = cur.fetchone()
        return dict(row) if row else None


# --- Repositories ---

def list_repos(db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_db(db_path) as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM repos ORDER BY is_active DESC, created_at DESC")
        return [dict(r) for r in cur.fetchall()]


def connect_repo(
    name: str,
    local_path: str,
    test_cmd: str = "pytest",
    health_url: str = "http://127.0.0.1:8000/health",
    start_cmd: str = "",
    port: int = 8000,
    set_active: bool = True,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    repo_id = f"repo-{os.urandom(3).hex()}"
    with get_db(db_path) as conn:
        if set_active:
            conn.execute("UPDATE repos SET is_active = 0")
        conn.execute(
            """
            INSERT OR REPLACE INTO repos (
                id, name, local_path, test_cmd, health_url, start_cmd, port, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (repo_id, name, local_path, test_cmd, health_url, start_cmd, port, 1 if set_active else 0)
        )
    return {
        "id": repo_id,
        "name": name,
        "local_path": local_path,
        "test_cmd": test_cmd,
        "health_url": health_url,
        "start_cmd": start_cmd,
        "port": port,
        "is_active": 1 if set_active else 0,
    }


def set_active_repo(repo_id: str, db_path: Optional[str] = None) -> None:
    with get_db(db_path) as conn:
        conn.execute("UPDATE repos SET is_active = 0")
        conn.execute("UPDATE repos SET is_active = 1 WHERE id = ?", (repo_id,))


def delete_repo(repo_id: str, db_path: Optional[str] = None) -> None:
    with get_db(db_path) as conn:
        conn.execute("DELETE FROM repos WHERE id = ?", (repo_id,))


def get_active_repo(db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    with get_db(db_path) as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM repos WHERE is_active = 1 LIMIT 1")
        row = cur.fetchone()
        if not row:
            cur.execute("SELECT * FROM repos ORDER BY created_at DESC LIMIT 1")
            row = cur.fetchone()
        return dict(row) if row else None


# --- Connected Servers / Services ---

def list_servers(db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_db(db_path) as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM servers ORDER BY is_active DESC, created_at DESC")
        return [dict(r) for r in cur.fetchall()]


def connect_server(
    name: str,
    health_url: str,
    port: int = 8000,
    host: str = "127.0.0.1",
    repo_id: Optional[str] = None,
    status: str = "UNKNOWN",
    latency_ms: float = 0.0,
    set_active: bool = True,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    server_id = f"srv-{os.urandom(3).hex()}"
    now_iso = datetime.utcnow().isoformat()
    with get_db(db_path) as conn:
        if set_active:
            conn.execute("UPDATE servers SET is_active = 0")
        conn.execute(
            """
            INSERT OR REPLACE INTO servers (
                id, name, repo_id, host, port, health_url, status, latency_ms, last_checked_at, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (server_id, name, repo_id, host, port, health_url, status, latency_ms, now_iso, 1 if set_active else 0)
        )
    return {
        "id": server_id,
        "name": name,
        "repo_id": repo_id,
        "host": host,
        "port": port,
        "health_url": health_url,
        "status": status,
        "latency_ms": latency_ms,
        "last_checked_at": now_iso,
        "is_active": 1 if set_active else 0,
    }


def update_server_status(
    server_id: str,
    status: str,
    latency_ms: Optional[float] = None,
    db_path: Optional[str] = None,
) -> None:
    now_iso = datetime.utcnow().isoformat()
    with get_db(db_path) as conn:
        if latency_ms is not None:
            conn.execute(
                "UPDATE servers SET status = ?, latency_ms = ?, last_checked_at = ? WHERE id = ?",
                (status, latency_ms, now_iso, server_id)
            )
        else:
            conn.execute(
                "UPDATE servers SET status = ?, last_checked_at = ? WHERE id = ?",
                (status, now_iso, server_id)
            )


def set_active_server(server_id: str, db_path: Optional[str] = None) -> None:
    with get_db(db_path) as conn:
        conn.execute("UPDATE servers SET is_active = 0")
        conn.execute("UPDATE servers SET is_active = 1 WHERE id = ?", (server_id,))


def delete_server(server_id: str, db_path: Optional[str] = None) -> None:
    with get_db(db_path) as conn:
        conn.execute("DELETE FROM servers WHERE id = ?", (server_id,))


def get_active_server(db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    with get_db(db_path) as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM servers WHERE is_active = 1 LIMIT 1")
        row = cur.fetchone()
        if not row:
            cur.execute("SELECT * FROM servers ORDER BY created_at DESC LIMIT 1")
            row = cur.fetchone()
        return dict(row) if row else None


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

