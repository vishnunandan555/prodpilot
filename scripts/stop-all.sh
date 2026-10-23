#!/usr/bin/env bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PID_DIR="$REPO_ROOT/.pids"

echo "🛑 [ProdPilot] Stopping all services..."

# 1. Stop recorded PIDs
if [ -d "$PID_DIR" ]; then
    for pidfile in "$PID_DIR"/*.pid; do
        if [ -f "$pidfile" ]; then
            SERVICE_NAME="$(basename "$pidfile" .pid)"
            PID="$(cat "$pidfile" 2>/dev/null || true)"
            if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
                echo "Terminating $SERVICE_NAME (PID: $PID)..."
                kill "$PID" 2>/dev/null || true
                # Give it up to 2 seconds to exit gracefully
                for _ in {1..20}; do
                    if ! kill -0 "$PID" 2>/dev/null; then
                        break
                    fi
                    sleep 0.1
                done
                # Force kill if still alive
                if kill -0 "$PID" 2>/dev/null; then
                    echo "Force-killing $SERVICE_NAME (PID: $PID)..."
                    kill -9 "$PID" 2>/dev/null || true
                fi
            fi
            rm -f "$pidfile"
        fi
    done
fi

# 2. Kill any processes bound to ports 8000 (demo-prod) and 8765 (api-server)
for port in 8000 8765; do
    if command -v fuser >/dev/null 2>&1; then
        fuser -k "${port}/tcp" 2>/dev/null || true
    elif command -v lsof >/dev/null 2>&1; then
        PIDS=$(lsof -ti :"$port" 2>/dev/null || true)
        if [ -n "$PIDS" ]; then
            kill -9 $PIDS 2>/dev/null || true
        fi
    fi
done

# 3. Clean up any remaining python daemon processes by pattern
pkill -f "backend.prodpilot.watcher.watcher" 2>/dev/null || true
pkill -f "backend.prodpilot.pipeline.orchestrator" 2>/dev/null || true
pkill -f "backend.prodpilot.api.server" 2>/dev/null || true
pkill -f "demo-prod/app.py" 2>/dev/null || true

echo "✓ All ProdPilot services stopped cleanly."
