@echo off
setlocal EnableDelayedExpansion

title Averio MDM - Build

echo.
echo  =================================================================
echo    AVERIO MDM  ^|  Full-Stack Build
echo  =================================================================
echo.

REM ── Parse arguments ───────────────────────────────────────────────────────────
set BUILD_BACKEND=1
set BUILD_FRONTEND=1
set SKIP_TESTS=1
set CLEAN=0

:ARG_LOOP
if "%~1"==""         goto :ARGS_DONE
if /i "%~1"=="--backend-only"  ( set BUILD_FRONTEND=0 & shift & goto :ARG_LOOP )
if /i "%~1"=="--frontend-only" ( set BUILD_BACKEND=0  & shift & goto :ARG_LOOP )
if /i "%~1"=="--with-tests"    ( set SKIP_TESTS=0     & shift & goto :ARG_LOOP )
if /i "%~1"=="--clean"         ( set CLEAN=1          & shift & goto :ARG_LOOP )
if /i "%~1"=="--help"          goto :SHOW_HELP
echo [WARN] Unknown argument: %~1
shift & goto :ARG_LOOP
:ARGS_DONE

goto :CHECK_TOOLS

:SHOW_HELP
echo  Usage:  build.bat [options]
echo.
echo  Options:
echo    --backend-only    Build Spring Boot only (skip frontend)
echo    --frontend-only   Build Vite/React only  (skip backend)
echo    --with-tests      Run tests during backend build
echo    --clean           Run mvn clean before building
echo    --help            Show this help
echo.
echo  Examples:
echo    build.bat                   ^>  Build both backend and frontend
echo    build.bat --backend-only    ^>  Backend only, skip tests
echo    build.bat --with-tests      ^>  Full build with tests
echo    build.bat --clean           ^>  Clean build (removes target/)
exit /b 0

REM ── Prerequisites ─────────────────────────────────────────────────────────────
:CHECK_TOOLS
set STEP=0

if %BUILD_BACKEND%==1 (
    where java >nul 2>&1
    if !ERRORLEVEL! neq 0 (
        echo [ERROR] Java 21+ not found in PATH.
        echo         Download: https://adoptium.net/
        pause & exit /b 1
    )
    for /f "tokens=3" %%v in ('java -version 2^>^&1 ^| findstr /i "version"') do set JAVA_VER=%%v
    echo [INFO] Java:   !JAVA_VER!

    set "MVN_CMD="
    where mvn >nul 2>&1
    if !ERRORLEVEL! equ 0 ( set "MVN_CMD=mvn" & goto :MVN_OK )
    set "LOCAL_MVN=%USERPROFILE%\.maven\maven-3.9.15\bin\mvn.cmd"
    if exist "!LOCAL_MVN!" ( set "MVN_CMD=!LOCAL_MVN!" & goto :MVN_OK )
    if exist "backend\mvnw.cmd" ( set "MVN_CMD=backend\mvnw.cmd" & goto :MVN_OK )
    echo [ERROR] Maven not found. Add Maven to PATH or install to %%USERPROFILE%%\.maven\maven-3.9.15
    pause & exit /b 1
    :MVN_OK
    echo [INFO] Maven: !MVN_CMD!
)

if %BUILD_FRONTEND%==1 (
    where node >nul 2>&1
    if !ERRORLEVEL! neq 0 (
        echo [ERROR] Node.js 20+ not found in PATH.
        echo         Download: https://nodejs.org/
        pause & exit /b 1
    )
    for /f %%v in ('node --version 2^>^&1') do set NODE_VER=%%v
    for /f %%v in ('npm --version  2^>^&1') do set NPM_VER=%%v
    echo [INFO] Node:  !NODE_VER!  ^|  npm: !NPM_VER!
)

echo.

REM ── Timestamps ────────────────────────────────────────────────────────────────
set START_TIME=%TIME%

REM ── Backend build ─────────────────────────────────────────────────────────────
if %BUILD_BACKEND%==1 (
    set /a STEP+=1
    echo [!STEP!/2] Building backend ^(Spring Boot^)...

    set MVN_GOALS=package
    if %CLEAN%==1 set MVN_GOALS=clean package
    set MVN_FLAGS=
    if %SKIP_TESTS%==1 set MVN_FLAGS=-DskipTests

    cd backend
    echo       Running: mvn !MVN_GOALS! !MVN_FLAGS!
    call "!MVN_CMD!" !MVN_GOALS! !MVN_FLAGS!
    if !ERRORLEVEL! neq 0 (
        echo.
        echo  [FAILED] Backend build failed.
        echo           Re-run with full output:  cd backend ^&^& mvn !MVN_GOALS! !MVN_FLAGS!
        cd ..
        pause & exit /b 1
    )

    REM Find the jar
    set "JAR_FILE="
    for %%f in (target\averio-mdm-*.jar) do (
        echo %%f | findstr /v "\.original" >nul && set "JAR_FILE=%%f"
    )
    cd ..

    if defined JAR_FILE (
        echo       [OK] backend\!JAR_FILE!
    ) else (
        echo  [WARN] Jar not found in target\ — check build output.
    )
    echo.
)

REM ── Frontend build ────────────────────────────────────────────────────────────
if %BUILD_FRONTEND%==1 (
    set /a STEP+=1
    echo [!STEP!/2] Building frontend ^(Vite/React^)...

    cd frontend

    if not exist node_modules (
        echo       node_modules not found — running npm install...
        call npm install
        if !ERRORLEVEL! neq 0 (
            echo  [FAILED] npm install failed.
            cd ..
            pause & exit /b 1
        )
    )

    echo       Running: npm run build
    call npm run build
    if !ERRORLEVEL! neq 0 (
        echo.
        echo  [FAILED] Frontend build failed.
        echo           Re-run with full output:  cd frontend ^&^& npm run build
        cd ..
        pause & exit /b 1
    )

    REM Count output files
    set DIST_FILES=0
    for /r dist %%f in (*) do set /a DIST_FILES+=1
    echo       [OK] frontend\dist\  (!DIST_FILES! files^)
    cd ..
    echo.
)

REM ── Summary ───────────────────────────────────────────────────────────────────
set END_TIME=%TIME%
echo  =================================================================
echo    BUILD SUCCESSFUL
echo  =================================================================
echo.
if %BUILD_BACKEND%==1  echo    Backend jar:    backend\target\averio-mdm-1.0.0.jar
if %BUILD_FRONTEND%==1 echo    Frontend dist:  frontend\dist\
echo.
echo    Start ^(local^):   start-backend.bat   /   start-frontend.bat
echo    Start ^(full^):    start-local.bat
echo  =================================================================
echo.

endlocal
