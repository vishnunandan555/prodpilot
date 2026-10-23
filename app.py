"""ProdPilot Telegram Bot - Visihot Entrypoint
Visihot / Pterodactyl Python egg defaults to executing app.py (${PY_FILE}).
This forwards directly to bot.main().
"""

import os
import sys

from bot import main

if __name__ == "__main__":
    main()
