# bt_model Integration Guide

## Architecture Overview

**bt_api** (this project) is the platform backend that owns auth, persistence, odds data, and tool endpoints. **bt_model** is the AI/ML service that owns conversational intelligence, RAG retrieval, LLM orchestration, tool calling, and responsible gambling guardrails. The two services communicate via REST API calls, and bt_api can optionally proxy SSE streams from bt_model to the mobile frontend.

## Database Integration

bt_model should connect to the **same PostgreSQL database** as bt_api to leverage existing tables for RAG and betting operations. Use the same `DATABASE_URL` from bt_api's `.env` file in bt_model's configuration. This allows bt_model to:
- Read and write to the `documents` and `chunks` tables for RAG indexing and retrieval using pgvector
- Query the `events`, `markets`, `odds_snapshots`, `sportsbooks`, and `team_mappings` tables for real-time odds context
- Read and write to the `messages` table for conversation history persistence
- Access `users` table for preferences like timezone and default stake limits

Ensure bt_model has read/write permissions on these tables, and keep schema migrations managed by bt_api (Prisma) to avoid conflicts.

## Authentication Between Services

bt_model must authenticate when calling bt_api tool endpoints. Implement one of these patterns:
1. **Shared secret header**: Add `X-Service-Token: <secret>` to all bt_model → bt_api requests; validate in bt_api middleware
2. **Service-to-service JWT**: Issue a long-lived JWT for bt_model with role `SERVICE` and validate with Auth0 or internal signing key
3. **API key**: Create a dedicated API key for bt_model stored in both services' env vars

For user-scoped tool calls, bt_model should forward the original user's `userId` (from the frontend JWT) in tool request payloads or headers so bt_api can enforce ownership checks (e.g., user can only plan bets for themselves).

## Tool Endpoints for bt_model

bt_api exposes these endpoints for bt_model's tool calling:

### 1. Get Best Price (`get_best_price`)
**Endpoint**: `POST /api/v1/odds/tools/best-price`  
**Purpose**: Find the best available odds for a specific team/market on a given date  
**Request Body** (JSON):
```json
{
  "league": "MLB",
  "team": "Brewers",
  "date": "2025-10-13",
  "market": "moneyline",
  "opponent": "Cubs"
}
```
- `league`: Sport/league identifier (e.g., "MLB", "NBA", "NFL")
- `team`: Team name (fuzzy matched against canonical and alias names)
- `date`: ISO date string (optional, defaults to today in user's timezone)
- `market`: One of `"moneyline"`, `"spread"`, or `"total"`
- `opponent`: Opponent team name (optional, helps narrow down if multiple games same day)

**Response**:
```json
{
  "event": {
    "id": "evt_abc123",
    "league": "MLB",
    "homeTeam": "Chicago Cubs",
    "awayTeam": "Milwaukee Brewers",
    "startTime": "2025-10-13T19:10:00.000Z"
  },
  "market": {
    "id": "mkt_xyz789",
    "type": "moneyline",
    "bestOdds": {
      "home": {
        "outcome": "home",
        "sportsbook": "fanduel",
        "oddsAmerican": -145
      },
      "away": {
        "outcome": "away",
        "sportsbook": "draftkings",
        "oddsAmerican": +130
      }
    }
  }
}
```

### 2. Plan Bet (`plan_bet`)
**Endpoint**: `POST /api/v1/bets/tools/plan`  
**Purpose**: Validate bet parameters and return a structured plan ready for user confirmation (bt_model adds LLM reasoning layer on top)  
**Request Body** (JSON):
```json
{
  "eventId": "evt_abc123",
  "marketId": "mkt_xyz789",
  "sportsbookId": "fanduel",
  "outcome": "away",
  "suggestedStake": 50.00,
  "oddsAmerican": 130
}
```

**Response**:
```json
{
  "plan": {
    "eventId": "evt_abc123",
    "marketId": "mkt_xyz789",
    "sportsbookId": "fanduel",
    "outcome": "away",
    "stake": 50.00,
    "oddsAmerican": 130,
    "potentialPayout": 115.00,
    "valid": true,
    "warnings": []
  }
}
```

bt_model's guardrails should validate stake limits (max 5% of bankroll), check for loss chasing patterns, and ensure odds are not stale before calling this endpoint.

### 3. Get Bet Status (`get_bet_status`)
**Endpoint**: `GET /api/v1/bets/tools/status/:betId`  
**Purpose**: Retrieve current status and details of a placed bet  
**Response**:
```json
{
  "id": "bet_123",
  "status": "CONFIRMED",
  "eventId": "evt_abc123",
  "marketId": "mkt_xyz789",
  "sportsbookId": "fanduel",
  "selectedOutcome": "away",
  "stake": "50.00",
  "oddsAmerican": 130,
  "potentialPayout": "115.00",
  "createdAt": "2025-10-13T18:00:00.000Z",
  "confirmedAt": "2025-10-13T18:01:00.000Z"
}
```

## Chat Flow Integration

When a user sends a message to bt_model via the mobile app:

1. **Frontend** sends user message to bt_api:  
   `POST /api/v1/chat/conversations/:conversationId/messages`  
   Body: `{ "content": "What are the best moneyline odds for the Brewers tonight?" }`  
   Headers: `Authorization: Bearer <user_jwt>`

2. **bt_api** persists the user message to the `messages` table and returns `201 Created` immediately.

3. **Frontend** opens SSE connection to bt_model (or bt_api proxy):  
   Option A (direct): `GET https://bt-model.example.com/chat/:conversationId/stream`  
   Option B (proxied): `GET /api/v1/chat/conversations/:conversationId/stream` (bt_api proxies to bt_model)

4. **bt_model** receives notification of new message (via webhook, polling, or shared DB watch):
   - Fetches conversation history from `messages` table
   - Classifies intent (odds query, general question, bet planning)
   - For odds queries: calls `POST /api/v1/odds/tools/best-price` with extracted entities
   - For RAG queries: performs vector search on `chunks` table using pgvector
   - For general questions: uses GPT-4 with optional RAG context
   - Streams response chunks via SSE to the frontend

5. **bt_model** persists assistant response to `messages` table when complete.

## SSE Event Schema

bt_model should emit these SSE event types (bt_api SseService already supports this structure):

- **`connected`**: Initial connection acknowledgment
  ```json
  { "type": "connected", "conversationId": "conv_123", "timestamp": "2025-10-13T18:00:00.000Z" }
  ```

- **`llm_chunk`**: Streaming LLM token
  ```json
  { "type": "llm_chunk", "content": "The best ", "timestamp": "2025-10-13T18:00:01.000Z" }
  ```

- **`llm_complete`**: Final complete response
  ```json
  { "type": "llm_complete", "content": "The best moneyline odds for...", "metadata": {...}, "timestamp": "..." }
  ```

- **`tool_call`**: Notify user that a tool is being invoked (optional, for transparency)
  ```json
  { "type": "tool_call", "tool": "get_best_price", "parameters": {...}, "timestamp": "..." }
  ```

- **`odds_update`**: Structured odds data payload (enriched response)
  ```json
  {
    "type": "odds_update",
    "event": { "id": "...", "homeTeam": "...", "awayTeam": "...", "startTime": "..." },
    "market": { "type": "moneyline", "bestOdds": {...} },
    "timestamp": "..."
  }
  ```

- **`error`**: Error message
  ```json
  { "type": "error", "message": "Failed to retrieve odds", "code": "ODDS_NOT_FOUND", "timestamp": "..." }
  ```

- **`heartbeat`**: Keep-alive ping (every 30s)
  ```json
  { "type": "heartbeat", "timestamp": "2025-10-13T18:00:30.000Z" }
  ```

## User Timezone Handling

User timezone preference should be stored in `users.preferences` JSONB column:
```json
{ "timezone": "America/Chicago" }
```

When bt_model receives a query like "Brewers game tonight", it should:
1. Fetch user timezone from `users` table
2. Calculate "today" in that timezone (start = 00:00, end = 23:59:59)
3. Pass ISO date string to `get_best_price` tool: `"date": "2025-10-13"`

bt_api will use this date to filter `events.startTime` within the correct day window.

## Responsible Gambling Guardrails (bt_model ownership)

bt_model is responsible for all guardrails before calling tool endpoints:
- **Stake limits**: Max 5% of user's bankroll (fetch from `users.defaultStake` or calculate from bet history)
- **Loss chasing detection**: Analyze recent bet history for patterns (e.g., doubling stakes after losses)
- **Odds staleness**: Verify odds timestamp is < 5 minutes old before allowing bet plan
- **Mandatory confirmation**: Never auto-execute bets; always require explicit user confirmation
- **Cooling-off periods**: Suggest breaks after consecutive losses or large stakes

bt_api provides raw tool functionality; bt_model wraps it with safety logic.

## Environment Variables

Add these to bt_model's `.env`:
```bash
# Database (shared with bt_api)
DATABASE_URL=postgresql://user:pass@host:5432/betthink_db

# bt_api connection
BT_API_BASE_URL=http://localhost:3000/api/v1
BT_API_SERVICE_TOKEN=<shared-secret-for-service-auth>

# Optional: if bt_model proxies SSE
BT_MODEL_BASE_URL=https://bt-model.example.com
```

Add these to bt_api's `.env`:
```bash
# bt_model connection (if bt_api proxies SSE to bt_model)
BT_MODEL_BASE_URL=http://localhost:8000
BT_MODEL_SERVICE_TOKEN=<shared-secret>
```

## Development Workflow

1. Start bt_api: `npm run start:dev` (runs on port 3000)
2. Start bt_model: `uvicorn app.main:app --reload --port 8000`
3. Mobile app connects to bt_api for auth and persistence, and either:
   - Connects directly to bt_model for SSE chat streaming, or
   - Connects to bt_api SSE endpoint which proxies to bt_model

## Production Deployment

- Deploy bt_api and bt_model as separate services
- Use shared PostgreSQL RDS instance with separate read replicas for bt_model if needed
- Configure mutual TLS or VPC peering for service-to-service communication
- Use API Gateway or load balancer to route `/api/v1/*` to bt_api and `/chat/*` to bt_model (or keep SSE proxy in bt_api)
- Rotate service tokens regularly via secrets manager

## Summary

bt_model handles all AI/ML intelligence (LLM, RAG, tool orchestration, guardrails) while bt_api handles all platform concerns (auth, persistence, odds data ingestion, tool execution). The two services communicate via REST APIs with shared database access for RAG and conversation history. This separation allows each service to scale and evolve independently while maintaining a clean contract boundary.

