# ProdPilot Multi-Agent Execution Plan & Runbook (Phase 4: Model 1 Hybrid Architecture)

This document defines the Phase 4 multi-agent operating procedure for ProdPilot under **Model 1: Laptop-Hosted Backend + Render-Hosted Frontend + Cloudflare Tunnel**.

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

## 2. Phase 4 Workstreams (Model 1 Division)

```
┌────────────────────────────────────────────────────────┐
│  STREAM A: Laptop Ingest, Triage & Anti-Looping        │
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
│    3. Fast rule-based triage classifier (High vs Low)  │
│    4. Low-severity GitHub issue creator                │
│    5. Stack trace fingerprinting & anti-looping        │
└────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
┌───────────────────────────────────┐    ┌───────────────────────────────────┐
│  STREAM B: Laptop Fixing & Guard  │    │  STREAM C: Render Web & Tunnel    │
│  • Worktree: prodpilot-b          │    │  • Directory: desktop/, telegram/ │
│  • Branch: stream-agent           │    │  • Branch: stream-ui              │
│  • Directory ownership:           │    │  • Deliverables:                  │
│    - backend/prodpilot/pipeline/  │    │    1. Vite build & Render Static  │
│    - backend/prodpilot/staging/   │    │       Site deploy config          │
│  • Deliverables:                  │    │    2. /incidents/{id} mobile-first│
│    1. Investigation RCA report    │    │       webpage with live SSE       │
│    2. Antigravity fix-in-worktree │    │    3. Mobile 1-tap action buttons │
│    3. GitHub branch & PR opener   │    │       ([Deploy Fix], [Rollback])  │
│    4. 10s post-deploy watchdog    │    │    4. Immediate Telegram alert    │
│    5. Auto-revert guard on fail   │    │       with direct Render web link │
└───────────────────────────────────┘    └───────────────────────────────────┘
```

---

## 3. Phase 4 Verification & Done Checks (All Passed ✅)

- **Stream A Done Check**:
  ```bash
  python3 scripts/test_ingest_triage.py
  # PASSED: 500 error triggered High classification & fingerprint stored;
  # PASSED: warning log triggered Low classification & issue brief.
  ```

- **Stream B Done Check**:
  ```bash
  python3 scripts/test_watchdog_revert.py
  # PASSED: broken deployment triggered 10s health failure and automatic rollback.
  python3 -m unittest backend/prodpilot/tests/test_e2e_exit_check.py
  # PASSED: full end-to-end incident lifecycle test passed.
  ```

- **Stream C Done Check**:
  ```bash
  cd desktop && npm run build
  # PASSED: Vite built successfully to dist/ in 1.22s for Render Static Sites.
  # PASSED: /incidents/{id} rendered with mobile action buttons over Cloudflare Tunnel.
  ```

**All 3 streams merged to `main` at `d082c09` and tagged `gate-4-passed`.**

---

## 4. Current Workstream: UI Operations Platform Overhaul (Gate UI)

Before starting Phase 5 (Rehearsals & Recording the 3-minute Backup Video), the UI is being transformed into an authentic SRE Operations Platform inspired by Splunk and Epok.

### Deliverables:
1. **Sidebar Navigation**: 8 sections (`Dashboard`, `Incidents`, `Logs`, `Services`, `Repositories`, `Agents`, `Team`, `Settings`).
2. **Dashboard View**: Metric cards (error rates, active incidents, log volume), service health grid, and live event activity feed.
3. **Incident Details (The Hero Screen)**: 6 internal tabs (`Overview`, `Logs & Traces`, `Investigation & RCA`, `Recovery & Canaries`, `Changes & Diffs`, `Timeline & Audit`) + 1-tap mobile action bar (`[🚀 Deploy Fix]`, `[⏪ Rollback]`, `[🛑 Take Over]`).
4. **Logs Explorer View**: Real-time log search, level filters, service filtering.
5. **Supporting Views**: `ServicesView`, `RepositoriesView`, `AgentsView`, `TeamView`.
6. **Zero-Error Validation**: Electron launch check & `npm run build` verification.
