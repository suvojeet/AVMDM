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
echo -e "${CYAN}${BOLD}   AVERIO MDM  -  Backend  (Spring Boot / port 8080)${NC}"
echo -e "${CYAN}${BOLD} =========================================================${NC}"
echo ""

# ── Locate Maven ──────────────────────────────────────────────────────────────
MVN_CMD=""

if command -v mvn &>/dev/null; then
    MVN_CMD="mvn"
elif [[ -f "$HOME/.maven/maven-3.9.15/bin/mvn" ]]; then
    MVN_CMD="$HOME/.maven/maven-3.9.15/bin/mvn"
elif [[ -f "$SCRIPT_DIR/backend/mvnw" ]]; then
    MVN_CMD="$SCRIPT_DIR/backend/mvnw"
else
    echo -e "${RED}[ERROR] Maven not found.${NC}"
    echo "        Add Maven to PATH or install to ~/.maven/maven-3.9.15"
    echo "        Download: https://maven.apache.org/download.cgi"
    exit 1
fi
echo -e "${GREEN}[INFO] Using Maven: $MVN_CMD${NC}"

# ── Check Java ────────────────────────────────────────────────────────────────
if ! command -v java &>/dev/null; then
    echo -e "${RED}[ERROR] Java 21+ is not installed or not in PATH.${NC}"
    echo "        Download: https://adoptium.net/"
    exit 1
fi
echo -e "${GREEN}[INFO] Java version: $(java -version 2>&1 | head -1)${NC}"

# ── Kill anything already on port 8080 ────────────────────────────────────────
if lsof -ti:8080 &>/dev/null; then
    echo -e "${YELLOW}[WARN] Port 8080 in use — killing existing process...${NC}"
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
fi

# ── Build ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[1/2] Building backend (skipping tests)...${NC}"
cd "$SCRIPT_DIR/backend"
$MVN_CMD clean package -DskipTests -q
echo -e "${GREEN}      Build successful.${NC}"

# ── Start ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[2/2] Starting Spring Boot on port 8080...${NC}"
echo -e "      Profile: ${BOLD}local${NC}  (Cosmos DB fallback active - no Docker required)"
echo ""

LOG_FILE="$SCRIPT_DIR/backend-startup.log"
java -jar target/averio-mdm-*.jar --spring.profiles.active=local \
    > "$LOG_FILE" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > /tmp/averio-backend.pid
echo -e "      PID: $BACKEND_PID  |  Log: $LOG_FILE"

# ── Wait for health ───────────────────────────────────────────────────────────
echo -n "      Waiting for backend"
until curl -s http://localhost:8080/actuator/health &>/dev/null; do
    echo -n "."
    sleep 3
done
echo ""

echo ""
echo -e "${GREEN}${BOLD} =========================================================${NC}"
echo -e "${GREEN}${BOLD}   Backend is UP!${NC}"
echo -e "${GREEN}${BOLD} =========================================================${NC}"
echo ""
echo -e "  ${BOLD}API Base:${NC}   http://localhost:8080/api/v1"
echo -e "  ${BOLD}Swagger UI:${NC} http://localhost:8080/swagger-ui.html"
echo -e "  ${BOLD}Health:${NC}     http://localhost:8080/actuator/health"
echo ""
echo -e "  Run ${YELLOW}./stop-backend.sh${NC} to stop."
echo -e "${GREEN} =========================================================${NC}"
echo ""
