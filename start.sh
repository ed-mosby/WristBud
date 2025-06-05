#!/bin/sh
set -e

echo "🚀 Starting Health Metrics Generator..."

port_in_use() {
    netstat -tuln | grep ":$1 " > /dev/null 2>&1
}

#
if [ -f "server.js" ]; then
    echo "📡 Starting backend server on port 5000..."
    PORT=5000 node server.js &
    BACKEND_PID=$!
    
    echo "⏳ Waiting for backend to start..."
    for i in $(seq 1 30); do
        if port_in_use 5000; then
            echo "✅ Backend server started successfully"
            break
        fi
        sleep 1
    done
    
    if ! port_in_use 5000; then
        echo "❌ Backend server failed to start"
        exit 1
    fi
fi

echo "🌐 Starting frontend server on port 7860..."
serve -s build -l 7860 --cors --no-clipboard --single

echo "❌ Frontend server stopped unexpectedly"
exit 1
