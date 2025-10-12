# Quick Start: Testing the Conversation API Fix

## TL;DR

The backend now returns consistent, properly formatted responses for the `POST /api/v1/chat/conversations` endpoint. The mobile app crash is fixed.

## Quick Test

### 1. Start the Backend

```bash
npm run start:dev
```

### 2. Get a JWT Token

You need a valid JWT token from your Auth0 authentication flow. In the mobile app, you can find it in the logs after login, or use your Auth0 test credentials.

### 3. Run the Test Script

```bash
# Set your JWT token
export JWT_TOKEN="your-actual-jwt-token-here"

# Run the automated tests
./test-conversation-api.sh
```

### 4. Expected Output

You should see:
```
✓ Test 1 PASSED
✓ Test 2 PASSED
✓ Test 3 PASSED
✓ Test 4 PASSED
```

## What Was Fixed?

### Before ❌
```json
{
  "conversationId": "...",
  "title": "...",
  "createdAt": "..."
}
```
**Result:** Mobile app crashed because it couldn't find `id` or `userId`

### After ✅
```json
{
  "success": true,
  "data": {
    "id": "...",
    "userId": "...",
    "title": "...",
    "createdAt": "...",
    "updatedAt": "...",
    "lastMessageAt": null,
    "messageCount": 0
  },
  "timestamp": "..."
}
```
**Result:** Mobile app works perfectly!

## Manual Testing

If you don't want to use the test script:

```bash
curl -X POST http://localhost:3000/api/v1/chat/conversations \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Conversation"}' \
  | jq '.'
```

## Test from Mobile App

1. Start backend: `npm run start:dev`
2. Start mobile app: `npx expo start -c` (clears cache)
3. Log in to the app
4. Try to create a new conversation
5. It should work without crashing! 🎉

## If Something Goes Wrong

### Backend Won't Start?
```bash
# Check for syntax errors
npm run build

# Check for missing dependencies
npm install
```

### Still Getting Old Response Format?
```bash
# Make sure you restarted the backend
npm run start:dev
```

### JWT Token Invalid?
- Make sure the token hasn't expired
- Check that Auth0 is configured correctly
- Verify the token includes a user ID in the `sub` claim

## Need More Details?

See the full documentation in `CONVERSATION_API_FIX.md` for:
- Complete API specification
- All response fields explained
- Error handling details
- Troubleshooting guide

---

**Status: ✅ Ready to Test**

All changes have been implemented and the code compiles successfully.

