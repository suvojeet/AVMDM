#!/usr/bin/env bash
# =============================================================================
#  Averio MDM — Full-Stack Build Script
#  Usage: ./build.sh [--backend-only] [--frontend-only] [--with-tests] [--clean]
# =============================================================================
set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
fail()    { echo -e "${RED}[FAILED]${RESET} $*" >&2; exit 1; }
step()    { echo -e "\n${BOLD}[$1]${RESET} $2"; }

# ── Defaults ──────────────────────────────────────────────────────────────────
BUILD_BACKEND=true
BUILD_FRONTEND=true
SKIP_TESTS=true
CLEAN=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Args ──────────────────────────────────────────────────────────────────────
usage() {
cat <<EOF
${BOLD}Usage:${RESET}  ./build.sh [options]

${BOLD}Options:${RESET}
  --backend-only    Build Spring Boot only
  --frontend-only   Build Vite/React only
  --with-tests      Run tests during backend build
  --clean           Run mvn clean before building
  --help            Show this help

${BOLD}Examples:${RESET}
  ./build.sh                   # Build both
  ./build.sh --backend-only    # Backend only, skip tests
  ./build.sh --with-tests      # Full build including tests
  ./build.sh --clean           # Clean build
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend-only)  BUILD_FRONTEND=false ;;
    --frontend-only) BUILD_BACKEND=false  ;;
    --with-tests)    SKIP_TESTS=false     ;;
    --clean)         CLEAN=true           ;;
    --help|-h)       usage; exit 0        ;;
    *) warn "Unknown argument: $1"        ;;
  esac
  shift
done

echo ""
echo -e "${BOLD} =================================================================${RESET}"
echo -e "${BOLD}   AVERIO MDM  |  Full-Stack Build${RESET}"
echo -e "${BOLD} =================================================================${RESET}"
echo ""

START_TS=$(date +%s)
STEP_NUM=0
TOTAL_STEPS=0
[[ "$BUILD_BACKEND"  == "true" ]] && TOTAL_STEPS=$((TOTAL_STEPS+1)) || true
[[ "$BUILD_FRONTEND" == "true" ]] && TOTAL_STEPS=$((TOTAL_STEPS+1)) || true

# ── Locate Maven ──────────────────────────────────────────────────────────────
find_mvn() {
  if command -v mvn &>/dev/null; then echo "mvn"; return; fi
  local m="$HOME/.maven/maven-3.9.15/bin/mvn"
  [[ -x "$m" ]] && echo "$m" && return
  m="$SCRIPT_DIR/backend/mvnw"
  [[ -x "$m" ]] && echo "$m" && return
  fail "Maven not found. Add to PATH or install to ~/.maven/maven-3.9.15"
}

# ── Prerequisites ─────────────────────────────────────────────────────────────
if $BUILD_BACKEND; then
  command -v java &>/dev/null || fail "Java 21+ not found. Download: https://adoptium.net/"
  JAVA_VER=$(java -version 2>&1 | head -1)
  info "Java:  $JAVA_VER"
  MVN=$(find_mvn)
  info "Maven: $MVN"
fi

if $BUILD_FRONTEND; then
  command -v node &>/dev/null || fail "Node.js 20+ not found. Download: https://nodejs.org/"
  info "Node:  $(node --version)  |  npm: $(npm --version)"
fi

echo ""

# ── Backend build ─────────────────────────────────────────────────────────────
if $BUILD_BACKEND; then
  STEP_NUM=$((STEP_NUM+1))
  step "$STEP_NUM/$TOTAL_STEPS" "Building backend (Spring Boot)..."

  MVN_GOALS="package"
  $CLEAN      && MVN_GOALS="clean package"
  MVN_FLAGS=""
  $SKIP_TESTS && MVN_FLAGS="-DskipTests"

  info "Running: mvn $MVN_GOALS $MVN_FLAGS"

  cd "$SCRIPT_DIR/backend"
  BACKEND_START=$(date +%s)

  "$MVN" $MVN_GOALS $MVN_FLAGS || fail "Backend build failed.\nRe-run: cd backend && mvn $MVN_GOALS $MVN_FLAGS"

  BACKEND_END=$(date +%s)
  JAR=$(find target -name "averio-mdm-*.jar" ! -name "*.original" 2>/dev/null | head -1)
  JAR_SIZE=""
  [[ -f "$JAR" ]] && JAR_SIZE=" ($(du -sh "$JAR" 2>/dev/null | cut -f1))"

  success "backend/$JAR$JAR_SIZE  [$(( BACKEND_END - BACKEND_START ))s]"
  cd "$SCRIPT_DIR"
  echo ""
fi

# ── Frontend build ────────────────────────────────────────────────────────────
if $BUILD_FRONTEND; then
  STEP_NUM=$((STEP_NUM+1))
  step "$STEP_NUM/$TOTAL_STEPS" "Building frontend (Vite/React)..."

  cd "$SCRIPT_DIR/frontend"
  FRONTEND_START=$(date +%s)

  if [[ ! -d node_modules ]]; then
    info "node_modules not found — running npm install..."
    npm install || fail "npm install failed."
  fi

  info "Running: npm run build"
  npm run build || fail "Frontend build failed.\nRe-run: cd frontend && npm run build"

  FRONTEND_END=$(date +%s)
  DIST_FILES=$(find dist -type f 2>/dev/null | wc -l | tr -d ' ')
  DIST_SIZE=$(du -sh dist 2>/dev/null | cut -f1)
  success "frontend/dist/  ($DIST_FILES files, $DIST_SIZE)  [$(( FRONTEND_END - FRONTEND_START ))s]"
  cd "$SCRIPT_DIR"
  echo ""
fi

# ── Summary ───────────────────────────────────────────────────────────────────
END_TS=$(date +%s)
ELAPSED=$(( END_TS - START_TS ))

echo -e "${BOLD} =================================================================${RESET}"
echo -e "${GREEN}${BOLD}   BUILD SUCCESSFUL  (${ELAPSED}s total)${RESET}"
echo -e "${BOLD} =================================================================${RESET}"
echo ""
$BUILD_BACKEND  && echo "   Backend jar:    backend/target/averio-mdm-1.0.0.jar"
$BUILD_FRONTEND && echo "   Frontend dist:  frontend/dist/"
echo ""
echo "   Start (local):  ./start-backend.sh   /   ./start-frontend.sh"
echo "   Start (full):   ./start-local.sh"
echo -e " ${BOLD}=================================================================${RESET}"
echo ""
