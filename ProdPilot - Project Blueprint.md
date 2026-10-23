# ProdPilot - Project Blueprint
## Autonomous Production Incident Response Platform

**Realm Hack 2026 | Agentic AI Track**  
**Author**: Vishnu Nandan, Christ College of Engineering  
**Version**: 2.1 (Authoritative Blueprint)

---

### 1. Product Vision

ProdPilot is a production monitoring and incident response platform that connects a production server and source code repository to continuously monitor application health, detect incidents, investigate root causes, and coordinate recovery.

The platform automates the incident lifecycle while maintaining developer control over production changes.

**Core objective:** Detect production failures, understand their causes, prepare recovery actions, and enable developers to resolve incidents without needing to immediately open their laptops.

---

### 2. Problem Statement

Production failures require developers to manually:
- Monitor logs and identify errors.
- Determine incident severity.
- Collect relevant production evidence.
- Investigate recent code changes.
- Identify the root cause.
- Decide whether rollback or a code fix is appropriate.
- Implement, test, and deploy fixes.
- Verify production health.

This process is time-consuming and requires developers to switch between infrastructure dashboards, repositories, terminals, communication tools, and monitoring systems.

ProdPilot aims to automate these repetitive operations and prepare actionable incident reports and recovery options.

---

### 3. Product Principles

1. **Autonomous investigation:** Agents collect evidence and identify potential root causes without requiring developers to initiate every step.
2. **Human-controlled production changes:** Developers retain control over code approval and production remediation.
3. **Evidence-based decisions:** Reports distinguish confirmed evidence from hypotheses.
4. **Safe recovery:** Rollback and remediation require appropriate safety checks.
5. **Persistent incident history:** Previous incidents and failed recovery attempts inform future investigations.
6. **Lightweight monitoring:** Continuous monitoring should not require expensive LLM execution for every log entry.
7. **Mobile accessibility:** Developers can understand incidents and monitor progress from their phones.
8. **Modular integrations:** Infrastructure providers and communication services should be replaceable without redesigning the incident pipeline.

---

### 4. Product Architecture & Core Components

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Production Infrastructure                              │
│         (Render REST API v1 / Local Service Forwarder on Port 8000)                    │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Log Stream & Health Checks
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              A. Production Monitoring Service                          │
│     • Continuous log receiver & buffer                                                 │
│     • Rule filter: 5xx, unhandled tracebacks, failed /health                           │
│     • Severity classifier: High (Severe) vs Low (Issue)                                │
│     • Fingerprinting & de-duplication (anti-crash loop)                                │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Dispatches Incident Signal
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              B. Incident Orchestrator                                  │
│     • Authoritative owner of incident state machine                                    │
│     • Manages lifecycle: DETECTED -> INVESTIGATING -> REPORT_READY ->                  │
│       RECOVERY_DECISION -> ROLLBACK / FIXING -> PR_READY -> AWAITING_APPROVAL ->       │
│       DEPLOYING -> VERIFYING -> RESOLVED                                               │
│     • Records transitions, dispatches agents, handles human gates                      │
└───────┬───────────────────┬───────────────────┬───────────────────┬────────────────────┘
        │                   │                   │                   │
        ▼                   ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│C.Investigation│   │ D. Recovery  │    │   E. Fix     │    │F.Verification│
│    Agent     │    │    Agent     │    │    Agent     │    │    Agent     │
├──────────────┤    ├──────────────┤    ├──────────────┤    ├──────────────┤
│• Collect logs│    │• Rollback    │    │• Antigravity │    │• 10s health  │
│• Git blame   │    │  eligibility │    │  SDK loop    │    │  watchdog    │
│• PR reviews  │    │• Stage 8002  │    │• Repro test  │    │• Auto-revert │
│• Root Cause  │    │  canary      │    │  (Red->Green)│    │  if broken   │
│  Report (RCA)│    │• Mitigate vs │    │• Stage 8001  │    │• Confirm     │
│• Telegram ping│   │  fix decision│    │• Open PR     │    │  resolution  │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
        │                   │                   │                   │
        └───────────────────┴─────────┬─────────┴───────────────────┘
                                      ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                         G. Incident History & SQLite Store                             │
│     • schema.sql: incidents, incident_events, reports, artifacts, decisions            │
│     • Anti-looping: stores fingerprints, failure reasons, prevents repeated bad fixes  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 5. Incident Severity Classification

ProdPilot initially uses two severity categories.

#### Low — Issue
Low-severity incidents do not require immediate autonomous remediation.
- **Examples**: Non-critical application errors, occasional failed requests, recoverable warnings, minor performance degradation, non-critical background task failures.
- **Workflow**:
  1. Detect issue.
  2. Create incident record in state `DETECTED`.
  3. Collect relevant logs.
  4. Generate diagnostic report $\rightarrow$ `REPORT_READY`.
  5. Create GitHub issue with labels `severity:low` $\rightarrow$ `ISSUE_CREATED`.
  6. Notify or record the issue $\rightarrow$ `WAITING_FOR_DEVELOPER`.
  7. No autonomous production rollback or code deployment.

#### High — Severe
High-severity incidents require immediate investigation and recovery coordination.
- **Examples**: Application crash, critical service unavailable, persistent database connection failures, severe error spikes, production deployment regression.
- **Workflow**:
  1. Detect incident $\rightarrow$ `DETECTED`. Immediate Telegram alert with incident web link!
  2. Collect production evidence $\rightarrow$ `INVESTIGATING`.
  3. Investigate root cause & generate report $\rightarrow$ `REPORT_READY`.
  4. Evaluate rollback vs fix $\rightarrow$ `RECOVERY_DECISION`.
  5. Execute permitted recovery (stage rollback 8002) or prepare fix PR (stage fix 8001) $\rightarrow$ `ROLLBACK` or `FIXING` $\rightarrow$ `PR_READY`.
  6. Notify developer $\rightarrow$ `AWAITING_APPROVAL`.
  7. On approval, merge and deploy $\rightarrow$ `DEPLOYING`.
  8. Monitor production health $\rightarrow$ `VERIFYING`.
  9. Resolve or escalate $\rightarrow$ `RESOLVED` / `ESCALATED`.

---

### 6. High-Severity Incident 10-Stage Lifecycle

#### Stage 1 — Detection
- The monitoring agent detects a severe issue.
- Orchestrator creates incident containing: Incident ID, Service, Severity, Detection timestamp, Error description, Occurrence count, Initial logs, Incident status.
- Incident is immediately visible in the dashboard and accessible via mobile URL (`/incidents/{id}`).
- **Telegram notification is sent immediately without waiting for the investigation report.**

#### Stage 2 — Evidence Collection
The investigation pipeline collects:
- Relevant production logs & stack traces.
- Error frequency & incident timeline.
- Current and previous deployments.
- Recent commits (`git log -n 5`) & git blame suspect commit.
- Relevant source files.
- Previous incidents from SQLite.
- Related PR discussion and error documentation (via Firecrawl).

#### Stage 3 — Root Cause Investigation
The investigation agent analyzes prepared evidence:
1. Identifies affected service & start time.
2. Correlates errors with deployments and commits.
3. Analyzes affected code files.
4. Distinguishes: Confirmed findings, Suspected causes, Missing evidence, Confidence level, and Recommended actions.

#### Stage 4 — Root Cause Report
Structured RCA report includes:
- **Incident summary**: What broke and affected service.
- **Severity**: High.
- **Timeline**: Detection, deployment, investigation events.
- **Evidence**: Stack traces, blamed commit SHA and author.
- **Root cause**: Most likely explanation supported by code evidence.
- **Suspected commit**: Linked PR discussion and rationale.
- **Recovery recommendation**: Rollback vs Code Fix.
- **Confidence**: High / Medium / Low.
- Saved in SQLite and immediately rendered on the incident webpage.

#### Stage 5 — Recovery Decision
The recovery agent evaluates whether rollback is appropriate based on:
- Root cause report & deployment history.
- Rollback availability & potential data loss / DB migration compatibility.
- Outgoing options: Safe rollback, Fix required, Developer approval required, or Manual intervention required.

#### Stage 6 — Rollback
When rollback is selected:
1. Identify previous deployment.
2. Validate rollback eligibility.
3. Stage rollback canary on port 8002.
4. Verify original failure is resolved on canary.

#### Stage 7 — Code Remediation
If rollback is insufficient, or to produce the permanent fix:
1. Load prepared context bundle (report, logs, source code, suspect commits, PR reviews).
2. Create isolated branch (`prodpilot-fix-<id>`) in a dedicated git worktree.
3. Write reproduction test verifying failure on unmodified code (Red).
4. Implement fix in code.
5. Verify reproduction test passes (Green) and full regression suite passes.
6. Stage fix-forward canary on port 8001.
7. Create a GitHub Pull Request with test evidence and link.

#### Stage 8 — Developer Approval
The developer receives:
- Mobile alert with direct link to `/incidents/{id}`.
- Incident summary, RCA report, recovery recommendation.
- Rollback result (Port 8002) and Proposed PR diff + test evidence (Port 8001).
- Actions: **`[Approve & Deploy Fix]`**, **`[Approve Rollback]`**, **`[Reject]`**, or **`[Take Over]`**.

#### Stage 9 — Deployment
After approval:
1. Promote chosen canary to production (port 8000 or Render service).
2. Merge PR if fix-forward was approved.
3. Track deployment status and monitor production logs.
4. Verification agent engages 10-second post-deploy watchdog.
5. If health check fails: auto-revert to previous known-good release and escalate.

#### Stage 10 — Incident Resolution
Once production health is verified:
- Mark incident `RESOLVED`.
- Record final root cause, recovery action, commit SHA, and post-mortem report in SQLite.
- Update incident history for future loop prevention.
- Notify developer on Telegram and Dashboard.

---

### 7. Mobile Incident Management (`/incidents/{id}`)

Every incident has its own webpage accessible over the active Cloudflare Tunnel.

1. **Incident Overview**: Incident ID, Severity, Service, Status badge, Detection time, Root cause summary, Recovery recommendation.
2. **Live Timeline**: Real-time SSE updates (`DETECTED` $\rightarrow$ `INVESTIGATING` $\rightarrow$ `REPORT_READY` $\rightarrow$ `AWAITING_APPROVAL` $\rightarrow$ `RESOLVED`).
3. **Evidence Drawer**: Stack traces, blamed commits, PR reviews, and Firecrawl doc insights.
4. **Recovery Status**: Live canary health (Canary 8001 fix vs Canary 8002 rollback), PR link, and test results.
5. **Developer Controls**: 1-tap mobile action buttons:
   - `[🚀 Approve & Deploy Fix (8001)]`
   - `[⏪ Instant Rollback (8002)]`
   - `[🛑 Take Over]`

---

### 8. GitHub Integration

- **Repository Connection**: Configured with repo owner/name, local checkout path, and fine-grained PAT.
- **Incident-to-Code Correlation**: Correlates stack traces via `git blame` against recent commits and PR discussions.
- **Low-Severity Issues**: Automatically files a GitHub issue with diagnostic brief and logs.
- **High-Severity Fixes**: Fix agent pushes branch `prodpilot-fix-<id>` and opens a PR with evidence.

---

### 9. Incident History & Loop Prevention

ProdPilot maintains an incident knowledge base in SQLite:
- **Stack Trace Fingerprinting**: Normalizes traces and stores SHA-256 hash. Repeat crashes increment `recurrence_count` rather than spawning duplicate runs.
- **Past Recovery Outcomes**: Stores what was attempted, what succeeded, and what failed.
- **Capped Loop**: Automatic code fix is capped at 1 attempt before falling back to rollback/escalation.

---

### 10. Integrations & Modularity

- **Core Integrations (Must Have)**:
  - **Render**: Production service hosting, real-time log ingestion via Render API (`/services/{serviceId}/logs`), and deploy triggers.
  - **GitHub**: Repository access, commit history, blame, issues, branches, and PR creation.
  - **Telegram**: Instant developer alert upon detection, RCA report delivery, and direct incident webpage link.
- **Optional Extensions**:
  - **n8n**: Workflow automation for dispatching external notifications and project tracking.
  - **Firecrawl**: Scraping official documentation for external library error codes.
  - **Slack**: Incident channel creation and responder discussion logging.
  - **Adaption AI Labs**: Deferred for future dataset/fine-tuning experiments.

---

### 11. Incident State Machine

```
DETECTED
  │
  ▼
INVESTIGATING
  │
  ▼
REPORT_READY
  │
  ▼
RECOVERY_DECISION
  │
  ├──────────────────────────────┐
  ▼                              ▼
ROLLBACK                       FIXING
  │                              │
  └──────────────┬───────────────┘
                 ▼
              PR_READY
                 │
                 ▼
         AWAITING_APPROVAL
                 │
                 ▼
             DEPLOYING
                 │
                 ▼
             VERIFYING
                 │
                 ▼
             RESOLVED

* Auxiliary States: ESCALATED, FAILED, CANCELLED, MANUAL_TAKEOVER
* Low-Severity Flow: DETECTED -> REPORT_READY -> ISSUE_CREATED -> WAITING_FOR_DEVELOPER
```

---

### 12. 3-Minute Hackathon Demo Script

1. **0:00 – 0:30 (Monitoring & Low Severity)**:
   - Show Production Mission Control connected to Render / local service.
   - Send low-severity warning: ProdPilot classifies as `Low`, files a GitHub issue, and leaves the phone quiet.
2. **0:30 – 1:15 (Outage Detection & Immediate Page)**:
   - Run `./scripts/trigger-crash.sh`.
   - Production returns 500 error. Detection triggers immediately $\rightarrow$ phone buzzes on Telegram with the live incident link.
3. **1:15 – 2:00 (Autonomous Investigation & Dual Staging)**:
   - Investigation agent collects logs, blames commit, extracts PR context, and generates RCA report.
   - Recovery agent stages Rollback canary on 8002.
   - Fix agent writes `test_repro.py`, verifies Red $\rightarrow$ Green, stages Fix canary on 8001, and opens GitHub PR.
4. **2:00 – 2:40 (Mobile Review & 1-Tap Resolution)**:
   - Open incident link on mobile. Review the RCA report, diff, and test evidence.
   - Tap **`[🚀 Approve & Deploy Fix]`** directly from mobile.
5. **2:40 – 3:00 (Watchdog Verification & Resolution)**:
   - Production port 8000 restores to 200 OK.
   - 10s watchdog confirms health. Incident transitions to `RESOLVED` and post-mortem report is saved.
