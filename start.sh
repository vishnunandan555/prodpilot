#!/usr/bin/env bash
set -e

echo "Starting ProdPilot Telegram Bot on Visihot..."
python3 -m pip install -r requirements.txt
python3 bot.py
