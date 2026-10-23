# ProdPilot - Master Execution & Architecture Plan
## Autonomous Production Incident Response Platform (Render + GitHub Integration)

**Realm Hack 2026 | Working deadline: 24 Oct 2026, 11:00 AM IST | Vishnu Nandan**

**Version**: 3.7 (Validated implementation audit, 24 Oct 2026 05:12 IST)

> **Reality check — 24 Oct 2026:** This plan previously described several integrations and end-to-end behaviors as verified. A source review of the current repository does not support those claims. The implementation has useful real API clients, UI screens, ingestion/triage, and a separately runnable remediation pipeline, but the core production incident lifecycle is not yet reliably connected end to end. Treat old “ONLINE”, “LIVE”, “verified”, and “ready” statements below as historical notes until the checks in §4 are completed against the current code and target accounts.

### Current maturity estimate

This is an evidence-based, weighted estimate of the promised product incorporating the latest worktree lifecycle management and unified test suite validation.

| Delivery state | Estimate | Meaning |
| :--- | :---: | :--- |
| **Properly implemented and locally validated** | **~55%** | FastAPI/SQLite foundation, 29/29 passing unified automated tests (~10s runtime), full worktree lifecycle management & process-exit auto-pruning, ingestion/triage/SHA-256 fingerprinting & anti-looping deduplication, repro-first pipeline (red repro -> fix -> green full suite), side-port canary staging (8001/8002), rule-based decision engine, local deployment watchdog with auto-revert & 1-attempt remediation cap, hold/resume/approval REST endpoints, standalone dark-mode mobile HTML renderer, and React/Electron Vite production bundle. |
| **Partially implemented** | **~25%** | Render REST API v1 live discovery, service details, and deployment log stream; GitHub client & PR generator (credential-dependent); Telegram alert dispatch formatting; Twilio TwiML audio generator & DTMF endpoints; Desktop UI views. |
| **Barely implemented / not yet trustworthy** | **~12%** | Cloud-native Render automated promotion (ProdPilot currently deploys via local-process swapping rather than Render cloud API deploys); public API authentication/authorization boundary (open CORS without token authentication on approval endpoints). |
| **Still missing (Out of scope for 11:00 AM)** | **~8%** | Direct Render cloud deployment adapter with deployment-ID polling; OAuth/JWT production auth gateway; multi-tenant public isolation. |

**Practical answer:** about **55% is properly implemented and locally verified for a robust, honest demo**. About **45% remains partial, barely implemented, or cloud-provider-dependent**. The system should be proudly presented as a **connected incident-response & autonomous remediation platform with locally validated verification, canaries, and safety guards**, with Render used for live monitoring/telemetry.

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

## 4. Current Repository Status (validated 24 October 2026, 05:20 IST)

### Validation actually run

| Check | Result | Interpretation |
| :--- | :--- | :--- |
| Full unified test suite (`./run_tests.sh`) | **29 passed, 0 failed in 10.3s** | Complete suite (API, worktree, orchestrator, brief, decide, e2e exit check, telegram/mobile, twilio, ingest, watchdog) passes deterministically without network stalls. |
| Worktree lifecycle management | **Passed** | Creation, tracking in `.worktree/.registry.json`, pathspec exclusions, process-exit (`atexit`) teardown, and stale PID/timeout pruning verified. |
| Desktop production build | **Passed** | `npm run build` completed successfully (Vite production bundle). |
| Local watchdog / auto-revert drill | **Passed** | A deliberately broken local service was reverted; status, audit log, Git head, health recovery, and remediation-attempt cap all passed. |
| Connected Render read path | **Passed** | The configured key retrieved service discovery, connected-service details, five deployment records, and live container logs. |
| Connected Render health probe | **Needs valid endpoint / timeout** | The default saved health URL timed out during initial probe. Needs service-specific URL update and verification. |

| Component | Current assessment | Evidence / limitation |
| :--- | :--- | :--- |
| **Backend API & SQLite** | **Implemented and locally tested** | Incident, project/server, event, worktree, hold/reject, and database paths have source and automated-test evidence. |
| **Worktree Lifecycle Management** | **Implemented, verified & pruned** | Atomic branch/worktree isolation, metadata tagging, startup pruning, and process-exit cleanup are active. |
| **Investigation / fix / canary pipeline** | **Locally validated; mock & live adapters** | Repro-first pipeline (red -> fix -> green), side-port canaries (8001/8002), and decision engine run deterministically with `MockAgentAdapter`, with `--live-agent` available for live LLMs. |
| **Approval / deployment** | **Safely verified for local process** | Approval requires persisted canary evidence, a repository, and a patch/suspect commit. Deploys via safe zero-downtime swap on local port with watchdog auto-revert. No Render cloud deployment adapter. |
| **Render integration** | **Live read operations validated; health probe pending** | Service list/details, deployment history, and logs work with the connected Render account. |
| **GitHub integration** | **Read/PR code implemented; live write requires PAT** | GitHub client and PR workflow are fail-closed when a repo/token is unavailable. Needs live PAT in settings for remote PR writes. |
| **UI** | **Build validated; runtime behavior mixed** | The production bundle compiles. Screens are substantial and functional; should be connected to live SSE streams without timer mocks. |
| **Incident intake / triage** | **Implemented, verified & deduplicated** | Ingest/triage, SHA-256 fingerprinting, and anti-looping recurrence counters are verified by `test_ingest.py`. |
| **Telegram / Twilio / tunnel** | **Endpoints & renderers verified; dispatch requires tunnel/bot** | Notification renderers (dark-mode mobile HTML, TwiML voice audio, DTMF callbacks) verified. Live push requires active bot token and public tunnel URL. |
| **Auth / security boundary** | **Barely implemented for public use** | CORS allows all origins and incident/integration routes lack authorization enforcement. Safe for local demo; do not expose without token checks. |

### Realistic completion estimate

The status in the summary table is the planning baseline: **~55% properly implemented, ~25% partial, ~12% barely implemented, ~8% missing/out-of-scope.**

---

## 5. What can be accomplished before 11:00 AM IST

There are approximately **5 hours 35 minutes** remaining. The achievable objective is a **rock-solid, truthful, end-to-end hackathon demo**:

| Timebox | Highest-value deliverable | Definition of done |
| :--- | :--- | :--- |
| **05:30–06:15** | Fix & prove live Render monitoring | Configure correct health URL for connected Render service, verify live latency probe, and demonstrate live container log streaming in UI/CLI. |
| **06:15–07:15** | Controlled incident drill & evidence capture | Ingest a realistic crash log -> verify triage -> supervised worker -> brief -> red repro test -> code fix -> green suite -> canary staging -> decision -> `AWAITING_APPROVAL`. Record event timeline. |
| **07:15–08:15** | Desktop UI live binding & honesty polish | Ensure UI displays live SSE incident events; clearly label deployment target as "Local Process Demonstration" to eliminate ambiguity; show real worktrees/canaries. |
| **08:15–09:15** | Live notification drill (Telegram & Tunnel) | Start Cloudflare tunnel, send real Telegram crash & approval alerts with live tunnel link, and verify 1-tap review page opens seamlessly on mobile phone. |
| **09:15–10:15** | End-to-end demo dry runs | Reset to clean state, run unified tests, seed demonstration incident, and rehearse the 3-minute pitch twice without hitches. |
| **10:15–11:00** | Code freeze & presentation collateral | Finalize terminal proofs, test reports, mobile screenshots, and prepare the demo narrative and slides. |

### Explicitly out of scope before 11:00 AM

- A cloud-native Render deployment promotion adapter with deployment-ID polling (ProdPilot uses safe local-process deployment for the hackathon demo).
- Full production OAuth/JWT user authentication gateway.

### What “done” means for the next milestone

The next milestone is **one repeatable, evidence-backed incident drill through approval**. It is accepted when the drill shows real Render monitoring where available, contains no misleading success state, cannot deploy without explicit operator approval, and produces a truthful timeline. Until a provider adapter and public API security are complete, describe ProdPilot as an integration dashboard plus a locally validated incident/remediation prototype—not an autonomous production recovery system.
