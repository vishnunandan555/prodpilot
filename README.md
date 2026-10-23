# ProdPilot Telegram Bot (Visihot Hosted Branch)

This branch (`telegram`) runs the ProdPilot Telegram bot on Visihot. It communicates with the ProdPilot backend via the REST/SSE API contract (`http://127.0.0.1:8765` or your public tunnel via `PRODPILOT_API_URL`).

## Phase 2 Features
- **Proactive Incident Alert Cards**: Formatted alerts whenever an incident reaches `AWAITING_APPROVAL`.
  - Service & Incident ID
  - Root Cause & Suspect Commit (`git blame` details)
  - Canary Status (Port 8001: 🟢 Healthy | Port 8002: 🟢 Healthy)
  - AI Recommendation with confidence percentage
- **One-Tap Interactive Approvals with Live Feedback**:
  - `[🚀 Deploy Fix (8001)]` -> Promotes fix-forward canary to production (port 8000), confirms healthcheck 200 OK, and appends the incident report summary.
  - `[⏪ Rollback (8002)]` -> Reverts suspect commit, verifies healthcheck 200 OK, and appends the incident report summary.
  - `[❌ Reject]` -> Rejects automated remediations and escalates to human on-call engineer.
- **Tunnel Resilience & Exponential Backoff**:
  - `ProdPilotClient` includes exponential backoff retry logic for `httpx.ConnectError`, `httpx.TimeoutException`, and network drops.
  - Polling loop automatically recovers when public tunnels (Cloudflare/ngrok/localtunnel) reconnect.
  - `app.py` serves as the resilient Visihot entrypoint with auto-restart on unhandled exceptions.
- **Commands**:
  - `/start`: Check backend connectivity and get welcome overview.
  - `/status`: Query active incidents and system health.
  - `/logs`: Retrieve last 20 lines of service logs.
  - `/report`: View full markdown root-cause and test evidence summary.
  - `/mock`: Trigger sample incident card for manual UI testing.
- **Multi-Channel Adapter**:
  - `discord_bot.py`: Multi-channel Discord webhook and bot adapter preview.
- **Mock & Dry-Run Modes**:
  - Standalone `--dry-run` and `--mock` modes allow 100% offline testing.

## Visihot Configuration
1. In Visihot GitHub Deployment, select repository: `vishnunandan555/prodpilot`.
2. Select **Branch**: `telegram`.
3. Set Environment Variables:
   - `TELEGRAM_BOT_TOKEN`: Your token from @BotFather
   - `TELEGRAM_ALLOWED_CHAT_ID`: Your personal Telegram Chat ID
   - `PRODPILOT_API_URL`: URL to your ProdPilot instance (default: `http://127.0.0.1:8765`, or your public tunnel)
   - `POLL_INTERVAL`: Polling interval in seconds (default: `3`)
4. Startup command: `python3 app.py` or `python3 bot.py`.

## Local Testing
```bash
# Run test verification for Telegram bot
python3 bot.py --dry-run

# Run test verification for Visihot entrypoint
python3 app.py --dry-run

# Run test verification for Discord adapter
python3 discord_bot.py --dry-run

# Run mock mode with live Telegram token
python3 bot.py --mock
```
