# ProdPilot Telegram Bot (Visihot Hosted Branch)

This branch (`telegram`) is dedicated to running the ProdPilot Telegram bot on Visihot. It communicates with the ProdPilot backend via the REST/SSE API contract (`http://127.0.0.1:8765`).

## Features
- **Proactive Incident Alert Cards**: Formatted alerts whenever an incident reaches `AWAITING_APPROVAL`.
- **One-Tap Interactive Approvals**:
  - `[🚀 Deploy Fix (8001)]` -> Promotes fix-forward canary to production (port 8000).
  - `[⏪ Rollback (8002)]` -> Reverts suspect commit and validates health.
  - `[❌ Reject]` -> Rejects automated remediations and escalates to engineer.
- **Commands**:
  - `/start`: Check backend connectivity and get welcome overview.
  - `/status`: Query active incidents and system health.
  - `/logs`: Retrieve last 20 lines of service logs.
  - `/report`: View full markdown root-cause and test evidence summary.
  - `/mock`: Trigger sample incident card for manual UI testing.
- **Mock Mode (`--mock`)**: Standalone mode simulating incidents and approvals without requiring a running backend.
- **Dry-Run Mode (`--dry-run`)**: Offline CLI test suite that validates formatting and button handlers.

## Visihot Configuration
1. In Visihot GitHub Deployment, select repository: `vishnunandan555/prodpilot`.
2. Select **Branch**: `telegram`.
3. Set Environment Variables:
   - `TELEGRAM_BOT_TOKEN`: Your token from @BotFather
   - `TELEGRAM_ALLOWED_CHAT_ID`: Your personal Telegram Chat ID
   - `PRODPILOT_API_URL`: URL to your ProdPilot instance (default: `http://127.0.0.1:8765`, or your public tunnel)
   - `POLL_INTERVAL`: Polling interval in seconds (default: `3`)
4. Startup command: `python3 bot.py` or `./start.sh`.

## Local Testing
```bash
# Run test verification
./start.sh --dry-run

# Run mock mode with live Telegram token
python3 bot.py --mock --token <YOUR_BOT_TOKEN> --chat-id <YOUR_CHAT_ID>
```
