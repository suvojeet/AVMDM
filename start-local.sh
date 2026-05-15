#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${CYAN}${BOLD} =========================================================${NC}"
echo -e "${CYAN}${BOLD}   AVERIO MDM  -  Local Development Environment${NC}"
echo -e "${CYAN}${BOLD} =========================================================${NC}"
echo ""

# ── Preflight checks ──────────────────────────────────────────────────────────

check_command() {
  if ! command -v "$1" &>/dev/null; then
    echo -e "${RED}[ERROR] '$1' is not installed or not in PATH.${NC}"
    echo "        $2"
    exit 1
  fi
}

check_command docker  "Install Docker Desktop: https://www.docker.com/products/docker-desktop"
check_command java    "Install Java 21+: https://adoptium.net/"
check_command node    "Install Node.js 20+: https://nodejs.org/"
check_command mvn     "Install Maven 3.9+: https://maven.apache.org/ (or use ./mvnw)"

if ! docker info &>/dev/null; then
  echo -e "${RED}[ERROR] Docker daemon is not running. Start Docker Desktop first.${NC}"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Step 1: Infrastructure ─────────────────────────────────────────────────────

echo -e "${YELLOW}[1/5] Starting infrastructure services (Neo4j, Redis, Cosmos DB emulator)...${NC}"
docker compose -f docker-compose.yml up -d neo4j redis cosmos-emulator

echo -e "${YELLOW}[2/5] Waiting for Neo4j to be ready...${NC}"
until docker exec averio-neo4j cypher-shell -u neo4j -p averio123 "RETURN 1" &>/dev/null; do
  echo "      Still waiting for Neo4j..."
  sleep 5
done
echo -e "${GREEN}      Neo4j is ready.${NC}"

# ── Step 2: Backend ───────────────────────────────────────────────────────────

echo -e "${YELLOW}[3/5] Building backend (Spring Boot)...${NC}"
cd backend
MVN_CMD="./mvnw"
[[ ! -f "$MVN_CMD" ]] && MVN_CMD="mvn"
$MVN_CMD clean package -DskipTests -q
echo -e "${GREEN}      Backend built.${NC}"

echo -e "${YELLOW}[4/5] Starting backend server on port 8080...${NC}"
java -jar target/averio-mdm-*.jar --spring.profiles.active=local &
BACKEND_PID=$!
echo "$BACKEND_PID" > /tmp/averio-backend.pid

until curl -s http://localhost:8080/actuator/health &>/dev/null; do
  sleep 3
done
echo -e "${GREEN}      Backend started (PID $BACKEND_PID).${NC}"
cd ..

# ── Step 3: Frontend ──────────────────────────────────────────────────────────

echo -e "${YELLOW}[5/5] Starting frontend (Vite on port 5173)...${NC}"
cd frontend
[[ ! -d node_modules ]] && npm install --silent
npm run dev &
FRONTEND_PID=$!
echo "$FRONTEND_PID" > /tmp/averio-frontend.pid
cd ..

echo ""
echo -e "${GREEN}${BOLD} =========================================================${NC}"
echo -e "${GREEN}${BOLD}   All services started!${NC}"
echo -e "${GREEN}${BOLD} =========================================================${NC}"
echo ""
echo -e "  ${BOLD}Frontend:${NC}       http://localhost:5173"
echo -e "  ${BOLD}Backend API:${NC}    http://localhost:8080"
echo -e "  ${BOLD}Swagger UI:${NC}     http://localhost:8080/swagger-ui.html"
echo -e "  ${BOLD}Neo4j Browser:${NC}  http://localhost:7474  (neo4j / averio123)"
echo ""
echo -e "  ${BOLD}Default login:${NC}  admin / admin"
echo ""
echo -e "  Run ${YELLOW}./stop-local.sh${NC} to shut everything down."
echo -e "${GREEN} =========================================================${NC}"
echo ""
