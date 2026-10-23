# ProdPilot - Build Plan

Realm Hack 2026 | 24-hour build window | Vishnu Nandan

Build in six phases across three decoupled parallel streams. Each phase ends at a verified gate; do not start the next phase until the gate passes. The demo floor is Gate 2: crash the service, tap Deploy on your phone, the service is healthy again. Everything after Gate 2 is a bonus.

---

## 1. Phase Overview & Current Status

| Phase | Hours | Goal | Gate | Status |
|---|---|---|---|---|
| **0. Setup and Spikes** | 0-2 | SDK works, Telegram talks, demo service ready, contracts frozen | **Gate 0** | ✅ **PASSED & MERGED** |
| **1. Core Pipeline** | 2-8 | Crash becomes incident, verified repro-test + fix from CLI | **Gate 1** | ✅ **PASSED (Tag: `gate-1-passed`)** |
| **2. Staging, Decisions, Telegram** | 8-14 | Phone approval restores service with post-mortem report | **Gate 2** (Demo Floor) | 🟡 **IN PROGRESS (ACTIVE)** |
| **3. Desktop Dashboard** | 14-19 | Live SSE timeline, diff viewer, before/after evidence UI | **Gate 3** | ⚪ Prepared (Ready to wire) |
| **4. Harden and Sponsor Integrations** | 19-22 | 3 clean runs in a row; Browser Use canary & Adaption AI eval | **Gate 4** | ⚪ Queued |
| **5. Freeze and Pitch** | 22-24 | Backup video, slides, rehearsal | **Done** | ⚪ Queued |

---

## 2. Architecture & Stream Division (Zero Conflicts)

```
┌─────────────────────────────────┐   ┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│     Stream A (The Brain)        │   │     Stream B (The Body & UI)    │   │     Stream C (The Comms)        │
├─────────────────────────────────┤   ├─────────────────────────────────┤   ├─────────────────────────────────┤
│ • Worktree: prodpilot-a         │   │ • Worktree: prodpilot-b         │   │ • Directory: prodpilot/telegram │
│ • Branch: stream-a              │   │ • Branch: stream-b              │   │ • Branch: telegram (root-level) │
│ • Pipeline & Antigravity SDK    │   │ • demo-prod (buggy service)     │   │ • Hosted on Visihot cloud server│
│ • Repro-test & Verifier         │   │ • Watcher + Git Blame           │   │ • python-telegram-bot v22.8     │
│ • Orchestrator Daemon           │   │ • Reset & trigger scripts       │   │ • Inline Action Buttons         │
│ • Staging Canaries (8001/8002)  │   │ • Desktop Dashboard (React+Vite)│   │ • Public Cloudflare Tunnel link │
│ • FastAPI & SSE API (port 8765) │   │ • Live SSE Event Subscriber     │   │ • 1-Tap Deploy / Rollback       │
└─────────────────────────────────┘   └─────────────────────────────────┘   └─────────────────────────────────┘
```

### Folder Ownership:
- **Stream A**: `backend/prodpilot/pipeline/`, `agents/`, `staging/`, `decide/`, `api/`, `db.py`
- **Stream B**: `demo-prod/`, `backend/prodpilot/watcher/`, `desktop/`, `scripts/`
- **Stream C**: `telegram/` (on branch `telegram`, untracked by `main`, deployed directly by Visihot)

---

## 3. Current Phase: Phase 2 (Hours 8-14) – Gate 2 (The Demo Floor)

**Goal**: Crash the service with `./scripts/trigger-crash.sh` -> Phone buzzes on Telegram with diagnosis and canary status -> Tap **`[🚀 Deploy Fix (8001)]`** on phone -> Service on port 8000 restored healthy, and an Incident Post-Mortem Report is saved.

### Stream A Tasks (Agent 1 - Brain & Orchestrator):
- [ ] **Orchestrator Daemon (`backend/prodpilot/pipeline/orchestrator.py`)**:
  - Continuously polls SQLite for new incidents in status `OPEN`.
  - Runs Context Brief (`brief.py`) and advances status to `INVESTIGATING`.
  - Runs Repro-First Pipeline (`repro_runner.py` via `AntigravityAdapter`) to generate reproduction test, verify failure on baseline, generate patch, and verify repro + full suite pass.
  - Spawns live canary instances: Fix-forward on `http://127.0.0.1:8001` and Rollback on `http://127.0.0.1:8002`.
  - Runs Decision Engine (`decide/rules.py`) to compute recommendation and confidence.
  - Advances incident status to `AWAITING_APPROVAL` and emits SSE event.
- [ ] **Deploy Adapter & Post-Mortem Report (`backend/prodpilot/staging/deploy.py`)**:
  - On `/incidents/{id}/approve`, promotes the chosen canary onto production port 8000.
  - Monitors health for 10s (triggers automatic emergency rollback if health check fails).
  - Generates comprehensive markdown post-mortem report (`artifacts/incident_report.md`) containing root cause, git blame suspect commit, test evidence before/after, diff, and approval log.

### Stream B Tasks (Agent 2 - Desktop Live Experience):
- [ ] **Live SSE Timeline Integration (`desktop/src/`)**:
  - Connect `desktop/src/App.jsx` and `Timeline.jsx` to live SSE endpoint `GET http://127.0.0.1:8765/incidents/{id}/events`.
  - Animate stages dynamically: `UNDERSTAND` -> `REPRODUCE` -> `FIX` -> `VERIFY` -> `STAGE` -> `DECIDE` -> `AWAITING_APPROVAL` -> `DEPLOY` -> `RESOLVED`.
  - Render live tool calls, test execution outputs, and patch diff in real time.
- [ ] **One-Tap Desktop Approvals & Controls**:
  - Wire Desktop `[Deploy Fix]` and `[Rollback]` buttons to call `POST http://127.0.0.1:8765/incidents/{id}/approve`.
  - Add demo triggers in `Header.jsx`: `[💥 Trigger Test Crash]` and `[🔄 Reset Demo]`.
- [ ] **Post-Mortem Report Viewer**:
  - Render the generated post-mortem report when incident reaches `DEPLOYED`.

### Stream C Tasks (Agent 3 - Visihot Telegram Cloud Bot):
- [ ] **Visihot Reconnect Resilience (`app.py`, `bot.py`)**:
  - Ensure bot handles network reconnects to the Cloudflare public tunnel (`https://developing-dimensional-acknowledged-minimal.trycloudflare.com`).
- [ ] **Live Approval Action**:
  - Receive proactive alert when incident enters `AWAITING_APPROVAL`.
  - Tapping `[🚀 Deploy Fix (8001)]` calls public tunnel `/approve` endpoint, updates message to `⏳ Deploying...`, and confirms with `✅ PROD RESTORED`.
  - Command `/report` sends the markdown post-mortem report summary.

### Gate 2 Verification:
1. Run `./scripts/reset-demo.sh` to ensure `demo-prod` is clean on port 8000.
2. Run `./scripts/trigger-crash.sh` to cause the `discount` crash.
3. Phone receives Telegram alert card within 30 seconds.
4. Tap **Deploy Fix** on phone.
5. Service on port 8000 returns `200 OK` (healthy) and Telegram confirms restoration.
6. Run twice consecutively to verify repeatability.

---

## 4. Phase 3: Dashboard & Polish (Hours 14-19)

- Desktop Electron app packaging dev mode.
- Agent Follow-Up Panel: allows operator to submit extra instructions ("use dict.get instead of removing schema") and re-runs pipeline on same worktree.
- Read-only GitHub issue sync (if time permits).

---

## 5. Phase 4: Harden & Sponsor Track Integrations (Hours 19-22)

- **Browser Use (Hero Sponsor)**: Autonomous browser-based canary check on `http://localhost:8001/checkout` ensuring visual checkout completion.
- **Adaption AI ($500 Credits)**: Route LLM brief synthesis and evaluation benchmarking through Adaption AI endpoints.
- **Render (Innovation Partner)**: Optional remote deploy webhook adapter.

---

## 6. Phase 5: Freeze & Pitch (Hours 22-24)

- Code freeze, tag final version.
- Record 3-minute demo backup video.
- Rehearse 3-minute pitch:
  1. Problem (15s): AI writes code fast, but verifying & recovering in production is manual.
  2. The Demo (90s): Crash service -> Phone buzzes with diagnosis & two staged options -> Tap Deploy Fix on phone -> Service back in seconds.
  3. Unique Value (45s): Repro-first proof, typed decision engine, canary staging, local-first control.
  4. Roadmap (30s): Server daemon mode, Docker/K8s adapters, APM integration.
