"""ProdPilot Telegram Bot - Visihot Hosted Edition
Controls incident remediation, provides interactive Deploy/Rollback approvals.
Runs at the root of the 'telegram' branch.
"""

import asyncio
import os
import sys
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
ALLOWED_CHAT_ID = os.getenv("TELEGRAM_ALLOWED_CHAT_ID")
PRODPILOT_API_URL = os.getenv("PRODPILOT_API_URL", "http://127.0.0.1:8765")

print(f"ProdPilot Telegram Bot starting... API target: {PRODPILOT_API_URL}")

if __name__ == "__main__":
    if not BOT_TOKEN:
        print("Note: TELEGRAM_BOT_TOKEN not set yet. Configure it in .env or environment variables.")
    print("Bot module initialized. Ready for implementation.")
