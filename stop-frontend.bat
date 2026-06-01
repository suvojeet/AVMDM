@echo off
title Averio MDM - Stop Frontend

echo.
echo  =========================================================
echo    AVERIO MDM  -  Stopping Frontend
echo  =========================================================
echo.

REM Kill the named window launched by start-frontend.bat
taskkill /FI "WINDOWTITLE eq Averio Frontend*" /F >nul 2>&1

REM Also kill any Node process still holding port 5173
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    echo [INFO] Killing process on port 5173 (PID %%p)...
    taskkill /F /PID %%p >nul 2>&1
)

echo  Frontend stopped.
echo  =========================================================
echo.
timeout /t 2 /nobreak >nul
