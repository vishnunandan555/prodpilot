# ProdPilot 3-Agent Execution Plan & Runbook (Phase 2: Gate 2 - The Demo Floor)

This document defines the Phase 2 multi-agent operating procedure for ProdPilot.
Each agent operates in its own isolated worktree or branch with strict folder ownership.

---

## 1. What Has Been Built (Phase 0 & Phase 1 Done & Merged to `main` - Tag `gate-1-passed`)

| Component | Files Built & Merged | Verified Functionality |
|---|---|---|
| **Contracts** | `contracts/schema.sql`, `incident.example.json`, `events.md`, `api.md`, `project.profile.example.yaml`, `agent_interface.py` | Frozen schemas for DB, REST, SSE, and Agent signatures. |
| **Database** | `backend/prodpilot/db.py` | Full SQLite access layer with parameterized queries, Foreign Keys, event logs, and JSON parsing. |
| **Agent Adapters** | `backend/prodpilot/agents/antigravity_adapter.py`, `gemini_adapter.py`, `factory.py` | Primary: Antigravity SDK (`agy` CLI v1.4.6, zero paid Gemini keys required). Fallback: Gemini adapter. |
| **Sandboxing** | `backend/prodpilot/pipeline/worktree.py` | Isolated git worktree creator and cleaner per incident. |
| **Pipeline Engine** | `backend/prodpilot/pipeline/brief.py`, `repro_runner.py` | Autonomous context brief synthesis; failing reproduction test generation on unmodified code; patch synthesis; deterministic verification of repro + full suite. |
| **Staging & Deploy** | `backend/prodpilot/staging/manager.py`, `deploy.py` | Side-port canaries (8001 & 8002); port-swapping deploy adapter with automatic 10s health monitoring and instant rollback. |
| **Decisions** | `backend/prodpilot/decide/rules.py` | Typed decision engine outputting recommendations (fix-forward vs rollback), probabilities, and reasoning. |
| **Backend & Tunnel** | `backend/prodpilot/api/server.py` | FastAPI REST & SSE streaming server on port 8765. Public Cloudflare tunnel active: `https://developing-dimensional-acknowledged-minimal.trycloudflare.com`. |
| **Fake Prod & Scripts** | `demo-prod/`, `scripts/init_demo_prod.py`, `reset-demo.sh`, `trigger-crash.sh` | Realistic order microservice with 5 commits of git history, planted `discount` bug, reset and crash triggers. |
| **Health Watcher** | `backend/prodpilot/watcher/watcher.py` | 5-second health poller; log tail and traceback extraction; git blame suspect commit capture. |
| **Desktop UI** | `desktop/` (Vite + React + Tailwind + Electron) | Complete incident view, diff viewer, test evidence cards, and timeline component compiled and ready. |
| **Telegram Bot** | `telegram/bot.py`, `app.py` (branch: `telegram`) | Interactive incident card with buttons (`[Deploy Fix]`, `[Rollback]`, `[Reject]`), `/status`, `/logs`, `/report`. Verified live with Telegram Bot API! |

---

## 2. What We Are Building Next (Phase 2: Gate 2 – The Demo Floor)

**The Hero Demo Goal**: 
Run `./scripts/trigger-crash.sh` -> Service crashes -> Watcher detects -> Pipeline auto-fixes and stages canaries on 8001 & 8002 -> Telegram buzzes your phone -> You tap **`[🚀 Deploy Fix (8001)]`** on phone -> Service restored healthy, and incident report is generated.

```
[Watcher detects 500 error]
          │
          ▼ (SQLite row: status=OPEN)
┌────────────────────────────────────────────────────────┐
│  AGENT 1 (Stream A): Orchestrator Daemon               │
│  1. Ingests OPEN incidents from SQLite                 │
│  2. Runs brief.py -> repro_runner.py (Antigravity loop)│
│  3. Spawns live canaries on Port 8001 & Port 8002      │
│  4. Runs decide/rules.py (recommendation & confidence) │
│  5. Sets status -> AWAITING_APPROVAL (streams via SSE) │
└────────────────────────────────────────────────────────┘
          │
          ├──────────────────────────────────────────────┐
          ▼                                              ▼
┌───────────────────────────────────┐    ┌───────────────────────────────────┐
│  AGENT 2 (Stream B): Desktop UI   │    │  AGENT 3 (Stream C): Telegram Bot │
│  • Connect live SSE to Timeline   │    │  • Receives incident from backend │
│  • Real-time animation of stages  │    │  • Sends card to your phone       │
│  • Desktop Deploy/Rollback buttons│    │  • User taps [🚀 Deploy Fix]      │
│  • Trigger Crash button in UI     │    │  • Calls POST /approve via tunnel │
└───────────────────────────────────┘    └───────────────────────────────────┘
          │                                              │
          └──────────────────────┬───────────────────────┘
                                 ▼
┌────────────────────────────────────────────────────────┐
│  DEPLOY ADAPTER (Automatic Verification):              │
│  • Promotes staged fix onto production port 8000       │
│  • Verifies health check for 10s                       │
│  • Generates markdown post-mortem report               │
│  • Phone & Desktop show: ✅ PROD RESTORED              │
└────────────────────────────────────────────────────────┘
```

---

## 3. Prompts for the 3 Agent Windows (Phase 2)

Copy-paste each prompt into the corresponding agent window:

---

### 🟢 Window 1: Agent 1 (Stream A – Autonomous Orchestrator Daemon & Deploy Engine)
**Working Directory**: `/home/vishnunandan555/Projects/prodpilot-a`  
**Git Branch**: `stream-a`

```markdown
You are Agent 1 (Stream A - The Brain) for ProdPilot.
Your workspace is `prodpilot-a`. Your task in Phase 2 is to build the autonomous End-to-End Orchestrator Daemon that ties the Watcher, Repro-First Pipeline, Staging, and Decision Engine together.

STRICT BOUNDARY:
- You ONLY work in `backend/prodpilot/pipeline/`, `backend/prodpilot/staging/`, `backend/prodpilot/decide/`, `backend/prodpilot/api/`, and `backend/prodpilot/tests/`.
- DO NOT touch `demo-prod/`, `backend/prodpilot/watcher/`, `desktop/`, or `telegram/`.

TASKS TO EXECUTE:
1. Orchestrator Daemon (`backend/prodpilot/pipeline/orchestrator.py`):
   - Create a continuous loop (`run_orchestrator(poll_interval=2)`) or background task that checks SQLite for incidents with `status == 'OPEN'`.
   - When a new incident arrives:
     a. Transition status to `INVESTIGATING` and log event `stage_started` (`UNDERSTAND`).
     b. Run `create_brief(incident_data)` and update incident brief in DB.
     c. Transition status to `FIXING` and run `run_repro_pipeline(...)` using `AntigravityAdapter`.
        - Ensure a minimal failing test (`tests/test_repro.py`) is written and verified failing.
        - Ensure patch is generated and verified (repro test + full suite green).
        - Save artifacts: `patch_diff`, `repro_test`, `test_evidence`.
     d. Stage Canaries:
        - Call `StagingManager.stage_fix_forward(...)` on side port 8001 and verify canary health.
        - Call `StagingManager.stage_rollback(...)` on side port 8002 and verify canary health.
     e. Run Decision Engine:
        - Call `decide(...)` to compute recommendation ("fix_forward" vs "rollback"), probabilities, and reason.
        - Record decision in `decisions` table.
     f. Transition status to `AWAITING_APPROVAL` and log event `awaiting_approval`.
   - Provide CLI entrypoint: `python -m backend.prodpilot.pipeline.orchestrator --daemon` (or `--once` for single incident execution).

2. Incident Post-Mortem Report Generator (`backend/prodpilot/staging/deploy.py`):
   - When `/incidents/{id}/approve` successfully promotes the build to port 8000:
     - Generate a comprehensive markdown report (`artifacts/incident_report.md`):
       - Incident ID, Service, Timestamp.
       - Root Cause Summary & Suspect Commit (`git blame` details).
       - Reproduction Test & Test Evidence (Before & After).
       - Patch Diff.
       - Canary Health Verification (Ports 8001 & 8002).
       - Who Approved & Source (Telegram / Desktop UI).
     - Save into SQLite `artifacts` table under `kind="incident_report"`.

3. Verification:
   - Add a test script or unit test verifying that when an incident is inserted as `OPEN`, running the orchestrator advances it to `AWAITING_APPROVAL` with staged canaries on 8001/8002.

Commit all code to `stream-a`.
```

---

### 🔵 Window 2: Agent 2 (Stream B – Desktop Live SSE Animation & Control)
**Working Directory**: `/home/vishnunandan555/Projects/prodpilot-b`  
**Git Branch**: `stream-b`

```markdown
You are Agent 2 (Stream B - The Body & UI) for ProdPilot.
Your workspace is `prodpilot-b`. Your task in Phase 2 is to wire up live SSE event streaming to the React desktop app so the entire incident investigation, test execution, and deployment animate live in real-time.

STRICT BOUNDARY:
- You ONLY work in `desktop/`, `scripts/`, and `backend/prodpilot/watcher/`.
- DO NOT touch `backend/prodpilot/pipeline/`, `backend/prodpilot/agents/`, `backend/prodpilot/staging/`, or `telegram/`.

TASKS TO EXECUTE:
1. Live SSE Subscription in Desktop UI (`desktop/src/`):
   - In `desktop/src/App.jsx` and `Timeline.jsx`:
     - Subscribe to `GET http://127.0.0.1:8765/incidents/{activeId}/events` using standard browser `EventSource`.
     - Dynamically animate stages as they occur:
       `UNDERSTAND` -> `REPRODUCE` -> `FIX` -> `VERIFY` -> `STAGE` -> `DECIDE` -> `AWAITING_APPROVAL` -> `DEPLOY` -> `RESOLVED`.
     - Display live tool calls, test execution logs, and diff preview in real time as events arrive.

2. One-Tap Actions & UI Controls:
   - Wire the Desktop `[Deploy Fix]` and `[Rollback]` buttons in `DecisionCard.jsx` / `IncidentDetail.jsx` to call `POST http://127.0.0.1:8765/incidents/{id}/approve`.
   - On deployment success, display a green celebration banner: `✅ PRODUCTION RESTORED (Port 8000: 200 OK)`.
   - Add a header action button in `Header.jsx`: `[💥 Trigger Test Crash]` which calls `/scripts/trigger-crash.sh` or simulates an outage, and `[🔄 Reset Demo]` which calls `/scripts/reset-demo.sh`.

3. Post-Mortem Report Viewer:
   - When incident is in `DEPLOYED` or `RESOLVED` status, render the markdown post-mortem report (fetched from `GET /incidents/{id}`).

4. Verification:
   - Verify `npm run build` succeeds without lint/syntax errors.
   - Run `npm run dev` and confirm UI renders cleanly at `http://localhost:5173`.

Commit all code to `stream-b`.
```

---

### 🟣 Window 3: Agent 3 (Stream C – Visihot Telegram Cloud Bot & Webhook Loop)
**Working Directory**: `/home/vishnunandan555/Projects/prodpilot/telegram`  
**Git Branch**: `telegram` (Dedicated branch for Visihot cloud deployment)

```markdown
You are Agent 3 (Stream C - Visihot Hosted Telegram Bot) for ProdPilot.
Your workspace is `/home/vishnunandan555/Projects/prodpilot/telegram` on the `telegram` branch. Your task in Phase 2 is to ensure the bot deployed on Visihot interacts flawlessly with the live public tunnel and provides immediate phone notifications.

STRICT BOUNDARY:
- You ONLY work inside `/home/vishnunandan555/Projects/prodpilot/telegram`.
- All bot files MUST stay at the root of this folder (`app.py`, `bot.py`, `requirements.txt`).
- Commits are pushed directly to `origin telegram`.

TASKS TO EXECUTE:
1. Visihot Entrypoint & Reconnect Resilience (`app.py`, `bot.py`):
   - Visihot launches `app.py`. Ensure `app.py` has robust retry/reconnect logic if the public tunnel URL is temporarily unavailable on boot.
   - Use exponential backoff for backend API requests (`httpx.ConnectError`, `httpx.TimeoutException`).

2. Instant Notification on `AWAITING_APPROVAL`:
   - Enhance the polling loop in `bot.py`:
     - Every 3 seconds, query `${PRODPILOT_API_URL}/incidents?status=AWAITING_APPROVAL`.
     - When a new incident is detected:
       - Send the formatted card to `TELEGRAM_ALLOWED_CHAT_ID`:
         - 🚨 **PRODUCTION INCIDENT DETECTED**
         - Root Cause & Suspect Commit (`git blame` details)
         - Staged Canary status (Port 8001: 🟢 Healthy | Port 8002: 🟢 Healthy)
         - AI Recommendation with confidence percentage
         - Inline buttons: `[🚀 Deploy Fix (8001)]`, `[⏪ Rollback (8002)]`, `[❌ Reject]`

3. Action Execution & Live Feedback:
   - When the user taps `[🚀 Deploy Fix (8001)]` on Telegram:
     - Immediately edit message to: `⏳ Deploying fix to production port 8000...`
     - Call `${PRODPILOT_API_URL}/incidents/{id}/approve` with `{"action": "fix_forward", "source": "telegram"}`.
     - On 200 OK: Edit message to: `✅ PROD RESTORED - Healthcheck 200 OK. Fix deployed successfully.`
     - Append the incident report summary.

4. Multi-Channel Preview (Discord Bot Adapter Skeleton - Optional):
   - In `discord_bot.py` (optional extra), provide an equivalent Discord webhook/bot listener using `discord.py` that posts the incident card and approval buttons into a Discord channel.

5. Verification:
   - Run `python3 bot.py --dry-run` to ensure all handlers, formatters, and buttons pass verification.
   - Commit and push to `origin telegram`:
     `git add . && git commit -m "feat(telegram): phase 2 resilient cloud poller and live approval loop" && git push origin telegram`

```

---

## 4. Phase 2 Gate 2 Merge & Demo Protocol

When all 3 agents finish:
```bash
# In /home/vishnunandan555/Projects/prodpilot (main)
git merge stream-a -m "merge: Stream A Phase 2 (Orchestrator Daemon & Post-Mortem Report)"
git merge stream-b -m "merge: Stream B Phase 2 (Desktop Live SSE Timeline & Controls)"
git tag gate-2-passed
```

**Run the 3-Minute Demo**:
1. Terminal 1: `.venv/bin/python backend/prodpilot/watcher/watcher.py`
2. Terminal 2: `.venv/bin/python -m backend.prodpilot.pipeline.orchestrator --daemon`
3. Terminal 3: `./scripts/trigger-crash.sh`
4. Phone buzzes -> Tap **Deploy Fix** on Telegram -> Service restored -> Report saved!
