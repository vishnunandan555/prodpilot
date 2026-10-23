# ProdPilot 3-Agent Execution Plan & Runbook (Phase 3: Copilot Desktop & Readiness Gate)

This document defines the Phase 3 multi-agent operating procedure for ProdPilot.
Each agent operates in its own isolated worktree or branch with strict folder ownership.

---

## 1. What Has Been Built & Merged to `main` (Phase 0, 1 & 2 Passed)

| Component | Files Built & Merged | Verified Functionality |
|---|---|---|
| **Contracts** | `contracts/schema.sql`, `incident.example.json`, `events.md`, `api.md`, `project.profile.example.yaml`, `agent_interface.py` | Frozen schemas for DB, REST, SSE, and Agent signatures. |
| **Database** | `backend/prodpilot/db.py` | SQLite layer with Foreign Keys, event logs, and JSON parsing. |
| **Agent Adapters** | `backend/prodpilot/agents/antigravity_adapter.py`, `gemini_adapter.py`, `factory.py` | Primary: Antigravity SDK (`agy` CLI v1.4.6, zero paid Gemini keys required). Fallback: Gemini adapter. |
| **Sandboxing** | `backend/prodpilot/pipeline/worktree.py` | Isolated git worktree creator and cleaner per incident. |
| **Pipeline Engine** | `backend/prodpilot/pipeline/brief.py`, `repro_runner.py` | Autonomous context brief synthesis; failing reproduction test generation on unmodified code; patch synthesis; deterministic verification of repro + full suite. |
| **Staging & Deploy** | `backend/prodpilot/staging/manager.py`, `deploy.py` | Side-port canaries (8001 & 8002); port-swapping deploy adapter with automatic health monitoring, instant rollback, and post-mortem report generation. |
| **Orchestrator** | `backend/prodpilot/pipeline/orchestrator.py` | Continuous daemon connecting watcher OPEN incidents to repro-runner, staging, and decision engine. Verified via pytest! |
| **Decisions** | `backend/prodpilot/decide/rules.py` | Typed decision engine outputting recommendations (fix-forward vs rollback), probabilities, and reasoning. |
| **Backend & Tunnel** | `backend/prodpilot/api/server.py` | FastAPI REST & SSE streaming server on port 8765. Public Cloudflare tunnel active. |
| **Fake Prod & Scripts** | `demo-prod/`, `scripts/init_demo_prod.py`, `reset-demo.sh`, `trigger-crash.sh` | Realistic order microservice with 5 commits of git history, planted `discount` bug, reset and crash triggers. |
| **Health Watcher** | `backend/prodpilot/watcher/watcher.py` | 5-second health poller; log tail and traceback extraction; git blame suspect commit capture. |
| **Desktop UI Base** | `desktop/` (Vite + React) | Live SSE timeline, diff viewer, test evidence, post-mortem report viewer merged and functional. |
| **Telegram Bot** | `telegram/bot.py`, `app.py` (branch: `telegram`) | Interactive incident card with buttons (`[Deploy Fix]`, `[Rollback]`), `/status`, `/logs`, `/report`. Verified live with Visihot Pterodactyl! |

---

## 2. What We Are Building Next (Phase 3: Copilot Desktop & Issue Readiness Gate)

Phase 2 passed and merged cleanly into `main`!
- The autonomous orchestrator loop (`orchestrator.py`), post-mortem generator (`deploy.py`), and test suite are all verified.
- The live Telegram bot is deployed and active on Visihot (`@prodpilotbot`).

Now in Phase 3, we execute across 3 non-conflicting workstreams:

```
┌────────────────────────────────────────────────────────┐
│  AGENT 2 (Current Window - Stream B):                  │
│  GitHub Copilot Desktop App Redesign                   │
│  • Directory: desktop/                                 │
│  • Pixel-accurate GitHub Copilot Linux Dark UI         │
│  • Matte #0d1117/#161b22, #30363d borders, #238636 CTA │
│  • Sessions tree, Issues split-view, Automations view  │
│  • Right drawer: Changes diff, Browser canary, Terminal│
│  • Live SSE timeline + 1-tap deploy/rollback controls  │
└────────────────────────────────────────────────────────┘
          │ (Zero directory overlaps)
          ├──────────────────────────────────────────────┐
          ▼                                              ▼
┌───────────────────────────────────┐    ┌───────────────────────────────────┐
│  AGENT 1 (Stream A - Window 1):   │    │  AGENT 3 (Stream C - Window 3):   │
│  Issue Readiness Gate & Daemon    │    │  Visihot Telegram Bot Supercharge │
│  • Worktree: prodpilot-a          │    │  • Branch: telegram (root level)  │
│  • Pull latest main               │    │  • Pull latest origin/telegram    │
│  • Issue Readiness Gate:          │    │  • Proactive phone push alert on  │
│    brief.py outputs ready:yes/no  │    │    status AWAITING_APPROVAL       │
│    vague issues get clarifying Qs │    │  • /issues command to list open   │
│  • scripts/start-all.sh runner:   │    │    issues with readiness grades   │
│    API + Watcher + Orchestrator   │    │  • Render markdown post-mortem    │
│  • POST /issues/{id}/analyze      │    │    report in Telegram via /report │
└───────────────────────────────────┘    └───────────────────────────────────┘
```

---

## 3. Prompts for the 2 Background Agents (Phase 3)

Copy-paste each prompt into the corresponding agent window while the main window builds the Copilot UI:

---

### 🟢 Window 1: Agent 1 (Stream A – Issue Readiness Gate & Unified Daemon)
**Working Directory**: `/home/vishnunandan555/Projects/prodpilot-a`  
**Git Branch**: `stream-a`

```markdown
You are Agent 1 (Stream A - The Brain) for ProdPilot.
First, pull latest main:
`git fetch origin && git merge main --no-edit`

Your workspace is `prodpilot-a`. Your task in Phase 3 is:
1. Issue Readiness Gate (`backend/prodpilot/pipeline/brief.py`):
   - Add `analyze_issue_readiness(issue_data: dict) -> dict`:
     - Checks if issue text contains reproduction steps, expected behavior, and error trace.
     - Returns: `{"ready": bool, "clarifying_questions": list[str], "task_summary": str, "suspected_area": str}`
     - If `ready is False`: Generates a polite, precise markdown comment asking for missing information rather than launching an expensive patch agent.
   - Add REST endpoints in `backend/prodpilot/api/server.py`:
     - `POST /issues/{id}/analyze`: Runs readiness gate, caches brief in SQLite `briefs` table, and returns result.
     - `POST /issues/{id}/clarify`: Posts the clarifying questions as an agent comment to the issue.
2. Unified Production Daemon (`scripts/start-all.sh` & `scripts/stop-all.sh`):
   - `scripts/start-all.sh`:
     - Checks and starts `demo-prod` on port 8000.
     - Starts FastAPI server on port 8765 (`uvicorn backend.prodpilot.api.server:app`).
     - Starts watcher poller (`backend/prodpilot/watcher/watcher.py`).
     - Starts orchestrator daemon (`python -m backend.prodpilot.pipeline.orchestrator --daemon`).
     - Prints active URLs and PIDs.
   - `scripts/stop-all.sh`:
     - Gracefully terminates all background PIDs.
3. Unit & Integration Tests:
   - Add `backend/prodpilot/tests/test_readiness.py` testing ready issue vs ambiguous issue.
   - Run `PYTHONPATH=. .venv/bin/pytest backend/prodpilot/tests/ -v`.
4. Commit:
   `git commit -am "feat(stream-a): issue readiness gate and unified daemon runner scripts"`
```

---

### 🔵 Window 3: Agent 3 (Stream C – Visihot Telegram Cloud Bot Supercharge)
**Working Directory**: `/home/vishnunandan555/Projects/prodpilot/telegram`  
**Git Branch**: `telegram`

```markdown
You are Agent 3 (Stream C - The Comms) for ProdPilot.
First, pull latest telegram branch:
`git pull origin telegram`

Your workspace is `telegram/` on branch `telegram`. Your task in Phase 3 is:
1. Proactive Phone Alert on `AWAITING_APPROVAL`:
   - Verify that the background polling loop in `bot.py` sends an alert card to `TELEGRAM_ALLOWED_CHAT_ID` (`8787477099`) within 3 seconds of an incident transitioning to `AWAITING_APPROVAL`.
   - Card includes:
     - 🚨 **CRITICAL INCIDENT DETECTED**
     - Suspect Commit & Culprit (`git blame`)
     - Canary Status (8001 Fix-Forward 🟢 | 8002 Rollback 🟢)
     - Inline Buttons: `[🚀 Deploy Fix (8001)]` `[⏪ Rollback (8002)]`
2. 1-Tap Deployment Confirmation:
   - When user taps `[🚀 Deploy Fix (8001)]`:
     - Call `${PRODPILOT_API_URL}/incidents/{id}/approve` with `{"action": "fix_forward", "source": "telegram"}` via tunnel.
     - Edit message to confirm:
       `✅ PRODUCTION RESTORED ON PORT 8000`
       `Canary 8001 promoted. Health check 200 OK verified.`
3. Post-Mortem Report Command (`/report`):
   - Add `/report` handler in `bot.py`:
     - Calls `${PRODPILOT_API_URL}/incidents/{id}` or retrieves the latest artifact.
     - Sends the formatted markdown post-mortem summary directly to the Telegram chat.
4. Verify & Push:
   - Run `python3 bot.py --dry-run` or syntax check.
   - Commit and push to origin:
     `git commit -am "feat(telegram): proactive approval card, 1-tap deploy, and /report command"`
     `git push origin telegram`
```

---

## 4. Phase 3 Gate 3 Verification Protocol
1. Start unified daemon: `./scripts/start-all.sh`.
2. Open Desktop Copilot App at `http://localhost:5173`.
3. Test Issue Mode: Inspect issue, view Readiness Gate evaluation (`ready: yes/no`), launch session.
4. Test Incident Mode: Run `./scripts/trigger-crash.sh` -> watch live Copilot chat stream animate -> approve via phone or desktop -> post-mortem report displayed.
