# ProdPilot - Master Execution & Architecture Plan
## Autonomous Production Incident Response Platform (Render + GitHub Integration)

**Realm Hack 2026 | Working deadline: 24 Oct 2026, 10:00 AM IST | Vishnu Nandan**

**Version**: 4.0 (Validated implementation audit & UI Truthfulness Refactor, 24 Oct 2026 06:00 IST)

> **Reality check — 24 Oct 2026:** This plan previously described several integrations and end-to-end behaviors as verified. Following an extensive code audit and UI truthfulness refactor, all simulated timer progress bars, fake PR links, and hardcoded "ONLINE" states have been eliminated. The implementation features a rock-solid, locally validated autonomous remediation pipeline with 41 passing automated tests, git worktree sandboxing, red-to-green reproduction tests, side-port canaries, and safe local demo deployment with watchdog auto-revert. Live Render read telemetry (service metadata, deployment history, container log streaming) is active. Cloud-native Render deploy promotion is out of scope for 10:00 AM; the platform accurately labels recovery as **"Local Demo Deployment (Port 8000)"**.

### Current maturity estimate

This is an evidence-based, weighted estimate of the promised product incorporating the completed UI truthfulness refactor and 41 passing automated tests.

| Delivery state | Estimate | Meaning |
| :--- | :---: | :--- |
| **Properly implemented and locally validated** | **~65%** | FastAPI/SQLite foundation, 41/41 passing unified automated tests (~12s runtime), full worktree lifecycle management & process-exit auto-pruning, ingestion/triage/SHA-256 fingerprinting & anti-looping deduplication, repro-first pipeline (red repro -> fix -> green full suite), side-port canary staging (8001/8002), rule-based decision engine, local deployment watchdog with auto-revert & 1-attempt remediation cap, hold/resume/approval REST endpoints, standalone dark-mode mobile HTML renderer, React/Vite production bundle, truthful UI without timer mocks, and explicit prerequisite/error surfacing. |
| **Partially implemented** | **~20%** | Render REST API v1 live discovery, service details, and deployment log stream; GitHub client & PR generator (credential-dependent); Telegram alert dispatch formatting; Twilio TwiML audio generator & DTMF endpoints; Desktop UI views. |
| **Barely implemented / out of scope for 10 AM** | **~10%** | Cloud-native Render automated promotion (ProdPilot deliberately deploys via local-process swapping on port 8000 rather than Render cloud API deploys); public API authentication boundary (open CORS without token authentication on approval endpoints). |
| **Still missing (Out of scope for 10:00 AM)** | **~5%** | Direct Render cloud deployment adapter with deployment-ID polling; production OAuth/JWT gateway; multi-tenant public isolation. |

**Practical answer:** about **65% is properly implemented and locally verified for a robust, honest demo**. About **35% remains partial, cloud-provider-dependent, or deliberately scoped to local demo execution**. The system is presented as an **autonomous production incident response & remediation platform with live Render telemetry, isolated git worktree code synthesis, side-port canaries, and local demo deployment verification**.

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
  - Truthful Twilio voice testing button (disabled when credentials missing with explanatory tooltip).
- [x] **Profile & Account Management (`desktop/src/components/ProfileModal.jsx`)**:
  - Profile photo upload/URL, phone number for on-call escalation, role, and Telegram ID.
- [x] **UI Truthfulness & Demo-Readiness Refactor (Completed 24 Oct 05:50 IST)**:
  - Eliminated artificial `setTimeout` progress simulations in `ServersView`, `ProjectsView`, and `DashboardView`.
  - Accurately relabeled deployment and rollback actions as **"Local Demo Deployment (Port 8000)"** and **"Local Demo Rollback"** across `AgentExecutionConsole`, `IncidentDetail`, and `DashboardView`.
  - Dynamically rendered platform engine availability statuses from backend `/platform-services` instead of hardcoding "ONLINE".
  - Surfaced real backend error responses (501 disabled adapter, 409 missing canary health evidence, health probe failures, missing GitHub PAT, missing Twilio credentials).
  - Added dedicated **Deployment Target Adapter** card in Settings and Dashboard guardrails specifying `local_process` mode.
  - Fixed `TwilioCallModal` duration timer to tick strictly when a call is active (`in-progress`/`answered`) and surfaced telephony call errors.

### Phase 5: Autonomous End-to-End Remediation Pipeline (Targeted for 06:00–07:00 AM)
- [ ] Connect `ChunkStream` project (`vishnunandan555/chunkstream` at `/home/vishnunandan555/Projects/chunkstream`).
- [ ] Connect `ChunkStream` Render server (`srv-dbdmotfb9u1s73a82le0`, `https://chunkstream.onrender.com/health`).
- [ ] Stream live Render logs into ProdPilot Logs Explorer.
- [ ] Ingest sample crash log $\rightarrow$ verify automatic triage creates incident.
- [ ] Antigravity agent inspects worktree, writes `test_repro.py`, confirms Red failure, fixes code, confirms Green pass.
- [ ] Canary ports 8001/8002 staged, Jev OpenRouter scores confidence.
- [ ] Telegram alert dispatched with 1-tap Render approval link & Twilio voice call triggers.
- [ ] Tap Approve $\rightarrow$ promotes to local demo process (Port 8000) $\rightarrow$ 10-second watchdog verifies health.

---

## 4. Current Repository Status (validated 24 October 2026, 05:55 IST)

### Validation actually run

| Check | Result | Interpretation |
| :--- | :--- | :--- |
| Full unified test suite (`./run_tests.sh` / `pytest`) | **41 passed, 0 failed in 12.0s** | Complete test suite including API, signed-session security, worktree lifecycle, orchestrator state machine, diagnostic briefs, decision scoring, e2e exit check, Telegram/mobile renderer, Twilio, ingest triage/fingerprinting, and watchdog recovery. |
| Worktree lifecycle management | **Passed** | Creation, tracking in `.worktree/.registry.json`, pathspec exclusions, process-exit (`atexit`) teardown, and stale PID/timeout pruning verified. |
| Desktop production build | **Passed** | `npm run build` completed cleanly in 1.49s (Vite production bundle, zero errors). |
| UI Truthfulness Audit | **Passed** | Zero timer simulations, zero fake PR URLs, truthful engine status telemetry, and explicit error banners for missing credentials or disabled adapters. |
| Local watchdog / auto-revert drill | **Passed** | A deliberately broken local service was reverted; status, audit log, Git head, health recovery, and remediation-attempt cap all passed. |
| Connected Render read path | **Passed** | The configured key retrieved service discovery, connected-service details, five deployment records, and live container logs. |
| Connected Render health probe | **Needs valid endpoint / timeout** | The default saved health URL timed out during initial probe. Needs service-specific URL update and verification. |

| Component | Current assessment | Evidence / limitation |
| :--- | :--- | :--- |
| **Backend API & SQLite** | **Implemented and locally tested** | Incident, project/server, event, worktree, hold/reject, and database paths have source and 41 passing automated tests. |
| **Worktree Lifecycle Management** | **Implemented, verified & pruned** | Atomic branch/worktree isolation, metadata tagging, startup pruning, and process-exit cleanup are active. |
| **Investigation / fix / canary pipeline** | **Locally validated; mock & live adapters** | Repro-first pipeline (red -> fix -> green), side-port canaries (8001/8002), and decision engine run deterministically with `MockAgentAdapter`, with `--live-agent` available for live LLMs. |
| **Approval / deployment** | **Safely verified for local process** | Approval requires persisted canary evidence, a repository, and a patch/suspect commit. Deploys via safe zero-downtime swap on local port 8000 with watchdog auto-revert. Accurately labeled as "Local Demo Deployment". |
| **Render integration** | **Live read operations validated; health probe pending** | Service list/details, deployment history, and logs work with the connected Render account. |
| **GitHub integration** | **Read/PR code implemented; live write requires PAT** | GitHub client and PR workflow are fail-closed when a repo/token is unavailable. Surfaced missing PAT alerts in UI. |
| **UI** | **Build validated; truthful and demo-ready** | Production bundle compiles. Screens are connected to live REST/SSE endpoints without simulated progress timers or mock states. |
| **Incident intake / triage** | **Implemented, verified & deduplicated** | Ingest/triage, SHA-256 fingerprinting, and anti-looping recurrence counters are verified by `test_ingest.py`. |
| **Telegram / Twilio / tunnel** | **Endpoints & renderers verified; dispatch requires tunnel/bot** | Notification renderers (dark-mode mobile HTML, TwiML voice audio, DTMF callbacks) verified. Live push requires active bot token and public tunnel URL. |
| **Auth / security boundary** | **Scoped for local demonstration** | CORS allows all origins and incident/integration routes lack authorization enforcement. Safe for local demo; clearly documented as non-production gateway. |

---

## 5. What to Accomplish Before 10:00 AM IST (4-Hour Plan)

There are approximately **4 hours** remaining until the 10:00 AM working deadline. The focus is executing a **rehearsed, rock-solid, evidence-backed hackathon demo**:

| Timebox | Highest-value deliverable | Step-by-step definition of done |
| :--- | :--- | :--- |
| **06:00–07:00** | **Controlled Incident Pipeline Drill & Golden Seed** | 1. Ingest realistic crash (`KeyError: 'discount'`) via `/ingest`.<br>2. Verify triage creates incident and triggers orchestrator.<br>3. Verify Antigravity worktree creates `test_repro.py` (Red), fixes bug, runs suite (Green).<br>4. Verify Canary 8001 (fix-forward) & 8002 (rollback) stage and score confidence.<br>5. Approve local demo deployment (port 8000) -> watchdog 10s health check verifies -> status `RESOLVED`. |
| **07:00–07:45** | **Cloudflare Public Tunnel & Mobile 1-Tap Review Drill** | 1. Start Cloudflare tunnel (`/tunnel/start` or `cloudflared tunnel`).<br>2. Verify public HTTPS ingress forwarder.<br>3. Open `/incidents/{id}` on an actual mobile device.<br>4. Verify responsive layout, syntax diff display, and test 1-tap mobile approval dispatch. |
| **07:45–08:30** | **Render Service Telemetry & Live Log Stream** | 1. Connect live Render Web Service (`chunkstream` or target service).<br>2. Verify health probe URL and latency measurements.<br>3. Stream live container logs in `LogsView` without mock data. |
| **08:30–09:20** | **Two Full Dry Runs of 3-Minute Presentation Script** | Execute the complete 3-minute pitch from clean state twice:<br>1. *Minute 0:00–0:45*: Problem statement & Model 1 architecture.<br>2. *Minute 0:45–1:45*: Outage detected -> Telegram alert on phone -> Auto-RCA + Red->Green repro in worktree + Canaries staged.<br>3. *Minute 1:45–2:45*: 1-Tap Mobile approval -> Local demo swap -> Watchdog verifies -> Resolved.<br>4. *Minute 2:45–3:00*: Guardrails & post-mortem summary. |
| **09:20–10:00** | **Code Freeze, Proof Artifacts & Submission Prep** | 1. Run final `./run_tests.sh` (ensure 41/41 pass).<br>2. Capture terminal proofs, mobile screenshots, and clean logs.<br>3. Finalize hackathon submission description, repo links, and presentation slides. |

### Explicitly out of scope before 10:00 AM
- Cloud-native Render deploy promotion adapter with deployment-ID polling (ProdPilot uses safe local-process deployment for the hackathon demo).
- Full production OAuth/JWT user authentication gateway.

### What “done” means for the 10:00 AM milestone
The product is **demo-ready and accepted** when:
1. One complete, repeatable incident drill runs from ingest to resolution with an evidence-backed event timeline.
2. The UI truthfully displays real statuses, handles missing credentials with clear alerts, and accurately identifies deployment actions as **"Local Demo Deployment"**.
3. Mobile approval works seamlessly over Cloudflare Tunnel without requiring the developer to sit at their laptop.
4. All 41 automated tests pass cleanly in under 15 seconds.
