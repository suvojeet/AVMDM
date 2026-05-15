@echo off
setlocal EnableDelayedExpansion

title Averio MDM - Local Development

echo.
echo  =========================================================
echo    AVERIO MDM  -  Local Development Environment
echo  =========================================================
echo.

REM ── Check Docker ──────────────────────────────────────────────
where docker >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Docker is not installed or not in PATH.
    echo         Download Docker Desktop: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

docker info >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Docker Desktop is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

REM ── Check Java ────────────────────────────────────────────────
where java >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Java 21+ is not installed or not in PATH.
    echo         Download from: https://adoptium.net/
    pause
    exit /b 1
)

REM ── Check Node ────────────────────────────────────────────────
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js 20+ is not installed or not in PATH.
    echo         Download from: https://nodejs.org/
    pause
    exit /b 1
)

echo [1/5] Starting infrastructure services (Neo4j, Redis, Cosmos DB emulator)...
docker-compose -f docker-compose.yml up -d neo4j redis cosmos-emulator
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to start Docker services. Check docker-compose.yml.
    pause
    exit /b 1
)

echo [2/5] Waiting for Neo4j to be ready (this may take 30-60 seconds)...
:NEO4J_WAIT
timeout /t 5 /nobreak >nul
docker exec averio-neo4j cypher-shell -u neo4j -p averio123 "RETURN 1" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo     Still waiting for Neo4j...
    goto NEO4J_WAIT
)
echo     Neo4j is ready.

echo [3/5] Building backend (Spring Boot)...
cd backend
call mvnw.cmd clean package -DskipTests -q
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Backend build failed. Check the Maven output above.
    cd ..
    pause
    exit /b 1
)
echo     Backend built successfully.

echo [4/5] Starting backend server (port 8080)...
start "Averio Backend" cmd /k "java -jar target\averio-mdm-*.jar --spring.profiles.active=local && pause"
cd ..

REM Wait for backend to be ready
echo     Waiting for backend to start...
:BACKEND_WAIT
timeout /t 3 /nobreak >nul
curl -s http://localhost:8080/actuator/health >nul 2>&1
if %ERRORLEVEL% neq 0 goto BACKEND_WAIT
echo     Backend is ready.

echo [5/5] Starting frontend (Vite dev server, port 5173)...
cd frontend
if not exist node_modules (
    echo     Installing npm dependencies...
    call npm install --silent
)
start "Averio Frontend" cmd /k "npm run dev && pause"
cd ..

echo.
echo  =========================================================
echo    All services started successfully!
echo  =========================================================
echo.
echo   Frontend:       http://localhost:5173
echo   Backend API:    http://localhost:8080
echo   Swagger UI:     http://localhost:8080/swagger-ui.html
echo   Neo4j Browser:  http://localhost:7474  (neo4j / averio123)
echo   Redis:          localhost:6379
echo.
echo   Default login:  admin / admin
echo.
echo   Run stop-local.bat to shut everything down.
echo  =========================================================
echo.

endlocal
