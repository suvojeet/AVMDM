@echo off
setlocal EnableDelayedExpansion

title Averio MDM - Frontend

echo.
echo  =========================================================
echo    AVERIO MDM  -  Frontend  (Vite dev server / port 5173)
echo  =========================================================
echo.

REM ── Check Node ────────────────────────────────────────────────────────────────
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js 20+ is not installed or not in PATH.
    echo         Download: https://nodejs.org/
    pause
    exit /b 1
)
for /f %%v in ('node --version') do echo [INFO] Node.js version: %%v

REM ── Check npm ─────────────────────────────────────────────────────────────────
where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm is not installed.
    pause
    exit /b 1
)

REM ── Kill any process already on port 5173 ─────────────────────────────────────
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    echo [WARN] Port 5173 in use by PID %%p — killing it...
    taskkill /F /PID %%p >nul 2>&1
)

REM ── Install dependencies if needed ────────────────────────────────────────────
cd frontend
if not exist node_modules (
    echo [1/2] Installing npm dependencies...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] npm install failed.
        cd ..
        pause
        exit /b 1
    )
    echo       Dependencies installed.
) else (
    echo [INFO] node_modules found — skipping install.
    echo        Run "npm install" manually if dependencies look outdated.
)

REM ── Start ─────────────────────────────────────────────────────────────────────
echo.
echo [2/2] Starting Vite dev server on port 5173...
echo       API requests proxy to: http://localhost:8080
echo.

start "Averio Frontend" cmd /k "npm run dev"
cd ..

REM ── Brief wait then print URLs ────────────────────────────────────────────────
timeout /t 3 /nobreak >nul

echo.
echo  =========================================================
echo    Frontend is starting!
echo  =========================================================
echo.
echo    App:        http://localhost:5173
echo    Login:      admin / admin
echo.
echo    Make sure the backend is also running on port 8080.
echo    Run start-backend.bat if it is not started yet.
echo.
echo    Close the "Averio Frontend" window or run stop-frontend.bat to stop.
echo  =========================================================
echo.

endlocal
