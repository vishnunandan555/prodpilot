#!/usr/bin/env bash
# ==============================================================================
# ProdPilot - Root Launcher & Development Runner
# Usage:
#   ./run.sh          # Start backend daemon & launch Desktop Electron UI
#   ./run.sh --backend# Start only backend daemon (port 8765)
#   ./run.sh --ui     # Launch only Desktop UI
#   ./run.sh --status # Check status of all ProdPilot components
#   ./run.sh --stop   # Stop all running ProdPilot processes
# ==============================================================================

set -eo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="${VIRTUAL_ENV:-$REPO_ROOT/.venv}/bin/python"
PID_DIR="$REPO_ROOT/.pids"
LOG_DIR="$REPO_ROOT/logs"

mkdir -p "$PID_DIR"
mkdir -p "$LOG_DIR"

# Text styles
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
BOLD="\033[1m"
NC="\033[0m"

# Find Python binary
if [ ! -x "$PYTHON_BIN" ]; then
    if command -v python3 >/dev/null 2>&1; then
        PYTHON_BIN="$(command -v python3)"
    else
        echo -e "${RED}Error: Python 3 not found. Please install Python or set up .venv.${NC}"
        exit 1
    fi
fi

# Helper: stop all processes
stop_all() {
    echo -e "${YELLOW}Stopping all ProdPilot services...${NC}"
    "$REPO_ROOT/scripts/stop-all.sh"
    echo -e "${GREEN}✓ All services stopped.${NC}"
}

# Helper: check status
check_status() {
    echo -e "${BOLD}--- ProdPilot Status Check ---${NC}"
    if curl -s http://127.0.0.1:8765/health | grep -q '"status"'; then
        echo -e "  Backend Core (8765):  ${GREEN}● ONLINE (200 OK)${NC}"
    else
        echo -e "  Backend Core (8765):  ${RED}○ OFFLINE${NC}"
    fi

    if [ -f "$PID_DIR/api-server.pid" ]; then
        PID=$(cat "$PID_DIR/api-server.pid")
        echo -e "  API Server PID:       $PID"
    fi
    if [ -f "$PID_DIR/orchestrator.pid" ]; then
        PID=$(cat "$PID_DIR/orchestrator.pid")
        echo -e "  Orchestrator PID:     $PID"
    fi
    echo -e "${BOLD}------------------------------${NC}"
}

# Helper: start backend
start_backend() {
    echo -e "${BLUE}▶ Checking Backend Daemon (:8765)...${NC}"
    if curl -s http://127.0.0.1:8765/health | grep -q '"status"'; then
        echo -e "  ${GREEN}✓ Backend already running on http://127.0.0.1:8765${NC}"
        return 0
    fi

    echo -e "  Starting FastAPI backend on port 8765..."
    cd "$REPO_ROOT"
    PYTHONPATH=. setsid "$PYTHON_BIN" -m uvicorn backend.prodpilot.api.server:app \
        --host 0.0.0.0 \
        --port 8765 >> "$LOG_DIR/api-server.log" 2>&1 &
    API_PID=$!
    echo "$API_PID" > "$PID_DIR/api-server.pid"

    # Wait for backend health check
    COUNT=0
    MAX_RETRIES=20
    while [ $COUNT -lt $MAX_RETRIES ]; do
        if curl -s http://127.0.0.1:8765/health | grep -q '"status"'; then
            echo -e "  ${GREEN}✓ Backend healthy on http://127.0.0.1:8765 (PID: $API_PID)${NC}"
            break
        fi
        sleep 0.5
        COUNT=$((COUNT + 1))
    done

    if [ $COUNT -ge $MAX_RETRIES ]; then
        echo -e "  ${RED}✗ Timed out waiting for backend. Check $LOG_DIR/api-server.log${NC}"
        exit 1
    fi
}

# Helper: launch desktop UI
start_ui() {
    echo -e "${BLUE}▶ Launching ProdPilot Desktop UI...${NC}"
    cd "$REPO_ROOT/desktop"

    if [ ! -d "node_modules" ]; then
        echo -e "  Installing desktop dependencies..."
        npm install
    fi

    echo -e "  Starting Electron workspace..."
    # If running in desktop mode, start npm run dev (Vite + Electron concurrently)
    npm run dev
}

# Command dispatch
case "${1:-all}" in
    --stop|stop)
        stop_all
        exit 0
        ;;
    --status|status)
        check_status
        exit 0
        ;;
    --backend|backend)
        start_backend
        echo -e "${GREEN}Backend daemon is running in background.${NC}"
        exit 0
        ;;
    --ui|ui)
        start_ui
        exit 0
        ;;
    --test|test)
        "$REPO_ROOT/run_tests.sh" "$@"
        exit 0
        ;;
    --help|help|-h)
        echo -e "${BOLD}ProdPilot Launcher${NC}"
        echo "  ./run.sh           Start backend daemon and launch Desktop UI"
        echo "  ./run.sh --backend Start only the backend API server (:8765)"
        echo "  ./run.sh --ui      Launch only the Desktop UI"
        echo "  ./run.sh --test    Run unified fast test suite"
        echo "  ./run.sh --status  Check system health and status"
        echo "  ./run.sh --stop    Stop all running ProdPilot background tasks"
        exit 0
        ;;
    all|"")
        echo -e "${BOLD}${GREEN}==================================================${NC}"
        echo -e "${BOLD}         ProdPilot Production Environment         ${NC}"
        echo -e "${BOLD}${GREEN}==================================================${NC}"
        start_backend
        echo ""
        start_ui
        ;;
    *)
        echo -e "${RED}Unknown option: $1${NC}. Use ./run.sh --help for usage."
        exit 1
        ;;
esac
