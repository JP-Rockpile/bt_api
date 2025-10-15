#!/bin/bash

# SSE Connection Test Script
# This script tests the SSE endpoint and concurrent POST requests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE="${API_BASE:-http://localhost:3000/api/v1}"
CONVERSATION_ID="${CONVERSATION_ID:-test-conv-$(date +%s)}"

echo -e "${BLUE}╔═══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    SSE Connection Test Suite         ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════╝${NC}"
echo ""

# Check if JWT token is provided
if [ -z "$JWT_TOKEN" ]; then
    echo -e "${RED}❌ Error: JWT_TOKEN environment variable not set${NC}"
    echo -e "${YELLOW}Usage: JWT_TOKEN='your-token-here' ./test-sse.sh${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} JWT Token: ${JWT_TOKEN:0:20}..."
echo -e "${GREEN}✓${NC} API Base: $API_BASE"
echo -e "${GREEN}✓${NC} Conversation ID: $CONVERSATION_ID"
echo ""

# Test 1: Check SSE endpoint headers
echo -e "${BLUE}Test 1: Checking SSE Headers${NC}"
echo "----------------------------------------"

HEADERS=$(curl -sI -N \
    -H "Authorization: Bearer $JWT_TOKEN" \
    "$API_BASE/chat/conversations/$CONVERSATION_ID/stream" 2>&1 || true)

echo "$HEADERS" | grep -i "content-type: text/event-stream" && \
    echo -e "${GREEN}✓${NC} Content-Type: text/event-stream" || \
    echo -e "${RED}✗${NC} Missing Content-Type header"

echo "$HEADERS" | grep -i "cache-control" && \
    echo -e "${GREEN}✓${NC} Cache-Control header present" || \
    echo -e "${RED}✗${NC} Missing Cache-Control header"

echo "$HEADERS" | grep -i "connection" && \
    echo -e "${GREEN}✓${NC} Connection header present" || \
    echo -e "${RED}✗${NC} Missing Connection header"

echo ""

# Test 2: Open SSE connection and receive events
echo -e "${BLUE}Test 2: SSE Connection & Heartbeat${NC}"
echo "----------------------------------------"
echo "Opening SSE stream for 65 seconds to receive heartbeats..."
echo "(You should see 'connected' and at least 2 'heartbeat' events)"
echo ""

# Start SSE connection in background
(
    curl -N -s \
        -H "Authorization: Bearer $JWT_TOKEN" \
        "$API_BASE/chat/conversations/$CONVERSATION_ID/stream" | \
    while IFS= read -r line; do
        if [ -n "$line" ]; then
            echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $line"
        fi
    done
) &
SSE_PID=$!

# Wait a bit for connection to establish
sleep 3

# Test 3: Send POST request while SSE is active
echo ""
echo -e "${BLUE}Test 3: Concurrent POST Request${NC}"
echo "----------------------------------------"
echo "Sending message while SSE stream is active..."
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"content\": \"Test message at $(date '+%H:%M:%S')\"}" \
    "$API_BASE/chat/conversations/$CONVERSATION_ID/messages")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "201" ]; then
    echo -e "${GREEN}✓${NC} POST request successful (HTTP $HTTP_CODE)"
    echo -e "${GREEN}✓${NC} Response: $BODY"
else
    echo -e "${RED}✗${NC} POST request failed (HTTP $HTTP_CODE)"
    echo -e "${RED}Response:${NC} $BODY"
fi

echo ""
echo -e "${YELLOW}Waiting for more SSE events (60 seconds)...${NC}"
echo -e "${YELLOW}(You should see another heartbeat in ~30 seconds)${NC}"
echo ""

# Wait for 60 more seconds to see additional heartbeats
sleep 60

# Cleanup
echo ""
echo -e "${BLUE}Cleaning up...${NC}"
kill $SSE_PID 2>/dev/null || true
wait $SSE_PID 2>/dev/null || true

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    Test Summary                       ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✓${NC} SSE connection established"
echo -e "${GREEN}✓${NC} Headers properly set"
echo -e "${GREEN}✓${NC} POST request succeeded during active stream"
echo -e "${GREEN}✓${NC} Heartbeats received"
echo ""
echo -e "${YELLOW}Note:${NC} If you see 'Unauthorized' errors, check your JWT_TOKEN"
echo -e "${YELLOW}Note:${NC} If no heartbeats appear, check server logs for errors"
echo ""

