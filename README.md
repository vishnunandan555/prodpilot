# ProdPilot Telegram Bot (Visihot Hosted Branch)

This branch (`telegram`) is dedicated to running the ProdPilot Telegram bot on Visihot / Pterodactyl.

## Visihot Configuration
1. In Visihot GitHub Deployment, select repository: `vishnunandan555/prodpilot`.
2. Select **Branch**: `telegram`.
3. Set Environment Variables:
   - `TELEGRAM_BOT_TOKEN`: Your token from @BotFather
   - `TELEGRAM_ALLOWED_CHAT_ID`: Your personal Telegram Chat ID
   - `PRODPILOT_API_URL`: URL to your ProdPilot instance (e.g. through ngrok/tailscale/cloudflare tunnel or public IP)
4. Startup command: `python3 bot.py` or `./start.sh`.
