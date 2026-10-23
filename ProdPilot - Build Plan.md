# ProdPilot - Build Plan

**Realm Hack 2026 | Deadline: Tomorrow, 11:00 AM (24 Oct 2026) | Vishnu Nandan**  
**Version**: 2.1 (Authoritative Execution Plan)

> **Current Time**: Friday, 6:25 PM (23 Oct 2026)  
> **Submission Deadline**: Saturday, 11:00 AM (24 Oct 2026)  
> **Total Time Remaining**: **~16.5 Hours**

---

## 1. Timeline & Phase Schedule (16.5-Hour Countdown)

| Phase & Timeline | Duration | Goal | Gate | Status |
|---|---|---|---|---|
| **Phase 0: Setup & Spikes** | Completed | SDK verified, Telegram bot talks, demo service ready, contracts frozen | **Gate 0** | ✅ **PASSED & MERGED** |
| **Phase 1: Core Pipeline** | Completed | Crash becomes incident, verified repro-test + fix from CLI | **Gate 1** | ✅ **PASSED (Tag: `gate-1-passed`)** |
| **Phase 2: Staging, Orchestrator, Telegram** | Completed | Orchestrator daemon, canaries 8001/8002, live SSE stream, Telegram bot | **Gate 2** | ✅ **PASSED (Tag: `gate-2-passed`)** |
| **Phase 3: Desktop Base & Daemon Runner** | Completed | Desktop Mission Control base, unified runner daemon, branding unified | **Gate 3** | ✅ **PASSED (Tag: `gate-3-passed`)** |
| **Phase 4: Platform Hardening & Ingestion Tier**<br>*(6:30 PM – 1:30 AM)* | **7.0 hours** | Render log ingestion, immediate Telegram alert, RCA report, mobile incident webpage, 10s auto-revert watchdog | **Gate 4** | 🟡 **IN PROGRESS (ACTIVE)** |
| **Phase 5: Rehearsals, Seeded Bugs & Video**<br>*(1:30 AM – 3:30 AM)* | **2.0 hours** | 3 consecutive clean runs, 5–8 seeded bugs suite, record 3-min backup video | **Gate 5**<br>*(Freeze)* | ⚪ Queued |
| **Rest & Buffer Window**<br>*(3:30 AM – 8:00 AM)* | **4.5 hours** | Rest & sleep buffer (prevents demo-day fatigue) | — | ⚪ Scheduled |
| **Phase 6: Pitch Slides & Devfolio Submit**<br>*(8:00 AM – 11:00 AM)* | **3.0 hours** | Fresh clone dry-run, pitch deck polish, Devfolio submission freeze | **Ship** | ⚪ Queued |

---

## 2. Architecture & Workstream Division

```
┌─────────────────────────────────┐   ┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│ Stream A: Ingest & Triage Tier  │   │ Stream B: Fixing & Safety Guard │   │ Stream C: Mobile & Web Comms    │
├─────────────────────────────────┤   ├─────────────────────────────────┤   ├─────────────────────────────────┤
│ • Branch: stream-triage         │   │ • Branch: stream-agent          │   │ • Branch: stream-ui             │
│ • Render Log API Ingest         │   │ • Antigravity SDK Fix Loop      │   │ • Immediate Telegram Alert      │
│ • Rule-Based Triage Filter      │   │ • Firecrawl Error Doc Scraper   │   │ • Mobile Webpage /incidents/{id}│
│ • Low-Severity Issue Handler    │   │ • Isolated Worktree & PR Opener │   │ • 1-Tap Mobile Actions          │
│ • SQLite Fingerprint & Anti-Loop│   │ • 10s Post-Deploy Watchdog Guard│   │ • n8n Webhook Dispatcher        │
└─────────────────────────────────┘   └─────────────────────────────────┘   └─────────────────────────────────┘
```

### Folder Ownership:
- **Stream A**: `backend/prodpilot/ingest/`, `backend/prodpilot/triage/`, `backend/prodpilot/db.py`
- **Stream B**: `backend/prodpilot/agents/`, `backend/prodpilot/pipeline/`, `backend/prodpilot/staging/deploy.py`
- **Stream C**: `backend/prodpilot/api/`, `telegram/`, `desktop/`

---

## 3. Active Phase: Phase 4 (6:30 PM – 1:30 AM) – Gate 4

**Goal**: Production monitoring receives Render/Local logs $\rightarrow$ High-severity outage triggers immediate Telegram alert with live mobile webpage link $\rightarrow$ Investigation agent creates Root Cause Report $\rightarrow$ Recovery agent stages rollback and Fix agent crafts verified PR $\rightarrow$ Developer resolves from phone $\rightarrow$ 10s watchdog confirms health or auto-reverts.

### Stream A Tasks (Ingestion, Triage & Anti-Looping):
- [ ] **Render & Forwarder Log Ingest (`backend/prodpilot/ingest/`)**:
  - Implement `/ingest` REST endpoint receiving batched log lines with timestamps and levels.
  - Add `scripts/forwarder.py` to tail local service logs or fetch from Render REST API (`/services/{serviceId}/logs`).
- [ ] **Lightweight Triage & Severity Classifier (`backend/prodpilot/triage/`)**:
  - Fast rule filter: extracts 5xx, unhandled exceptions, and `/health` failures.
  - Classifies events into `HIGH` (Severe Outage) vs `LOW` (Minor Issue).
  - Safety Override: any fatal crash or service exit is unconditionally forced to `HIGH`.
- [ ] **Low-Severity Issue Creator**:
  - On `LOW` classification, synthesize diagnostic brief and create a non-urgent GitHub Issue with `severity:low` tag.
- [ ] **Anti-Looping Fingerprint Store (`backend/prodpilot/db.py`)**:
  - Normalize stack traces and compute SHA-256 fingerprint.
  - If fingerprint already exists in status `OPEN` or `INVESTIGATING`, increment `recurrence_count` without triggering duplicate agent runs.

### Stream B Tasks (Agent Fixing, Context & Safety Guard):
- [ ] **Investigation & Root Cause Report Generator (`backend/prodpilot/pipeline/investigate.py`)**:
  - Collect stack trace, `git blame` suspect commit, PR review discussion, and Firecrawl doc insights.
  - Generate structured RCA report (summary, severity, timeline, evidence, root cause, suspected commit, recommendation, confidence).
- [ ] **Recovery Decision & Rollback Staging (`backend/prodpilot/staging/recovery.py`)**:
  - Evaluate rollback eligibility; stage clean revert canary on port 8002.
- [ ] **Automated GitHub PR Creation (`backend/prodpilot/pipeline/pr_opener.py`)**:
  - Run Antigravity fixing loop in isolated git worktree: repro test Red $\rightarrow$ Green + full suite pass.
  - Stage fix-forward canary on port 8001.
  - Push branch `prodpilot-fix-<id>` to GitHub and open a Draft Pull Request with test evidence.
- [ ] **10-Second Post-Deploy Watchdog & Auto-Revert (`backend/prodpilot/staging/deploy.py`)**:
  - When approved, swap chosen build to production port 8000.
  - Monitor `/health` for 10 seconds.
  - If health check fails or errors occur, trigger immediate rollback to previous build and mark `AUTO_REVERTED`.
  - Cap automatic remediation attempts at 1.

### Stream C Tasks (Mobile Incident Webpage & Telegram):
- [ ] **Immediate Telegram Alert on Detection (`telegram/bot.py`)**:
  - On Stage 1 (`DETECTED`), immediately send Telegram alert card with incident summary and direct Cloudflare Tunnel URL (`/incidents/{id}`).
  - Do not wait for the investigation report to send the initial page.
- [ ] **Mobile Incident Webpage (`backend/prodpilot/api/`)**:
  - Create a clean, fast mobile web view accessible at `/incidents/{id}` over the active Cloudflare Tunnel.
  - Render: Overview, Live Timeline (SSE), Evidence Drawer, Recovery Canaries (8001 vs 8002), and 1-tap mobile action buttons:
    - **`[🚀 Approve & Deploy Fix]`**
    - **`[⏪ Instant Rollback]`**
    - **`[🛑 Take Over]`**
- [ ] **Post-Report & PR Notification**:
  - When RCA report and PR are ready (`AWAITING_APPROVAL`), send follow-up update to Telegram with links and diff summary.
- [ ] **n8n Webhook Dispatcher (`backend/prodpilot/pipeline/n8n.py`)**:
  - Post incident webhook payload to n8n workflow for external notification orchestration.

---

## 4. Phase 5: Rehearsals, Seeded Bugs & Demo Freeze (1:30 AM – 3:30 AM)

- [ ] **3 Consecutive Clean Runs**:
  - Trigger crash $\rightarrow$ immediate detection $\rightarrow$ RCA report $\rightarrow$ repro test $\rightarrow$ fix verified $\rightarrow$ mobile approval $\rightarrow$ healthy production.
  - Run 3 times consecutively without manual intervention.
- [ ] **Seeded Bug Suite**:
  - Test against 5 distinct failure modes:
    1. `KeyError` (missing dict key in order calculations).
    2. `TypeError` / `NoneType` (unhandled null response).
    3. `IndexError` (empty array access).
    4. Infrastructure / Missing ENV (triggers "Not a Code Bug" escape hatch).
    5. Recurrent crash loop (confirms de-duplication counter works).
- [ ] **Record 3-Minute Backup Demo Video**:
  - High-definition recording showing the mobile approval and desktop timeline, ready as an offline fallback for the judges.
- [ ] **Feature Freeze (1:30 AM Sharp)**: Zero new features past this point.

---

## 5. Phase 6: Pitch Slides & Submission (8:00 AM – 11:00 AM)

- **8:00 AM – 9:15 AM**: Clean clone test from GitHub to verify seamless fresh installation.
- **9:15 AM – 10:15 AM**: Polish pitch deck:
  - Slide 1: The Problem (The 2026 Verification Bottleneck & 3 AM On-Call Burnout).
  - Slide 2: ProdPilot: The Autonomous Production Incident Response Platform.
  - Slide 3: The Secret Sauce (Repro-first verification, Firecrawl context, mitigation-first rollback).
  - Slide 4: Sponsor Power (Render + GitHub + Telegram + n8n + Firecrawl).
  - Slide 5: Live Demo Walkthrough (Mobile-first resolution).
- **10:15 AM – 10:45 AM**: Final dry-run presentation.
- **10:45 AM – 11:00 AM**: Final Devfolio submission!

---

## 6. Demo Script (3-Minute Winning Beat)

1. **0:00 – 0:30**: Show Mission Control connected to Render/Local server. Trigger Low-severity warning $\rightarrow$ shows non-urgent GitHub Issue created without midnight paging.
2. **0:30 – 1:15**: Trigger severe crash (`./scripts/trigger-crash.sh`). Production goes down. Detection triggers immediately $\rightarrow$ phone buzzes on Telegram with the live incident link.
3. **1:15 – 2:00**: Investigation agent produces RCA report; Antigravity agent in worktree proves the fix: `test_repro.py` turns Red $\rightarrow$ Green. Canaries 8001 and 8002 stand ready. GitHub PR opens.
4. **2:00 – 2:40**: Tap mobile link on phone. Show responsive mobile incident page (`/incidents/{id}`). Tap **Deploy Fix** directly from bed.
5. **2:40 – 3:00**: Production port 8000 restores healthy. 10s watchdog confirms health. Show auto-generated post-mortem report and wrap up.
