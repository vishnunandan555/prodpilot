# ProdPilot - Build Plan

**Realm Hack 2026 | Deadline: Tomorrow, 11:00 AM (24 Oct 2026) | Vishnu Nandan**  
**Version**: 2.0 (Transformed Architecture & Execution Plan)

> **Current Time**: Friday, 6:20 PM (23 Oct 2026)  
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
| **Phase 4: Platform Hardening & Ingestion Tier**<br>*(6:30 PM – 1:30 AM)* | **7.0 hours** | Render log ingestion, Adaption AI triage, Firecrawl context, mobile incident web page, 10s auto-revert watchdog | **Gate 4** | 🟡 **IN PROGRESS (ACTIVE)** |
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
│ • Render Log API Ingest         │   │ • Antigravity SDK Fix Loop      │   │ • Telegram Mobile Incident Link │
│ • Adaption AI Labs Classifier   │   │ • Firecrawl Error Doc Scraper   │   │ • Mobile Incident Webpage       │
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

**Goal**: Production monitoring connects to Render/Local logs $\rightarrow$ Adaption AI triages events $\rightarrow$ High-severity outage triggers Telegram alert with mobile web link $\rightarrow$ Antigravity agent crafts verified fix with Firecrawl docs $\rightarrow$ Developer resolves from phone $\rightarrow$ 10s watchdog confirms health or auto-reverts.

### Stream A Tasks (Ingestion, Triage & Anti-Looping):
- [ ] **Render & Forwarder Log Ingest (`backend/prodpilot/ingest/`)**:
  - Implement `/ingest` REST endpoint receiving batched log lines with timestamps and levels.
  - Add `scripts/forwarder.py` to tail local service logs or fetch from Render REST API (`/services/{serviceId}/logs`).
- [ ] **Adaption AI Labs Triage Engine (`backend/prodpilot/triage/`)**:
  - Fast rule filter: extracts 5xx, unhandled exceptions, and `/health` failures.
  - Route anomaly logs to Adaption AI Labs endpoint to classify as `HIGH` (Severe Outage) vs `LOW` (Minor Issue) vs `INFRA` (Config/Env Drift).
  - Safety Override: any fatal crash or service exit is unconditionally forced to `HIGH`.
- [ ] **Low-Severity Issue Creator**:
  - On `LOW` classification, synthesize diagnostic brief and create a non-urgent GitHub Issue (or local DB entry) with `severity:low` tag.
- [ ] **Anti-Looping Fingerprint Store (`backend/prodpilot/db.py`)**:
  - Normalize stack traces and compute SHA-256 fingerprint.
  - If fingerprint already exists in status `OPEN` or `INVESTIGATING`, increment `recurrence_count` without triggering duplicate agent runs.

### Stream B Tasks (Agent Fixing, Context & Safety Guard):
- [ ] **Firecrawl Error Documentation Scraper (`backend/prodpilot/pipeline/docs.py`)**:
  - On unhandled exception, invoke Firecrawl API to scrape relevant documentation and community solutions.
  - Inject verified API recommendations into the fixing agent prompt.
- [ ] **Automated GitHub PR Creation (`backend/prodpilot/pipeline/pr_opener.py`)**:
  - After repro test and full regression suite pass, push branch `prodpilot-fix-<id>` to GitHub.
  - Open a Draft Pull Request containing reproduction test evidence and diff.
- [ ] **10-Second Post-Deploy Watchdog & Auto-Revert (`backend/prodpilot/staging/deploy.py`)**:
  - When approved, swap chosen build to production port 8000.
  - Monitor `/health` for 10 seconds.
  - If health check fails or errors occur, trigger immediate rollback to previous build and mark `AUTO_REVERTED`.
  - Cap automatic remediation attempts at 1.

### Stream C Tasks (Mobile Web View, Telegram & n8n):
- [ ] **Mobile-Responsive Incident Web Page (`backend/prodpilot/api/`)**:
  - Create a clean, fast mobile web view accessible at `/incidents/{id}/mobile` over the active Cloudflare Tunnel.
  - Render Root-Cause summary, Firecrawl doc snippet, diff preview, test evidence, and 3 mobile buttons:
    - **`[🚀 Approve & Deploy Fix]`**
    - **`[⏪ Instant Rollback]`**
    - **`[🛑 Take Over]`**
- [ ] **Telegram Alert Enhancement (`telegram/bot.py`)**:
  - Include the direct Cloudflare Tunnel mobile web link in every alert card.
  - Add inline `[⏪ Revert Commit (8002)]` button directly next to `[🚀 Deploy Fix (8001)]`.
- [ ] **n8n Webhook Dispatcher (`backend/prodpilot/pipeline/n8n.py`)**:
  - Post incident webhook payload to n8n workflow for multi-channel incident dispatch.

---

## 4. Phase 5: Rehearsals, Seeded Bugs & Demo Freeze (1:30 AM – 3:30 AM)

- [ ] **3 Consecutive Clean Runs**:
  - Trigger crash $\rightarrow$ autonomous triage $\rightarrow$ repro test $\rightarrow$ fix verified $\rightarrow$ mobile approval $\rightarrow$ healthy production.
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
  - Slide 4: Sponsor Power (Render + Adaption AI + Firecrawl + n8n + Google Antigravity).
  - Slide 5: Live Demo Walkthrough (Mobile-first resolution).
- **10:15 AM – 10:45 AM**: Final dry-run presentation.
- **10:45 AM – 11:00 AM**: Final Devfolio submission!

---

## 6. Demo Script (3-Minute Winning Beat)

1. **0:00 – 0:30**: Show Mission Control connected to Render/Local server. Trigger Low-severity warning $\rightarrow$ shows non-urgent GitHub Issue created without midnight paging.
2. **0:30 – 1:15**: Trigger severe crash (`./scripts/trigger-crash.sh`). Production goes down. Adaption AI triages High. Blame isolates commit, Firecrawl finds doc, and Telegram alerts phone with mobile link.
3. **1:15 – 2:00**: Show Antigravity agent in worktree proving the fix: `test_repro.py` turns Red $\rightarrow$ Green. Canaries 8001 and 8002 stand ready. GitHub PR opens.
4. **2:00 – 2:40**: Tap mobile link on phone. Show responsive mobile incident page. Tap **Deploy Fix** directly from bed.
5. **2:40 – 3:00**: Production port 8000 restores healthy. Show auto-generated post-mortem report and wrap up.
