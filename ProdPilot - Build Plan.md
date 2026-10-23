# ProdPilot - Build Plan

**Realm Hack 2026 | Deadline: Tomorrow, 11:00 AM (24 Oct 2026) | Vishnu Nandan**  
**Version**: 2.2 (Model 1 Hybrid Execution Plan)

> **Current Time**: Friday, 6:35 PM (23 Oct 2026)  
> **Submission Deadline**: Saturday, 11:00 AM (24 Oct 2026)  
> **Total Time Remaining**: **~16.4 Hours**

---

## 1. Timeline & Phase Schedule (16.4-Hour Countdown)

| Phase & Timeline | Duration | Goal | Gate | Status |
|---|---|---|---|---|
| **Phase 0: Setup & Spikes** | Completed | SDK verified, Telegram bot talks, demo service ready, contracts frozen | **Gate 0** | ✅ **PASSED & MERGED** |
| **Phase 1: Core Pipeline** | Completed | Crash becomes incident, verified repro-test + fix from CLI | **Gate 1** | ✅ **PASSED (Tag: `gate-1-passed`)** |
| **Phase 2: Staging, Orchestrator, Telegram** | Completed | Orchestrator daemon, canaries 8001/8002, live SSE stream, Telegram bot | **Gate 2** | ✅ **PASSED (Tag: `gate-2-passed`)** |
| **Phase 3: Desktop Base & Daemon Runner** | Completed | Desktop Mission Control base, unified runner daemon, branding unified | **Gate 3** | ✅ **PASSED (Tag: `gate-3-passed`)** |
| **Phase 4: Model 1 Hardening & Render Deploy** | Completed | Render log ingestion, immediate Telegram alert, Render frontend deploy + Cloudflare Tunnel, 10s watchdog | **Gate 4** | ✅ **PASSED (Tag: `gate-4-passed`)** |
| **Active Milestone: Operations UI Overhaul**<br>*(7:05 PM – 8:30 PM)* | **1.5 hours** | 8-Section SRE Operations Platform + 6-Tab Incident Details Hero Screen (Splunk/Epok-inspired) | **Gate UI** | 🟡 **IN PROGRESS (ACTIVE)** |
| **Phase 5: Rehearsals, Seeded Bugs & Video**<br>*(8:30 PM – 1:30 AM)* | **5.0 hours** | 3 consecutive clean runs, 5–8 seeded bugs suite, record 3-min backup video on final UI | **Gate 5**<br>*(Freeze)* | ⚪ Next Up (After UI) |
| **Rest & Buffer Window**<br>*(1:30 AM – 7:30 AM)* | **6.0 hours** | Rest & sleep buffer (prevents demo-day fatigue) | — | ⚪ Scheduled |
| **Phase 6: Pitch Slides & Devfolio Submit**<br>*(7:30 AM – 11:00 AM)* | **3.5 hours** | Fresh clone dry-run, pitch deck polish, Devfolio submission freeze | **Ship** | ⚪ Queued |

---

## 2. Model 1 Architecture & Workstream Division

```
┌─────────────────────────────────┐   ┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│ Stream A: Laptop Ingest & Triage│   │ Stream B: Laptop Fixing & Guard │   │ Stream C: Render Web & Tunnel   │
├─────────────────────────────────┤   ├─────────────────────────────────┤   ├─────────────────────────────────┤
│ • Status: ✅ MERGED & VERIFIED   │   │ • Status: ✅ MERGED & VERIFIED   │   │ • Status: ✅ MERGED & VERIFIED   │
│ • Branch: stream-triage         │   │ • Branch: stream-agent          │   │ • Branch: stream-ui             │
│ • Render Log API Ingest         │   │ • Antigravity SDK Fix Loop      │   │ • Vite Build for Render Static  │
│ • Fast Rule Filter              │   │ • Git Worktree Isolation        │   │ • Cloudflare Tunnel Bridge      │
│ • SQLite Fingerprint & Anti-Loop│   │ • PR Opener & Staging Canaries  │   │ • Immediate Telegram Alert      │
│ • Low-Severity Issue Handler    │   │ • 10s Post-Deploy Watchdog Guard│   │ • Mobile Incident Page (/inc/id)│
└─────────────────────────────────┘   └─────────────────────────────────┘   └─────────────────────────────────┘
```

### Folder Ownership:
- **Stream A (Agent 1)**: `backend/prodpilot/ingest/`, `backend/prodpilot/triage/`, `backend/prodpilot/db.py`
- **Stream B (Agent 2)**: `backend/prodpilot/agents/`, `backend/prodpilot/pipeline/`, `backend/prodpilot/staging/deploy.py`
- **Stream C (Agent 3)**: `desktop/`, `backend/prodpilot/api/`, `telegram/`

---

## 3. Passed Phase: Phase 4 – Gate 4 (Model 1 Hardening & Render Ready)

**Goal**: Production monitoring on laptop pulls Render/Local logs $\rightarrow$ Outage triggers immediate Telegram alert with link to Render-hosted incident webpage $\rightarrow$ Antigravity agent on laptop investigates and crafts verified fix $\rightarrow$ Developer approves from phone $\rightarrow$ Cloudflare Tunnel forwards approval to laptop $\rightarrow$ 10s watchdog verifies production restored.

### Stream A Tasks (Agent 1 - Laptop Ingestion, Triage & Anti-Looping):
- [x] **Render & Forwarder Log Ingest (`backend/prodpilot/ingest/`)**:
  - Implemented `/ingest` REST endpoint receiving batched log lines with timestamps and levels.
  - Added `scripts/forwarder.py` to tail local service logs or fetch from Render REST API (`/services/{serviceId}/logs`).
- [x] **Lightweight Triage & Severity Classifier (`backend/prodpilot/triage/`)**:
  - Fast rule filter: extracts 5xx, unhandled exceptions, and `/health` failures.
  - Classifies events into `HIGH` (Severe Outage) vs `LOW` (Minor Issue).
  - Safety Override: any fatal crash or service exit is unconditionally forced to `HIGH`.
- [x] **Low-Severity Issue Creator**:
  - On `LOW` classification, synthesizes diagnostic brief and creates a non-urgent record with status `WAITING_FOR_DEVELOPER` and `severity:low` tag.
- [x] **Anti-Looping Fingerprint Store (`backend/prodpilot/db.py`)**:
  - Normalizes stack traces and computes SHA-256 fingerprint.
  - If fingerprint already exists in status `OPEN`, `DETECTED`, or `INVESTIGATING`, increments `recurrence_count` without triggering duplicate agent runs.
  - Verified with `scripts/test_ingest_triage.py` (Exit Code 0)!

### Stream B Tasks (Agent 2 - Laptop Agent Fixing, Context & Safety Guard):
- [x] **Investigation & Root Cause Report Generator (`backend/prodpilot/pipeline/investigate.py`)**:
  - Collects stack trace, `git blame` suspect commit, and PR review discussion.
  - Generates structured RCA report (summary, severity, timeline, evidence, root cause, suspected commit, recommendation, confidence).
- [x] **Recovery Decision & Rollback Staging (`backend/prodpilot/staging/recovery.py`)**:
  - Evaluates rollback eligibility; stages clean revert canary on port 8002.
- [x] **Automated GitHub PR Creation (`backend/prodpilot/pipeline/pr_opener.py`)**:
  - Runs Antigravity fixing loop in isolated git worktree: repro test Red $\rightarrow$ Green + full suite pass.
  - Stages fix-forward canary on port 8001.
  - Pushes branch `prodpilot-fix-<id>` to GitHub and opens a Draft Pull Request with test evidence.
- [x] **10-Second Post-Deploy Watchdog & Auto-Revert (`backend/prodpilot/staging/deploy.py`)**:
  - When approved, promotes chosen build to production port 8000.
  - Monitors `/health` for 10 seconds.
  - If health check fails or errors occur, triggers immediate rollback to previous build and marks `AUTO_REVERTED`.
  - Strictly caps automatic remediation attempts at 1 before escalating to human on-call.
  - Verified with `scripts/test_watchdog_revert.py` (Exit Code 0)!

### Stream C Tasks (Agent 3 - Render Web Deploy, Cloudflare Tunnel & Telegram):
- [x] **Purge Copilot Dead Views (`desktop/src/components/`)**:
  - Deleted `SessionView.jsx`, `IssuesView.jsx`, `AutomationsView.jsx`, `CustomizeView.jsx`, and `discord_bot.py`.
  - Streamlined navigation to: **Incidents**, **Telemetry & Logs**, and **Settings**.
- [x] **Vite Web App Build & Render Static Site Config (`desktop/`)**:
  - Configured `desktop/` for static web export with `VITE_API_URL` pointing to Cloudflare Tunnel URL.
  - Added `desktop/render.yaml` and `RENDER_DEPLOY.md` for 1-click Render Static Site deployment.
  - Verified `npm run build` generates clean production assets in 1.22s!
- [x] **Mobile Incident Webpage (`/incidents/{id}`)**:
  - Ensured incident detail view is fully responsive for mobile screens.
  - Prominent 1-tap mobile action buttons: `[🚀 Approve & Deploy Fix]`, `[⏪ Instant Rollback]`, and `[🛑 Take Over]`.
- [x] **Immediate Telegram Alert on Detection (`telegram/bot.py`)**:
  - Sends immediate Telegram alert card on Stage 1 (`DETECTED`) with direct Render incident webpage link.
  - Added inline `[⏪ Revert Commit (8002)]` button directly next to `[🚀 Deploy Fix (8001)]`.
- [x] **Cloudflare Tunnel Runner Script (`scripts/start-tunnel.sh`)**:
  - Persistent Cloudflare Tunnel forwarding to `http://127.0.0.1:8765`.

---

## 4. Active Milestone: UI Operations Platform Overhaul (Gate UI)

**Goal**: Transform ProdPilot into an authentic, production-grade SRE Operations Platform inspired by Splunk Observability and Epok Log Anomaly Detection, supporting both Desktop (Electron) and Web/Mobile (Render) before running Phase 5 rehearsals.

> **Strategic Decision**: Complete the UI overhaul *before* Phase 5 rehearsals and demo video recording so that the recorded 3-minute video and automated runs capture the polished, final platform.

### A. 8 Primary Navigation Sections
- [ ] **1. Dashboard**: High-level production health overview, active SEV-1 incident alerts, live error rate metrics, log volume timeline, monitored services status cards, and recent autonomous activity stream.
- [ ] **2. Incidents**: Comprehensive incident catalog with status filters (`Active`, `Investigating`, `Awaiting Approval`, `Resolved`), severity tags (`SEV-1 Critical`, `SEV-2 High`, `SEV-3 Low`), search bar, and one-click demo crash trigger simulation.
- [ ] **3. Incident Details (The Hero Screen)**: The central operational hub for a single incident featuring 6 internal tabs:
  - **Tab 1: Overview** (Incident metadata, affected service, timeline overview, quick actions, blast radius).
  - **Tab 2: Logs & Traces** (Extracted stack traces, panic logs, surrounding log context, copy/export).
  - **Tab 3: Investigation & RCA** (Hypothesis vs confirmed facts, suspect commit, `git blame` attribution, confidence score).
  - **Tab 4: Recovery & Canaries** (Canary 8001 fix-forward, Canary 8002 rollback, health status, 1-tap mobile approval buttons).
  - **Tab 5: Changes & Diffs** (Unified syntax-highlighted git diff, PR branch link, repro test case).
  - **Tab 6: Timeline & Audit** (Real-time SSE event stream, transition history, agent actions, watchdog verification).
- [ ] **4. Logs Explorer**: Searchable log stream with live auto-scroll, log-level filters (ERROR, WARN, INFO, DEBUG), service picker, and regex search.
- [ ] **5. Services**: Monitored microservices overview (`order_service`, `demo-prod`, etc.) displaying uptime, latency, health endpoint status, and active canaries.
- [ ] **6. Repositories**: Source code repo intelligence (connected GitHub repo, active branches, recent commits, blame history, and automated PR links).
- [ ] **7. Agents**: Multi-agent fleet monitor (Antigravity SDK status, isolated git worktrees, active runs, token/cost telemetry, and safety guardrails).
- [ ] **8. Team**: SRE on-call rotation roster, escalation tiers, Slack/Telegram notification status, and access control.
- [ ] **9. Settings**: Infrastructure connection panel (Render API Key, Render Service ID, Cloudflare Tunnel URL, GitHub PAT, Telegram Bot token).

### B. Implementation Checklist (Operations UI Overhaul)
- [x] Update `Sidebar.jsx` with the 8 primary navigation tabs and status badges.
- [x] Implement `DashboardView.jsx` with telemetry summary cards, service health indicators, and Epok-style activity stream.
- [x] Upgrade `IncidentDetail.jsx` with the 6-tab hero structure and responsive 1-tap mobile action bar (`[🚀 Deploy Fix]`, `[⏪ Rollback]`, `[🛑 Take Over]`).
- [x] Implement `LogsView.jsx` (interactive log explorer).
- [x] Implement `ServicesView.jsx`, `RepositoriesView.jsx`, `AgentsView.jsx`, and `TeamView.jsx`.
- [x] Verify both Desktop Electron and Render Web views render with 0 console errors and pass `npm run build`.

---

## 5. Professional Platform Gap Analysis & Production Checklists

This section provides a rigorous, transparent technical audit of ProdPilot: what is genuinely implemented and operational vs. what is currently synthetic/mocked for demo purposes, followed by concrete engineering checklists to make ProdPilot a full-scale, professional SRE platform.

### A. What is PROPERLY Implemented & Verified (The Operational Core)
1. **SQLite Database & Audit Store (`backend/prodpilot/db.py`)**:
   - Complete relational schema: `incidents`, `runs`, `events`, `artifacts`, `decisions`, `approvals`, `fingerprints`.
   - Real SHA-256 stack trace fingerprint computation & recurrence counters (proven anti-loop crash protection).
   - Real structured event logging (`log_event`) powering live SSE streams.
2. **Deterministic Sandboxed Verification (`backend/prodpilot/pipeline/`)**:
   - `worktree.py`: Real `git worktree add` and `git worktree remove` for strict filesystem isolation per incident.
   - `repro_runner.py`: Deterministic test runner invoking `pytest`. Verifies repro test fails on baseline code (RED), applies patch, verifies full suite passes (GREEN).
3. **Dual Agent Fixing Loop (`backend/prodpilot/agents/`)**:
   - `antigravity_adapter.py`: Calls local Google Antigravity CLI binary (`/home/vishnunandan555/.local/bin/agy` v1.4.6).
   - `gemini_adapter.py`: Gated AST / regex inspector and patch synthesizer with strictly sandboxed tools (`read_file`, `write_file`, `list_dir`, `grep_search`).
4. **Side-Port Canary Staging & Watchdog (`backend/prodpilot/staging/`)**:
   - `manager.py`: Launches real FastAPI canary instances on port 8001 (Fix-Forward) and port 8002 (Rollback Canary).
   - `deploy.py`: 10-second real `/health` watchdog polling loop with automatic port-swap and auto-revert to rollback canary on failure.
   - `pr_opener.py`: Creates real git branch `prodpilot-fix-<id>` and executes git commits.
5. **Log Ingest & Triage Engine (`backend/prodpilot/ingest/` & `triage/`)**:
   - `/ingest` REST endpoint receiving batch logs from local forwarder or Render API.
   - Rule & regex classifier detecting 5xx, unhandled tracebacks, and health probe failures.
6. **Backend REST API & Live SSE Streaming (`backend/prodpilot/api/server.py`)**:
   - Port 8765 FastAPI server with CORS, SSE streaming events, and approval webhooks.
7. **Telegram Bot Dispatcher (`telegram/bot.py`)**:
   - Live Telegram bot with interactive inline buttons (`[🚀 Deploy Fix]`, `[⏪ Rollback]`), `/status`, `/logs`, `/report`.
8. **Cloudflare Tunnel Bridge (`scripts/start-tunnel.sh`)**:
   - Exposes laptop backend to the public internet securely without port forwarding.

---

### B. What is Currently SYNTHETIC / MOCKED / HARDCODED
1. **Frontend Hardcoded Datasets**:
   - `DashboardView.jsx`: Time-series anomaly pulse bar chart uses static numbers (`timelinePoints`); MTTR ("42s") and uptime ("98.2%") are mock values.
   - `ServicesView.jsx`: Hardcoded list of 4 static microservices; does not query dynamic service registries.
   - `RepositoriesView.jsx`: Hardcoded list of commits and PR metadata; does not dynamically pull from GitHub REST API in the frontend.
   - `AgentsView.jsx`: Static latency and execution run numbers.
   - `TeamView.jsx`: Hardcoded on-call engineer contacts.
   - `App.jsx`: Hardcoded fallback incident (`FALLBACK_INCIDENT`) when backend is disconnected.
2. **Fixed Service Target**:
   - Hardcoded to local `demo-prod` microservice repository. No dynamic repository selector or multi-repo switching in the UI.
3. **No Authentication or Multi-Tenancy**:
   - Open access on both Desktop and Render web; anyone with the URL can view and approve deployments.
4. **No Remote Interactive Agent Coding IDE / Chat**:
   - While autonomous fix runs in the background, developers cannot currently converse directly with the agent, ask questions, or tweak code collaboratively before deploying.

---

### C. Engineering Checklists to Turn ProdPilot into a Full Professional Platform

#### Checklist 1: Authentication & Role-Based Access Control (RBAC)
- [ ] **GitHub / Google OAuth Integration**: Implement user login via GitHub OAuth or Clerk/Supabase.
- [ ] **JWT Bearer Auth on Backend**: Protect FastAPI endpoints (`/incidents`, `/approve`, `/ingest`) with signed JWT tokens.
- [ ] **Role Permissions**:
  - `Viewer`: Can view dashboard, telemetry, and incident timelines.
  - `Incident Commander / Lead SRE`: Authorized to approve production deploys and instant rollbacks.
- [ ] **Audit Trail Attribution**: Store user ID and email on all approval records in SQLite and Telegram notifications.

#### Checklist 2: Dynamic Repository & Cloud Infrastructure Connectors
- [ ] **Connect Repository Flow**:
  - OAuth or GitHub PAT integration allowing developers to select any repo from their GitHub account.
  - Clone/fetch repository dynamically into isolated workspaces on the backend.
  - Live commit history and blame extraction directly via GitHub REST/GraphQL API.
- [ ] **Connect Render Platform**:
  - Render API Key & Workspace picker in Settings.
  - Fetch real services list (`GET https://api.render.com/v1/services`).
  - Auto-configure log forwarding streams and Render deploy hooks (`POST https://api.render.com/deploy/...`).
- [ ] **Multi-Service Registry**:
  - Dynamically register microservices, their ports, health endpoints, and Docker/k8s targets.

#### Checklist 3: Remote Interactive Agent Coding IDE & Chat Workspace
- [ ] **Interactive SRE Agent Chat Tab**:
  - Add dedicated chat/IDE tab in the platform to converse with the Antigravity agent.
  - Support natural language queries: *"Why didn't you use a try/except instead?"*, *"Can you add input validation for price?"*, *"Show me the full stack trace context."*
- [ ] **Collaborative Split-View Code Editor**:
  - Lightweight Monaco or CodeMirror editor embedded in the Incident Details screen.
  - Allow developers to directly review, edit, and modify the agent's synthesized patch before approving.
- [ ] **Sandboxed Diagnostic Terminal**:
  - Web-based read-only terminal executing safe diagnostic commands (`pytest`, `git status`, `git log`) in the incident worktree.

#### Checklist 4: UI De-AI-ification (Professional Matte SRE Aesthetic)
- [ ] **Strip AI-Generated Cliches**:
  - Remove neon purple/blue glowing gradients (`shadow-indigo-500/30`, saturated gradient cards).
  - Eliminate generic floating circular pulse badges.
- [ ] **Adopt High-Density Matte SRE Design System (Grafana / Linear / Datadog style)**:
  - Deep matte obsidian palette (`#090d16` canvas, `#0e131f` surface, `#1b2234` subtle border).
  - High-density monospace typography for all metrics, timestamps, and commit hashes.
  - Dense operational data tables with sorting, sticky headers, and live search.
  - Authentic Linux terminal styling with syntax-highlighted ANSI logs.

#### Checklist 5: Live Telemetry & Dynamic Metric Pipelines
- [ ] **Real Time-Series Aggregations**:
  - Replace static `timelinePoints` with dynamic SQLite queries grouping ingested logs by minute (`SELECT strftime('%H:%M', timestamp), count(*) ...`).
  - Compute real MTTR dynamically: average elapsed time between `detected_at` and `resolved_at` across past incidents.
- [ ] **Live Health Probe Engine**:
  - Active background thread probing configured service health endpoints every 5 seconds, calculating real p99 latencies and uptime percentages.

---

---

## 5. Phase 5: Rehearsals, Seeded Bugs & Demo Freeze (1:30 AM – 3:30 AM)

- [ ] **3 Consecutive Clean Runs**:
  - Trigger crash $\rightarrow$ immediate detection on laptop $\rightarrow$ phone alerts with Render link $\rightarrow$ repro test on laptop $\rightarrow$ fix verified $\rightarrow$ mobile approval on phone $\rightarrow$ healthy production.
  - Run 3 times consecutively without manual intervention.
- [ ] **Seeded Bug Suite**:
  - Test against 5 distinct failure modes:
    1. `KeyError` (missing dict key in order calculations).
    2. `TypeError` / `NoneType` (unhandled null response).
    3. `IndexError` (empty array access).
    4. Infrastructure / Missing ENV (triggers "Not a Code Bug" escape hatch).
    5. Recurrent crash loop (confirms de-duplication counter works).
- [ ] **Record 3-Minute Backup Demo Video**:
  - High-definition recording showing the mobile approval on the Render webpage and laptop backend timeline, ready as an offline fallback for the judges.
- [ ] **Feature Freeze (1:30 AM Sharp)**: Zero new features past this point.

---

## 5. Phase 6: Pitch Slides & Submission (8:00 AM – 11:00 AM)

- **8:00 AM – 9:15 AM**: Clean clone test from GitHub to verify seamless fresh installation.
- **9:15 AM – 10:15 AM**: Polish pitch deck:
  - Slide 1: The Problem (The 2026 Verification Bottleneck & 3 AM On-Call Burnout).
  - Slide 2: ProdPilot: The Autonomous Production Incident Response Platform.
  - Slide 3: Model 1 Architecture (*"Render makes ProdPilot accessible. Your laptop makes ProdPilot operational."*).
  - Slide 4: The Secret Sauce (Repro-first verification, mitigation-first rollback, mobile-first resolution).
  - Slide 5: Live Demo Walkthrough (Crash $\rightarrow$ Mobile page $\rightarrow$ 1-tap fix $\rightarrow$ Healthy prod).
- **10:15 AM – 10:45 AM**: Final dry-run presentation.
- **10:45 AM – 11:00 AM**: Final Devfolio submission!

---

## 6. Demo Script (3-Minute Model 1 Beat)

1. **0:00 – 0:30 (Architecture & Setup)**:
   - Open `https://prodpilot.onrender.com` on a phone and a browser. Explain Model 1: Render hosts the public interface; laptop runs the operational backend connected via Cloudflare Tunnel.
   - Show healthy production service.
2. **0:30 – 1:15 (Outage & Immediate Mobile Alert)**:
   - Run `./scripts/trigger-crash.sh`.
   - Production goes down. Laptop monitoring detects it $\rightarrow$ phone buzzes on Telegram with the Render incident webpage link.
3. **1:15 – 2:00 (Autonomous Investigation on Laptop)**:
   - Laptop investigation agent generates RCA report.
   - Antigravity agent in isolated worktree creates `test_repro.py`, verifies Red $\rightarrow$ Green, stages Canaries 8001 and 8002, and opens GitHub PR.
4. **2:00 – 2:40 (Mobile Review & 1-Tap Resolution)**:
   - Tap the link on phone. Show the live Render webpage: RCA report, diff, and green canaries.
   - Tap **`[🚀 Approve & Deploy Fix]`** directly from mobile.
5. **2:40 – 3:00 (Watchdog Verification & Resolution)**:
   - Cloudflare Tunnel routes approval to laptop.
   - Laptop promotes Fix canary to production port 8000.
   - 10-second watchdog confirms health. Post-mortem report auto-generates on Render and Telegram.
