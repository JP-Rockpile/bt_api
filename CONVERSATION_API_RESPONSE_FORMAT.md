# Conversation API Response Format

## ✅ Changes Implemented

### 1. Response Wrapping (TransformInterceptor)
Updated `/src/common/interceptors/transform.interceptor.ts` to properly wrap all API responses in the standard format:

```typescript
{
  success: boolean,
  data: T,
  timestamp: string,
  statusCode?: number,
  requestId?: string
}
```

### 2. Assistant "hi" Message
Updated `/src/modules/chat/chat.service.ts` to automatically create an ASSISTANT message saying "hi" when a conversation is started with an initial message. This serves as a placeholder until the LLM is integrated.

## 📋 POST /api/v1/chat/conversations

### Request Format

```json
{
  "title": "Optional conversation title",
  "initialMessage": "Optional first message from user",
  "metadata": {
    "key": "value"
  }
}
```

All fields are optional.

### Response Format - Case 1: No Initial Message

**Request:**
```json
{
  "title": "Betting Strategy"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "cm2abc123def456",
    "userId": "auth0|user123",
    "title": "Betting Strategy",
    "createdAt": "2025-10-12T19:20:00.000Z",
    "updatedAt": "2025-10-12T19:20:00.000Z",
    "lastMessageAt": null,
    "messageCount": 0
  },
  "timestamp": "2025-10-12T19:20:00.123Z",
  "statusCode": 201,
  "requestId": "abc123"
}
```

### Response Format - Case 2: With Initial Message

**Request:**
```json
{
  "title": "Lakers Betting Advice",
  "initialMessage": "Should I bet on the Lakers tonight?"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "cm2xyz789ghi012",
    "userId": "auth0|user123",
    "title": "Lakers Betting Advice",
    "createdAt": "2025-10-12T19:20:00.000Z",
    "updatedAt": "2025-10-12T19:20:00.000Z",
    "lastMessageAt": "2025-10-12T19:20:00.000Z",
    "messageCount": 2
  },
  "timestamp": "2025-10-12T19:20:00.123Z",
  "statusCode": 201,
  "requestId": "xyz789"
}
```

**Note:** `messageCount` is 2 because:
1. USER message: "Should I bet on the Lakers tonight?"
2. ASSISTANT message: "hi" (placeholder until LLM is hooked up)

## 📋 GET /api/v1/chat/conversations/:id/history

To retrieve the actual message content:

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "msg1",
      "userId": "auth0|user123",
      "conversationId": "cm2xyz789ghi012",
      "role": "USER",
      "content": "Should I bet on the Lakers tonight?",
      "createdAt": "2025-10-12T19:20:00.000Z",
      "metadata": {
        "title": "Lakers Betting Advice"
      }
    },
    {
      "id": "msg2",
      "userId": "auth0|user123",
      "conversationId": "cm2xyz789ghi012",
      "role": "ASSISTANT",
      "content": "hi",
      "createdAt": "2025-10-12T19:20:00.001Z",
      "metadata": null
    }
  ],
  "timestamp": "2025-10-12T19:20:05.123Z",
  "statusCode": 200,
  "requestId": "def456"
}
```

## 🔍 Field Descriptions

### Conversation Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (cuid2) | Unique conversation identifier |
| `userId` | string | User ID from JWT token (Auth0 subject) |
| `title` | string | Conversation title (empty string if not provided) |
| `createdAt` | string (ISO 8601) | When the conversation was created |
| `updatedAt` | string (ISO 8601) | When the conversation was last updated |
| `lastMessageAt` | string or null | Timestamp of the last message (null if no messages) |
| `messageCount` | number | Total number of messages in the conversation |

### Wrapper Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | `true` for 2xx responses, `false` for errors |
| `data` | object | The actual response data |
| `timestamp` | string (ISO 8601) | When the response was generated |
| `statusCode` | number | HTTP status code |
| `requestId` | string/number | Request tracking ID |

## ❌ Error Response Format

**Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token",
    "details": {}
  },
  "timestamp": "2025-10-12T19:20:00.123Z",
  "statusCode": 401,
  "requestId": "err123"
}
```

**Response (400 Bad Request - Validation Error):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "title must be a string, initialMessage must be a string",
    "details": {
      "errors": [
        "title must be a string",
        "initialMessage must be a string"
      ]
    }
  },
  "timestamp": "2025-10-12T19:20:00.123Z",
  "statusCode": 400,
  "requestId": "val456"
}
```

## ✅ Frontend Requirements Compliance

All requirements from the frontend team are now met:

- ✅ **Field name:** `id` (not `conversationId`)
- ✅ **userId included:** Extracted from JWT token
- ✅ **updatedAt field:** Included
- ✅ **lastMessageAt field:** Included (null or timestamp)
- ✅ **messageCount field:** Included (0 or 2 depending on initialMessage)
- ✅ **Wrapped response:** All responses wrapped in `{success, data, timestamp}` format
- ✅ **Error format:** Consistent `{success: false, error, timestamp}` format
- ✅ **ISO 8601 dates:** All timestamps use ISO 8601 format

## 🔄 Typical Frontend Flow

### 1. Create Conversation
```javascript
const response = await fetch('/api/v1/chat/conversations', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'Betting Help',
    initialMessage: 'What are the best bets today?'
  })
});

const { success, data } = await response.json();
// data.id = conversation ID
// data.messageCount = 2 (user message + "hi" response)
```

### 2. Get Message History
```javascript
const response = await fetch(`/api/v1/chat/conversations/${data.id}/history`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { success, data: messages } = await response.json();
// messages = array of message objects
// messages[0].role = 'USER'
// messages[0].content = 'What are the best bets today?'
// messages[1].role = 'ASSISTANT'
// messages[1].content = 'hi'
```

### 3. Connect to SSE Stream (for real-time updates)
```javascript
const eventSource = new EventSource(
  `/api/v1/chat/conversations/${conversationId}/stream`,
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle real-time updates (when LLM is hooked up)
};
```

## 📝 TODO: LLM Integration

Current placeholder behavior:
```typescript
// TODO: Remove this placeholder once LLM is hooked up
// Create a simple assistant response for now
await this.createMessage(userId, conversationId, 'ASSISTANT', 'hi');
messageCount = 2;
```

When integrating the LLM:
1. Remove the hardcoded "hi" message
2. Connect to your LLM service
3. Stream the response via SSE endpoint `/api/v1/chat/conversations/:id/stream`
4. Update `messageCount` and `lastMessageAt` after LLM response completes

## 🧪 Testing

Use the provided test script:

```bash
# Set your JWT token
export JWT_TOKEN="your-auth0-jwt-token"

# Run tests
./test-conversation-api.sh
```

The test script verifies:
- ✅ Response wrapping format
- ✅ All required fields present
- ✅ Correct messageCount behavior
- ✅ Error response format

## 📊 Example: Complete Conversation Creation Flow

```bash
# 1. Create conversation
curl -X POST http://localhost:3000/api/v1/chat/conversations \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Betting Strategy",
    "initialMessage": "Should I bet on Lakers tonight?"
  }' | jq

# Response:
# {
#   "success": true,
#   "data": {
#     "id": "cm2abc123",
#     "userId": "auth0|user123",
#     "title": "Betting Strategy",
#     "messageCount": 2,
#     ...
#   }
# }

# 2. Get message history
curl http://localhost:3000/api/v1/chat/conversations/cm2abc123/history \
  -H "Authorization: Bearer ${JWT_TOKEN}" | jq

# Response:
# {
#   "success": true,
#   "data": [
#     { "role": "USER", "content": "Should I bet on Lakers tonight?" },
#     { "role": "ASSISTANT", "content": "hi" }
#   ]
# }

# 3. Get all user conversations
curl http://localhost:3000/api/v1/chat/conversations \
  -H "Authorization: Bearer ${JWT_TOKEN}" | jq

# Response:
# {
#   "success": true,
#   "data": [
#     {
#       "conversationId": "cm2abc123",
#       "messageCount": 2,
#       "lastMessageAt": "2025-10-12T19:20:00.000Z",
#       "preview": "Should I bet on Lakers tonight?"
#     }
#   ]
# }
```

## 🔐 Authentication

All endpoints require a valid Auth0 JWT token in the Authorization header:

```
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

The `userId` in responses is automatically extracted from the JWT token's `sub` (subject) claim.

## 🚀 Summary

The backend now returns responses that exactly match your frontend requirements:
- ✅ Wrapped in `{success, data, timestamp}` format
- ✅ All required fields present (`id`, `userId`, `title`, `createdAt`, `updatedAt`, `lastMessageAt`, `messageCount`)
- ✅ Placeholder "hi" message until LLM is integrated
- ✅ Consistent error format
- ✅ Ready for mobile app integration

