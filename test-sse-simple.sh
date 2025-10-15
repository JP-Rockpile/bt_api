#!/bin/bash

# Simple SSE endpoint test
# This tests the endpoint WITHOUT authentication to show it's responding

echo "🔍 Simple SSE Endpoint Test"
echo "=============================="
echo ""
echo "Testing endpoint: http://localhost:3000/api/v1/chat/conversations/test-123/stream"
echo ""
echo "Expected: 401 Unauthorized (proves endpoint exists and responds)"
echo ""

RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -H "Accept: text/event-stream" \
  http://localhost:3000/api/v1/chat/conversations/test-123/stream)

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE:/d')

echo "Response Code: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" = "401" ]; then
    echo "✅ SUCCESS: Endpoint is responding!"
    echo "   - Endpoint exists and is reachable"
    echo "   - Authentication is working (requires valid token)"
    echo ""
    echo "📋 Response:"
    echo "$BODY" | head -20
    echo ""
    echo "🎯 Next Step: Run with a valid JWT token:"
    echo "   export JWT_TOKEN='your-token-here'"
    echo "   ./test-sse-auth.sh"
elif [ "$HTTP_CODE" = "200" ]; then
    echo "✅ SUCCESS: Connected without auth (unexpected but working!)"
    echo "   You might have auth disabled for testing"
else
    echo "❌ Unexpected response code: $HTTP_CODE"
    echo "$BODY"
fi

echo ""
echo "💡 To get a JWT token:"
echo "   1. Extract from your mobile app logs"
echo "   2. Use Auth0 dashboard test feature"
echo "   3. Run: ./get-test-token.sh for instructions"

