# ProdPilot - Master Execution & Architecture Plan
## Autonomous Production Incident Response Platform (Render + GitHub Integration)

**Realm Hack 2026 | Deadline stated in original plan: 24 Oct 2026, 11:00 AM (past; confirm if still relevant) | Vishnu Nandan**  
**Version**: 3.6 (Implementation Reality Audit)

> **Reality check — 24 Oct 2026:** This plan previously described several integrations and end-to-end behaviors as verified. A source review of the current repository does not support those claims. The implementation has useful real API clients, UI screens, ingestion/triage, and a separately runnable remediation pipeline, but the core production incident lifecycle is not yet reliably connected end to end. Treat old “ONLINE”, “LIVE”, “verified”, and “ready” statements below as historical notes until the checks in §4 are completed against the current code and target accounts.

### Current maturity estimate

These are product-scope estimates based on code inspection, not measured test coverage or a claim that every screen was exercised:

| Project slice | Estimate | What that means |
| :--- | :---: | :--- |
| Solid working foundation | **~35%** | API/database foundations, React/Electron shell, GitHub and Render read clients, project/server CRUD, log triage, incident storage, and some isolated pipeline stages exist. |
| Partially implemented or fragile | **~40%** | Integration views, background Render polling, notification setup, incident actions, and agent/remediation pieces exist but depend on manual setup, separate processes, fallbacks, or have not been shown to work together against a real target. |
| Missing or not demonstrated for the intended product | **~25%** | A reliable, safe, real-target flow from detected production error through verified fix, explicit approval, provider deployment, and post-deploy verification is not established. |

**Practical answer:** roughly **one third works as a foundation**, while about **two thirds is partial, fragile, missing, or unverified** for the full product promise. “Poorly implemented” is not a measured code-quality score; the highest-risk parts are the wiring and safety boundaries. The UI also contains simulated progress timers, so visual progress is not proof of backend work. No tests or live-account checks were run for this audit.

---

## 1. Executive Real-Infrastructure Alignment

ProdPilot's target is to connect a **real production server (Render)** and **source code repository (GitHub)** to monitor application health, detect failures, investigate causes, and coordinate recovery. This is the intended product behavior; current implementation status is assessed in §4.

### Target Architecture Principles (not yet all verified):
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

The checkboxes below describe intended work and historical implementation claims. They are not a current acceptance report; current repository status is in §4.

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

### Phase 5: Autonomous End-to-End Remediation Pipeline — NOT YET ACCEPTED
- [ ] Connect `ChunkStream` project (`vishnunandan555/chunkstream` at `/home/vishnunandan555/Projects/chunkstream`).
- [ ] Connect `ChunkStream` Render server (`srv-dbdmotfb9u1s73a82le0`, `https://chunkstream.onrender.com/health`).
- [ ] Stream live Render logs into ProdPilot Logs Explorer.
- [ ] Trigger an error in Render logs $\rightarrow$ verify automatic triage creates incident.
- [ ] Antigravity agent inspects worktree, writes `test_repro.py`, confirms Red failure, fixes code, confirms Green pass.
- [ ] Canary ports 8001/8002 staged, Jev OpenRouter scores confidence.
- [ ] Telegram alert dispatched with 1-tap Render approval link & Twilio voice call triggers.
- [ ] Tap Approve $\rightarrow$ promotes to Render $\rightarrow$ 10-second watchdog verifies health.

---

## 4. Current Repository Status (source review, October 24, 2026)

| Component | Current assessment | Evidence / limitation |
| :--- | :--- | :--- |
| **Backend API & SQLite** | **Implemented; runtime unverified** | FastAPI routes and DB operations exist in source. This review did not confirm a running daemon or current database contents. |
| **GitHub integration** | **Read operations implemented; live access unverified** | Client and project endpoints fetch repository issues, PRs, workflow runs, and local commits. Account permissions and actual UI flows were not exercised. |
| **Render integration** | **Read/probe operations implemented; live access unverified** | Client and endpoints discover services, fetch deploy/log data, and probe health. Render API access is subject to credentials and API behavior. |
| **UI** | **Substantial screens implemented; behavior mixed** | React views call backend endpoints, but project/server registration includes timer-driven simulated progress. That display must not be treated as completed backend work. |
| **Incident intake / triage** | **Implemented as a partial flow** | `/ingest` classifies log batches and stores incidents; an API startup task polls the active Render service for logs and invokes triage. Polling is not evidence of the remediation pipeline running. |
| **Investigation / fix / canary pipeline** | **Separate pieces exist; automatic wiring unproven** | `process_incident` runs repro, staging, and decision logic, but the API startup watcher shown in source only calls `run_server_log_triage`; it does not dispatch new incidents to the orchestrator. Treat orchestrator as a separately launched process until wired and supervised. |
| **Production approval / deploy** | **Unsafe and not provider deployment** | The API approval path may use mock mode when repository/patch evidence is missing. The deploy adapter manages a local process on port 8000; that does not deploy a Render service. Do not present this as safe Render promotion. |
| **GitHub PR workflow** | **Unsafe automatic merge and mock fallback present** | After the API approval action, workflow code attempts to merge the PR automatically. If PR creation fails, it fabricates a PR URL and reports `merged=true`. This conflicts with the blueprint's human-controlled production change principle and must be removed before any real repository is connected. |
| **Telegram / Twilio / tunnel** | **Code present; end-to-end delivery unverified** | Webhook/client code exists. Phone verification, public reachability, signatures/access control, and real delivery were not checked here. |
| **Auth / security boundary** | **Needs review before public exposure** | Source has signup/login/token routes, but incident and integration routes are not shown as consistently requiring authentication; CORS allows all origins. Do not expose the API publicly until authorization and secret handling are reviewed. |

### Realistic completion estimate

Use the estimate in the summary table as the current planning baseline: **~35% solid foundation, ~40% partial/fragile, ~25% missing or not demonstrated**. The overall score is weighted by the core product promise (safe incident-to-recovery workflow), not by number of files, routes, or screens. The “properly works” share could change materially after running current tests and a controlled real-target drill.

---

## 5. Next Actions (ordered by risk and product value)

1. **Make one controlled, non-production target the source of truth.** Register its repo and service, confirm real GitHub/Render reads, and ensure incident records retain the correct project/service identity. Do not use production promotion for this first drill.
2. **Wire and supervise the remediation worker.** Dispatch newly created eligible incidents to `process_incident` exactly once, persist progress/errors, prevent duplicate runs, and recover cleanly after API/worker restart. Make the active project’s local path explicit; remove reliance on demo/current-directory fallback for real incidents.
3. **Remove misleading success paths.** Make mock/fallback mode explicit in API responses and UI. An absent patch, repository, or credential must fail closed and never return a success-shaped deployment result.
4. **Separate local canary validation from provider deployment.** Keep the current local port deploy adapter labeled as a demo/local adapter. Implement a Render deployment/rollback adapter with deployment ID tracking, explicit approval, and health verification before describing it as production recovery.
5. **Enforce the human approval boundary.** Ensure no PR auto-merge or production mutation occurs before an authenticated explicit approval. Add route authentication/authorization, restrict CORS, and protect stored credentials before any public tunnel exposure.
6. **Then run an end-to-end rehearsal.** In a disposable service/repository, verify: real log detected → one incident created → repro fails before fix and passes after → canary health confirmed → PR prepared → operator explicitly approves → provider deployment succeeds or rolls back → incident state and audit trail match reality. Capture evidence and update each status row.

### What “done” means for the next milestone

The next milestone is **one safe, repeatable incident drill through approval**, not more dashboard surface area. It is accepted only when the drill uses real connected APIs, does not use mock fallbacks, cannot deploy without explicit operator approval, and produces a truthful incident/audit timeline. Until then, describe ProdPilot as an integration dashboard plus a prototype incident/remediation pipeline, not an autonomous production recovery system.
