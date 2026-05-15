@echo off
title Averio MDM - Stopping Local Environment

echo.
echo  =========================================================
echo    AVERIO MDM  -  Stopping Local Environment
echo  =========================================================
echo.

echo [1/3] Stopping backend and frontend processes...
taskkill /FI "WINDOWTITLE eq Averio Backend*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Averio Frontend*" /F >nul 2>&1
echo     Done.

echo [2/3] Stopping Docker infrastructure...
docker-compose -f docker-compose.yml stop neo4j redis cosmos-emulator
echo     Done.

echo [3/3] Cleanup complete.
echo.
echo  All services stopped. Run start-local.bat to restart.
echo  =========================================================
echo.
pause
