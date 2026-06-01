@echo off
setlocal EnableDelayedExpansion

title Averio MDM - Backend

echo.
echo  =========================================================
echo    AVERIO MDM  -  Backend  (Spring Boot / port 8080)
echo  =========================================================
echo.

REM ── Locate Maven ──────────────────────────────────────────────────────────────
set "MVN_CMD="

REM 1. Maven on PATH
where mvn >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set "MVN_CMD=mvn"
    goto :MVN_FOUND
)

REM 2. Known local Maven install
set "LOCAL_MVN=%USERPROFILE%\.maven\maven-3.9.15\bin\mvn.cmd"
if exist "%LOCAL_MVN%" (
    set "MVN_CMD=%LOCAL_MVN%"
    goto :MVN_FOUND
)

REM 3. Maven wrapper in backend/
if exist "backend\mvnw.cmd" (
    set "MVN_CMD=backend\mvnw.cmd"
    goto :MVN_FOUND
)

echo [ERROR] Maven not found.
echo         Add Maven to PATH, or install to %%USERPROFILE%%\.maven\maven-3.9.15
echo         Download: https://maven.apache.org/download.cgi
pause
exit /b 1

:MVN_FOUND
echo [INFO] Using Maven: %MVN_CMD%

REM ── Check Java ────────────────────────────────────────────────────────────────
where java >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Java 21+ is not installed or not in PATH.
    echo         Download: https://adoptium.net/
    pause
    exit /b 1
)
for /f "tokens=3" %%v in ('java -version 2^>^&1 ^| findstr /i "version"') do (
    echo [INFO] Java version: %%v
)

REM ── Kill any process already on port 8080 ─────────────────────────────────────
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr ":8080 " ^| findstr "LISTENING"') do (
    echo [WARN] Port 8080 in use by PID %%p — killing it...
    taskkill /F /PID %%p >nul 2>&1
)

REM ── Build ─────────────────────────────────────────────────────────────────────
echo.
echo [1/2] Building backend (skipping tests)...
cd backend
call "%MVN_CMD%" clean package -DskipTests -q
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Maven build failed. Run with full output:
    echo         cd backend ^&^& mvn clean package -DskipTests
    cd ..
    pause
    exit /b 1
)
echo       Build successful.

REM ── Start ─────────────────────────────────────────────────────────────────────
echo.
echo [2/2] Starting Spring Boot on port 8080...
echo       Profile: local  (Cosmos DB fallback active - no Docker required)
echo.

REM Resolve the actual jar filename (wildcards don't work in java -jar on Windows)
set "JAR_FILE="
for %%f in (target\averio-mdm-*.jar) do set "JAR_FILE=%%f"

if not defined JAR_FILE (
    echo [ERROR] No jar found in backend\target\. Build may have failed.
    cd ..
    pause
    exit /b 1
)
echo       Jar: %JAR_FILE%

start "Averio Backend" cmd /k "java -jar %JAR_FILE% --spring.profiles.active=local"
cd ..

REM ── Wait for port 8080 to be listening (up to 3 minutes) ────────────────────
echo Waiting for backend to start (this takes ~30 seconds)...
set WAIT_COUNT=0
:HEALTH_WAIT
set /a WAIT_COUNT+=1
if %WAIT_COUNT% gtr 60 (
    echo.
    echo [ERROR] Backend did not start after 3 minutes.
    echo         Check the "Averio Backend" window for error messages.
    goto :EOF
)
timeout /t 3 /nobreak >nul
netstat -ano 2>nul | findstr ":8080 " | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo         Still waiting... [%WAIT_COUNT%/60]
    goto HEALTH_WAIT
)

echo.
echo  =========================================================
echo    Backend is UP!
echo  =========================================================
echo.
echo    API Base:   http://localhost:8080/api/v1
echo    Swagger UI: http://localhost:8080/swagger-ui.html
echo    Health:     http://localhost:8080/actuator/health
echo.
echo    Close the "Averio Backend" window or run stop-backend.bat to stop.
echo  =========================================================
echo.

endlocal
