# ProdPilot Multi-Agent Execution Plan & Runbook

This document defines the strict multi-agent parallel operating procedure for ProdPilot.
Each agent operates in its own isolated git worktree / terminal window with hard directory boundaries.

---

## 1. Ground Rules (Zero Conflicts)

1. **Folder Ownership**:
   - **Stream A (The Brain)**: `backend/prodpilot/pipeline/`, `agents/`, `staging/`, `decide/`, `api/`, `db.py`
   - **Stream B (The Body/Comms)**: `demo-prod/` (separate git repo), `backend/prodpilot/watcher/`, `telegram/`, `desktop/`, `scripts/`
2. **Frozen Contracts**: All interfaces live in `contracts/`. No agent may edit files in `contracts/` without approval.
3. **Mock-Driven Decoupling**:
   - Stream A builds against `contracts/incident.example.json` without waiting for Stream B's watcher.
   - Stream B builds Telegram and UI against mock database rows and SQLite without waiting for Stream A's LLM pipeline.
4. **Merge Only at Gates**:
   - Work happens in branches `stream-a` and `stream-b`.
   - Merges happen at Gate 0, Gate 1, Gate 2, and Gate 3.

---

## 2. Worktree Setup (Execute Once in Terminal)

Run these commands in your bash terminal to create isolated worktrees for the two agent windows:

```bash
# 1. Commit Phase 0 contracts to main
git add .
git commit -m "chore(contracts): freeze Phase 0 contracts, db schema and directory layout"

# 2. Create branches
git branch -f stream-a main
git branch -f stream-b main

# 3. Create independent worktrees outside the main repo folder
git worktree add ../prodpilot-a stream-a
git worktree add ../prodpilot-b stream-b
```

- **Window 1 (Agent 1 - Stream A)**: Open directory `../prodpilot-a`
- **Window 2 (Agent 2 - Stream B)**: Open directory `../prodpilot-b`

---

## 3. Phase Timeline & Gates

```
Phase 0 (0-2h)   ──► Gate 0: SDK spike passes, Telegram hello button works, demo-prod crashed & reset
Phase 1 (2-8h)   ──► Gate 1: Incident auto-captured, CLI pipeline generates verified repro test & fix
Phase 2 (8-14h)  ──► Gate 2: (DEMO FLOOR) Crash service -> Phone Telegram message -> Tap Deploy Fix -> Service healthy
Phase 3 (14-19h) ──► Gate 3: Desktop UI & live SSE stream drive the same incident resolution
Phase 4 (19-22h) ──► Gate 4: 3 clean consecutive runs from reset without manual code edits
```

---

## 4. Agent 1 (Stream A: The Brain) Execution Prompts

### Agent 1 - Prompt for Phase 0 & Phase 1
> **Working Directory**: `../prodpilot-a`  
> **Copy-paste this prompt into Agent 1's window:**

```markdown
You are Agent 1 (Stream A - The Brain) for ProdPilot.
Your workspace is `prodpilot-a`. Your job is to build the backend pipeline, agent loop, and deterministic verifier.

STRICT BOUNDARY:
- You ONLY work in `backend/prodpilot/pipeline/`, `backend/prodpilot/agents/`, `backend/prodpilot/db.py`, and test scripts.
- DO NOT touch or create files in `demo-prod/`, `backend/prodpilot/watcher/`, `backend/prodpilot/telegram/`, or `desktop/`.
- Contracts in `contracts/` are FROZEN. Read `contracts/schema.sql`, `contracts/incident.example.json`, and `contracts/agent_interface.py`.

TASKS TO EXECUTE:
1. Phase 0 Spike:
   - Check if `google-antigravity` or `google-genai` is available.
   - Implement `backend/prodpilot/agents/antigravity_adapter.py` conforming to `contracts/agent_interface.py`.
   - Provide a fallback tool loop in `backend/prodpilot/agents/gemini_adapter.py` that supports tools: `read_file`, `write_file`, `list_dir`, `grep_search`. Gate/restrict arbitrary shell execution.

2. Worktree Manager (`backend/prodpilot/pipeline/worktree.py`):
   - Helper to create a temporary git worktree for a target repo (e.g. `git worktree add <temp_dir> HEAD`) and cleanly remove it (`git worktree remove --force <temp_dir>`).

3. Context Brief Step (`backend/prodpilot/pipeline/brief.py`):
   - Given an incident JSON (like `contracts/incident.example.json`), generate structured JSON: summary, suspect_area, suspect_commit_analysis, proposed_repro_approach.

4. Repro-First Pipeline (`backend/prodpilot/pipeline/repro_runner.py`):
   - Step 1: Instruct agent to write a minimal failing reproduction test (e.g. `tests/test_repro.py`) based on traceback/logs.
   - Step 2: Deterministic Verifier runs `pytest tests/test_repro.py`. It MUST FAIL on baseline code. If it passes, discard and reprompt.
   - Step 3: Agent edits application code to fix the bug.
   - Step 4: Deterministic Verifier runs `pytest tests/test_repro.py` AND the full test suite.
   - Step 5: If full suite fails, feed error back to agent (max 2 retries).

5. CLI Entrypoint (`backend/prodpilot/pipeline/cli.py`):
   - Run: `python -m prodpilot.pipeline.cli --incident contracts/incident.example.json --repo <repo_path>`
   - Print proof: Test FAILED before fix, PASSED after fix, and output diff.

EXIT CHECK:
Run the CLI against a sample test repository and prove that a failing test is written first, verified failing, patched, and verified passing. Commit all code to `stream-a`.
```

---

## 5. Agent 2 (Stream B: The Body & Comms) Execution Prompts

### Agent 2 - Prompt for Phase 0 & Phase 1
> **Working Directory**: `../prodpilot-b`  
> **Copy-paste this prompt into Agent 2's window:**

```markdown
You are Agent 2 (Stream B - The Body & Comms) for ProdPilot.
Your workspace is `prodpilot-b`. Your job is to build the fake production service (`demo-prod`), the health watcher with git blame capture, and the Telegram bot.

STRICT BOUNDARY:
- You ONLY work in `demo-prod/`, `backend/prodpilot/watcher/`, `backend/prodpilot/telegram/`, and `scripts/`.
- DO NOT edit `backend/prodpilot/pipeline/`, `backend/prodpilot/agents/`, or `contracts/`.
- Use `backend/prodpilot/db.py` to insert incidents and log events.

TASKS TO EXECUTE:
1. Build `demo-prod` Service (`../demo-prod` or subfolder `demo-prod/`):
   - A standalone FastAPI/Flask microservice (Order Total service).
   - Initialize as a git repo with 5 realistic commits:
     1: init order api
     2: add item pricing
     3: add tax calculation
     4: add authentication middleware
     5: feat: add discount support to order checkout (PLANTED BUG: accessing order['discount'] directly causing KeyError on standard orders without discounts).
   - Endpoints: `GET /health`, `POST /orders`, `GET /orders/history`.
   - Tests: `pytest` test suite covering basic orders (which pass on commit 4, fail on bad payload).
   - Logging: writes to `service.log` with timestamp, level, tracebacks.

2. Demo Scripts (`scripts/`):
   - `scripts/trigger-crash.sh`: Sends a POST request without `discount` key, causing an unhandled 500 error and healthcheck failure.
   - `scripts/reset-demo.sh`: Resets `demo-prod` git repo back to the buggy commit and restarts the service on port 8000.

3. Health Watcher & Incident Capture (`backend/prodpilot/watcher/watcher.py`):
   - Polls `GET http://127.0.0.1:8000/health` every 5 seconds.
   - 2 consecutive failures OR process death triggers incident capture.
   - Capture engine:
     - Extracts the traceback from `service.log`.
     - Grabs last 200 lines of `service.log`.
     - Runs `git log -n 5 --oneline` in `demo-prod`.
     - Runs `git blame` on the traceback file/line in `demo-prod` to identify `suspect_commit`, author, and minutes elapsed since commit.
   - Saves incident to SQLite via `backend/prodpilot/db.py:create_incident(...)`.

4. Telegram Bot Skeleton (`backend/prodpilot/telegram/bot.py`):
   - Uses `python-telegram-bot` with long polling.
   - Reads `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` from environment.
   - Sends a test alert message with inline buttons: `[Deploy Fix]`, `[Rollback]`, `[Reject]`.
   - Clicking a button prints the callback data.

EXIT CHECK:
1. Start `demo-prod`, run `trigger-crash.sh`, ensure the watcher detects failure within 10s and writes a populated incident row to SQLite with the suspect commit identified.
2. Run `python -m prodpilot.telegram.bot` and receive an inline button on Telegram.
Commit all code to `stream-b`.
```

---

## 6. Phase 2 Prompts (Staging, Decisions, Telegram Action Loop)

### Agent 1 - Prompt for Phase 2 (Staging & Decisions)
```markdown
You are Agent 1 (Stream A). Goal: Phase 2 Staging & Deploy Adapter.
Workspace: `../prodpilot-a`

TASKS:
1. Staging Manager (`backend/prodpilot/staging/manager.py`):
   - Fix-forward staging: Runs the patched code in a worktree on side port 8001. Polls `http://127.0.0.1:8001/health` to confirm canary health.
   - Rollback staging: In a separate worktree, runs `git revert <suspect_commit>` without committing. Runs tests and launches on side port 8002. Polls `http://127.0.0.1:8002/health`.
2. Decision Layer (`backend/prodpilot/decide/rules.py`):
   - `decide(incident_data, staging_status)` -> returns recommendation ("fix_forward" vs "rollback"), probabilities, and reason.
   - Rules: If patch diff <= 10 lines and repro test passes -> fix_forward (85%). If diff is massive or touches migrations/auth -> rollback.
3. Deploy Adapter (`backend/prodpilot/staging/deploy.py`):
   - On approval ("fix_forward" or "rollback"):
     - Shuts down production port 8000 process.
     - Deploys the selected build to production port 8000.
     - Monitors health for 10s. If health fails, automatically triggers emergency rollback!
   - Saves final Incident Report in markdown (`artifacts/` table).

EXIT CHECK:
Run test script that stages both builds on 8001 and 8002, produces a recommendation, and verifies the deploy adapter swaps the ports cleanly. Commit to `stream-a`.
```

### Agent 2 - Prompt for Phase 2 (Telegram Approval & End-to-End Gate 2)
```markdown
You are Agent 2 (Stream B). Goal: Complete Gate 2 (Demo Floor: Phone tap restores prod).
Workspace: `../prodpilot-b`

TASKS:
1. Wire Telegram Bot (`backend/prodpilot/telegram/bot.py`) to incident events:
   - When an incident reaches `AWAITING_APPROVAL`, send message with:
     - Root Cause & Suspect Commit info.
     - Recommendation card with probability.
     - Inline buttons: `[Deploy Fix (Canary OK: 8001)]` and `[Rollback (Canary OK: 8002)]`.
2. When the user taps a button on Telegram:
   - Call the approval logic (or deploy adapter) to execute the deploy.
   - Send confirmation message to Telegram: "Production restored successfully! Health: 200 OK. Report attached."
3. Add Telegram commands `/status` (shows health) and `/logs` (shows last 20 log lines).

EXIT CHECK (GATE 2 - DEMO FLOOR):
1. Crash `demo-prod` with `trigger-crash.sh`.
2. Watch phone receive Telegram incident alert with Deploy/Rollback buttons.
3. Tap Deploy Fix on phone.
4. Verify `demo-prod` on port 8000 is healthy again and Telegram receives confirmation.
Commit to `stream-b`.
```

---

## 7. Gate Merging Runbook

When a Phase finishes, execute this sequence in the main repo:

```bash
# In /home/vishnunandan555/Projects/prodpilot:
git checkout main

# Merge Stream A
git merge stream-a -m "merge: Stream A Phase complete"

# Merge Stream B
git merge stream-b -m "merge: Stream B Phase complete"

# Tag the gate
git tag gate-1-passed

# Push or update worktrees for next phase
cd ../prodpilot-a && git rebase main
cd ../prodpilot-b && git rebase main
```
