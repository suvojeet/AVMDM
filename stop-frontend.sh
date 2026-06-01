#!/usr/bin/env bash
set -uo pipefail

echo ""
echo " ========================================================="
echo "   AVERIO MDM  -  Stopping Frontend"
echo " ========================================================="
echo ""

STOPPED=0

# Kill by saved PID file
if [[ -f /tmp/averio-frontend.pid ]]; then
    PID=$(cat /tmp/averio-frontend.pid)
    if kill -0 "$PID" 2>/dev/null; then
        echo "[INFO] Stopping frontend (PID $PID)..."
        kill "$PID"
        STOPPED=1
    fi
    rm -f /tmp/averio-frontend.pid
fi

# Kill anything still holding port 5173
if lsof -ti:5173 &>/dev/null; then
    echo "[INFO] Killing remaining process on port 5173..."
    lsof -ti:5173 | xargs kill -9 2>/dev/null || true
    STOPPED=1
fi

if [[ $STOPPED -eq 0 ]]; then
    echo "[INFO] No frontend process found."
fi

echo " Frontend stopped."
echo " ========================================================="
echo ""
