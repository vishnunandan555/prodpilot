#!/usr/bin/env bash
set -e

echo "Starting ProdPilot Telegram Bot on Visihot..."

# Activate virtual environment if present
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
fi

# Install dependencies if pip is present
if command -v pip3 &> /dev/null; then
    pip3 install -q -r requirements.txt || true
elif python3 -m pip --version &> /dev/null; then
    python3 -m pip install -q -r requirements.txt || true
fi

exec python3 bot.py "$@"
