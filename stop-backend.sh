#!/usr/bin/env bash
set -uo pipefail

echo ""
echo " ========================================================="
echo "   AVERIO MDM  -  Stopping Backend"
echo " ========================================================="
echo ""

STOPPED=0

# Kill by saved PID file
if [[ -f /tmp/averio-backend.pid ]]; then
    PID=$(cat /tmp/averio-backend.pid)
    if kill -0 "$PID" 2>/dev/null; then
        echo "[INFO] Stopping backend (PID $PID)..."
        kill "$PID"
        STOPPED=1
    fi
    rm -f /tmp/averio-backend.pid
fi

# Kill anything still holding port 8080
if lsof -ti:8080 &>/dev/null; then
    echo "[INFO] Killing remaining process on port 8080..."
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
    STOPPED=1
fi

if [[ $STOPPED -eq 0 ]]; then
    echo "[INFO] No backend process found."
fi

echo " Backend stopped."
echo " ========================================================="
echo ""
