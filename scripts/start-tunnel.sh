#!/usr/bin/env bash
# ==============================================================================
# ProdPilot Cloudflare Tunnel Runner Script
# Starts a quick public tunnel forwarding to local backend API port 8765
# ==============================================================================

set -euo pipefail

# Add common local bin paths to PATH
export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"

TARGET_URL="${PRODPILOT_TARGET_URL:-http://127.0.0.1:8765}"
URL_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/tunnel_url.txt"
LOG_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/tunnel.log"

echo "================================================================="
echo "🚀 PRODPILOT CLOUDFLARE TUNNEL INITIALIZER"
echo "================================================================="
echo "Target Local Service: $TARGET_URL"

# Find cloudflared executable
CLOUDFLARED_BIN=""
if command -v cloudflared &>/dev/null; then
    CLOUDFLARED_BIN="$(command -v cloudflared)"
elif [[ -f "$HOME/.local/bin/cloudflared" ]]; then
    CLOUDFLARED_BIN="$HOME/.local/bin/cloudflared"
elif [[ -f "/usr/local/bin/cloudflared" ]]; then
    CLOUDFLARED_BIN="/usr/local/bin/cloudflared"
else
    echo "❌ Error: cloudflared binary not found in PATH or ~/.local/bin."
    echo "Please install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    exit 1
fi

echo "Using cloudflared binary: $CLOUDFLARED_BIN"

# Clean previous log file
rm -f "$LOG_FILE" "$URL_FILE"

# Start cloudflared tunnel in background and capture output
echo "Starting Cloudflare quick tunnel to $TARGET_URL..."
"$CLOUDFLARED_BIN" tunnel --url "$TARGET_URL" 2>&1 | tee "$LOG_FILE" &
TUNNEL_PID=$!

# Ensure cleanup on exit
cleanup() {
    echo ""
    echo "Stopping Cloudflare tunnel (PID: $TUNNEL_PID)..."
    kill "$TUNNEL_PID" 2>/dev/null || true
    wait "$TUNNEL_PID" 2>/dev/null || true
    echo "Tunnel stopped."
}
trap cleanup EXIT INT TERM

# Poll log file for trycloudflare.com URL
echo "Waiting for trycloudflare.com public URL..."
FOUND_URL=""
for i in {1..30}; do
    if [[ -f "$LOG_FILE" ]]; then
        MATCH=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "$LOG_FILE" | head -n 1 || true)
        if [[ -n "$MATCH" ]]; then
            FOUND_URL="$MATCH"
            break
        fi
    fi
    sleep 1
done

if [[ -z "$FOUND_URL" ]]; then
    echo "⚠️ Warning: Could not detect trycloudflare.com URL within 30 seconds."
    echo "Check $LOG_FILE for details."
else
    echo "$FOUND_URL" > "$URL_FILE"
    echo ""
    echo "================================================================="
    echo "🌐 CLOUDFLARE TUNNEL ACTIVE"
    echo "================================================================="
    echo "Public URL: $FOUND_URL"
    echo "Local Target: $TARGET_URL"
    echo "Saved to: $URL_FILE"
    echo ""
    echo "To configure Render Frontend to use this tunnel, set:"
    echo "  VITE_API_URL=$FOUND_URL"
    echo "================================================================="
fi

# Keep script running while cloudflared runs
wait "$TUNNEL_PID"
