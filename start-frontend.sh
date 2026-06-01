#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo -e "${CYAN}${BOLD} =========================================================${NC}"
echo -e "${CYAN}${BOLD}   AVERIO MDM  -  Frontend  (Vite dev server / port 5173)${NC}"
echo -e "${CYAN}${BOLD} =========================================================${NC}"
echo ""

# ── Check Node ────────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
    echo -e "${RED}[ERROR] Node.js 20+ is not installed or not in PATH.${NC}"
    echo "        Download: https://nodejs.org/"
    exit 1
fi
echo -e "${GREEN}[INFO] Node.js version: $(node --version)${NC}"

if ! command -v npm &>/dev/null; then
    echo -e "${RED}[ERROR] npm is not installed.${NC}"
    exit 1
fi

# ── Kill anything already on port 5173 ────────────────────────────────────────
if lsof -ti:5173 &>/dev/null; then
    echo -e "${YELLOW}[WARN] Port 5173 in use — killing existing process...${NC}"
    lsof -ti:5173 | xargs kill -9 2>/dev/null || true
fi

# ── Install dependencies if needed ────────────────────────────────────────────
cd "$SCRIPT_DIR/frontend"
if [[ ! -d node_modules ]]; then
    echo -e "${YELLOW}[1/2] Installing npm dependencies...${NC}"
    npm install
    echo -e "${GREEN}      Dependencies installed.${NC}"
else
    echo -e "${GREEN}[INFO] node_modules found — skipping install.${NC}"
fi

# ── Start ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[2/2] Starting Vite dev server on port 5173...${NC}"
echo -e "      API requests proxy to: ${BOLD}http://localhost:8080${NC}"
echo ""

npm run dev &
FRONTEND_PID=$!
echo "$FRONTEND_PID" > /tmp/averio-frontend.pid
echo -e "      PID: $FRONTEND_PID"

sleep 3

echo ""
echo -e "${GREEN}${BOLD} =========================================================${NC}"
echo -e "${GREEN}${BOLD}   Frontend is starting!${NC}"
echo -e "${GREEN}${BOLD} =========================================================${NC}"
echo ""
echo -e "  ${BOLD}App:${NC}    http://localhost:5173"
echo -e "  ${BOLD}Login:${NC}  admin / admin"
echo ""
echo -e "  Make sure the backend is also running on port 8080."
echo -e "  Run ${YELLOW}./start-backend.sh${NC} if it is not started yet."
echo ""
echo -e "  Run ${YELLOW}./stop-frontend.sh${NC} to stop."
echo -e "${GREEN} =========================================================${NC}"
echo ""
