# ProdPilot Multi-Agent Execution Plan & Runbook (Phase 4: Platform Hardening & Ingest Tier)

This document defines the Phase 4 multi-agent operating procedure for ProdPilot.
Each agent operates in its own isolated worktree or branch with strict folder ownership.

---

## 1. What Has Been Built & Merged to `main` (Gates 0, 1, 2, and 3 Passed)

| Component | Files Built & Merged | Verified Functionality |
|---|---|---|
| **Contracts** | `contracts/schema.sql`, `incident.example.json`, `events.md`, `api.md`, `project.profile.example.yaml`, `agent_interface.py` | Frozen schemas for DB, REST, SSE, and Agent signatures. |
| **Database** | `backend/prodpilot/db.py` | SQLite layer with Foreign Keys, event logs, and JSON parsing. |
| **Agent Adapters** | `backend/prodpilot/agents/antigravity_adapter.py`, `gemini_adapter.py`, `factory.py` | Primary: Antigravity SDK (`agy` CLI v1.4.6). Fallback: Gemini adapter. |
| **Sandboxing** | `backend/prodpilot/pipeline/worktree.py` | Isolated git worktree creator and cleaner per incident. |
| **Pipeline Engine** | `backend/prodpilot/pipeline/brief.py`, `repro_runner.py` | Autonomous context brief synthesis; failing reproduction test generation on unmodified code; patch synthesis; deterministic verification of repro + full suite. |
| **Staging & Deploy** | `backend/prodpilot/staging/manager.py`, `deploy.py` | Side-port canaries (8001 & 8002); port-swapping deploy adapter with automatic health monitoring, instant rollback, and post-mortem report generation. |
| **Orchestrator** | `backend/prodpilot/pipeline/orchestrator.py` | Continuous daemon connecting watcher OPEN incidents to repro-runner, staging, and decision engine. Verified via pytest! |
| **Decisions** | `backend/prodpilot/decide/rules.py` | Typed decision engine outputting recommendations (fix-forward vs rollback), probabilities, and reasoning. |
| **Backend & Tunnel** | `backend/prodpilot/api/server.py` | FastAPI REST & SSE streaming server on port 8765. Public Cloudflare tunnel active. |
| **Fake Prod & Scripts** | `demo-prod/`, `scripts/init_demo_prod.py`, `reset-demo.sh`, `trigger-crash.sh` | Realistic order microservice with 5 commits of git history, planted `discount` bug, reset and crash triggers. |
| **Health Watcher** | `backend/prodpilot/watcher/watcher.py` | 5-second health poller; log tail and traceback extraction; git blame suspect commit capture. |
| **Desktop Base** | `desktop/` (Vite + React) | Live SSE timeline, diff viewer, test evidence, post-mortem report viewer merged. |
| **Telegram Bot** | `telegram/bot.py`, `app.py` (branch: `telegram`) | Interactive incident card with buttons (`[Deploy Fix]`, `[Rollback]`), `/status`, `/logs`, `/report`. Verified live with Visihot Pterodactyl! |

---

## 2. Phase 4 Workstreams (Zero Conflicts)

```
┌────────────────────────────────────────────────────────┐
│  STREAM A: Ingest, Triage Tier & Anti-Looping          │
│  • Worktree: /home/vishnunandan555/Projects/prodpilot-a│
│  • Branch: stream-triage                               │
│  • Directory ownership:                                │
│    - backend/prodpilot/ingest/                         │
│    - backend/prodpilot/triage/                         │
│    - backend/prodpilot/db.py (fingerprint extensions)  │
│    - scripts/forwarder.py                              │
│  • Deliverables:                                       │
│    1. /ingest endpoint for log batches                 │
│    2. Render Log API puller & local forwarder          │
│    3. Adaption AI triage classifier (High vs Low)      │
│    4. Low-severity GitHub issue creator                │
│    5. Stack trace fingerprinting & anti-looping        │
└────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
┌───────────────────────────────────┐    ┌───────────────────────────────────┐
│  STREAM B: Fixing & Safety Guard  │    │  STREAM C: Mobile Web & Comms     │
│  • Worktree: prodpilot-b          │    │  • Directory: desktop/, telegram/ │
│  • Branch: stream-agent           │    │  • Branch: stream-ui              │
│  • Directory ownership:           │    │  • Deliverables:                  │
│    - backend/prodpilot/pipeline/  │    │    1. /incidents/{id}/mobile web  │
│    - backend/prodpilot/staging/   │    │       view with Cloudflare tunnel │
│  • Deliverables:                  │    │    2. Mobile 1-tap action buttons │
│    1. Firecrawl doc scraper       │    │       ([Deploy Fix], [Rollback])  │
│    2. GitHub branch & PR opener   │    │    3. Telegram alert card with    │
│    3. 10s post-deploy watchdog    │    │       direct mobile web link      │
│    4. Auto-revert guard on fail   │    │    4. n8n webhook dispatcher      │
└───────────────────────────────────┘    └───────────────────────────────────┘
```

---

## 3. Done Check & Verification Commands per Stream

- **Stream A Done Check**:
  ```bash
  python3 scripts/test_ingest_triage.py
  # Asserts that fake 500 error triggers High classification & fingerprint stored;
  # Asserts that warning log triggers Low classification & issue brief.
  ```

- **Stream B Done Check**:
  ```bash
  python3 scripts/test_watchdog_revert.py
  # Asserts that broken deployment triggers 10s health failure and automatic rollback.
  ```

- **Stream C Done Check**:
  ```bash
  curl -s http://127.0.0.1:8765/incidents/1/mobile | grep -q "Deploy Fix"
  # Asserts mobile incident web page renders properly with action buttons.
  ```
