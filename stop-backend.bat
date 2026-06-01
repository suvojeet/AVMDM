@echo off
title Averio MDM - Stop Backend

echo.
echo  =========================================================
echo    AVERIO MDM  -  Stopping Backend
echo  =========================================================
echo.

REM Kill the named window launched by start-backend.bat
taskkill /FI "WINDOWTITLE eq Averio Backend*" /F >nul 2>&1

REM Also kill any Java process still holding port 8080
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr ":8080 " ^| findstr "LISTENING"') do (
    echo [INFO] Killing process on port 8080 (PID %%p)...
    taskkill /F /PID %%p >nul 2>&1
)

echo  Backend stopped.
echo  =========================================================
echo.
timeout /t 2 /nobreak >nul
