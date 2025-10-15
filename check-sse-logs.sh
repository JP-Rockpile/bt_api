#!/bin/bash

# SSE Log Checker Script
# Use this to monitor SSE connections in real-time

echo "🔍 SSE Connection Log Monitor"
echo "=============================="
echo ""
echo "Choose an option:"
echo ""
echo "1. View last 50 SSE events"
echo "2. Watch SSE events in real-time (live)"
echo "3. Check for specific conversation ID"
echo "4. Show authentication activity"
echo "5. Show all recent logs (last 100 lines)"
echo ""
read -p "Enter choice (1-5): " choice

case $choice in
  1)
    echo ""
    echo "📊 Last 50 SSE Events:"
    echo "---------------------"
    docker-compose logs --tail=50 api | grep -E "SSE|stream" | tail -20
    ;;
  2)
    echo ""
    echo "👁️  Watching SSE events live (Ctrl+C to stop)..."
    echo "---------------------------------------------"
    docker-compose logs -f api | grep --line-buffered -E "SSE|stream|ChatController"
    ;;
  3)
    read -p "Enter conversation ID: " conv_id
    echo ""
    echo "🔎 Searching for conversation: $conv_id"
    echo "----------------------------------------"
    docker-compose logs --tail=200 api | grep "$conv_id"
    ;;
  4)
    echo ""
    echo "🔐 Authentication Activity:"
    echo "--------------------------"
    docker-compose logs --tail=100 api | grep -E "authenticated|SSE stream created|SSE auth"
    ;;
  5)
    echo ""
    echo "📜 Recent API Logs (last 100 lines):"
    echo "------------------------------------"
    docker-compose logs --tail=100 api
    ;;
  *)
    echo "Invalid choice"
    exit 1
    ;;
esac

echo ""
echo "✨ Log patterns to look for:"
echo "  ✅ 'User authenticated: auth0|...' - Auth successful"
echo "  ✅ 'SSE stream created for ...' - Connection established"
echo "  ✅ 'statusCode: 200' - Success response"
echo "  ✅ 'SSE stream closed for ...' - Normal disconnect"
echo "  ❌ '401 Unauthorized' - Invalid token"
echo "  ❌ 'SSE stream error' - Something went wrong"

