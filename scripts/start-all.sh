#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
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

echo "🚀 [ProdPilot] Starting core daemon suite..."

# Stop any previously running processes
"$SCRIPT_DIR/stop-all.sh" >/dev/null 2>&1 || true
sleep 1

# 1. Start FastAPI server on port 8765
echo "Starting FastAPI server on port 8765..."
cd "$REPO_ROOT"
PYTHONPATH=. setsid "$PYTHON_BIN" -m uvicorn backend.prodpilot.api.server:app --host 0.0.0.0 --port 8765 >> "$LOG_DIR/api-server.log" 2>&1 &
API_PID=$!
echo "$API_PID" > "$PID_DIR/api-server.pid"
echo "  ✓ FastAPI server running (PID: $API_PID, log: $LOG_DIR/api-server.log)"

# Wait for FastAPI server health check
COUNT=0
MAX_RETRIES=20
while [ $COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://127.0.0.1:8765/health | grep -q '"status"'; then
        break
    fi
    sleep 0.5
    COUNT=$((COUNT + 1))
done

# 2. Start Orchestrator daemon
echo "Starting Orchestrator daemon..."
cd "$REPO_ROOT"
PYTHONPATH=. setsid "$PYTHON_BIN" -m backend.prodpilot.pipeline.orchestrator \
    --daemon \
    >> "$LOG_DIR/orchestrator.log" 2>&1 &
ORCH_PID=$!
echo "$ORCH_PID" > "$PID_DIR/orchestrator.pid"
echo "  ✓ Orchestrator daemon running (PID: $ORCH_PID, log: $LOG_DIR/orchestrator.log)"

echo ""
echo "============================================================"
echo "🎉 ProdPilot Engine Core Running"
echo "   - API Server:    http://127.0.0.1:8765 (PID: $API_PID)"
echo "   - Health URL:    http://127.0.0.1:8765/health"
echo "   - Orchestrator:  PID $ORCH_PID"
echo "============================================================"
