# ProdPilot - Project Blueprint

**Realm Hack 2026 | Agentic AI Track**  
**Author**: Vishnu Nandan, Christ College of Engineering  
**Version**: 2.0 (Transformed Architecture)

---

## 1. Executive Summary & Pitch

**ProdPilot** is an autonomous production monitoring and incident response platform. It bridges production observability with autonomous code-level remediation and deterministic verification.

> **One-Line Pitch**:  
> *"When production breaks, ProdPilot investigates, fixes, and verifies the bug, then asks a developer for one approval. It never deploys on its own."*

### The Core Difference:
Existing AI SRE tools (Datadog Bits, Sentry Seer, Resolve AI) either stop at unverified PR suggestions or depend purely on surface telemetry. ProdPilot goes the last mile:
1. **Deterministic Verification**: Writes an automated reproduction test that fails on the unmodified code (Red) and passes after the patch (Green) alongside the full regression suite.
2. **Human Context over Raw Telemetry**: Reads the blamed commit's PR description, code review discussions, and web documentation to understand *why* the breaking code was written.
3. **Mitigation-First (Rollback Ready)**: Recognizes that on-call engineers roll back first to restore SLOs; stages an instant **Revert** alongside the **Fix-Forward** patch.
4. **Mobile-First Approval**: Pushes an incident link to Telegram so the responder can inspect the diagnosis, Firecrawl-scraped docs, and diff on a dedicated mobile web page and approve with one tap before turning on a laptop.

---

## 2. The Problem in 2026: The Verification Bottleneck & On-Call Fatigue

AI code generation is now a commodity. The real bottleneck has shifted from *generating code* to *verifying, validating, and remediating it during high-pressure production outages*.

- **The Verification Bottleneck**: 85% of developers report that AI shifted the bottleneck from writing code to reviewing and validating it (GitLab 2026). Over 96% of developers do not fully trust AI-generated code without independent proof (Sonar 2026).
- **On-Call Burnout**: Investigating outages at 3:00 AM requires wading through fragmented dashboards, finding who merged what, running `git blame`, searching error documentation, and guessing whether a hotfix or rollback is safe.
- **Flawed AI Fixes**: Current incident bots hallucinate code patches for infrastructure/config drift or repeat-crash 50 times in a loop when a service restarts.

ProdPilot solves the verification and context gap by pairing autonomous agents with hard deterministic test gates, crash-loop prevention, and human-in-the-loop approvals.

---

## 3. Connected Infrastructure: Repo & Production Server

ProdPilot connects your codebase to your production infrastructure through clean API boundaries:

```
┌────────────────────────────┐              ┌────────────────────────────┐
│      GitHub Repository     │              │  Render Production Server  │
├────────────────────────────┤              ├────────────────────────────┤
│ • GitHub REST API (PAT)    │              │ • Render REST API v1       │
│ • Commits, Blame, Branches │              │ • Live Log Stream (/logs)  │
│ • Pull Requests & Reviews  │              │ • Deploy & Restart API     │
│ • Issues & Discussions     │              │ • Service Status & Metrics │
└──────────────┬─────────────┘              └─────────────┬──────────────┘
               │                                          │
               └───────────────────┬──────────────────────┘
                                   ▼
                   ┌───────────────────────────────┐
                   │    ProdPilot Platform Core    │
                   │  FastAPI + SQLite + Daemon    │
                   └───────────────────────────────┘
```

1. **GitHub Connection**:
   - Authenticated via fine-grained Personal Access Token (PAT).
   - Clones repo locally into isolated git worktrees.
   - Executes `git blame` to isolate breaking commits, extracts associated PR discussions, and opens draft fix PRs.
2. **Production Server Connection (Render & Local Fallback)**:
   - **Render Cloud Service**: Connects to `GET https://api.render.com/v1/services/{serviceId}/logs` to stream server stdout/stderr logs in real time. Deploys/restarts via `POST /services/{serviceId}/deploys`.
   - **Local Microservice Fallback (`demo-prod`)**: For offline demo resilience, a local Docker/Python microservice on port 8000 can be tailed directly via a lightweight log forwarder (`scripts/forwarder.py`).

---

## 4. Sponsor Integrations & Strategic Synergy

ProdPilot integrates 4 key sponsors to create a production-grade incident loop:

| Sponsor | Integration Mechanism | Concrete Value in ProdPilot |
|---|---|---|
| **Render** | Production Hosting, Log API & Deploy Webhooks | Serves as the connected production server. Streams real-time error logs to ProdPilot's triage engine and receives verified deploy/rollback webhooks. |
| **Adaption AI Labs** | Fast Model Router / Lightweight Triage Inference | Powers the 24/7 continuous log triage agent. Analyzes log streams at high throughput with low latency and cost, classifying events into **Severe (High)** vs **Issue (Low)**. |
| **Firecrawl** | Error Code & Documentation Scraper | When an unhandled exception or third-party API error occurs (e.g. Stripe, FastAPI, Pydantic), Firecrawl crawls the official error documentation and community fixes, passing verified technical context into the fixing agent. |
| **n8n** | Incident Dispatch & Webhook Orchestration | Webhook pipeline that triggers upon High-severity incidents to format mobile alert payloads, dispatch Telegram notifications, generate mobile web tokens, and manage responder escalations. |

---

## 5. Multi-Agent System Architecture

ProdPilot replaces monolithic AI pipelines with specialized, decoupled agents:

```
                          [Render / Ingested Server Logs]
                                         │
                                         ▼
                     ┌───────────────────────────────────────┐
                     │    Agent 1: Triage Agent              │
                     │    (Powered by Adaption AI Labs)      │
                     │    Fast rule filter + cheap LLM       │
                     └───────────────────┬───────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼ (Low: Warning / Non-fatal)                    ▼ (High: 5xx / Crash Override)
     ┌───────────────────────┐                       ┌───────────────────────────────────────┐
     │ Low-Severity Handler  │                       │  Agent 2: Diagnosis & Context Agent   │
     │ • Create GitHub Issue │                       │  • Fingerprint & de-duplicate trace   │
     │ • Save brief in DB    │                       │  • Git blame breaking commit          │
     │ • No midnight alert   │                       │  • Scrape PR reviews & Firecrawl docs │
     └───────────────────────┘                       │  • Formulate Root-Cause Report        │
                                                     └───────────────────┬───────────────────┘
                                                                         │
                                                                         ▼
                                                     ┌───────────────────────────────────────┐
                                                     │  Agent 3: Mitigation Decision Agent   │
                                                     │  • Decide: Rollback vs Fix-Forward    │
                                                     │  • Stage Rollback Canary (Port 8002)  │
                                                     │  • Trigger n8n Telegram Mobile Alert  │
                                                     └───────────────────┬───────────────────┘
                                                                         │
                                                                         ▼
                                                     ┌───────────────────────────────────────┐
                                                     │  Agent 4: Fixing Agent                │
                                                     │  (Google Antigravity SDK)             │
                                                     │  • Isolated git worktree/branch       │
                                                     │  • Reproduction test: Red -> Green    │
                                                     │  • Deterministic full suite verify    │
                                                     │  • Stage Fix Canary (Port 8001)       │
                                                     │  • Open GitHub Pull Request           │
                                                     └───────────────────┬───────────────────┘
                                                                         │
                                                                         ▼
                                                     ┌───────────────────────────────────────┐
                                                     │  Human-in-the-Loop Decision Gate      │
                                                     │  (Dedicated Mobile Webpage / Desktop) │
                                                     │  [🚀 Deploy Fix] [⏪ Rollback] [Stop] │
                                                     └───────────────────┬───────────────────┘
                                                                         │
                                                                         ▼
                                                     ┌───────────────────────────────────────┐
                                                     │  Agent 5: Monitor & Verification      │
                                                     │  • Promote chosen canary to port 8000 │
                                                     │  • 10-second post-deploy health watch │
                                                     │  • Auto-revert if still failing       │
                                                     │  • Finalize post-mortem report in DB  │
                                                     └───────────────────────────────────────┘
```

### Agent Roles:
1. **Agent 1: Triage Agent (Adaption AI Labs)**:
   - Continuously evaluates incoming server log batches.
   - Evaluates against rule filters (5xx status, unhandled tracebacks, failed `/health` endpoints).
   - Classifies incident severity: **High (Severe Outage)** vs **Low (Minor Issue)** vs **Infra/Config Drift**.
2. **Agent 2: Diagnosis & Context Agent**:
   - Normalizes and hashes the stack trace into a collision-free fingerprint.
   - Runs `git blame` against the offending file/line to locate the breaking commit author and SHA.
   - Fetches the blamed commit's PR description and review comments.
   - Executes a **Firecrawl** search on the exact error message to fetch official framework solutions.
   - Compiles the initial diagnostic Root-Cause Analysis (RCA) report.
3. **Agent 3: Mitigation Decision Agent**:
   - Assesses the risk of immediate rollback vs waiting for a code fix.
   - Automatically prepares and stages the **Rollback Canary** on port 8002 (clean revert of breaking commit).
   - Hands off context to n8n to page the on-call engineer via Telegram with a direct mobile incident link.
4. **Agent 4: Fixing Agent (Google Antigravity SDK)**:
   - Operates strictly in an isolated git worktree (`backend/prodpilot/pipeline/worktree.py`).
   - Writes a reproduction test verifying the failure on unmodified code (Red).
   - Generates the minimal patch adhering to context from PR reviews and Firecrawl docs.
   - Executes deterministic verification: confirms the repro test passes (Green) and zero regression tests break.
   - Stages the **Fix-Forward Canary** on port 8001.
   - Pushes an isolated branch (`prodpilot-fix-<incident-id>`) and opens a GitHub Pull Request with test evidence.
5. **Agent 5: Monitor & Auto-Revert Agent**:
   - Upon developer approval, promotes the chosen build to production port 8000 (or Render service).
   - Engages an immediate **10-second post-deploy watchdog**.
   - If the health check fails: triggers an **immediate automatic rollback**, flags the incident as `AUTO_REVERTED`, and prevents infinite restart loops.

---

## 6. Incident Lifecycles & Workflows

### Lifecycle A: High-Severity Outage (Hero Path)
1. **Detect**: Render log stream or health watcher captures a 500 error / unhandled exception.
2. **Fingerprint**: Hashes trace; increments recurrence count if known, or creates new incident record.
3. **Context Gathering**: Blames commit, extracts PR discussion ("*we added discount logic for promo*"), queries Firecrawl for error docs.
4. **Mobile Ping**: Telegram bot receives alert with summary and a direct Cloudflare Tunnel URL: `https://prodpilot.tunnel/incidents/{id}`.
5. **Simultaneous Fix & Rollback**:
   - Port 8002 boots with breaking commit reverted (Rollback canary).
   - Antigravity agent crafts failing test `test_repro.py`, patches code, verifies green, and boots on Port 8001 (Fix canary).
   - PR opened on GitHub with diff and test log.
6. **Mobile Review & Approval**: Responder taps link on phone, views root-cause card, diff, and taps **`[🚀 Deploy Fix (8001)]`** or **`[⏪ Rollback (8002)]`**.
7. **Deploy & Verification**: Chosen build replaces production. 10s watchdog passes. Incident marked `RESOLVED`.
8. **Post-Mortem**: Markdown post-mortem document generated and saved to DB.

### Lifecycle B: Low-Severity Issue
1. **Detect**: Non-fatal warning, single 404 spike, or minor handled error.
2. **Triage**: Classified as `Low` by Adaption AI.
3. **Action**: Automatically generates a structured diagnostic brief and opens a non-urgent GitHub Issue with labels `prodpilot-triage` and `severity:low`.
4. **Outcome**: No midnight phone alerts. Stored in ProdPilot DB for normal daytime sprint planning.

### Lifecycle C: Non-Code Issue (Config / Infra Drift)
1. **Detect**: Error logs indicate database timeout, missing environment variable, or cloud quota exhaustion.
2. **Escape Hatch**: Diagnosis agent detects no application code changes in blame history or recognizes infrastructure keywords.
3. **Action**: Bypasses fixing agent. Alerts responder with: *"Infrastructure/Environment Outage Detected (Not a Code Bug)"*, providing raw logs and infrastructure diagnosis without hallucinating code changes.

---

## 7. Mobile-First Incident Experience

On-call engineers are rarely at their desk when an outage hits. ProdPilot treats mobile as a first-class operational interface:

```
┌──────────────────────────────────────────────┐
│ 📱 Telegram Alert                            │
│ 🚨 SEV-1 Outage: KeyError in order_service   │
│ Root Cause: commit c49f1a2 by @alex          │
│ 🔗 Live Incident: https://prodpilot.live/inc │
└──────────────────────┬───────────────────────┘
                       │ (Tap link on mobile)
                       ▼
┌──────────────────────────────────────────────┐
│ 🌐 Mobile Incident Web Page (FastAPI/SSE)   │
│ ┌──────────────────────────────────────────┐ │
│ │ 🔴 OUTAGE: KeyError: 'discount'         │ │
│ │ Service: demo-prod | Port: 8000          │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ 📋 Root Cause Summary                        │
│ Commit c49f1a2 introduced unvalidated dict   │
│ access. Context from PR #14 review noted:    │
│ "make sure discount is optional".            │
│                                              │
│ 📚 Firecrawl Knowledge Insight               │
│ Python KeyError doc: use dict.get('key', 0)  │
│                                              │
│ 🧪 Deterministic Verification                │
│ ✅ tests/test_repro_order.py (Red -> Green)  │
│ ✅ 14/14 existing test suite passed          │
│                                              │
│ 🔍 Canaries Ready:                           │
│ • Canary 8001 (Fix-Forward): Healthy 🟢      │
│ • Canary 8002 (Rollback):    Healthy 🟢      │
│                                              │
│ ──────────────────────────────────────────── │
│ [ 🚀 Approve & Deploy Fix (Port 8001) ]      │
│ [ ⏪ Instant Rollback to Prior Commit ]      │
│ [ 🛑 Take Over (Keep Staged) ]               │
└──────────────────────────────────────────────┘
```

---

## 8. Anti-Looping & Reliability Guardrails

1. **Stack Trace Fingerprinting**:
   - Strips dynamic elements (timestamps, process IDs, memory addresses, line numbers of standard libraries).
   - Generates SHA-256 hash. If the service restarts and crashes 50 times in 5 minutes, it increments `recurrence_count` on the single active incident instead of spawning 50 duplicate investigations.
2. **Single-Attempt Auto-Remediation Cap**:
   - The fixing agent is strictly capped at **1 attempt** per incident. If the synthesized patch fails verification, it does not loop infinitely; it immediately falls back to the staged Rollback canary and alerts the human.
3. **10-Second Post-Deploy Watchdog**:
   - After promoting any fix or rollback to production, the monitor agent polls the `/health` endpoint for 10 seconds.
   - If health check fails or returns 5xx: immediate automated rollback to previous known-good release and status updated to `AUTO_REVERTED`.
4. **Strict Isolation**:
   - The fixing agent operates solely in an isolated git worktree. It has no write permissions to production files or environment variables.

---

## 9. Production Mission Control (Desktop UI)

The desktop application (`desktop/`) serves as the central control plane:
- **Telemetry View**: Live status of connected server (Render / Local), port 8000 health, latency, and uptime.
- **Log Stream Viewer**: Live stream of ingested server logs with color-coded severity levels (Info, Warning, Error, Severe).
- **Incident Drawer**: Chronological feed of active and resolved incidents with recurrence counters and severity badges.
- **Real-Time SSE Timeline**: Visual 9-stage progression (`DETECT` $\rightarrow$ `DIAGNOSE` $\rightarrow$ `REPRODUCE` $\rightarrow$ `FIX` $\rightarrow$ `VERIFY` $\rightarrow$ `STAGE` $\rightarrow$ `AWAIT_APPROVAL` $\rightarrow$ `DEPLOY` $\rightarrow$ `RESOLVED`).
- **Diff & Canary Inspector**: Side-by-side comparison of the Fix-Forward patch vs the Rollback commit.
- **Post-Mortem Library**: Formatted markdown post-mortem reports saved to SQLite.

---

## 10. Technical Stack Summary

- **Core Backend**: Python 3.11+, FastAPI (REST + SSE streaming on port 8765), SQLite with foreign key enforcement.
- **Coding & Remediation Engine**: Google Antigravity SDK (`agy` CLI / Python runtime).
- **Triage & Classification**: Adaption AI Labs API (Fast low-cost LLM routing).
- **Web & Doc Intelligence**: Firecrawl API.
- **Workflow Automation**: n8n Webhook triggers.
- **Comms & Tunneling**: `python-telegram-bot` v22.8, Cloudflare Tunnel (`cloudflared`) for public mobile webhook URLs.
- **Desktop Dashboard**: Vite + React + TypeScript + Electron, matte dark aesthetic.
- **Target Microservice**: FastAPI Python order service (`demo-prod`) with realistic Git commit history.

---

## 11. 3-Minute Demo Script (The Winning Story)

1. **Minute 0:00 – 0:30 (Platform Overview & Log Monitoring)**:
   - Show Production Mission Control. Connect to Render / Local server. Show healthy green heartbeat and log stream.
   - Trigger a low-severity warning: ProdPilot flags it as `Low`, files a non-urgent GitHub issue, and leaves the phone silent.
2. **Minute 0:30 – 1:15 (The Outage & Context Synthesis)**:
   - Execute `./scripts/trigger-crash.sh` introducing a breaking order discount crash.
   - Production returns `500 Internal Server Error`.
   - Adaption AI classifies it as `High`. Diagnosis agent fingerprints trace, blames commit, pulls PR review comments, and Firecrawl fetches error docs.
   - Phone buzzes on Telegram with the mobile link.
3. **Minute 1:15 – 2:00 (Deterministic Proof & Dual Canaries)**:
   - Antigravity agent runs in isolated worktree: writes `test_repro.py`, confirms failure (Red), applies patch, confirms pass (Green), verifies full suite.
   - Staging manager spins up Canary 8001 (Fix-Forward) and Canary 8002 (Rollback).
   - PR is opened on GitHub.
4. **Minute 2:00 – 2:40 (1-Tap Mobile Resolution)**:
   - Tap the mobile link on phone. Show the clean mobile incident report, Firecrawl insight, and diff.
   - Tap **`[🚀 Deploy Fix]`** directly from mobile.
5. **Minute 2:40 – 3:00 (Verification & Post-Mortem)**:
   - Watchdog confirms production restored to `200 OK`.
   - Comprehensive markdown post-mortem report automatically populates on Desktop and Telegram.
