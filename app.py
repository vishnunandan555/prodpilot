"""ProdPilot Telegram Bot - Visihot Entrypoint
Visihot / Pterodactyl Python egg executes app.py (${PY_FILE}).
Provides resilient lifecycle management with auto-restart on network/tunnel disconnects.
"""

import logging
import sys
import time

from bot import main

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger("prodpilot-visihot")


def run():
    """Run bot with outer restart loop to survive cloud tunnel reconnects."""
    restart_delay = 2.0
    max_delay = 30.0

    # If --dry-run is in arguments, run once and exit with code
    if "--dry-run" in sys.argv:
        main()
        return

    while True:
        try:
            logger.info("Visihot App executing ProdPilot bot entrypoint...")
            main()
            # If main() returns normally (e.g. clean shutdown), break loop
            break
        except KeyboardInterrupt:
            logger.info("Bot manually terminated. Exiting.")
            break
        except Exception as e:
            logger.error(
                f"Bot crashed with unexpected error: {e}. Auto-restarting in {restart_delay:.1f}s..."
            )
            time.sleep(restart_delay)
            restart_delay = min(restart_delay * 1.5, max_delay)


if __name__ == "__main__":
    run()
