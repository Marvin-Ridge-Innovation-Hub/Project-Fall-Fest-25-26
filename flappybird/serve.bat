@echo off
REM Quick server startup script for Flappy Bird Game (Windows)

setlocal enabledelayedexpansion

REM Get the directory where this script is located
set SCRIPT_DIR=%~dp0
set OUT_DIR=%SCRIPT_DIR%out

REM Check if out directory exists
if not exist "%OUT_DIR%" (
    echo ❌ Error: 'out' directory not found at %OUT_DIR%
    echo Please run 'npm run build' first to generate the output.
    pause
    exit /b 1
)

echo 🚀 Starting HTTP server...
echo.
echo ✅ Server running at http://localhost:8000
echo 📁 Serving from: %OUT_DIR%
echo.
echo 👉 Open http://localhost:8000 in your browser
echo.
echo Press Ctrl+C to stop the server
echo.

cd /d "%OUT_DIR%"
python -m http.server 8000

pause
