#!/bin/bash

# Test script for bt_model integration with bt_api
# This script tests the SSE proxy functionality

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}bt_model Integration Test${NC}"
echo -e "${YELLOW}========================================${NC}"

# Configuration
BT_API_URL="${BT_API_URL:-http://localhost:3000}"
TEST_USER_TOKEN="${TEST_USER_TOKEN}"

if [ -z "$TEST_USER_TOKEN" ]; then
  echo -e "${RED}❌ ERROR: TEST_USER_TOKEN environment variable is required${NC}"
  echo "Get a test token by running: ./get-test-token.sh"
  exit 1
fi

echo -e "\n${YELLOW}Configuration:${NC}"
echo "  BT_API_URL: $BT_API_URL"
echo "  Token: ${TEST_USER_TOKEN:0:20}..."

# Step 1: Create a new conversation
echo -e "\n${YELLOW}Step 1: Creating conversation...${NC}"
CONVERSATION_RESPONSE=$(curl -s -X POST "$BT_API_URL/api/v1/chat/conversations" \
  -H "Authorization: Bearer $TEST_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "bt_model Integration Test",
    "initialMessage": "What are the best odds for the Chiefs game tonight?"
  }')

CONVERSATION_ID=$(echo $CONVERSATION_RESPONSE | jq -r '.id')

if [ -z "$CONVERSATION_ID" ] || [ "$CONVERSATION_ID" == "null" ]; then
  echo -e "${RED}❌ Failed to create conversation${NC}"
  echo "Response: $CONVERSATION_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Conversation created: $CONVERSATION_ID${NC}"

# Step 2: Open SSE stream
echo -e "\n${YELLOW}Step 2: Opening SSE stream...${NC}"
echo "This will stream the AI response from bt_model (or placeholder if disabled)"
echo ""

curl -N -H "Authorization: Bearer $TEST_USER_TOKEN" \
  "$BT_API_URL/api/v1/chat/conversations/$CONVERSATION_ID/stream" 2>/dev/null | while read -r line; do
  
  # Parse SSE events
  if [[ "$line" == data:* ]]; then
    EVENT_DATA="${line#data: }"
    EVENT_TYPE=$(echo "$EVENT_DATA" | jq -r '.type // empty')
    
    case "$EVENT_TYPE" in
      "connected")
        echo -e "${GREEN}✅ Connected to SSE stream${NC}"
        ;;
      "llm_chunk")
        CONTENT=$(echo "$EVENT_DATA" | jq -r '.content // empty')
        echo -n "$CONTENT"
        ;;
      "llm_complete")
        echo ""
        echo -e "\n${GREEN}✅ Response complete${NC}"
        FULL_CONTENT=$(echo "$EVENT_DATA" | jq -r '.content // empty')
        echo -e "\nFull response length: ${#FULL_CONTENT} characters"
        break
        ;;
      "odds_update")
        echo -e "\n${GREEN}📊 Received odds update${NC}"
        echo "$EVENT_DATA" | jq '.'
        ;;
      "tool_call")
        TOOL_NAME=$(echo "$EVENT_DATA" | jq -r '.tool // empty')
        echo -e "\n${GREEN}🔧 Tool called: $TOOL_NAME${NC}"
        ;;
      "error")
        ERROR_MSG=$(echo "$EVENT_DATA" | jq -r '.message // empty')
        echo -e "\n${RED}❌ Error: $ERROR_MSG${NC}"
        break
        ;;
      "heartbeat")
        # Silent heartbeat
        ;;
      *)
        if [ -n "$EVENT_TYPE" ]; then
          echo -e "\n${YELLOW}📦 Event: $EVENT_TYPE${NC}"
        fi
        ;;
    esac
  fi
done

# Step 3: Verify message was saved
echo -e "\n${YELLOW}Step 3: Verifying message history...${NC}"
HISTORY=$(curl -s -H "Authorization: Bearer $TEST_USER_TOKEN" \
  "$BT_API_URL/api/v1/chat/conversations/$CONVERSATION_ID/history")

MESSAGE_COUNT=$(echo "$HISTORY" | jq '. | length')
echo -e "${GREEN}✅ Found $MESSAGE_COUNT messages in history${NC}"

if [ "$MESSAGE_COUNT" -lt 2 ]; then
  echo -e "${RED}❌ Expected at least 2 messages (user + assistant)${NC}"
  exit 1
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Integration test completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Set BT_MODEL_ENABLED=true in .env to use real bt_model"
echo "2. Ensure bt_model is running at \$BT_MODEL_BASE_URL"
echo "3. Verify BT_MODEL_SERVICE_TOKEN matches between services"

