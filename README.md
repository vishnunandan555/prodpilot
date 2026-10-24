<p align="center">
  <img src="logo.png" alt="ProdPilot Logo" width="180" />
</p>

<h1 align="center">ProdPilot</h1>

<p align="center">
  <strong>Autonomous Production Incident Response & SRE Companion Platform</strong><br>
  <em>Connecting Production Telemetry, Git Codebases, and On-Call Engineers in Real Time.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/Electron-2B2E3A?style=for-the-badge&logo=electron&logoColor=9FEAF9" alt="Electron" />
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Cloudflare_Tunnel-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare" />
  <img src="https://img.shields.io/badge/Twilio_Voice-F22F46?style=for-the-badge&logo=twilio&logoColor=white" alt="Twilio" />
</p>

---

## 📌 Executive Summary

**ProdPilot** is an autonomous incident response platform that monitors production services, detects runtime outages, isolates the root cause in the git commit history, and safely prepares remediations—all while keeping the human engineer firmly in control.

When a **SEV-1 production failure** strikes at 3:00 AM, ProdPilot:
1. **Detects** errors from production log streams in under 2 seconds.
2. **Isolates** the suspect commit using automated stack-trace extraction and `git blame`.
3. **Synthesizes** an automated **Red-to-Green reproduction test** inside an isolated git worktree.
4. **Verifies** candidate patches in a side-port sandbox canary (Ports 8001/8002).
5. **Escalates** to the on-call engineer via **Twilio Interactive Voice Hotline** and **Telegram 1-Tap Buttons**.
6. **Enforces Human-in-the-Loop Safety**: No code is ever deployed without explicit developer confirmation.

---

## 🏗️ Architecture & Topology

ProdPilot follows a hybrid architecture designed for enterprise security and instant mobile accessibility:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   ON-CALL SRE                                          │
│              (Mobile Phone / Telegram Bot / Twilio Voice Call / Browser)               │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              SECURE CLOUDFLARE INGRESS                                 │
│        • Zero-config HTTPS tunnel exposing webhooks without open ports                 │
│        • Twilio Voice TwiML Webhooks & Telegram 1-Tap Approval Endpoints               │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Reverse Proxy to localhost:8765
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                  PRODPILOT BACKEND                                     │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. FastAPI REST & Real-time SSE Engine (:8765)                                   │  │
│  │ 2. Production Log Watcher & Triage (SHA-256 fingerprint deduplication)           │  │
│  │ 3. Incident Orchestrator (10-stage state machine authority)                      │  │
│  │ 4. Investigation Agent (Git blame, PR reviews, RCA report generator)             │  │
│  │ 5. Fix Agent (Synthesizes tests Red->Green in isolated .worktree/)               │  │
│  │ 6. Canary Sandbox Runner (Side-port verification: 8001 Fix, 8002 Rollback)       │  │
│  │ 7. Verification Watchdog (Post-deploy health probes with 10s auto-revert)        │  │
│  │ 8. Twilio Voice SRE Companion (Two-way STT speech recognition & Neural TTS)      │  │
│  │ 9. Telegram Bot Daemon (@prodpilotbot)                                           │  │
│  │ 10. SQLite Database (Audit trail, state events, service metrics)                 │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ IPC / Localhost HTTP
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               DESKTOP WORKSPACE                                        │
│     • Electron + Vite Desktop Dashboard with real-time SSE stream                      │
│     • Incident Timeline, AST Diff Viewer, Service Health, & Live Telemetry             │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ The 10-Stage Incident Lifecycle

```
DETECTED ──> INVESTIGATING ──> REPORT_READY ──> RECOVERY_DECISION ──> [ROLLBACK or FIXING]
                                                                              │
RESOLVED <── VERIFYING <── DEPLOYING <── AWAITING_APPROVAL <── PR_READY <─────┘
```

1. **DETECTED**: Continuous monitoring captures 5xx errors or unhandled tracebacks. SHA-256 fingerprinting deduplicates recurring crash loops.
2. **INVESTIGATING**: Gathers recent commits (`git log -n 5`) and executes `git blame` against stack frames.
3. **REPORT_READY**: Synthesizes a structured Root Cause Analysis (RCA) report separating confirmed evidence from hypotheses.
4. **RECOVERY_DECISION**: Autonomous decision engine evaluates whether an instant Rollback or a Fix-Forward patch is optimal.
5. **FIXING**: Spawns an isolated git worktree (`.worktree/`) to prevent corrupting local working directories. Writes a reproduction test that fails on current code (Red) and passes once patched (Green).
6. **PR_READY**: Stages pull request with reproduction proof and verification logs.
7. **AWAITING_APPROVAL**: Triggers notifications across desktop, Telegram, and outbound Twilio Voice.
8. **DEPLOYING**: Upon engineer 1-tap confirmation, applies the verified patch or triggers rollback.
9. **VERIFYING**: Autonomous Watchdog polls health metrics every 2s for 10 seconds. If error rates remain elevated, it auto-reverts immediately.
10. **RESOLVED**: Incident marked resolved; post-mortem report archived into SQLite.

---

## 📞 Twilio Voice SRE Companion Hotline

For critical SEV-1 outages, ProdPilot rings the on-call engineer's phone:
- **Neural Voice Synthesis**: Powered by Amazon Polly (`Polly.Matthew-Neural`) through Twilio Voice.
- **Two-Way Voice Recognition**: Speak naturally into your phone:
  - Say **`"status"`** or *"what happened?"* &rarr; ProdPilot speaks the root cause and worktree status.
  - Say **`"approve"`** (or press `2`) &rarr; Records remediation approval.
  - Say **`"rollback"`** (or press `1`) &rarr; Triggers instant deployment rollback.
  - Say **`"hang up"`** (or press `*` / `9`) &rarr; Ends the call.
- **Built-in Diagnostics**: Integrated test call drill in the Settings and Services dashboard.

---

## 🛠️ Prerequisites

- **Linux / macOS / Windows (WSL2)**
- **Python 3.10+** (Python 3.11 or 3.12 recommended)
- **Node.js 18+** & **npm 9+**
- **Git** installed and configured
- *(Optional but Recommended)*:
  - [Cloudflare Tunnel (`cloudflared`)](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/): For secure public webhook exposure.
  - [Twilio Account](https://www.twilio.com/): Account SID, Auth Token, and Virtual Phone Number for voice escalation.
  - [Telegram Bot Token](https://t.me/BotFather): For mobile alerts to `@prodpilotbot`.

---

## 🚀 Quickstart & Setup Guide

### 1. Clone the Repository
```bash
git clone https://github.com/vishnunandan555/prodpilot.git
cd prodpilot
```

### 2. Set Up Python Environment
```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install backend dependencies
pip install -r requirements.txt
```

### 3. Set Up Desktop Application
```bash
cd desktop
npm install
cd ..
```

### 4. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

Key variables in `.env`:
```ini
# AI Engine API Keys
GEMINI_API_KEY=your_gemini_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Telegram Alerts (Optional)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_ALLOWED_CHAT_ID=your_chat_id

# Twilio Voice Escalation (Optional - can also be configured in Settings UI)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_FROM_NUMBER=+1234567890
ENGINEER_PHONE=+19876543210
```

---

## 💻 Running ProdPilot

ProdPilot includes a unified launcher script (`run.sh`):

### Launch Everything (Backend + Desktop Electron App)
```bash
./run.sh
```
*This starts the FastAPI backend on `http://127.0.0.1:8765` and opens the desktop dashboard window.*

### Component Launch Options
```bash
# Start only the backend daemon
./run.sh --backend

# Launch Desktop Electron App
./run.sh --ui

# Launch Web UI in your default browser (Vite mode)
./run.sh --browser

# Check health of all running services
./run.sh --status

# Stop all running background processes
./run.sh --stop
```

### Accessing the Web Dashboard
- **Backend API Docs (Swagger)**: [http://127.0.0.1:8765/docs](http://127.0.0.1:8765/docs)
- **Local Web Frontend**: [http://localhost:5173](http://localhost:5173)

---

## 🧪 Testing & Verification

ProdPilot maintains a test suite covering state machine transitions, git worktree isolation, triage deduplication, watchdog auto-reverts, and Twilio voice calls:

```bash
# Run all tests using the unified runner
./run.sh --test

# Or run pytest directly
pytest backend/prodpilot/tests/ -v
```

All 41+ automated tests execute in under 15 seconds.

---

## 📂 Project Structure

```
prodpilot/
├── backend/
│   └── prodpilot/
│       ├── api/
│       │   ├── server.py              # Core FastAPI app & SSE event broadcaster
│       │   └── connect_router.py      # Cloudflare tunnel, voice, & triage endpoints
│       ├── core/
│       │   ├── orchestrator.py        # 10-stage incident state machine
│       │   ├── triage.py              # Stack trace parsing & SHA-256 fingerprinting
│       │   └── decide.py              # Recovery decision engine (Rollback vs Fix)
│       ├── integrations/
│       │   ├── twilio_client.py       # Twilio Voice Hotline & TwiML generator
│       │   ├── telegram_client.py     # Telegram bot alert dispatcher
│       │   └── render_client.py       # Render API log ingestion adapter
│       └── tests/                     # Comprehensive test suite (41 tests)
├── desktop/                           # Electron + React + Vite SRE Desktop App
│   ├── src/
│   │   ├── components/                # Incident detail, timeline, diff viewer
│   │   └── App.jsx                    # Primary desktop shell & navigation
│   └── electron/                      # Electron main & preload scripts
├── scripts/
│   ├── start-tunnel.sh                # Cloudflare tunnel auto-spawner
│   └── stop-all.sh                    # Process cleanup utility
├── ProdPilot - Project Blueprint.md   # Architectural specifications
├── ProdPilot - Build Plan.md          # Technical roadmap & implementation audit
├── requirements.txt                   # Backend dependencies
├── run.sh                             # Unified launcher script
└── logo.png                           # ProdPilot logo asset
```

---

## 🛡️ Safety & Production Guardrails

- **Zero Autonomous Production Pushes**: ProdPilot generates reproduction tests, verifies fixes in isolated worktrees, and prepares pull requests, but *never* merges or deploys to production without human confirmation.
- **Git Worktree Isolation**: All fix synthesis occurs in temporary `.worktree/` directories, preventing contamination of your main branch or uncommitted local files.
- **10-Second Watchdog Auto-Revert**: Post-deployment probes continuously monitor production health. If error rates do not recover within 10 seconds, the watchdog triggers an automatic rollback.
- **Traceback Deduplication**: SHA-256 signature hashing ensures recurring crash loops generate a single coordinated incident instead of alert storms.

---

## 👥 Hackathon Track & Authorship

- **Event**: Realm Hack 2026 | Agentic AI Track
- **Author**: Vishnu Nandan
- **Institution**: Christ College of Engineering
- **Version**: 3.0 (Truthful Baseline Architecture)
- **License**: MIT
