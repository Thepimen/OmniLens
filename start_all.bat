@echo off
rem ===================================================
rem   OmniLens Unified Local Startup Orchestration
rem ===================================================
echo.

rem 1. Verify Node.js is installed
where node >nul 2>&1
if errorlevel 1 goto nonode
echo [OK] Node.js detected.

rem 2. Verify Python is installed
where python >nul 2>&1
if errorlevel 1 goto nopython
echo [OK] Python detected.

rem 3. Verify Docker (for Redis)
echo Checking Docker status...
docker info >nul 2>&1
if errorlevel 1 goto nodocker
echo [OK] Docker detected. Spinning up Redis container...
docker-compose up -d redis
goto checkvenv

:nodocker
echo.
echo [WARNING] Docker is not running or not installed.
echo Please make sure Docker Desktop is running if you want Redis to start automatically.
echo.
echo Press any key to continue if Redis is already running independently on localhost:6379,
echo or press Ctrl+C to abort and close.
pause
echo.

:checkvenv
echo.
echo Setting up Python virtual environment for AI Worker...
cd ai-worker

rem Check if venv directory exists
if exist venv goto activatevenv
echo Creating virtual environment (venv)...
python -m venv venv

:activatevenv
echo Activating virtual environment...
call venv\Scripts\activate.bat
echo Installing/Verifying Python dependencies...
pip install -r requirements.txt
cd ..

echo.
echo Installing Node.js dependencies (monorepo ^& microservices)...
call npm install
call npm run install:all

echo.
echo ===================================================
echo   All environments verified! Starting OmniLens...
echo ===================================================
echo.
call npm start
goto end

:nonode
echo.
echo [ERROR] Node.js is not installed or not in PATH. 
echo Please install Node.js (v18+) and try again.
pause
exit /b 1

:nopython
echo.
echo [ERROR] Python is not installed or not in PATH.
echo Please install Python (3.10+) and try again.
pause
exit /b 1

:end
pause
