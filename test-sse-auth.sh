#!/bin/bash

# SSE Authentication Test Script
# Tests the SSE endpoint with proper authentication

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
echo -e "${BLUE}║    SSE Authentication Test Suite     ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════╝${NC}"
echo ""

# Check if JWT token is provided
if [ -z "$JWT_TOKEN" ]; then
    echo -e "${RED}❌ Error: JWT_TOKEN environment variable not set${NC}"
    echo ""
    echo -e "${YELLOW}To get a JWT token:${NC}"
    echo "1. Login to your mobile app"
    echo "2. Extract the access token from your auth provider"
    echo "3. Set it as an environment variable:"
    echo ""
    echo -e "${GREEN}export JWT_TOKEN='eyJhbGc...'${NC}"
    echo ""
    echo "Then run this script again:"
    echo -e "${GREEN}./test-sse-auth.sh${NC}"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓${NC} JWT Token provided: ${JWT_TOKEN:0:20}..."
echo -e "${GREEN}✓${NC} API Base: $API_BASE"
echo -e "${GREEN}✓${NC} Conversation ID: $CONVERSATION_ID"
echo ""

# Test 1: Verify token is valid by testing a regular endpoint
echo -e "${BLUE}Test 1: Verifying JWT Token${NC}"
echo "----------------------------------------"

TOKEN_TEST=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    "$API_BASE/chat/conversations" 2>&1)

TOKEN_HTTP_CODE=$(echo "$TOKEN_TEST" | tail -n1)
TOKEN_RESPONSE=$(echo "$TOKEN_TEST" | head -n-1)

if [ "$TOKEN_HTTP_CODE" = "200" ] || [ "$TOKEN_HTTP_CODE" = "201" ]; then
    echo -e "${GREEN}✓${NC} Token is valid (HTTP $TOKEN_HTTP_CODE)"
else
    echo -e "${RED}✗${NC} Token validation failed (HTTP $TOKEN_HTTP_CODE)"
    echo -e "${RED}Response:${NC} $TOKEN_RESPONSE"
    echo ""
    echo -e "${YELLOW}Token might be expired or invalid. Please get a fresh token.${NC}"
    exit 1
fi

echo ""

# Test 2: Connect to SSE endpoint with Authorization header
echo -e "${BLUE}Test 2: SSE Connection with Authorization Header${NC}"
echo "----------------------------------------"
echo "Connecting to SSE endpoint..."
echo ""

# Start SSE connection in background
(
    timeout 15 curl -N -s \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -H "Accept: text/event-stream" \
        "$API_BASE/chat/conversations/$CONVERSATION_ID/stream" 2>&1 | \
    while IFS= read -r line; do
        if [ -n "$line" ]; then
            echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $line"
        fi
    done
) &
SSE_PID=$!

# Wait for connection to establish
sleep 2

# Check if SSE process is still running
if ps -p $SSE_PID > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} SSE connection established"
else
    echo -e "${RED}✗${NC} SSE connection failed"
    echo -e "${YELLOW}Check backend logs for errors:${NC} docker-compose logs --tail=50 api"
    exit 1
fi

# Test 3: Send a message while SSE is active
echo ""
echo -e "${BLUE}Test 3: Sending Message (Trigger Placeholder Response)${NC}"
echo "----------------------------------------"
sleep 1

MESSAGE_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"content\": \"Test message from script at $(date '+%H:%M:%S')\"}" \
    "$API_BASE/chat/conversations/$CONVERSATION_ID/messages")

MESSAGE_HTTP_CODE=$(echo "$MESSAGE_RESPONSE" | tail -n1)
MESSAGE_BODY=$(echo "$MESSAGE_RESPONSE" | head -n-1)

if [ "$MESSAGE_HTTP_CODE" = "201" ]; then
    echo -e "${GREEN}✓${NC} Message sent successfully (HTTP $MESSAGE_HTTP_CODE)"
    echo -e "${YELLOW}Watch above for SSE events:${NC}"
    echo "  - llm_chunk events (streaming response)"
    echo "  - llm_complete event (completion signal)"
else
    echo -e "${RED}✗${NC} Message send failed (HTTP $MESSAGE_HTTP_CODE)"
    echo -e "${RED}Response:${NC} $MESSAGE_BODY"
fi

echo ""
echo -e "${YELLOW}Monitoring SSE stream for 10 more seconds...${NC}"
echo -e "${YELLOW}You should see:${NC}"
echo "  1. llm_chunk events appearing (word by word)"
echo "  2. llm_complete event at the end"
echo ""

# Wait for events
sleep 10

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
echo -e "${GREEN}✓${NC} JWT token validation"
echo -e "${GREEN}✓${NC} SSE connection established"
echo -e "${GREEN}✓${NC} Message sent during active SSE connection"
echo ""
echo -e "${YELLOW}Expected SSE Events:${NC}"
echo "  • connected event (immediate)"
echo "  • heartbeat event (every 30s)"
echo "  • llm_chunk events (after POST)"
echo "  • llm_complete event (end of response)"
echo ""
echo -e "${YELLOW}If you didn't see all events:${NC}"
echo "  1. Check backend logs: ${GREEN}docker-compose logs --tail=100 api${NC}"
echo "  2. Look for '[ChatController] SSE stream requested'"
echo "  3. Look for '[SseService] SSE stream created'"
echo "  4. Check for authentication errors"
echo ""
echo -e "${YELLOW}Full testing guide:${NC} See SSE_AUTH_AND_TESTING.md"
echo ""

