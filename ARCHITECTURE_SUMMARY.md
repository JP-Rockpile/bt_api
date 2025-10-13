# BetThink Architecture Summary

## Service Responsibilities

### bt_api (this project) - Platform Backend
**What it owns:**
- ✅ Authentication & Authorization (Auth0 JWT validation)
- ✅ Database persistence (Prisma + PostgreSQL with pgvector)
- ✅ Odds data ingestion (Unabated + TheOdds API integrations)
- ✅ Real-time odds updates (WebSocket subscriptions, Redis caching)
- ✅ Team name canonicalization and fuzzy matching
- ✅ Bet workflow execution (plan → confirm → deep link generation)
- ✅ SSE gateway for mobile clients
- ✅ Tool endpoints for bt_model to call

**API Routes:**
- `/api/v1/auth/*` - User authentication
- `/api/v1/chat/*` - Conversation persistence & SSE streaming
- `/api/v1/odds/*` - Odds queries and aggregation
- `/api/v1/bets/*` - Bet management
- `/api/v1/events/*` - Sports events catalog
- `/api/v1/sportsbooks/*` - Sportsbook configuration

### bt_model (separate FastAPI service) - AI/ML Backend
**What it owns:**
- ✅ Conversational AI (GPT-4 Turbo chat interface)
- ✅ RAG retrieval (vector search + keyword matching via pgvector)
- ✅ Intent classification & entity extraction
- ✅ Tool calling orchestration (calls bt_api tool endpoints)
- ✅ Responsible gambling guardrails (stake limits, loss chasing detection)
- ✅ LLM response streaming via SSE
- ✅ Document embedding pipeline (OpenAI embeddings)

## Data Flow

### 1. User Sends Message
```
Mobile App → bt_api POST /chat/conversations/:id/messages
         → bt_api persists user message to DB
         → bt_api returns 201 Created
```

### 2. AI Processing (bt_model)
```
bt_model watches DB or receives webhook
       → Fetches conversation history
       → Classifies intent (odds | rag | general)
       → If odds: calls bt_api POST /odds/tools/best-price
       → If RAG: queries pgvector chunks table
       → If general: uses GPT-4 directly
       → Streams response via SSE
       → Persists assistant message to DB
```

### 3. SSE Streaming to Mobile
```
Option A: Mobile → bt_api SSE proxy → bt_model
Option B: Mobile → bt_model SSE direct
```

## Tool Endpoints for bt_model

### 1. Get Best Price
`POST /api/v1/odds/tools/best-price`
```json
{
  "league": "MLB",
  "team": "Brewers",
  "date": "2025-10-13",
  "market": "moneyline"
}
```
Returns best available odds across all sportsbooks.

### 2. Plan Bet
`POST /api/v1/bets/tools/plan`
```json
{
  "eventId": "evt_123",
  "marketId": "mkt_456",
  "sportsbookId": "fanduel",
  "outcome": "away",
  "suggestedStake": 50.00,
  "oddsAmerican": 130
}
```
Validates bet and returns structured plan (bt_model adds guardrails layer).

### 3. Get Bet Status
`GET /api/v1/bets/tools/status/:betId`
Returns current status of a placed bet.

## Shared Database

Both services connect to the same PostgreSQL instance:
- **bt_api** manages schema via Prisma migrations
- **bt_model** reads/writes to `documents`, `chunks`, `messages` tables
- pgvector extension enabled for RAG similarity search

## Authentication

### User → bt_api
Auth0 JWT in `Authorization: Bearer <token>` header

### bt_model → bt_api
Shared service token in `X-Service-Token: <secret>` header

## Next Steps for bt_model Integration

1. Configure bt_model to connect to same `DATABASE_URL`
2. Set `BT_API_BASE_URL` and `BT_API_SERVICE_TOKEN` in bt_model env
3. Implement tool calling functions that POST to bt_api endpoints
4. Set up SSE streaming (direct or via bt_api proxy)
5. Store user timezone in `users.preferences` JSONB column
6. Implement guardrails before calling tool endpoints

See `BT_MODEL_INTEGRATION.md` for detailed integration instructions.

