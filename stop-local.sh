#!/usr/bin/env bash
set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo -e "${CYAN} =========================================================${NC}"
echo -e "${CYAN}   AVERIO MDM  -  Stopping Local Environment${NC}"
echo -e "${CYAN} =========================================================${NC}"
echo ""

echo -e "${YELLOW}[1/2] Stopping backend and frontend processes...${NC}"
if [[ -f /tmp/averio-backend.pid ]]; then
  kill "$(cat /tmp/averio-backend.pid)" 2>/dev/null || true
  rm -f /tmp/averio-backend.pid
fi
if [[ -f /tmp/averio-frontend.pid ]]; then
  kill "$(cat /tmp/averio-frontend.pid)" 2>/dev/null || true
  rm -f /tmp/averio-frontend.pid
fi
# Fallback: kill by port
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
echo -e "${GREEN}      Done.${NC}"

echo -e "${YELLOW}[2/2] Stopping Docker infrastructure...${NC}"
docker compose -f docker-compose.yml stop neo4j redis cosmos-emulator
echo -e "${GREEN}      Done.${NC}"

echo ""
echo -e "${GREEN} All services stopped. Run ./start-local.sh to restart.${NC}"
echo -e "${GREEN} =========================================================${NC}"
echo ""
