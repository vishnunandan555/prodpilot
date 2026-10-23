# ProdPilot Event Contract (SSE & DB)

Version: 1.0 (Phase 0 Frozen Contract)

Every step of an incident investigation and resolution streams to the UI via Server-Sent Events (SSE) and is recorded in the `run_events` SQLite table.

## SSE Wire Format

```http
event: run_event
data: {
  "id": 104,
  "run_id": "run-9812",
  "incident_id": "inc-20261023-001",
  "ts": "2026-10-23T14:31:05.120Z",
  "stage": "REPRODUCE",
  "kind": "test_result",
  "payload": { ... }
}
```

## Stages (`stage`)

- `UNDERSTAND`: Reading traceback, logs, suspect commit, creating incident brief.
- `REPRODUCE`: Generating a reproduction test and confirming it fails on baseline code.
- `FIX`: Agent modifying code in git worktree to resolve the failure.
- `VERIFY`: Running the repro test and full test suite deterministically.
- `STAGE`: Spinning up side-port canary instances (fix-forward on 8001, rollback on 8002).
- `DECIDE`: Evaluating health, diff size, sensitivity to recommend fix vs rollback.
- `AWAIT_APPROVAL`: Waiting for human confirmation via Telegram or Desktop UI.
- `DEPLOY`: Swapping canary into production port with health verification.
- `ROLLED_BACK`: If post-deploy health check fails or human chooses rollback.
- `RESOLVED`: Final healthy production state confirmed and incident closed.

## Event Kinds (`kind`) & Payloads

### 1. `stage_started`
Fired when the pipeline moves into a new phase.
```json
{
  "stage": "REPRODUCE",
  "message": "Synthesizing minimal reproduction test from traceback..."
}
```

### 2. `tool_call`
Fired when the coding agent performs an action.
```json
{
  "tool": "read_file",
  "args": {"path": "app.py", "start_line": 35, "end_line": 60},
  "summary": "Inspected app.py lines 35-60 around KeyError: 'discount'"
}
```

### 3. `test_result`
Fired whenever deterministic verifier runs test commands.
```json
{
  "phase": "repro_baseline", // repro_baseline, repro_after_fix, full_suite
  "passed": false,
  "exit_code": 1,
  "duration_sec": 0.45,
  "summary": "1 failed, 12 passed in 0.45s",
  "failure_snippet": "FAILED tests/test_repro.py::test_reproduce_order_discount - KeyError: 'discount'"
}
```

### 4. `decision`
Fired when decision engine (rules or Jev) computes the recommendation.
```json
{
  "backend": "rules", // "rules" or "jev"
  "recommendation": "fix_forward", // "fix_forward" or "rollback"
  "probabilities": {
    "fix_forward": 0.85,
    "rollback": 0.15
  },
  "reason": "Small 3-line patch in app.py, passes full test suite, suspect commit was landed only 15m ago."
}
```

### 5. `awaiting_approval`
Fired when staged canary instances are verified and awaiting approval.
```json
{
  "recommendation": "fix_forward",
  "options": {
    "fix_forward": {
      "port": 8001,
      "health_ok": true,
      "diff_stats": "+3 -1"
    },
    "rollback": {
      "port": 8002,
      "health_ok": true,
      "revert_commit": "a1b2c3d"
    }
  }
}
```

### 6. `deployed`
Fired after deployment succeeds and passes health check.
```json
{
  "choice": "fix_forward",
  "production_port": 8000,
  "post_deploy_health_ok": true,
  "deployed_at": "2026-10-23T14:34:10Z"
}
```

### 7. `status_change` / `error`
Fired on global status transitions or fatal pipeline errors.
```json
{
  "status": "AWAITING_APPROVAL",
  "error": null
}
```
