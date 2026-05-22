#!/bin/bash
set -e

echo "==================================================="
echo "  OmniLens Unified Local Startup Orchestration"
echo "==================================================="
echo ""

# 1. Verify Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed or not in PATH. Please install Node.js (v18+) to run this project."
    exit 1
fi
echo "[OK] Node.js detected."

# 2. Verify Python
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "[ERROR] Python is not installed or not in PATH. Please install Python 3.10+ to run this project."
    exit 1
fi
echo "[OK] Python detected."

# Check python command alias
PYTHON_CMD="python3"
if ! command -v python3 &> /dev/null; then
    PYTHON_CMD="python"
fi

# 3. Verify Docker (for Redis)
echo "Checking Docker and Redis status..."
if ! docker info &> /dev/null; then
    echo "[WARNING] Docker is not running or not installed."
    echo "Please make sure Docker Daemon is running if you want Redis to start automatically."
    echo "Press ENTER to continue if Redis is already running independently on localhost:6379, or Ctrl+C to abort."
    read -r
else
    echo "[OK] Docker detected. Spinning up Redis..."
    docker-compose up -d redis
fi

# 4. Verify/Setup Python Virtual Environment
echo ""
echo "Setting up Python virtual environment for AI Worker..."
cd ai-worker
if [ ! -d "venv" ]; then
    echo "Creating virtual environment (venv)..."
    $PYTHON_CMD -m venv venv
fi
source venv/bin/activate
echo "Installing/Verifying Python dependencies..."
pip install -r requirements.txt
cd ..

# 5. Install node dependencies
echo ""
echo "Installing Node.js dependencies (monorepo & microservices)..."
npm install
npm run install:all

# 6. Run all services
echo ""
echo "==================================================="
echo "  All environments verified! Starting OmniLens..."
echo "==================================================="
echo ""
npm start
