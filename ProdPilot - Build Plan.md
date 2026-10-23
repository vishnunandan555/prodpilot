# ProdPilot - Master Execution & Architecture Plan
## Autonomous Production Incident Response Platform (Render + GitHub Integration)

**Realm Hack 2026 | Deadline: Tomorrow, 11:00 AM (24 Oct 2026) | Vishnu Nandan**  
**Version**: 3.5 (Real-Infrastructure Execution & Verified Telemetry State)

---

## 1. Executive Real-Infrastructure Alignment

ProdPilot connects your **real production server (Render)** and **source code repository (GitHub)** to monitor application health, detect production failures, investigate root causes, and coordinate recovery without requiring you to open your laptop.

### The Core Architectural Truths:
1. **Zero Mock / Fake Data**: No simulated log streams or fake "STREAM ACTIVE" badges when disconnected. All data originates strictly from user configuration, live GitHub REST API, and Render REST API v1.
2. **Projects Section (GitHub Integration)**:
   - Projects link a local working directory with the **GitHub REST API** via a pre-scoped Personal Access Token (PAT).
   - Live GitHub data is fetched directly: **Active GitHub Issues & Bug Reports**, **Pull Requests & Reviewer Discussions**, **GitHub Actions Workflow Deployment Logs**, and **Local Git Commit History**.
3. **Servers / Production Host Section (Render Integration)**:
   - Operators attach a **Render Web Service** or Worker to their project.
   - Connects to the **Render REST API v1** (`https://api.render.com/v1`) using the verified Render API Key.
   - Auto-discovers services associated with the key (e.g. `chunkstream` - `srv-dbdmotfb9u1s73a82le0`), with 1-click **[Auto-Fill]**, live health probes, deploy history, and live container log streaming.
4. **Autonomous Remediation & Agentic Fleet**:
   - Continuous watchdog monitoring over production health endpoints and crash traces.
   - Stack trace triage, SHA-256 deduplication fingerprinting, and Jev / OpenRouter rule evaluation.
   - Google Antigravity agent inspects an isolated git worktree, writes reproduction tests (`test_repro.py`), verifies failure (Red), fixes the code, and verifies pass (Green).
   - Canary staging container (ports 8001/8002) validation and fix-forward vs rollback confidence scoring.
   - Telegram bot 1-tap mobile approval buttons + Twilio Sev-1 interactive emergency voice call escalation.

---

## 2. Architecture Diagram (Model 1 Hybrid)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   REMOTE DEVELOPER                                     │
│                     (Mobile Phone Browser / Any Web Browser)                           │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Outbound Actions
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              RENDER: PRODPILOT WEBSITE                                 │
│     • Public Frontend (React + Vite build hosted on Render Static Sites)               │
│     • Incident Dashboard & Live Incident Webpage (/incidents/{id})                     │
│     • 1-Tap Developer Controls: [Deploy Fix], [Rollback], [Take Over]                  │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Outbound HTTPS API Calls
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                  CLOUDFLARE TUNNEL                                     │
│     • Secure zero-config bridge forwarding to laptop http://127.0.0.1:8765             │
│     • TwiML Webhook endpoint (/voice/test-twiml, /voice/action)                        │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               LAPTOP: PRODPILOT BACKEND                                │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. FastAPI Daemon (Port 8765): REST & SSE endpoints                              │  │
│  │ 2. Projects Manager: GitHub REST API (Issues, PRs, Workflow Runs, Git Blame)     │  │
│  │ 3. Server Manager: Render REST API v1 (Live Discovery, Deploys, Log Stream)      │  │
│  │ 4. Monitoring Engine: Real log ingestion from Render API with rule filters        │  │
│  │ 5. Agent Fleet: Google Antigravity SDK fix loop in isolated git worktree         │  │
│  │ 6. Decision Engine: TypeSafe Jev (OpenRouter Decisions API typesafe/jev-1.14)     │  │
│  │ 7. Verification Watchdog: 10-second post-deploy health check & auto-revert       │  │
│  │ 8. Telegram Bot API: Instant push alert with Render mobile web link              │  │
│  │ 9. Twilio Voice Engine: Emergency Sev-1 voice call tree & DTMF response          │  │
│  │ 10. SQLite Database: Projects, Servers, Users, Settings, Incidents, Audit Logs   │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Workstream Execution Roadmap

### Phase 1: Residue & Misconception Purge
- [x] Remove vague "Services" and "Repositories" tabs from sidebar and router.
- [x] Eliminate fake "STREAM ACTIVE" badges when Render API is not connected.
- [x] Clear old static/demo fallback strings in backend handlers.
- [x] Purge test runner incidents from SQLite DB (`inc-api-test-01`, `inc-orch-...`) and add automated test teardowns.
- [x] Eliminate duplicate inner window controls from `WindowHeader.jsx`.

### Phase 2: Database Schema & Credential Management
- [x] **`projects` table**: Schema created and verified (ID, name, repo, token, local path, branch, test command).
- [x] **`servers` table**: Schema created and verified (ID, project_id, name, provider, render_service_id, render_api_key, health_url, status, latency_ms).
- [x] **`users` table**: Upgraded with avatar URL, phone number, Telegram chat ID, role, and bio.
- [x] **`settings` storage**:
  - Global GitHub PAT (`GITHUB_PAT`) with direct pre-configured token generator link.
  - Global Render API Key (`RENDER_API_KEY`) verified with Render REST API v1.
  - OpenRouter API Key for Jev (`OPENROUTER_API_KEY`).
  - Telegram Bot Token & Allowed Chat ID (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_CHAT_ID`).
  - Twilio Voice Escalation credentials (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `ENGINEER_PHONE`).
  - Cloudflare Tunnel URL (`CLOUDFLARE_TUNNEL_URL`).

### Phase 3: Real Backend Integrations
- [x] **Render REST API Client (`backend/prodpilot/integrations/render_client.py`)**:
  - `list_services(limit=25)`: Discovers all services linked to API key.
  - `get_service(service_id)`: Fetches live specifications, env, region, repo, and update timestamps.
  - `get_deploys(service_id)`: Pulls real deployment history and commit IDs.
  - `get_logs(service_id, limit=100)`: Streams real production logs.
  - `probe_health(health_url)`: Measures millisecond round-trip probe latency.
- [x] **GitHub REST API Client (`backend/prodpilot/integrations/github_client.py`)**:
  - `get_issues(repo_slug, token)`: Fetches active GitHub issues, labels, bug reports, and authors.
  - `get_pull_requests(repo_slug, token)`: Fetches open PRs, reviewers, and discussion threads.
  - `get_workflow_runs(repo_slug, token)`: Fetches GitHub Actions workflow runs and deployment logs.
  - `inspect_local_commits(local_path)`: Fetches commit tree, authors, and timestamps.
- [x] **Twilio Voice Call Service (`backend/prodpilot/integrations/twilio_client.py`)**:
  - Outbound emergency voice dispatch with interactive TwiML audio.
  - DTMF keypad capture (Press 1 to Rollback, Press 2 to Approve Staged Hotfix, Press 3 for Manual Takeover).
  - Speech-to-text audio drill and test echo callbacks.
  - Dynamic public tunnel resolver (`get_effective_public_url`).
- [x] **Backend API Router (`backend/prodpilot/api/connect_router.py`)**:
  - Endpoints for `/projects`, `/servers`, `/render/discover`, `/agents`, `/platform-services`, `/users`, `/voice/test-call`, and `/settings`.

### Phase 4: UI Architecture & Dedicated Views
- [x] **Personal Dashboard (`desktop/src/components/DashboardView.jsx`)**:
  - Personalized operator dashboard (`damu007's Dashboard`) with clean zero-mock onboarding state when 0 projects are connected.
- [x] **Projects Section (`desktop/src/components/ProjectsView.jsx`)**:
  - Manual project creation with GitHub PAT shortcut link (`scopes=repo,workflow,read:user,user:email`).
  - Tabbed subviews: Active Issues, Pull Requests, Workflow Runs, and Local Commits with manual refresh buttons.
- [x] **Production Servers Section (`desktop/src/components/ServersView.jsx`)**:
  - Auto-Discovery drawer querying Render REST API v1.
  - 1-Click **[Auto-Fill]** for discovered services (`chunkstream`, etc.).
  - Live Render specifications, deployment history, health probe latency, and manual refresh controls.
- [x] **Logs Explorer (`desktop/src/components/LogsView.jsx`)**:
  - Live log streamer from Render REST API with search, level filters, and zero fake data.
- [x] **Autonomous Agents View (`desktop/src/components/AgentsView.jsx`)**:
  - Real-time operations center displaying live telemetry, assigned targets, active tasks, toolchains, and safety guardrails across the 6 specialized agents.
- [x] **Platform Services View (`desktop/src/components/PlatformServicesView.jsx`)**:
  - Live ping test suite for Jev, Antigravity, Telegram, Twilio Voice, Render Watchdog, and Cloudflare Tunnel.
  - Interactive Twilio Voice Call testing modal with live telemetry log stream.
- [x] **Profile & Account Management (`desktop/src/components/ProfileModal.jsx`)**:
  - Profile photo upload/URL, phone number for on-call escalation, role, and Telegram ID.

### Phase 5: Autonomous End-to-End Remediation Pipeline
- [ ] Connect `ChunkStream` project (`vishnunandan555/chunkstream` at `/home/vishnunandan555/Projects/chunkstream`).
- [ ] Connect `ChunkStream` Render server (`srv-dbdmotfb9u1s73a82le0`, `https://chunkstream.onrender.com/health`).
- [ ] Stream live Render logs into ProdPilot Logs Explorer.
- [ ] Trigger an error in Render logs $\rightarrow$ verify automatic triage creates incident.
- [ ] Antigravity agent inspects worktree, writes `test_repro.py`, confirms Red failure, fixes code, confirms Green pass.
- [ ] Canary ports 8001/8002 staged, Jev OpenRouter scores confidence.
- [ ] Telegram alert dispatched with 1-tap Render approval link & Twilio voice call triggers.
- [ ] Tap Approve $\rightarrow$ promotes to Render $\rightarrow$ 10-second watchdog verifies health.

---

## 4. Current Verification Status (October 24, 2026)

| Component | Status | Verification Detail |
| :--- | :--- | :--- |
| **Backend Daemon** | **ONLINE** | FastAPI running on `0.0.0.0:8765` with reload enabled. |
| **Database** | **CLEAN** | Pure zero-mock SQLite state (`incidents: 0`, `servers: 0`, `projects: 0`, `users: 1`). |
| **Render API** | **AUTHENTICATED** | Key `rnd_2Pdih0...` verified; 5 services discovered (`chunkstream` active & healthy). |
| **Desktop Client** | **BUILT & RUNNING** | Electron + Vite dev server running cleanly on `:5173`. Native window controls restored. |
| **Agents Fleet** | **LIVE TELEMETRY** | `GET /agents` dynamically reports live task states, targets, and toolchains every 5s. |
| **Twilio Voice** | **READY FOR VERIFICATION** | TwiML webhooks and call dispatcher armed; pending single recipient phone verification on Twilio console. |

---

## 5. Next Immediate Actions (Final Demo Prep)

1. **Step 1: Register ChunkStream in Production Servers**:
   - In **Production Servers** $\rightarrow$ click **[+ Connect Render Server]**.
   - Click **[Auto-Fill]** on `chunkstream` (`srv-dbdmotfb9u1s73a82le0`).
   - Click **[Connect Server]** to begin 15-second autonomous watchdog telemetry.
2. **Step 2: Add ChunkStream in Projects**:
   - In **Projects** $\rightarrow$ click **[+ Add Project]**.
   - Set Name: `ChunkStream`, Repo: `vishnunandan555/chunkstream`, Local Path: `/home/vishnunandan555/Projects/chunkstream`.
   - Verify GitHub Issues, PRs, Workflow Runs, and Git Commits pull live.
3. **Step 3: Verify Phone Number on Twilio**:
   - Verify `+919539916820` at `https://console.twilio.com/us1/develop/phone-numbers/manage/verified` to unlock trial account outbound voice calls.
4. **Step 4: Execute Live Incident Drill**:
   - Run autonomous end-to-end incident drill: ingest error trace $\rightarrow$ Antigravity worktree patch $\rightarrow$ canary verification $\rightarrow$ Telegram/Voice approval $\rightarrow$ production promotion.
