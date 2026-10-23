# ProdPilot - Build Plan

Realm Hack 2026 | Deadline: Tomorrow, 11:00 AM | Vishnu Nandan

> **Current Time**: Friday, 4:07 PM (23 Oct 2026)  
> **Submission Deadline**: Saturday, 11:00 AM (24 Oct 2026)  
> **Total Time Remaining**: **~19 Hours (18h 53m)**

Build in six phases across three decoupled parallel streams. Each phase ends at a verified gate; do not start the next phase until the gate passes. The demo floor is Gate 2: crash the service, tap Deploy on your phone, the service is healthy again. Everything after Gate 2 is a bonus.

---

## 1. Timeline & Phase Schedule (19-Hour Countdown)

| Phase & Timeline | Duration | Goal | Gate | Status |
|---|---|---|---|---|
| **Phase 0: Setup & Spikes**<br>*(Passed)* | Completed | SDK works, Telegram talks, demo service ready, contracts frozen | **Gate 0** | ✅ **PASSED & MERGED** |
| **Phase 1: Core Pipeline**<br>*(Passed)* | Completed | Crash becomes incident, verified repro-test + fix from CLI | **Gate 1** | ✅ **PASSED (Tag: `gate-1-passed`)** |
| **Phase 2: Staging, Orchestrator, Telegram**<br>*(Passed)* | Completed | Orchestrator daemon, canaries 8001/8002, live SSE stream, Telegram bot | **Gate 2**<br>*(Demo Floor)* | ✅ **PASSED (Tag: `gate-2-passed`)** |
| **Phase 3: Copilot Desktop & Issue Readiness**<br>*(Passed)* | Completed | Pixel-accurate GitHub Copilot Linux UI, Issue-to-PR readiness gate, unified runner daemon | **Gate 3** | ✅ **PASSED (Tag: `gate-3-passed`)** |
| **Phase 4: Rehearsal & Sponsor Hardening**<br>*(5:20 PM – 9:30 PM)* | **4.0 hours** | 3 clean runs in a row; backup demo recording; Adaption AI eval | **Gate 4** | 🟡 **IN PROGRESS (ACTIVE)** |
| **Sleep / Buffer Window**<br>*(1:00 AM – 7:00 AM)* | **6.0 hours** | Team rest & buffer time | — | ⚪ Scheduled |
| **Phase 5: Freeze, Backup Video & Pitch**<br>*(7:00 AM – 9:30 AM)* | **2.5 hours** | Record 3-min backup video, polish pitch slides, rehearse demo | **Done** | ⚪ Queued |
| **Final Submission Freeze**<br>*(9:30 AM – 11:00 AM)* | **1.5 hours** | Final clean demo run, Devfolio submission, project freeze | **Ship** | ⚪ Queued |

---

## 2. Architecture & Stream Division (Zero Conflicts)

```
┌─────────────────────────────────┐   ┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│     Stream A (The Brain)        │   │     Stream B (The Copilot Body) │   │     Stream C (The Comms)        │
├─────────────────────────────────┤   ├─────────────────────────────────┤   ├─────────────────────────────────┤
│ • Worktree: prodpilot-a         │   │ • Worktree: prodpilot-b         │   │ • Directory: prodpilot/telegram │
│ • Branch: stream-a              │   │ • Branch: stream-b              │   │ • Branch: telegram (root-level) │
│ • Pipeline & Antigravity SDK    │   │ • demo-prod (buggy service)     │   │ • Hosted on Visihot cloud server│
│ • Repro-test & Verifier         │   │ • Watcher + Git Blame           │   │ • python-telegram-bot v22.8     │
│ • Orchestrator Daemon           │   │ • Reset & trigger scripts       │   │ • Inline Action Buttons         │
│ • Staging Canaries (8001/8002)  │   │ • GitHub Copilot App Clone UI   │   │ • Public Cloudflare Tunnel link │
│ • FastAPI & SSE API (port 8765) │   │ • Strict GitHub Dark aesthetic  │   │ • 1-Tap Deploy / Rollback       │
└─────────────────────────────────┘   └─────────────────────────────────┘   └─────────────────────────────────┘
```

### Folder Ownership:
- **Stream A**: `backend/prodpilot/pipeline/`, `agents/`, `staging/`, `decide/`, `api/`, `db.py`
- **Stream B**: `demo-prod/`, `backend/prodpilot/watcher/`, `desktop/`, `scripts/`
- **Stream C**: `telegram/` (on branch `telegram`, untracked by `main`, deployed directly by Visihot)

---

## 3. Current Phase: Phase 2 (4:00 PM – 7:30 PM) – Gate 2 (The Demo Floor)

**Goal**: Crash the service with `./scripts/trigger-crash.sh` -> Phone buzzes on Telegram with diagnosis and canary status -> Tap **`[🚀 Deploy Fix (8001)]`** on phone -> Service on port 8000 restored healthy, and an Incident Post-Mortem Report is saved.

### Stream A Tasks (Agent 1 - Brain & Orchestrator):
- [ ] **Orchestrator Daemon (`backend/prodpilot/pipeline/orchestrator.py`)**:
  - Continuously polls SQLite for new incidents in status `OPEN`.
  - Runs Context Brief (`brief.py`) and advances status to `INVESTIGATING`.
  - Runs Repro-First Pipeline (`repro_runner.py` via `AntigravityAdapter`) to generate reproduction test, verify failure on baseline, generate patch, and verify repro + full suite pass.
  - Spawns live canary instances: Fix-forward on `http://127.0.0.1:8001` and Rollback on `http://127.0.0.1:8002`.
  - Runs Decision Engine (`decide/rules.py`) to compute recommendation and confidence.
  - Advances incident status to `AWAITING_APPROVAL` and emits SSE event.
- [x] **Post-Mortem Report Generator (`backend/prodpilot/staging/deploy.py`)**:
  - Implemented `generate_incident_report(...)` saving comprehensive markdown report to SQLite `artifacts` table.
- [ ] **Deploy Adapter Verification**:
  - On `/incidents/{id}/approve`, promotes the chosen canary onto production port 8000.
  - Monitors health for 10s (triggers automatic emergency rollback if health check fails).

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
- [x] **Visihot Entrypoint**: Added `app.py` forwarding to `bot.py` for Pterodactyl container.
- [ ] **Live Approval Action via Cloudflare Tunnel**:
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

## 4. Phase 3: Desktop Dashboard & Polish (7:30 PM – 11:30 PM)

- Desktop Electron app packaging / dev mode verification.
- Agent Follow-Up Panel: allows operator to submit extra instructions ("use dict.get instead of removing schema") and re-runs pipeline on same worktree.
- Read-only GitHub issue sync (if time permits).

---

## 5. Phase 4: Harden & Sponsor Integrations (11:30 PM – 4:00 AM)

- **3 Consecutive Clean Runs**: Trigger crash -> autonomous fix -> deploy -> verify 3 times in a row without manual code edits.
- **Browser Use (Hero Sponsor)**: Autonomous browser-based canary check on `http://localhost:8001/checkout` ensuring visual checkout completion without error screens.
- **Adaption AI ($500 Credits)**: Route LLM brief synthesis and evaluation benchmarking through Adaption AI endpoints.
- **Render (Innovation Partner)**: Optional remote deploy webhook adapter.

---

## 6. Phase 5: Freeze, Backup Video & Pitch (7:00 AM – 11:00 AM)

- **7:00 AM – 8:30 AM**: Record 3-minute demo backup video showing the phone approval and desktop timeline.
- **8:30 AM – 9:30 AM**: Polish pitch slides (highlighting problem, last-mile restart-ready innovation, sponsor tracks, and roadmap).
- **9:30 AM – 10:30 AM**: Dry run pitch twice with the backup video on standby.
- **10:30 AM – 11:00 AM**: Final freeze and Devfolio project submission!
