#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEMO_DIR="${PRODPILOT_DEMO_DIR:-$REPO_ROOT/demo-prod}"
PYTHON_BIN="${VIRTUAL_ENV:-$REPO_ROOT/.venv}/bin/python"
PID_DIR="$REPO_ROOT/.pids"
LOG_DIR="$REPO_ROOT/logs"

mkdir -p "$PID_DIR"
mkdir -p "$LOG_DIR"

if [ ! -x "$PYTHON_BIN" ]; then
    if command -v python3 >/dev/null 2>&1; then
        PYTHON_BIN="$(command -v python3)"
    else
        echo "Error: Python binary not found!"
        exit 1
    fi
fi

echo "🚀 [ProdPilot] Starting unified production daemon suite..."

# Stop any previously running processes
"$SCRIPT_DIR/stop-all.sh" >/dev/null 2>&1 || true
sleep 1

# Ensure demo-prod git repo exists
if [ ! -d "$DEMO_DIR/.git" ]; then
    echo "Initializing demo-prod git repo..."
    "$PYTHON_BIN" "$SCRIPT_DIR/init_demo_prod.py" "$DEMO_DIR"
fi

# a. Start demo-prod on port 8000
echo "Starting demo-prod on port 8000..."
cd "$DEMO_DIR"
PORT=8000 setsid "$PYTHON_BIN" app.py >> "$LOG_DIR/demo-prod.log" 2>&1 &
DEMO_PID=$!
echo "$DEMO_PID" > "$PID_DIR/demo-prod.pid"
echo "  ✓ demo-prod running (PID: $DEMO_PID, log: $LOG_DIR/demo-prod.log)"

# Wait for demo-prod health check
COUNT=0
MAX_RETRIES=20
while [ $COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://127.0.0.1:8000/health | grep -q '"status"'; then
        break
    fi
    sleep 0.5
    COUNT=$((COUNT + 1))
done

# b. Start FastAPI server on port 8765
echo "Starting FastAPI server on port 8765..."
cd "$REPO_ROOT"
PYTHONPATH=. setsid "$PYTHON_BIN" -m uvicorn backend.prodpilot.api.server:app --host 0.0.0.0 --port 8765 >> "$LOG_DIR/api-server.log" 2>&1 &
API_PID=$!
echo "$API_PID" > "$PID_DIR/api-server.pid"
echo "  ✓ FastAPI server running (PID: $API_PID, log: $LOG_DIR/api-server.log)"

# Wait for FastAPI server health check
COUNT=0
while [ $COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://127.0.0.1:8765/health | grep -q '"status"'; then
        break
    fi
    sleep 0.5
    COUNT=$((COUNT + 1))
done

# c. Start Watcher poller
echo "Starting Watcher poller..."
cd "$REPO_ROOT"
PYTHONPATH=. setsid "$PYTHON_BIN" backend/prodpilot/watcher/watcher.py \
    --url http://127.0.0.1:8000/health \
    --repo "$DEMO_DIR" \
    --log-file "$DEMO_DIR/service.log" \
    >> "$LOG_DIR/watcher.log" 2>&1 &
WATCHER_PID=$!
echo "$WATCHER_PID" > "$PID_DIR/watcher.pid"
echo "  ✓ Watcher poller running (PID: $WATCHER_PID, log: $LOG_DIR/watcher.log)"

# d. Start Orchestrator daemon
echo "Starting Orchestrator daemon..."
cd "$REPO_ROOT"
PYTHONPATH=. setsid "$PYTHON_BIN" -m backend.prodpilot.pipeline.orchestrator \
    --daemon \
    --repo-path "$DEMO_DIR" \
    >> "$LOG_DIR/orchestrator.log" 2>&1 &
ORCH_PID=$!
echo "$ORCH_PID" > "$PID_DIR/orchestrator.pid"
echo "  ✓ Orchestrator daemon running (PID: $ORCH_PID, log: $LOG_DIR/orchestrator.log)"

echo ""
echo "============================================================"
echo "🎉 ProdPilot Unified Suite Started Successfully!"
echo "   - demo-prod:     http://127.0.0.1:8000 (PID: $DEMO_PID)"
echo "   - API Server:    http://127.0.0.1:8765 (PID: $API_PID)"
echo "   - Watcher:       PID $WATCHER_PID"
echo "   - Orchestrator:  PID $ORCH_PID"
echo "============================================================"
