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
| **Phase 5: Rehearsals, Seeded Bugs & Video**<br>*(7:00 PM – 1:30 AM)* | **6.5 hours** | 3 consecutive clean runs, 5–8 seeded bugs suite, record 3-min backup video | **Gate 5**<br>*(Freeze)* | 🟡 **IN PROGRESS (ACTIVE)** |
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

## 4. UI Review & Alignment (Current Milestone)

**Focus**: Reviewing and aligning the platform UI architecture across Desktop (Electron) and Web/Mobile (Render) before entering final demo hardening.

- [x] Streamlined navigation: purged dead Copilot views (`SessionView`, `IssuesView`, `AutomationsView`, `CustomizeView`).
- [ ] Align on core platform views:
  1. **Incidents & Operations**: Active incidents, severity badges, live investigation timeline, and mobile resolution buttons.
  2. **Live Telemetry & Logs**: Real-time log stream from Render/Local forwarder with error filtering.
  3. **Repository & Issue Intelligence**: View all repository issues, commit timeline, and PR correlation.
  4. **Team & Service Context**: Multi-service / microservice selector and on-call team roster.
  5. **Platform Settings & Access**: Connected Repo (GitHub PAT), Connected Server (Render API Key / URL), and Cloudflare Tunnel status.

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
