#!/bin/bash
# Quick server startup script for Flappy Bird Game

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
OUT_DIR="$SCRIPT_DIR/out"

# Check if out directory exists
if [ ! -d "$OUT_DIR" ]; then
    echo "❌ Error: 'out' directory not found at $OUT_DIR"
    echo "Please run 'npm run build' first to generate the output."
    exit 1
fi

# Check for open command (macOS)
if command -v open &> /dev/null; then
    echo "🚀 Starting HTTP server and opening in browser..."
    cd "$OUT_DIR"
    python -m http.server 8000 &
    SERVER_PID=$!
    sleep 1
    open http://localhost:8000
    echo ""
    echo "✅ Server running at http://localhost:8000"
    echo "📁 Serving from: $OUT_DIR"
    echo ""
    echo "Press Ctrl+C to stop the server"
    wait $SERVER_PID
elif command -v xdg-open &> /dev/null; then
    # Linux
    echo "🚀 Starting HTTP server and opening in browser..."
    cd "$OUT_DIR"
    python -m http.server 8000 &
    SERVER_PID=$!
    sleep 1
    xdg-open http://localhost:8000
    echo ""
    echo "✅ Server running at http://localhost:8000"
    echo "📁 Serving from: $OUT_DIR"
    echo ""
    echo "Press Ctrl+C to stop the server"
    wait $SERVER_PID
else
    # Generic fallback (Windows Git Bash, etc.)
    echo "🚀 Starting HTTP server..."
    cd "$OUT_DIR"
    echo ""
    echo "✅ Server running at http://localhost:8000"
    echo "📁 Serving from: $OUT_DIR"
    echo ""
    echo "👉 Open http://localhost:8000 in your browser"
    echo ""
    echo "Press Ctrl+C to stop the server"
    python -m http.server 8000
fi
