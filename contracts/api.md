# ProdPilot REST & SSE API Contract

Version: 1.0 (Phase 0 Frozen Contract)
Base URL: `http://127.0.0.1:8765`

## Endpoints

### 1. Healthcheck
- `GET /health`
- Response: `200 OK`
  ```json
  {"status": "ok", "version": "1.0.0"}
  ```

### 2. List Incidents
- `GET /incidents`
- Query Params: `status` (optional)
- Response: `200 OK`
  ```json
  [
    {
      "id": "inc-20261023-001",
      "service": "demo-prod",
      "detected_at": "2026-10-23T14:30:00Z",
      "status": "AWAITING_APPROVAL",
      "suspect_commit": { ... },
      "recommendation": "fix_forward"
    }
  ]
  ```

### 3. Get Single Incident Detail
- `GET /incidents/{id}`
- Response: `200 OK`
  ```json
  {
    "id": "inc-20261023-001",
    "service": "demo-prod",
    "detected_at": "2026-10-23T14:30:00Z",
    "status": "AWAITING_APPROVAL",
    "trace": "...",
    "log_tail": "...",
    "recent_commits": [ ... ],
    "suspect_commit": { ... },
    "brief": {
      "summary": "KeyError: 'discount' in order calculation endpoint.",
      "suspected_area": "app.py:45",
      "introduced_by": "a1b2c3d"
    },
    "artifacts": {
      "repro_test": "tests/test_repro.py",
      "patch_diff": "diff --git a/app.py b/app.py...",
      "test_evidence": {
        "before": "FAILED (KeyError: discount)",
        "after": "PASSED"
      }
    },
    "staging": {
      "fix_forward": {"port": 8001, "health": true},
      "rollback": {"port": 8002, "health": true}
    },
    "decision": {
      "backend": "rules",
      "recommendation": "fix_forward",
      "probabilities": {"fix_forward": 0.85, "rollback": 0.15},
      "reason": "Clean 3-line patch with 100% test pass"
    }
  }
  ```

### 4. Stream Incident Events (SSE)
- `GET /incidents/{id}/events`
- Headers: `Accept: text/event-stream`
- Response: Server-Sent Events stream matching `contracts/events.md`.

### 5. Approve Incident Action
- `POST /incidents/{id}/approve`
- Body:
  ```json
  {
    "action": "fix_forward", // "fix_forward" or "rollback"
    "source": "telegram"    // "telegram", "desktop_ui", or "cli"
  }
  ```
- Response: `200 OK`
  ```json
  {
    "status": "DEPLOYED",
    "deployed_action": "fix_forward",
    "health_check": "ok",
    "incident_id": "inc-20261023-001"
  }
  ```

### 6. Reject Incident
- `POST /incidents/{id}/reject`
- Body:
  ```json
  {
    "reason": "Patch changes business logic instead of checking presence",
    "source": "desktop_ui"
  }
  ```
- Response: `200 OK`
  ```json
  {"status": "REJECTED", "incident_id": "inc-20261023-001"}
  ```

### 7. Agent Follow-Up / Reject with Instructions
- `POST /incidents/{id}/followup`
- Body:
  ```json
  {
    "instruction": "Use dict.get('discount', 0) rather than raising KeyError",
    "source": "desktop_ui"
  }
  ```
- Response: `200 OK`
  ```json
  {"status": "FIXING", "attempt": 2, "incident_id": "inc-20261023-001"}
  ```
