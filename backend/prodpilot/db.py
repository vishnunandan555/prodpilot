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
            phone TEXT,
            avatar_url TEXT,
            telegram_chat_id TEXT,
            bio TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        cur.execute("PRAGMA table_info(users);")
        user_cols = {row[1] for row in cur.fetchall()}
        for col, ctype in [
            ("phone", "TEXT"),
            ("avatar_url", "TEXT"),
            ("telegram_chat_id", "TEXT"),
            ("bio", "TEXT"),
        ]:
            if col not in user_cols:
                try:
                    cur.execute(f"ALTER TABLE users ADD COLUMN {col} {ctype};")
                except Exception:
                    pass

        # 3. Projects table (Manual setup, GitHub integration)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            github_repo TEXT NOT NULL,
            github_token TEXT,
            local_path TEXT NOT NULL,
            default_branch TEXT DEFAULT 'main',
            test_cmd TEXT DEFAULT 'pytest',
            is_active INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 4. Repositories table (kept for backwards compatibility)
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

        # 5. Production Servers table (Render Infrastructure)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS servers (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            name TEXT NOT NULL,
            provider TEXT DEFAULT 'render',
            render_service_id TEXT,
            render_api_key TEXT,
            health_url TEXT NOT NULL,
            status TEXT DEFAULT 'UNKNOWN',
            latency_ms REAL DEFAULT 0.0,
            last_checked_at TIMESTAMP,
            is_active INTEGER DEFAULT 0,
            host TEXT DEFAULT '127.0.0.1',
            port INTEGER DEFAULT 8000,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
        cur.execute("PRAGMA table_info(servers);")
        server_cols = {row[1] for row in cur.fetchall()}
        for col, ctype in [
            ("project_id", "TEXT"),
            ("provider", "TEXT DEFAULT 'render'"),
            ("render_service_id", "TEXT"),
            ("render_api_key", "TEXT"),
            ("is_active", "INTEGER DEFAULT 0"),
        ]:
            if col not in server_cols:
                try:
                    cur.execute(f"ALTER TABLE servers ADD COLUMN {col} {ctype};")
                except Exception:
                    pass

        # 6. Global Platform Settings table
        cur.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 7. Service Logs table (for real ingested telemetry)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS service_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            service TEXT NOT NULL,
            level TEXT DEFAULT 'INFO',
            message TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # Migrate existing repo into projects if projects is empty
        cur.execute("SELECT COUNT(*) FROM projects;")
        if cur.fetchone()[0] == 0:
            cur.execute("SELECT id, name, local_path, test_cmd, is_active FROM repos LIMIT 1;")
            first_repo = cur.fetchone()
            if first_repo:
                cur.execute(
                    """
                    INSERT INTO projects (id, name, github_repo, local_path, default_branch, test_cmd, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (first_repo[0], first_repo[1], f"vishnunandan555/{first_repo[1]}", first_repo[2], "main", first_repo[3] or "pytest", first_repo[4])
                )

        conn.commit()
    except Exception as e:
        logger.debug(f"Migration error: {e}")


def get_db(db_path: Optional[str] = None) -> sqlite3.Connection:
    path = db_path or os.environ.get("PRODPILOT_DB_PATH") or DEFAULT_DB_PATH
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
    """Returns an existing incident if its status is active (not resolved/deployed/rolled_back/dismissed)."""
    if not fingerprint:
        return None
    with get_db(db_path) as conn:
        cursor = conn.execute(
            """
            SELECT * FROM incidents
            WHERE fingerprint = ? AND status NOT IN ('RESOLVED', 'DEPLOYED', 'ROLLED_BACK', 'DISMISSED')
            ORDER BY detected_at DESC LIMIT 1
            """,
            (fingerprint,)
        )
        row = cursor.fetchone()
        return dict_from_row(row)


def find_active_incident_by_service(service: str, suspected_area: Optional[str] = None, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Finds any active, unresolved incident for the service to prevent duplicate incidents during ongoing triage/fixing."""
    if not service:
        return None
    with get_db(db_path) as conn:
        if suspected_area:
            cursor = conn.execute(
                """
                SELECT * FROM incidents
                WHERE service = ? AND suspected_area = ? AND status NOT IN ('RESOLVED', 'DEPLOYED', 'ROLLED_BACK', 'DISMISSED')
                ORDER BY detected_at DESC LIMIT 1
                """,
                (service, suspected_area)
            )
            row = cursor.fetchone()
            if row:
                return dict_from_row(row)

        cursor = conn.execute(
            """
            SELECT * FROM incidents
            WHERE service = ? AND status IN ('OPEN', 'DETECTED', 'INVESTIGATING', 'TRIAGED', 'REPRODUCED', 'FIXING', 'STAGED', 'AWAITING_APPROVAL')
            ORDER BY detected_at DESC LIMIT 1
            """,
            (service,)
        )
        row = cursor.fetchone()
        return dict_from_row(row)


def delete_incident(incident_id: str, db_path: Optional[str] = None) -> bool:
    """Deletes an incident and all associated runs, events, artifacts, decisions, and approvals."""
    with get_db(db_path) as conn:
        conn.execute("DELETE FROM approvals WHERE incident_id = ?", (incident_id,))
        conn.execute("DELETE FROM decisions WHERE incident_id = ?", (incident_id,))
        conn.execute("DELETE FROM artifacts WHERE incident_id = ?", (incident_id,))
        conn.execute("DELETE FROM run_events WHERE incident_id = ?", (incident_id,))
        conn.execute("DELETE FROM runs WHERE incident_id = ?", (incident_id,))
        cursor = conn.execute("DELETE FROM incidents WHERE id = ?", (incident_id,))
        conn.commit()
        return cursor.rowcount > 0


def clear_incidents_by_status(status_filter: Optional[str] = None, db_path: Optional[str] = None) -> int:
    """Clears incidents by status (e.g. 'RESOLVED' or 'ALL')."""
    with get_db(db_path) as conn:
        if status_filter and status_filter.upper() != "ALL":
            cursor = conn.execute("SELECT id FROM incidents WHERE status = ?", (status_filter,))
        else:
            cursor = conn.execute("SELECT id FROM incidents")
        inc_ids = [row[0] for row in cursor.fetchall()]
        for inc_id in inc_ids:
            conn.execute("DELETE FROM approvals WHERE incident_id = ?", (inc_id,))
            conn.execute("DELETE FROM decisions WHERE incident_id = ?", (inc_id,))
            conn.execute("DELETE FROM artifacts WHERE incident_id = ?", (inc_id,))
            conn.execute("DELETE FROM run_events WHERE incident_id = ?", (inc_id,))
            conn.execute("DELETE FROM runs WHERE incident_id = ?", (inc_id,))
            conn.execute("DELETE FROM incidents WHERE id = ?", (inc_id,))
        conn.commit()
        return len(inc_ids)


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


def claim_incident_for_processing(
    incident_id: str,
    target_status: str = "INVESTIGATING",
    expected_status: str = "OPEN",
    db_path: Optional[str] = None,
) -> bool:
    """Atomically claims an incident by transitioning from expected_status to target_status.
    Returns True if successfully claimed, False if already claimed/transitioned.
    """
    with get_db(db_path) as conn:
        cursor = conn.execute(
            "UPDATE incidents SET status = ?, updated_at = ? WHERE id = ? AND status = ?",
            (target_status, datetime.utcnow().isoformat(), incident_id, expected_status),
        )
        return cursor.rowcount > 0


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
    phone: Optional[str] = None,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    user_id = f"usr-{os.urandom(4).hex()}"
    p_hash = hash_password(password)
    with get_db(db_path) as conn:
        conn.execute(
            """
            INSERT INTO users (id, username, email, password_hash, full_name, role, phone)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, username.strip(), email.strip() if email else None, p_hash, full_name, role, phone.strip() if phone else None)
        )
    return {
        "id": user_id,
        "username": username,
        "email": email,
        "full_name": full_name,
        "role": role,
        "phone": phone,
    }


def delete_user(user_id: str, db_path: Optional[str] = None) -> None:
    with get_db(db_path) as conn:
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))


def authenticate_user(
    username_or_email: str,
    password: str,
    db_path: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    clean = username_or_email.strip()
    with get_db(db_path) as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, username, email, password_hash, full_name, role, phone, avatar_url, telegram_chat_id, bio, created_at FROM users WHERE username = ? OR email = ?",
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
                "phone": d.get("phone"),
                "avatar_url": d.get("avatar_url"),
                "telegram_chat_id": d.get("telegram_chat_id"),
                "bio": d.get("bio"),
                "created_at": d["created_at"],
            }
        return None


def get_user_by_id(user_id: str, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    with get_db(db_path) as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, username, email, full_name, role, phone, avatar_url, telegram_chat_id, bio, created_at FROM users WHERE id = ?",
            (user_id,)
        )
        row = cur.fetchone()
        return dict(row) if row else None


def update_user_profile(
    user_id: str,
    full_name: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    avatar_url: Optional[str] = None,
    telegram_chat_id: Optional[str] = None,
    bio: Optional[str] = None,
    role: Optional[str] = None,
    db_path: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    existing = get_user_by_id(user_id, db_path)
    if not existing:
        return None

    updates = []
    params = []
    if full_name is not None:
        updates.append("full_name = ?")
        params.append(full_name.strip() if full_name else None)
    if email is not None:
        updates.append("email = ?")
        params.append(email.strip() if email else None)
    if phone is not None:
        updates.append("phone = ?")
        params.append(phone.strip() if phone else None)
    if avatar_url is not None:
        updates.append("avatar_url = ?")
        params.append(avatar_url.strip() if avatar_url else None)
    if telegram_chat_id is not None:
        updates.append("telegram_chat_id = ?")
        params.append(telegram_chat_id.strip() if telegram_chat_id else None)
    if bio is not None:
        updates.append("bio = ?")
        params.append(bio.strip() if bio else None)
    if role is not None:
        updates.append("role = ?")
        params.append(role.strip() if role else None)

    if not updates:
        return existing

    params.append(user_id)
    query = f"UPDATE users SET {', '.join(updates)} WHERE id = ?"

    with get_db(db_path) as conn:
        conn.execute(query, tuple(params))

    return get_user_by_id(user_id, db_path)


# --- Projects (GitHub Integration) ---

def create_project(
    name: str,
    github_repo: str,
    local_path: str,
    github_token: Optional[str] = None,
    default_branch: str = "main",
    test_cmd: str = "pytest",
    set_active: bool = True,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    project_id = f"proj-{os.urandom(3).hex()}"
    now_iso = datetime.utcnow().isoformat()
    with get_db(db_path) as conn:
        if set_active:
            conn.execute("UPDATE projects SET is_active = 0")
        conn.execute(
            """
            INSERT INTO projects (
                id, name, github_repo, github_token, local_path, default_branch, test_cmd, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                project_id,
                name.strip(),
                github_repo.strip(),
                github_token.strip() if github_token else None,
                local_path.strip(),
                default_branch.strip() or "main",
                test_cmd.strip() or "pytest",
                1 if set_active else 0,
            )
        )
        # Also sync to repos for backward compatibility
        conn.execute("UPDATE repos SET is_active = 0")
        conn.execute(
            """
            INSERT OR REPLACE INTO repos (id, name, local_path, test_cmd, health_url, start_cmd, port, is_active)
            VALUES (?, ?, ?, ?, 'http://127.0.0.1:8000/health', '', 8000, ?)
            """,
            (project_id, name.strip(), local_path.strip(), test_cmd.strip() or "pytest", 1 if set_active else 0)
        )
    return {
        "id": project_id,
        "name": name.strip(),
        "github_repo": github_repo.strip(),
        "github_token": github_token.strip() if github_token else None,
        "local_path": local_path.strip(),
        "default_branch": default_branch.strip() or "main",
        "test_cmd": test_cmd.strip() or "pytest",
        "is_active": 1 if set_active else 0,
        "created_at": now_iso,
    }


def list_projects(db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_db(db_path) as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM projects ORDER BY is_active DESC, created_at DESC")
        return [dict(r) for r in cur.fetchall()]


def get_project(project_id: str, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    with get_db(db_path) as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
        row = cur.fetchone()
        return dict(row) if row else None


def get_active_project(db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    with get_db(db_path) as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM projects WHERE is_active = 1 LIMIT 1")
        row = cur.fetchone()
        if not row:
            cur.execute("SELECT * FROM projects ORDER BY created_at DESC LIMIT 1")
            row = cur.fetchone()
        return dict(row) if row else None


def set_active_project(project_id: str, db_path: Optional[str] = None) -> None:
    with get_db(db_path) as conn:
        conn.execute("UPDATE projects SET is_active = 0")
        conn.execute("UPDATE projects SET is_active = 1 WHERE id = ?", (project_id,))
        # Also sync to repos
        conn.execute("UPDATE repos SET is_active = 0")
        conn.execute("UPDATE repos SET is_active = 1 WHERE id = ?", (project_id,))


def delete_project(project_id: str, db_path: Optional[str] = None) -> None:
    with get_db(db_path) as conn:
        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.execute("DELETE FROM repos WHERE id = ?", (project_id,))
        conn.execute("DELETE FROM servers WHERE project_id = ?", (project_id,))


# --- Repositories (Legacy Compatibility) ---

def list_repos(db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    return list_projects(db_path)


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
    return create_project(
        name=name,
        github_repo=f"vishnunandan555/{name}",
        local_path=local_path,
        test_cmd=test_cmd,
        set_active=set_active,
        db_path=db_path,
    )


def set_active_repo(repo_id: str, db_path: Optional[str] = None) -> None:
    set_active_project(repo_id, db_path)


def delete_repo(repo_id: str, db_path: Optional[str] = None) -> None:
    delete_project(repo_id, db_path)


def get_active_repo(db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    return get_active_project(db_path)


# --- Connected Production Servers (Render Infrastructure) ---

def list_servers(project_id: Optional[str] = None, db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_db(db_path) as conn:
        cur = conn.cursor()
        if project_id:
            cur.execute("SELECT * FROM servers WHERE project_id = ? ORDER BY is_active DESC, created_at DESC", (project_id,))
        else:
            cur.execute("SELECT * FROM servers ORDER BY is_active DESC, created_at DESC")
        return [dict(r) for r in cur.fetchall()]


def get_server(server_id: str, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    with get_db(db_path) as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM servers WHERE id = ?", (server_id,))
        row = cur.fetchone()
        return dict(row) if row else None


def connect_server(
    name: str,
    health_url: str,
    project_id: Optional[str] = None,
    provider: str = "render",
    render_service_id: Optional[str] = None,
    render_api_key: Optional[str] = None,
    port: int = 8000,
    host: str = "127.0.0.1",
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
                id, project_id, name, provider, render_service_id, render_api_key,
                host, port, health_url, status, latency_ms, last_checked_at, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                server_id,
                project_id,
                name.strip(),
                provider.strip().lower() if provider else "render",
                render_service_id.strip() if render_service_id else None,
                render_api_key.strip() if render_api_key else None,
                host.strip() if host else "127.0.0.1",
                port or 8000,
                health_url.strip(),
                status,
                latency_ms,
                now_iso,
                1 if set_active else 0,
            )
        )
    return {
        "id": server_id,
        "project_id": project_id,
        "name": name.strip(),
        "provider": provider or "render",
        "render_service_id": render_service_id.strip() if render_service_id else None,
        "render_api_key": render_api_key.strip() if render_api_key else None,
        "host": host,
        "port": port,
        "health_url": health_url.strip(),
        "status": status,
        "latency_ms": latency_ms,
        "last_checked_at": now_iso,
        "is_active": 1 if set_active else 0,
    }


# Alias create_server to connect_server for API compatibility
create_server = connect_server


# --- Global Settings Key-Value Store ---

def get_setting(key: str, default: Optional[str] = None, db_path: Optional[str] = None) -> Optional[str]:
    with get_db(db_path) as conn:
        cur = conn.cursor()
        cur.execute("SELECT value FROM settings WHERE key = ?", (key,))
        row = cur.fetchone()
        if row:
            return row["value"]
    # Fallback to os.environ
    return os.environ.get(key, default)


def set_setting(key: str, value: str, db_path: Optional[str] = None) -> None:
    now_iso = datetime.utcnow().isoformat()
    with get_db(db_path) as conn:
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
            (key, value.strip(), now_iso)
        )


def get_all_settings(db_path: Optional[str] = None) -> Dict[str, str]:
    settings = {}
    with get_db(db_path) as conn:
        cur = conn.cursor()
        cur.execute("SELECT key, value FROM settings")
        for r in cur.fetchall():
            settings[r["key"]] = r["value"]

    # Fill defaults from environment if missing in DB
    for env_key in [
        "GITHUB_PAT",
        "RENDER_API_KEY",
        "TELEGRAM_BOT_TOKEN",
        "TELEGRAM_ALLOWED_CHAT_ID",
        "OPENROUTER_API_KEY",
        "JEV_API_KEY",
        "CLOUDFLARE_TUNNEL_URL",
        "RENDER_WEB_URL",
    ]:
        if env_key not in settings and os.environ.get(env_key):
            settings[env_key] = os.environ.get(env_key, "")

    return settings


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


def get_active_server(project_id: Optional[str] = None, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    with get_db(db_path) as conn:
        cur = conn.cursor()
        if project_id:
            cur.execute("SELECT * FROM servers WHERE project_id = ? AND is_active = 1 LIMIT 1", (project_id,))
            row = cur.fetchone()
            if not row:
                cur.execute("SELECT * FROM servers WHERE project_id = ? ORDER BY created_at DESC LIMIT 1", (project_id,))
                row = cur.fetchone()
        else:
            cur.execute("SELECT * FROM servers WHERE is_active = 1 LIMIT 1")
            row = cur.fetchone()
            if not row:
                cur.execute("SELECT * FROM servers ORDER BY created_at DESC LIMIT 1")
                row = cur.fetchone()
        return dict_from_row(row)


def list_users(db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_db(db_path) as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, username, email, full_name, role, phone, avatar_url, telegram_chat_id, bio, created_at FROM users ORDER BY created_at ASC"
        )
        return [dict(r) for r in cur.fetchall()]


# --- Service Telemetry Logs ---

def insert_service_log(
    service: str,
    level: str,
    message: str,
    timestamp: Optional[str] = None,
    db_path: Optional[str] = None,
) -> None:
    ts = timestamp or datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    with get_db(db_path) as conn:
        conn.execute(
            "INSERT INTO service_logs (service, level, message, timestamp) VALUES (?, ?, ?, ?)",
            (service, level.upper(), message, ts)
        )


def list_service_logs(
    service: Optional[str] = None,
    level: Optional[str] = None,
    limit: int = 150,
    db_path: Optional[str] = None,
) -> List[Dict[str, Any]]:
    query = "SELECT id, service, level, message, timestamp FROM service_logs WHERE 1=1"
    params = []
    if service and service != "ALL":
        query += " AND service = ?"
        params.append(service)
    if level and level != "ALL":
        query += " AND level = ?"
        params.append(level.upper())
    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)

    with get_db(db_path) as conn:
        cur = conn.cursor()
        cur.execute(query, tuple(params))
        rows = [dict(r) for r in cur.fetchall()]
        return list(reversed(rows))


def clear_all_incidents(db_path: Optional[str] = None) -> None:
    """Wipes all incidents, runs, artifacts, decisions, approvals, and logs."""
    with get_db(db_path) as conn:
        conn.execute("DELETE FROM run_events")
        conn.execute("DELETE FROM artifacts")
        conn.execute("DELETE FROM decisions")
        conn.execute("DELETE FROM approvals")
        conn.execute("DELETE FROM runs")
        conn.execute("DELETE FROM incidents")
        conn.execute("DELETE FROM service_logs")


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

