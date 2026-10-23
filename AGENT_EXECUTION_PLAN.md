# ProdPilot 3-Agent Execution Plan & Runbook

This document defines the 3-agent parallel operating procedure for ProdPilot.
Each agent operates in its own isolated worktree or branch with strict folder ownership.

---

## 1. Multi-Agent Architecture & Strict Boundaries

```
┌─────────────────────────────────┐   ┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│     Agent 1: Stream A           │   │     Agent 2: Stream B           │   │     Agent 3: Stream C           │
│     (The Brain / Engine)        │   │     (The Body & UI)             │   │     (Visihot Telegram Bot)      │
├─────────────────────────────────┤   ├─────────────────────────────────┤   ├─────────────────────────────────┤
│ • Worktree: prodpilot-a         │   │ • Worktree: prodpilot-b         │   │ • Directory: prodpilot/telegram │
│ • Branch: stream-a              │   │ • Branch: stream-b              │   │ • Branch: telegram (root-level) │
│ • Pipeline & Agent loop         │   │ • demo-prod (buggy service)     │   │ • Untracked by main git repo    │
│ • Repro-test & Verifier         │   │ • Watcher + Git Blame           │   │ • python-telegram-bot           │
│ • Staging & Deploy Adapter      │   │ • Reset & trigger scripts       │   │ • Inline Action Buttons         │
│ • FastAPI & SSE API (port 8765) │   │ • Electron + React Dashboard    │   │ • Deploys directly on Visihot   │
└─────────────────────────────────┘   └─────────────────────────────────┘   └─────────────────────────────────┘
```

### Strict Folder Ownership:
| Agent | Directory / Scope Owned | Strictly Forbidden |
|---|---|---|
| **Agent 1** (Brain) | `backend/prodpilot/pipeline/`<br>`backend/prodpilot/agents/`<br>`backend/prodpilot/staging/`<br>`backend/prodpilot/decide/`<br>`backend/prodpilot/api/`<br>`backend/prodpilot/db.py` | `demo-prod/`<br>`backend/prodpilot/watcher/`<br>`desktop/`<br>`scripts/`<br>`telegram/` |
| **Agent 2** (Body & UI) | `demo-prod/` (separate git repo inside `demo-prod`)<br>`backend/prodpilot/watcher/`<br>`desktop/` (Electron + React)<br>`scripts/` | `backend/prodpilot/pipeline/`<br>`backend/prodpilot/agents/`<br>`backend/prodpilot/staging/`<br>`telegram/` |
| **Agent 3** (Telegram) | `telegram/` (on branch `telegram`, untracked by `main`) | Any file outside `telegram/` |

---

## 2. Directory & Git Setup

All worktrees and branches are initialized:
- **Main Coordinator**: `/home/vishnunandan555/Projects/prodpilot` (branch: `main`)
- **Window 1 (Agent 1)**: `/home/vishnunandan555/Projects/prodpilot-a` (branch: `stream-a`)
- **Window 2 (Agent 2)**: `/home/vishnunandan555/Projects/prodpilot-b` (branch: `stream-b`)
- **Window 3 (Agent 3)**: `/home/vishnunandan555/Projects/prodpilot/telegram` (branch: `telegram`)

### How Visihot Telegram Deployment Works:
1. Agent 3 works entirely inside `/home/vishnunandan555/Projects/prodpilot/telegram`.
2. When Agent 3 commits and pushes:
   ```bash
   cd /home/vishnunandan555/Projects/prodpilot/telegram
   git push origin telegram
   ```
3. In the Visihot dashboard, select repository: `vishnunandan555/prodpilot`, choose branch: `telegram`, and click **Deploy**! Visihot will run `bot.py` right from the root of that branch.

---

## 3. Prompts for the 3 Agent Windows

Copy-paste each prompt into the corresponding agent window:

---

### Window 1: Agent 1 (Stream A – The Brain / Engine)
**Working Directory**: `/home/vishnunandan555/Projects/prodpilot-a`  
**Git Branch**: `stream-a`

```markdown
You are Agent 1 (Stream A - The Brain) for ProdPilot.
Your workspace is `prodpilot-a`. Your job is to build the backend pipeline, agent loop, deterministic verifier, staging canaries, and the FastAPI/SSE server.

STRICT BOUNDARY:
- You ONLY work in `backend/prodpilot/pipeline/`, `backend/prodpilot/agents/`, `backend/prodpilot/staging/`, `backend/prodpilot/decide/`, `backend/prodpilot/api/`, and `backend/prodpilot/db.py`.
- DO NOT touch `demo-prod/`, `backend/prodpilot/watcher/`, `desktop/`, or `telegram/`.
- Contracts in `contracts/` are FROZEN. Read `contracts/schema.sql`, `contracts/incident.example.json`, `contracts/api.md`, and `contracts/agent_interface.py`.

TASKS TO EXECUTE:
1. Agent Adapter (`backend/prodpilot/agents/`):
   - Implement `antigravity_adapter.py` conforming to `contracts/agent_interface.py`.
   - Provide fallback `gemini_adapter.py` supporting `read_file`, `write_file`, `list_dir`, `grep_search`. Gate arbitrary shell commands so verifier remains deterministic.

2. Worktree Manager (`backend/prodpilot/pipeline/worktree.py`):
   - Helper to create temporary git worktrees (`git worktree add <dir> HEAD`) and cleanly remove them (`git worktree remove --force <dir>`).

3. Context Brief & Repro-First Pipeline (`backend/prodpilot/pipeline/`):
   - `brief.py`: Extract structured brief from incident JSON (suspect area, suspect commit analysis).
   - `repro_runner.py`:
     1. Agent writes minimal reproduction test (`tests/test_repro.py`).
     2. Verifier runs test: MUST FAIL on baseline code (if it passes, re-prompt).
     3. Agent modifies code in worktree to fix bug.
     4. Verifier runs repro test AND full test suite.
     5. Bounded retry: max 2 attempts on test failure with error logs fed back to agent.

4. Staging & Deploy Adapter (`backend/prodpilot/staging/`):
   - `manager.py`:
     - Fix-forward: Runs patched build on side port 8001, verifies canary `http://127.0.0.1:8001/health`.
     - Rollback: In a worktree, runs `git revert <suspect_commit>` without committing, runs tests, starts on side port 8002, verifies canary `http://127.0.0.1:8002/health`.
   - `deploy.py`: On approval, swaps build onto production port 8000, checks health for 10s, auto-reverts if health fails.

5. Decision Layer (`backend/prodpilot/decide/rules.py`):
   - `decide(incident, staging_status)` -> recommendations ("fix_forward" vs "rollback"), probabilities, and reason.

6. FastAPI REST & SSE Server (`backend/prodpilot/api/`):
   - Run on port 8765 matching `contracts/api.md`:
     - `GET /health`
     - `GET /incidents`
     - `GET /incidents/{id}`
     - `GET /incidents/{id}/events` (SSE stream from `run_events`)
     - `POST /incidents/{id}/approve` (executes deploy adapter for "fix_forward" or "rollback")
     - `POST /incidents/{id}/reject`

EXIT CHECK:
Run a complete test script: create mock incident in DB -> run pipeline -> stage on 8001/8002 -> trigger approval via API endpoint -> verify clean deployment. Commit all code to `stream-a`.
```

---

### Window 2: Agent 2 (Stream B – The Body / Fake Production & Desktop UI)
**Working Directory**: `/home/vishnunandan555/Projects/prodpilot-b`  
**Git Branch**: `stream-b`

```markdown
You are Agent 2 (Stream B - The Body & UI) for ProdPilot.
Your workspace is `prodpilot-b`. Your job is to build the fake production service (`demo-prod`), demo control scripts, the health watcher with git blame capture, and the Electron+React dashboard.

STRICT BOUNDARY:
- You ONLY work in `demo-prod/`, `backend/prodpilot/watcher/`, `desktop/`, and `scripts/`.
- DO NOT touch `backend/prodpilot/pipeline/`, `backend/prodpilot/agents/`, `backend/prodpilot/staging/`, or `telegram/`.
- Use `backend/prodpilot/db.py` to insert incidents into SQLite.

TASKS TO EXECUTE:
1. Build `demo-prod` Service (`demo-prod/`):
   - A standalone FastAPI/Flask microservice (Order Total service).
   - Initialize as a git repo with 5 realistic commits:
     1: init order api
     2: add item pricing
     3: add tax calculation
     4: add authentication middleware
     5: feat: add discount support to order checkout (PLANTED BUG: accessing order['discount'] directly causing KeyError on standard orders without discounts).
   - Endpoints: `GET /health`, `POST /orders`, `GET /orders/history`.
   - Tests: `pytest` suite covering standard orders.
   - Logging: writes to `service.log` with timestamp, level, tracebacks.

2. Demo Scripts (`scripts/`):
   - `scripts/trigger-crash.sh`: Sends POST request without `discount` key, causing an unhandled 500 error and healthcheck failure.
   - `scripts/reset-demo.sh`: Resets `demo-prod` git repo back to the buggy commit and restarts the service on port 8000.

3. Health Watcher & Git Blame Capture (`backend/prodpilot/watcher/watcher.py`):
   - Polls `GET http://127.0.0.1:8000/health` every 5 seconds.
   - 2 consecutive failures OR process exit triggers incident creation.
   - Capture engine:
     - Extracts traceback from `service.log`.
     - Pulls last 200 lines of `service.log`.
     - Runs `git log -n 5 --oneline` in `demo-prod`.
     - Runs `git blame` on traceback file/line in `demo-prod` to identify `suspect_commit`, author, and minutes elapsed since commit.
   - Saves incident to SQLite via `backend/prodpilot/db.py:create_incident(...)`.

4. Desktop Dashboard (`desktop/`):
   - Electron shell wrapping React (Vite + React + Vanilla CSS or Tailwind).
   - Talks to backend API at `http://127.0.0.1:8765`.
   - Screens:
     - Incident List: Shows open incidents, status badges.
     - Incident View:
       - Incident Brief card & suspect commit badge.
       - Live Event Timeline (subscribing to `/incidents/{id}/events` SSE).
       - Before / After test evidence card.
       - Diff viewer for generated patch.
       - Decision Recommendation Card (probabilities for fix-forward vs rollback).
       - `[Deploy Fix]` and `[Rollback]` approval buttons calling `POST /incidents/{id}/approve`.

EXIT CHECK:
Start `demo-prod`, run `trigger-crash.sh`, verify watcher creates populated incident row in SQLite with suspect commit within 10s. Start desktop app to display incident view. Commit all code to `stream-b`.
```

---

### Window 3: Agent 3 (Stream C – Visihot Hosted Telegram Bot)
**Working Directory**: `/home/vishnunandan555/Projects/prodpilot/telegram`  
**Git Branch**: `telegram` (Standalone branch for Visihot deployment)

```markdown
You are Agent 3 (Stream C - Visihot Hosted Telegram Bot) for ProdPilot.
Your workspace is `/home/vishnunandan555/Projects/prodpilot/telegram`.
This workspace is on a dedicated git branch called `telegram` and is completely untracked by the main repository. When committed and pushed to `origin telegram`, Visihot will deploy this branch directly!

STRICT BOUNDARY:
- You ONLY work inside `/home/vishnunandan555/Projects/prodpilot/telegram`.
- All bot files MUST stay at the root of this folder (`bot.py`, `requirements.txt`, etc.) because Visihot executes from root.
- You communicate with ProdPilot through the REST/SSE API described in `contracts/api.md` (default: `http://127.0.0.1:8765` or configured via `PRODPILOT_API_URL`).

TASKS TO EXECUTE:
1. Standalone Telegram Bot (`bot.py`):
   - Build with `python-telegram-bot` (v20+ async) or `aiogram`.
   - Read configurations from `.env` or environment variables:
     - `TELEGRAM_BOT_TOKEN`: Bot token from @BotFather.
     - `TELEGRAM_ALLOWED_CHAT_ID`: Restrict bot strictly to your own chat ID for security.
     - `PRODPILOT_API_URL`: URL to ProdPilot backend (default `http://127.0.0.1:8765`).
     - `POLL_INTERVAL`: Interval in seconds to poll for incidents needing approval (default: 3).

2. Incident Notification Card:
   - When an incident reaches `AWAITING_APPROVAL`:
     - Send formatted Telegram message with Markdown:
       - 🚨 **PRODUCTION INCIDENT DETECTED**
       - **Service**: `demo-prod`
       - **Root Cause**: `KeyError: 'discount'` in `app.py:45`
       - **Suspect Commit**: `a1b2c3d` by Vishnu Nandan (15 min ago)
       - **Evidence**: Repro test failed before fix, passed after. Full suite green.
       - **Canary Status**: Staged Fix (Port 8001: 🟢 Healthy) | Staged Rollback (Port 8002: 🟢 Healthy)
       - **Recommendation**: Fix-Forward (85% confidence) vs Rollback (15%)
     - Inline Keyboard Buttons:
       - `[🚀 Deploy Fix (8001)]` (callback: `approve_fix_<id>`)
       - `[⏪ Rollback (8002)]` (callback: `approve_rollback_<id>`)
       - `[❌ Reject]` (callback: `reject_<id>`)

3. Interactive Button Actions:
   - When user taps `[🚀 Deploy Fix]`:
     - Call `POST ${PRODPILOT_API_URL}/incidents/{id}/approve` with `{"action": "fix_forward", "source": "telegram"}`.
     - Edit message to: "⏳ Deploying fix to port 8000...".
     - On completion: Edit message to "✅ **PROD RESTORED** - Healthcheck 200 OK. Fix deployed successfully."
   - When user taps `[⏪ Rollback]`:
     - Call `POST .../approve` with `{"action": "rollback", "source": "telegram"}`.
     - On completion: Edit message to "✅ **ROLLED BACK** - Reverted suspect commit. Healthcheck 200 OK."

4. Telegram Commands:
   - `/start`: Welcome message with current connection status to ProdPilot.
   - `/status`: Queries `GET /health` and `GET /incidents` to show active incident status.
   - `/logs`: Fetches last 20 lines of service log for the active incident.
   - `/report`: Sends the markdown incident report summary.

5. Visihot Server Execution Package:
   - Ensure `requirements.txt` has: `python-telegram-bot>=20.0`, `httpx>=0.25.0`, `python-dotenv>=1.0.0`.
   - Ensure `start.sh` is executable (`chmod +x start.sh`).
   - Include a lightweight mock mode (`python3 bot.py --mock`) so the bot can be tested immediately with sample incidents and interactive buttons before Agent 1 launches the API.

EXIT CHECK:
Run `python3 bot.py --mock` (or against live API), verify the bot sends the interactive incident card with Deploy and Rollback buttons to your Telegram chat, and tapping the button confirms the action.
Commit all code to the `telegram` branch:
`git add . && git commit -m "feat(telegram): complete interactive incident bot for Visihot" && git push origin telegram`
```

---

## 4. Gate Merging Protocol

When Agent 1 and Agent 2 finish their Phase tasks:
```bash
# In /home/vishnunandan555/Projects/prodpilot (main)
git merge stream-a -m "merge: Stream A Phase 1 complete"
git merge stream-b -m "merge: Stream B Phase 1 complete"
git tag gate-1-passed
```
Agent 3 pushes directly to the `telegram` branch (`git push origin telegram`), which Visihot deploys directly.
