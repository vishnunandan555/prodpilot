#!/usr/bin/env bash
# ==============================================================================
# ProdPilot Unified Fast Test Runner
# Runs the full unified test suite deterministically in seconds.
#
# Usage:
#   ./run_tests.sh               # Run all unified tests fast (mock adapter)
#   ./run_tests.sh -v            # Run verbose
#   ./run_tests.sh -k "worktree" # Run specific test pattern
#   ./run_tests.sh --live        # Run with live Antigravity/Gemini agent adapter
# ==============================================================================

set -eo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PYTEST="$REPO_ROOT/.venv/bin/pytest"

if [ ! -x "$VENV_PYTEST" ]; then
    VENV_PYTEST="$(command -v pytest || true)"
fi

if [ -z "$VENV_PYTEST" ] || [ ! -x "$VENV_PYTEST" ]; then
    echo "Error: pytest executable not found. Please setup .venv."
    exit 1
fi

export PRODPILOT_AGENT_ADAPTER="${PRODPILOT_AGENT_ADAPTER:-mock}"
export PRODPILOT_DEPLOY_TARGET="${PRODPILOT_DEPLOY_TARGET:-local_process}"
export PRODPILOT_WATCHDOG_DURATION="${PRODPILOT_WATCHDOG_DURATION:-1}"
export PRODPILOT_WATCHDOG_INTERVAL="${PRODPILOT_WATCHDOG_INTERVAL:-0.05}"
export CLOUDFLARE_TUNNEL_URL="${CLOUDFLARE_TUNNEL_URL:-http://localhost:8765}"

LIVE_FLAG=""
ARGS=()

for arg in "$@"; do
    if [ "$arg" == "--live" ] || [ "$arg" == "--live-agent" ]; then
        LIVE_FLAG="--live-agent"
        export PRODPILOT_AGENT_ADAPTER="auto"
    else
        ARGS+=("$arg")
    fi
done

echo "=========================================================="
echo "  ProdPilot Unified Test Suite"
echo "  Adapter: ${PRODPILOT_AGENT_ADAPTER} (use --live for LLM calls)"
echo "=========================================================="

cd "$REPO_ROOT"
exec "$VENV_PYTEST" -q ${LIVE_FLAG} "${ARGS[@]}"
