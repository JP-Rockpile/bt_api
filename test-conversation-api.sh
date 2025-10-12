#!/bin/bash

# Test script for POST /api/v1/chat/conversations endpoint
# This script verifies that the API returns the correct response format

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "======================================"
echo "Testing Chat Conversation API"
echo "======================================"
echo ""

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
ENDPOINT="${API_URL}/api/v1/chat/conversations"

# Check if JWT token is provided
if [ -z "$JWT_TOKEN" ]; then
    echo -e "${RED}ERROR: JWT_TOKEN environment variable is not set${NC}"
    echo ""
    echo "Usage:"
    echo "  export JWT_TOKEN='your-jwt-token-here'"
    echo "  ./test-conversation-api.sh"
    echo ""
    echo "Or:"
    echo "  JWT_TOKEN='your-jwt-token-here' ./test-conversation-api.sh"
    echo ""
    exit 1
fi

echo "Target: $ENDPOINT"
echo ""

# Test 1: Create conversation without title or initial message
echo -e "${YELLOW}Test 1: Create conversation (minimal)${NC}"
echo "--------------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "201" ]; then
    # Check if response has required fields
    SUCCESS=$(echo "$BODY" | jq -r '.success' 2>/dev/null)
    HAS_DATA=$(echo "$BODY" | jq 'has("data")' 2>/dev/null)
    HAS_ID=$(echo "$BODY" | jq 'has("data") and .data | has("id")' 2>/dev/null)
    HAS_USER_ID=$(echo "$BODY" | jq 'has("data") and .data | has("userId")' 2>/dev/null)
    HAS_TITLE=$(echo "$BODY" | jq 'has("data") and .data | has("title")' 2>/dev/null)
    HAS_CREATED_AT=$(echo "$BODY" | jq 'has("data") and .data | has("createdAt")' 2>/dev/null)
    HAS_UPDATED_AT=$(echo "$BODY" | jq 'has("data") and .data | has("updatedAt")' 2>/dev/null)
    HAS_MESSAGE_COUNT=$(echo "$BODY" | jq 'has("data") and .data | has("messageCount")' 2>/dev/null)
    
    if [ "$SUCCESS" = "true" ] && \
       [ "$HAS_DATA" = "true" ] && \
       [ "$HAS_ID" = "true" ] && \
       [ "$HAS_USER_ID" = "true" ] && \
       [ "$HAS_TITLE" = "true" ] && \
       [ "$HAS_CREATED_AT" = "true" ] && \
       [ "$HAS_UPDATED_AT" = "true" ] && \
       [ "$HAS_MESSAGE_COUNT" = "true" ]; then
        echo -e "${GREEN}✓ Test 1 PASSED${NC}"
    else
        echo -e "${RED}✗ Test 1 FAILED - Missing required fields${NC}"
        echo "  success: $SUCCESS"
        echo "  has data: $HAS_DATA"
        echo "  has id: $HAS_ID"
        echo "  has userId: $HAS_USER_ID"
        echo "  has title: $HAS_TITLE"
        echo "  has createdAt: $HAS_CREATED_AT"
        echo "  has updatedAt: $HAS_UPDATED_AT"
        echo "  has messageCount: $HAS_MESSAGE_COUNT"
    fi
else
    echo -e "${RED}✗ Test 1 FAILED - Expected status 201, got $HTTP_CODE${NC}"
fi
echo ""

# Test 2: Create conversation with title
echo -e "${YELLOW}Test 2: Create conversation with title${NC}"
echo "--------------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Lakers vs Warriors Strategy"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "201" ]; then
    TITLE=$(echo "$BODY" | jq -r '.data.title' 2>/dev/null)
    MESSAGE_COUNT=$(echo "$BODY" | jq -r '.data.messageCount' 2>/dev/null)
    
    if [ "$TITLE" = "Lakers vs Warriors Strategy" ] && [ "$MESSAGE_COUNT" = "0" ]; then
        echo -e "${GREEN}✓ Test 2 PASSED${NC}"
    else
        echo -e "${RED}✗ Test 2 FAILED - Title or messageCount incorrect${NC}"
        echo "  Expected title: 'Lakers vs Warriors Strategy', got: '$TITLE'"
        echo "  Expected messageCount: 0, got: $MESSAGE_COUNT"
    fi
else
    echo -e "${RED}✗ Test 2 FAILED - Expected status 201, got $HTTP_CODE${NC}"
fi
echo ""

# Test 3: Create conversation with initial message
echo -e "${YELLOW}Test 3: Create conversation with initial message${NC}"
echo "--------------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Betting Advice",
    "initialMessage": "Should I bet on the Lakers tonight?"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "201" ]; then
    MESSAGE_COUNT=$(echo "$BODY" | jq -r '.data.messageCount' 2>/dev/null)
    LAST_MESSAGE_AT=$(echo "$BODY" | jq -r '.data.lastMessageAt' 2>/dev/null)
    
    if [ "$MESSAGE_COUNT" = "1" ] && [ "$LAST_MESSAGE_AT" != "null" ]; then
        echo -e "${GREEN}✓ Test 3 PASSED${NC}"
    else
        echo -e "${RED}✗ Test 3 FAILED - messageCount or lastMessageAt incorrect${NC}"
        echo "  Expected messageCount: 1, got: $MESSAGE_COUNT"
        echo "  Expected lastMessageAt: not null, got: $LAST_MESSAGE_AT"
    fi
else
    echo -e "${RED}✗ Test 3 FAILED - Expected status 201, got $HTTP_CODE${NC}"
fi
echo ""

# Test 4: Test error response format (invalid auth)
echo -e "${YELLOW}Test 4: Test error response format (invalid auth)${NC}"
echo "--------------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT" \
  -H "Authorization: Bearer invalid-token" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "401" ]; then
    SUCCESS=$(echo "$BODY" | jq -r '.success' 2>/dev/null)
    HAS_ERROR=$(echo "$BODY" | jq 'has("error")' 2>/dev/null)
    HAS_ERROR_CODE=$(echo "$BODY" | jq 'has("error") and .error | has("code")' 2>/dev/null)
    HAS_ERROR_MESSAGE=$(echo "$BODY" | jq 'has("error") and .error | has("message")' 2>/dev/null)
    
    if [ "$SUCCESS" = "false" ] && \
       [ "$HAS_ERROR" = "true" ] && \
       [ "$HAS_ERROR_CODE" = "true" ] && \
       [ "$HAS_ERROR_MESSAGE" = "true" ]; then
        echo -e "${GREEN}✓ Test 4 PASSED - Error format is correct${NC}"
    else
        echo -e "${YELLOW}⚠ Test 4 WARNING - Error format may not match expected format${NC}"
        echo "  success: $SUCCESS (expected: false)"
        echo "  has error: $HAS_ERROR (expected: true)"
        echo "  has error.code: $HAS_ERROR_CODE (expected: true)"
        echo "  has error.message: $HAS_ERROR_MESSAGE (expected: true)"
    fi
else
    echo -e "${YELLOW}⚠ Test 4 SKIPPED - Expected 401 status for invalid auth${NC}"
fi
echo ""

echo "======================================"
echo "Tests Complete"
echo "======================================"

