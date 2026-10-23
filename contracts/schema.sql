-- ProdPilot SQLite Database Schema
-- Version: 1.0 (Phase 0 Frozen Contract)

CREATE TABLE IF NOT EXISTS repos (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    local_path TEXT NOT NULL,
    test_cmd TEXT NOT NULL,
    health_url TEXT NOT NULL,
    start_cmd TEXT NOT NULL,
    port INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    service TEXT NOT NULL,
    detected_at TIMESTAMP NOT NULL,
    status TEXT NOT NULL, -- OPEN, INVESTIGATING, FIXING, AWAITING_APPROVAL, DEPLOYED, ROLLED_BACK, REJECTED, CLOSED
    health_url TEXT,
    trace TEXT,
    log_tail TEXT,
    recent_commits TEXT, -- JSON array of commits
    suspect_commit TEXT, -- JSON object of suspect commit
    suspected_area TEXT,
    brief_json TEXT, -- JSON brief from Context step
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    incident_id TEXT,
    issue_id TEXT,
    state TEXT NOT NULL, -- INGESTED, BRIEFED, REPRO_TEST, FIX, VERIFY, STAGED, AWAIT_APPROVAL, DEPLOYED, ROLLED_BACK, FAILED
    attempts INTEGER DEFAULT 0,
    tier TEXT DEFAULT 'fast', -- fast (Flash-class) or strong (Pro-class)
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    FOREIGN KEY(incident_id) REFERENCES incidents(id)
);

CREATE TABLE IF NOT EXISTS run_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT,
    incident_id TEXT,
    ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    stage TEXT NOT NULL, -- UNDERSTAND, REPRODUCE, FIX, VERIFY, STAGE, DECIDE, AWAIT_APPROVAL, DEPLOY
    kind TEXT NOT NULL,  -- stage_started, tool_call, test_result, decision, status_change, error
    payload TEXT NOT NULL, -- JSON string
    FOREIGN KEY(run_id) REFERENCES runs(id),
    FOREIGN KEY(incident_id) REFERENCES incidents(id)
);

CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    run_id TEXT,
    incident_id TEXT,
    kind TEXT NOT NULL, -- repro_test, patch_diff, test_log_before, test_log_after, incident_report
    path TEXT,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(run_id) REFERENCES runs(id),
    FOREIGN KEY(incident_id) REFERENCES incidents(id)
);

CREATE TABLE IF NOT EXISTS decisions (
    id TEXT PRIMARY KEY,
    run_id TEXT,
    incident_id TEXT,
    backend TEXT NOT NULL, -- rules, jev
    questions_json TEXT NOT NULL,
    answers_json TEXT NOT NULL,
    action TEXT NOT NULL, -- fix_forward, rollback, retry, escalate, ask_human, abandon
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(run_id) REFERENCES runs(id),
    FOREIGN KEY(incident_id) REFERENCES incidents(id)
);

CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    run_id TEXT,
    incident_id TEXT,
    decision TEXT NOT NULL, -- APPROVED_FIX, APPROVED_ROLLBACK, REJECTED
    reason TEXT,
    source TEXT NOT NULL,   -- telegram, desktop_ui, cli
    ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(run_id) REFERENCES runs(id),
    FOREIGN KEY(incident_id) REFERENCES incidents(id)
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_run_events_run_id ON run_events(run_id);
CREATE INDEX IF NOT EXISTS idx_run_events_incident_id ON run_events(incident_id);
