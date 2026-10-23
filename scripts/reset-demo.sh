#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEMO_DIR="${PRODPILOT_DEMO_DIR:-$REPO_ROOT/demo-prod}"
PYTHON_BIN="${VIRTUAL_ENV:-$REPO_ROOT/.venv}/bin/python"

if [ ! -x "$PYTHON_BIN" ]; then
    if command -v python3 >/dev/null 2>&1; then
        PYTHON_BIN="$(command -v python3)"
    else
        echo "Error: Python binary not found!"
        exit 1
    fi
fi

echo "🔄 [ProdPilot] Resetting demo service in $DEMO_DIR..."

# 1. Kill any process occupying port 8000
echo "Stopping any existing service on port 8000..."
if command -v fuser >/dev/null 2>&1; then
    fuser -k 8000/tcp 2>/dev/null || true
elif command -v lsof >/dev/null 2>&1; then
    PIDS=$(lsof -ti :8000 || true)
    if [ -n "$PIDS" ]; then
        kill -9 $PIDS 2>/dev/null || true
    fi
else
    pkill -f "demo-prod/app.py" 2>/dev/null || true
fi
sleep 1

# 2. Reset git repo to buggy commit
if [ ! -d "$DEMO_DIR/.git" ]; then
    echo "Initializing demo-prod git repo..."
    "$PYTHON_BIN" "$SCRIPT_DIR/init_demo_prod.py" "$DEMO_DIR"
else
    echo "Resetting demo-prod git repo to clean HEAD..."
    cd "$DEMO_DIR"
    git checkout -f main 2>/dev/null || true
    git reset --hard HEAD
    git clean -fd
fi

# 3. Truncate service log
> "$DEMO_DIR/service.log"

# 4. Start demo-prod on port 8000 with nohup and disown
echo "Starting demo-prod on port 8000..."
cd "$DEMO_DIR"
PORT=8000 setsid "$PYTHON_BIN" app.py >> "$DEMO_DIR/service.log" 2>&1 &
SERVICE_PID=$!
disown $SERVICE_PID
echo "Started demo-prod (PID: $SERVICE_PID)"

# 5. Wait for healthy status
echo "Waiting for http://127.0.0.1:8000/health..."
MAX_RETRIES=20
COUNT=0
HEALTHY=false

while [ $COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://127.0.0.1:8000/health | grep -q '"status":"healthy"'; then
        HEALTHY=true
        break
    fi
    sleep 0.5
    COUNT=$((COUNT + 1))
done

if [ "$HEALTHY" = true ]; then
    echo "✅ [ProdPilot] demo-prod service is RUNNING and HEALTHY on port 8000."
    exit 0
else
    echo "❌ [ProdPilot] Failed to verify demo-prod health within timeout."
    tail -n 20 "$DEMO_DIR/service.log" || true
    exit 1
fi
