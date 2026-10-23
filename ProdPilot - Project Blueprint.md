# ProdPilot - Project Blueprint
## Autonomous Production Incident Response Platform

**Realm Hack 2026 | Agentic AI Track**  
**Author**: Vishnu Nandan, Christ College of Engineering  
**Version**: 2.2 (Model 1 Hybrid Architecture)

---

### 1. Product Vision

ProdPilot is an autonomous production monitoring and incident response platform that connects a production server and source code repository to continuously monitor application health, detect incidents, investigate root causes, and coordinate recovery.

The platform automates the incident lifecycle while maintaining strict developer control over production changes.

**Core objective:** Detect production failures, understand their causes, prepare recovery actions, and enable developers to resolve incidents remotely from their phones without needing to immediately open their laptops.

---

### 2. Problem Statement

Production failures require developers to manually:
- Monitor logs and identify errors across disconnected tools.
- Determine incident severity and impact.
- Collect relevant production evidence and stack traces.
- Investigate recent code changes with `git blame`.
- Identify the root cause and research documentation.
- Decide whether rollback or a code fix is appropriate.
- Implement, test, and deploy fixes.
- Verify production health post-deployment.

This process is stressful, time-consuming, and error-prone, especially during off-hours outages at 3:00 AM.

ProdPilot automates these operational tasks, prepares evidence-based incident reports, stages recovery options, and provides a 1-tap mobile decision workflow.

---

### 3. Product Principles

1. **Autonomous investigation:** Agents collect evidence, correlate commits, and identify root causes without requiring developers to initiate every step.
2. **Human-controlled production changes:** Developers retain final approval over code merges and production remediation. Agents never autonomously merge to production.
3. **Evidence-based decisions:** Reports strictly distinguish confirmed evidence from hypotheses.
4. **Safe recovery:** Rollback and remediation require deterministic verification and post-deploy health checks.
5. **Persistent incident history:** Previous incidents and failed recovery attempts inform future investigations to prevent loops.
6. **Lightweight monitoring:** Continuous monitoring avoids expensive LLM calls on every log line; uses fast rule filters.
7. **Mobile accessibility:** Developers can inspect incidents, view diffs, and approve recovery from their phones.
8. **Modular integrations:** Infrastructure providers (Render) and communication channels (Telegram, Slack) are cleanly decoupled.

---

### 4. Deployment Architecture: Model 1

For the hackathon, ProdPilot uses **Model 1: Laptop-Hosted Backend + Render-Hosted Website + Cloudflare Tunnel Remote Access**.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   REMOTE DEVELOPER                                     │
│                     (Mobile Phone Browser / Any Web Browser)                           │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              RENDER: PRODPILOT WEBSITE                                 │
│     • Public Frontend (React + Vite build hosted on Render Static Sites)               │
│     • Incident Dashboard & Live Incident Webpage (/incidents/{id})                     │
│     • Real-time SSE Investigation Timeline & Evidence Inspector                        │
│     • 1-Tap Developer Controls: [Deploy Fix], [Rollback], [Take Over]                  │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Outbound HTTPS API Calls
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                  CLOUDFLARE TUNNEL                                     │
│     • Secure, zero-config tunnel from laptop to public internet                        │
│     • No public IP, no port forwarding required on laptop                              │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Forwards requests to http://127.0.0.1:8765
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               LAPTOP: PRODPILOT BACKEND                                │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Backend API (FastAPI on Port 8765)                                            │  │
│  │ 2. Monitoring Engine (Render Log API + Local Forwarder)                          │  │
│  │ 3. Incident Orchestrator (State machine authority)                              │  │
│  │ 4. Investigation Agent (Git blame, PR reviews, RCA report generator)             │  │
│  │ 5. Recovery Agent (Evaluates rollback eligibility, stages 8002 canary)          │  │
│  │ 6. Fix Agent (Google Antigravity SDK: repro test Red->Green, isolated worktree)  │  │
│  │ 7. Verification Watchdog (10-second post-deploy health monitor & auto-revert)    │  │
│  │ 8. Integrations: GitHub API (PRs, issues) & Telegram Bot API (@prodpilotbot)     │  │
│  │ 9. Local Database: SQLite (incidents, events, reports, fingerprints)              │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Core Design Principle:
> *"Render makes ProdPilot accessible. Your laptop makes ProdPilot operational."*

### Division of Responsibility:

| Component | Host Environment | Responsibility |
|---|---|---|
| **Public Website / Webpage** | **Render** | Remotely accessible UI. Displays dashboard, incident timeline, evidence, diff preview, and approval controls. Accessible by phone or laptop. |
| **Backend API** | **Laptop** | FastAPI REST & SSE server (port 8765). Serves incident state, handles approvals, and receives log webhooks. |
| **Monitoring Engine** | **Laptop** | Pulls production logs via Render REST API (`/services/{serviceId}/logs`) or local forwarder. Runs rule filters and severity triage. |
| **Incident Orchestrator** | **Laptop** | Authoritative state machine manager. Tracks state transitions from `DETECTED` to `RESOLVED`. |
| **AI Agents (Investigation, Fix)** | **Laptop** | Runs Google Antigravity SDK and LLM inference locally. Uses git worktrees for isolated code execution and test verification. |
| **Canary Staging & Watchdog** | **Laptop** | Boots side-port canaries (8001 Fix-Forward, 8002 Rollback). Executes 10s post-deploy health watchdog. |
| **Database** | **Laptop** | Local SQLite database (`prodpilot.db`) storing incidents, audit events, fingerprints, and reports. |
| **Remote Connectivity** | **Cloudflare Tunnel** | Bridges Render frontend and mobile phones to the laptop backend securely. |

### Limitations & Security:
- **Laptop Online Requirement**: The laptop must be awake and connected to the internet during the demo. Render hosts the UI, but operational actions require the laptop backend.
- **Credential Isolation**: Production tokens and GitHub PAT stay on the laptop. AI agents run in isolated git worktrees without access to root system credentials.
- **Human-in-the-Loop**: Agents cannot merge pull requests or deploy to production without explicit developer approval via the Render website or Telegram.

---

### 5. High-Severity Incident 10-Stage Lifecycle

```
DETECTED ──> INVESTIGATING ──> REPORT_READY ──> RECOVERY_DECISION ──> [ROLLBACK or FIXING]
                                                                              │
RESOLVED <── VERIFYING <── DEPLOYING <── AWAITING_APPROVAL <── PR_READY <─────┘
```

#### Stage 1 — Detection
- Monitoring engine detects crash or 5xx anomaly via Render API or local log forwarder.
- Orchestrator creates incident in state `DETECTED`.
- **Immediate Telegram alert sent to developer with direct link to the Render-hosted incident webpage (`https://prodpilot.onrender.com/incidents/{id}`).**

#### Stage 2 — Evidence Collection
- Collects raw production logs and stack traces.
- Computes SHA-256 fingerprint of the cleaned stack trace (prevents crash-loop duplication).
- Fetches recent commits (`git log -n 5`) and runs `git blame` to isolate the suspect commit.
- Pulls linked PR discussions and reviewer comments from GitHub.

#### Stage 3 — Root Cause Investigation
- Investigation agent correlates stack trace with the suspect commit.
- Distinguishes confirmed findings from hypotheses.
- Formulates a structured Root-Cause Analysis (RCA) report.

#### Stage 4 — Root Cause Report
- Report structured with: Summary, Affected Service, Severity, Timeline, Evidence, Root Cause, Suspected Commit, and Recommendation.
- Saved in SQLite and immediately visible on the Render incident webpage.

#### Stage 5 — Recovery Decision
- Recovery agent evaluates rollback eligibility:
  - Is previous deployment available?
  - Does rollback risk data loss or break DB migrations?
- Decides whether immediate Rollback is recommended or a code fix is required.

#### Stage 6 — Rollback Staging
- Reverts suspect commit in a clean worktree.
- Boots Rollback canary on Port 8002.
- Verifies health check on Canary 8002.

#### Stage 7 — Code Remediation (Fix Agent)
- Fixing agent (Google Antigravity SDK) operates in an isolated git worktree.
- Crafts a reproduction test verifying the failure on unmodified code (Red).
- Applies patch to resolve the defect.
- Verifies reproduction test passes (Green) and full regression suite passes.
- Boots Fix-Forward canary on Port 8001.
- Pushes branch `prodpilot-fix-<id>` and opens a GitHub Pull Request with test evidence.

#### Stage 8 — Developer Approval
- Developer inspects incident from their phone via the Render website:
  - Incident Summary & RCA Report.
  - Rollback Canary status (Port 8002).
  - Fix-Forward Canary status (Port 8001) & GitHub PR diff.
- Developer taps: **`[🚀 Approve & Deploy Fix]`**, **`[⏪ Instant Rollback]`**, or **`[🛑 Take Over]`**.

#### Stage 9 — Deployment & Verification Watchdog
- Approved build is deployed to production (Port 8000 or Render service).
- If fix was approved, PR is merged.
- **Verification Watchdog** monitors production `/health` for 10 seconds.
- If health check fails: **automatic emergency rollback** is triggered, and incident is marked `AUTO_REVERTED`.

#### Stage 10 — Incident Resolution
- If production remains healthy: incident is marked `RESOLVED`.
- Post-mortem report is finalized and saved in SQLite.
- Incident history is updated to prevent future regressions.

---

### 6. Low-Severity Incident Lifecycle

For non-critical issues (handled exceptions, recoverable warnings, single 404 spikes):
1. Monitoring detects event $\rightarrow$ classified as `Low`.
2. Diagnostic brief synthesized $\rightarrow$ `REPORT_READY`.
3. Non-urgent GitHub issue created with label `severity:low` $\rightarrow$ `ISSUE_CREATED`.
4. Stored in ProdPilot DB for normal daytime triage $\rightarrow$ `WAITING_FOR_DEVELOPER`.
5. **No midnight Telegram alarms or autonomous production changes.**

---

### 7. UI Architecture: SRE Operations Platform & Mobile Incident Experience

ProdPilot provides a dual-environment UI (Native Desktop Electron & Render-Hosted Web/Mobile) styled with a dark, high-contrast SRE operations aesthetic inspired by Splunk Observability and Epok Log Anomaly Detection.

#### A. 8 Primary Navigation Sections
1. **Dashboard**: High-level production health overview, active incident count, system error rates, log volume timeline, service status grid, and Epok-style live event activity stream.
2. **Incidents**: Incident triage table with severity badges (`SEV-1 Critical`, `SEV-2 High`, `SEV-3 Low`), status filters (`Active`, `Investigating`, `Awaiting Approval`, `Resolved`), search bar, and one-click demo incident simulator.
3. **Incident Details (The Hero Screen)**: Complete operational workspace for a single incident featuring 6 internal tabs:
   - **Tab 1: Overview** (Metadata, affected service, timeline summary, blast radius, quick actions).
   - **Tab 2: Logs & Traces** (Extracted stack traces, surrounding log lines, panic traces).
   - **Tab 3: Investigation & RCA** (Hypothesis vs confirmed facts, suspect commit, `git blame` attribution, confidence rating).
   - **Tab 4: Recovery & Canaries** (Canary 8001 fix-forward, Canary 8002 rollback, health status, 1-tap mobile approval buttons).
   - **Tab 5: Changes & Diffs** (Syntax-highlighted git diff, PR branch link, repro test case).
   - **Tab 6: Timeline & Audit** (Real-time SSE event stream, transition history, agent actions, watchdog verification).
4. **Logs Explorer**: Real-time log streamer with level filtering (ERROR, WARN, INFO, DEBUG), service filtering, and text/regex search.
5. **Services**: Service health catalog (`order_service`, `demo-prod`, etc.) displaying uptime, latency, health endpoint status, and active canaries.
6. **Repositories**: Connected source repo intelligence (GitHub repo link, active branch, recent commits, blame history, and automated PR links).
7. **Agents**: Autonomous agent fleet monitor (Antigravity SDK status, isolated git worktrees, active runs, token/cost telemetry, and safety guardrails).
8. **Team**: On-call rotation roster, escalation tiers, Slack/Telegram notification status, and access control.
9. **Settings**: Connection settings for Render API Key, Render Service ID, Cloudflare Tunnel URL, GitHub PAT, and Telegram Bot token.

#### B. Mobile Incident Experience (`/incidents/{id}`)
On mobile devices (accessed via the Telegram notification link), the Incident Details Hero Screen optimizes for single-hand operational triage:
- Sticky header with severity (`SEV-1`) and status badge.
- Compact 6-tab selector.
- Prominent 1-tap mobile action bar fixed to the bottom:
  - `[🚀 Approve & Deploy Fix]` (Promotes Canary 8001 to prod)
  - `[⏪ Instant Rollback]` (Reverts to Canary 8002)
  - `[🛑 Take Over]` (Pauses agents for manual developer intervention)

---

### 8. Integrations & Technology Stack

| Layer | Component | Host | Purpose |
|---|---|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS | **Render Static Sites** | Public web dashboard and mobile incident pages. |
| **Backend API** | FastAPI, Python 3.11, SSE | **Laptop** (Port 8765) | Authoritative incident orchestrator and agent controller. |
| **Connectivity** | Cloudflare Tunnel (`cloudflared`) | **Laptop $\rightarrow$ Web** | Outbound HTTPS tunnel to expose laptop API securely. |
| **Monitoring** | Render REST API v1 / Forwarder | **Laptop** | Ingests production logs and monitors service health. |
| **Agent Engine** | Google Antigravity SDK (`agy`) | **Laptop** | Multi-agent repro test runner, code fixer, and verifier. |
| **Code Sandboxing**| Git Worktrees (`git worktree`) | **Laptop** | Isolated file execution for reproduction tests and builds. |
| **Database** | SQLite3 (`prodpilot.db`) | **Laptop** | Local ACID store for incidents, events, and reports. |
| **Notifications** | Telegram Bot API (`@prodpilotbot`)| **Visihot / Laptop** | Immediate mobile incident alerts with Render web links. |
| **Code Repository**| GitHub REST API | **GitHub** | Commits, blame, issues, branches, and PR creation. |
| **Workflow (Opt)** | n8n Webhooks | **Cloud / Local** | Multi-channel notification routing. |
| **Docs (Opt)** | Firecrawl API | **Cloud** | External library error documentation scraping. |

---

### 9. 3-Minute Hackathon Demo Script (Model 1 in Action)

1. **Minute 0:00 – 0:30 (The Setup & Live Architecture)**:
   - Show Render-hosted website on a browser: `https://prodpilot.onrender.com`.
   - Explain Model 1: Render hosts the interface for global access; laptop runs the operational backend connected via Cloudflare Tunnel.
   - Show healthy production service.
2. **Minute 0:30 – 1:15 (The Outage & Immediate Mobile Page)**:
   - Trigger production crash (`./scripts/trigger-crash.sh`).
   - Laptop monitoring detects crash within seconds.
   - Phone buzzes on Telegram: **"🚨 SEV-1 Outage: `KeyError: 'discount'` in `order_service`"** with a direct link to the Render website.
3. **Minute 1:15 – 2:00 (Autonomous Investigation on Laptop)**:
   - Laptop orchestrator investigates: runs `git blame`, correlates recent commit, and writes RCA report.
   - Antigravity agent in isolated worktree creates `test_repro.py`, confirms failure (Red), fixes code, confirms pass (Green).
   - Staging manager brings up Rollback canary (8002) and Fix canary (8001).
   - Pull request opened on GitHub.
4. **Minute 2:00 – 2:40 (Remote Mobile Decision)**:
   - Tap the link on phone. Show the live Render webpage: RCA report, diff, and green canaries.
   - Tap **`[🚀 Approve & Deploy Fix]`** directly from mobile.
5. **Minute 2:40 – 3:00 (Watchdog Verification & Resolution)**:
   - Request reaches laptop via Cloudflare Tunnel.
   - Laptop promotes Fix canary to production port 8000.
   - 10-second watchdog confirms production is healthy.
   - Mobile and Render dashboard update to `RESOLVED` with the auto-generated post-mortem.
