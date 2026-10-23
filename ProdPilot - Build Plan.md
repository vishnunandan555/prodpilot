# ProdPilot - Master Execution & Architecture Plan
## Autonomous Production Incident Response Platform (Render + GitHub Integration)

**Realm Hack 2026 | Working deadline: 24 Oct 2026, 11:00 AM IST | Vishnu Nandan**

**Version**: 3.7 (Validated implementation audit, 24 Oct 2026 05:12 IST)

> **Reality check — 24 Oct 2026:** This plan previously described several integrations and end-to-end behaviors as verified. A source review of the current repository does not support those claims. The implementation has useful real API clients, UI screens, ingestion/triage, and a separately runnable remediation pipeline, but the core production incident lifecycle is not yet reliably connected end to end. Treat old “ONLINE”, “LIVE”, “verified”, and “ready” statements below as historical notes until the checks in §4 are completed against the current code and target accounts.

### Current maturity estimate

This is a weighted estimate of the promised product, not a count of files or UI screens. It incorporates the validation recorded in §4.

| Delivery state | Estimate | Meaning |
| :--- | :---: | :--- |
| **Properly implemented and locally validated** | **~40%** | FastAPI/SQLite foundation, incident APIs, ingestion/triage/deduplication, isolated worktrees and repro-first pipeline, local canary/decision flow, local watchdog auto-revert, notification rendering, and the React/Electron build have executable evidence. |
| **Partially implemented** | **~30%** | Background watcher/worker wiring, Render and GitHub integration UI, PR preparation, mobile flows, and notifications have useful code, but some paths are only unit-tested, configuration-dependent, or not validated together. |
| **Barely implemented / not yet trustworthy** | **~20%** | Provider-facing recovery, authentication/authorization, live approval delivery, production health monitoring, and the agent path have code or UI surfaces but lack the safety and live evidence needed for a real production claim. |
| **Still missing** | **~10%** | A real Render deployment/rollback adapter, authenticated public API boundary, and a fully evidenced controlled end-to-end drill remain absent. |

**Practical answer:** about **40% is properly implemented for a local/demo workflow**. About **60% remains partial, barely implemented, or missing** when judged against the headline promise of safe autonomous production recovery. The implementation should currently be presented as a **connected incident-response prototype with a locally validated remediation demo**, not as autonomous production deployment software.

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

## 4. Current Repository Status (validated 24 October 2026)

### Validation actually run

| Check | Result | Interpretation |
| :--- | :--- | :--- |
| Backend tests excluding stale end-to-end expectation | **25 passed** | Core API, worktree, orchestration, brief, decision, notification/mobile, Twilio-TwiML, and adapter tests pass locally. |
| Full backend test suite | **1 failed, 25 passed** | `test_full_pipeline_exit_check` expects HTTP 200 from approval. The endpoint correctly returns **501** because `PRODPILOT_DEPLOY_TARGET` is deliberately disabled. The test must be rewritten to assert the fail-closed behavior, or explicitly enable the local demo target. |
| Desktop production build | **Passed** | `npm run build` completed successfully (Vite production bundle). |
| Local watchdog / auto-revert drill | **Passed** | A deliberately broken local service was reverted; status, audit log, Git head, health recovery, and remediation-attempt cap all passed. This is a local-process check, not a Render deployment check. |
| Connected Render read path | **Passed** | The configured key retrieved service discovery, connected-service details, five deployment records, and ten live log entries. |
| Connected Render health probe | **Failed / timed out** | The saved health URL did not complete the client probe. Do not show this server as independently health-verified until its URL/timeout is corrected and re-tested. |

| Component | Current assessment | Evidence / limitation |
| :--- | :--- | :--- |
| **Backend API & SQLite** | **Implemented and locally tested** | Incident, project/server, event, worktree, hold/reject, and database paths have source and automated-test evidence. The current DB has one configured project/server and one incident awaiting approval. |
| **Render integration** | **Live read operations validated; health incomplete** | Service list/details, deployment history, and logs work with the connected Render account. The probe for the configured health URL timed out. No provider mutation is implemented. |
| **GitHub integration** | **Read/PR code implemented; live write unvalidated** | GitHub client and PR workflow are fail-closed when a repo/token is unavailable. A GitHub PAT is not configured, so no real issue/PR/workflow query or PR creation was tested. |
| **UI** | **Build validated; runtime behavior mixed** | The production bundle compiles. Screens are substantial, but timer-driven registration/progress UI should not be presented as live backend completion. |
| **Incident intake / triage** | **Implemented and wired** | Ingest/triage and fingerprinting exist. The API startup watcher polls the active Render service and the supervised worker selects eligible `OPEN` incidents for `process_incident`. This exact chain was not run against a controlled live crash. |
| **Investigation / fix / canary pipeline** | **Locally validated; live-agent path partial** | Repro-first pipeline, isolated worktree, decision logic, and local staging are covered by tests. The configured Gemini key is absent; a real model-generated patch is unvalidated. |
| **Approval / deployment** | **Safely disabled for provider use** | Approval requires persisted canary evidence, a repository, and a patch/suspect commit. It returns 501 unless the explicit local-process target is enabled. There is no Render deploy or rollback adapter. |
| **GitHub PR workflow** | **Fail-closed and human-review-only** | Current workflow creates a branch/PR when credentials work; it does not fabricate a PR and does not merge or deploy. Live operation is untested because no PAT is configured. |
| **Telegram / Twilio / tunnel** | **Partial** | Telegram configuration is present. Twilio account and phone fields exist but its auth token is absent; no tunnel URL is configured. Delivery, webhook reachability, and caller verification are unvalidated. |
| **Auth / security boundary** | **Barely implemented for public use** | CORS allows all origins and incident/integration routes lack demonstrated authorization enforcement. Do not expose the control API through a public tunnel yet. |

### Realistic completion estimate

The status in the summary table is the planning baseline: **~40% properly implemented, ~30% partial, ~20% barely implemented, ~10% missing.** The percentage is intentionally conservative because the unreached portions are safety-critical rather than cosmetic.

---

## 5. What can be accomplished before 11:00 AM IST

There are approximately **5 hours 48 minutes** from the audit timestamp. The achievable objective is a reliable, honest demo—not a safe autonomous Render production-deployer.

| Timebox | Highest-value deliverable | Definition of done |
| :--- | :--- | :--- |
| **05:15–05:45** | Repair validation signal | Update the stale approval test to assert 501 with deployment disabled; add an explicit local-demo test only when the target is enabled; rerun all tests. |
| **05:45–06:30** | Fix and prove live monitoring | Correct the connected service health URL/timeout, then record successful Render health, logs, and triage results. Keep this read-only. |
| **06:30–07:30** | Controlled incident drill | Use a disposable/local target to prove log → one deduplicated incident → worker → brief → repro red/green → canary decision → `AWAITING_APPROVAL`. Capture the event timeline. |
| **07:30–08:30** | Truthful UI/demo polish | Remove or label simulated progress; show “local demo deployment” distinctly from Render; surface missing-credential/health errors clearly. |
| **08:30–09:30** | Notification readiness | Configure and send one real Telegram test; only attempt Twilio after adding the missing auth token and a reachable tunnel. |
| **09:30–10:15** | Demo hardening | Restart from a clean state, rerun tests/build, seed one prepared incident, and rehearse the 3-minute path twice. |
| **10:15–11:00** | Buffer and presentation evidence | Freeze code, collect terminal/test evidence, record the live Render read proof, and prepare a concise limitation statement. |

### Explicitly out of scope before 11:00 AM

- A real Render deployment/rollback implementation with deployment-ID tracking and provider verification.
- Public tunnel exposure before route authentication, authorization, webhook signature checks, and restricted CORS exist.
- Claiming live Gemini remediation, GitHub PR creation, or Twilio escalation without their missing credentials and an observed successful run.

### What “done” means for the next milestone

The next milestone is **one repeatable, evidence-backed incident drill through approval**. It is accepted when the drill shows real Render monitoring where available, contains no misleading success state, cannot deploy without explicit operator approval, and produces a truthful timeline. Until a provider adapter and public API security are complete, describe ProdPilot as an integration dashboard plus a locally validated incident/remediation prototype—not an autonomous production recovery system.
