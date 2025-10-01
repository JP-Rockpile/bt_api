# Bet Think API - Architecture Documentation

## Overview

Bet Think API is a production-grade NestJS backend service that serves as the core infrastructure for the Bet Think mobile application. It provides authenticated access, real-time odds aggregation, intelligent bet workflow management, and comprehensive analytics.

## System Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Mobile Application                        │
│                     (React Native + Expo)                        │
└───────────────┬─────────────────────────────────────────────────┘
                │
                │ REST API + SSE
                │ Auth0 JWT Bearer Token
                │
┌───────────────▼─────────────────────────────────────────────────┐
│                        API Gateway Layer                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ NestJS Controllers                                       │   │
│  │ - JwtAuthGuard (Auth0)                                   │   │
│  │ - RolesGuard (RBAC)                                      │   │
│  │ - Rate Limiting (Redis)                                  │   │
│  │ - Idempotency Middleware                                 │   │
│  │ - Request Validation (class-validator)                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Business Logic Layer (Services)                          │   │
│  │                                                           │   │
│  │  Events Service ────► Sports events CRUD                 │   │
│  │  Markets Service ───► Betting markets management         │   │
│  │  Odds Service ──────► Aggregation & best price calc      │   │
│  │  Bets Service ──────► 3-phase bet workflow              │   │
│  │  Users Service ─────► Profile & sportsbook links        │   │
│  │  Chat Service ──────► Message history & SSE             │   │
│  │  Documents Service ─► RAG vector search                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Odds Aggregation Engine                                  │   │
│  │                                                           │   │
│  │  ┌──────────────────┐      ┌──────────────────┐         │   │
│  │  │ Unabated Adapter │      │TheOddsApi Adapter│         │   │
│  │  │                  │      │                  │         │   │
│  │  │ • NFL, NBA, MLB  │      │ • MMA (UFC)      │         │   │
│  │  │ • NHL, NCAAF/B   │      │ • Boxing         │         │   │
│  │  │ • Soccer         │      │                  │         │   │
│  │  └────────┬─────────┘      └────────┬─────────┘         │   │
│  │           │                         │                    │   │
│  │           └─────────┬───────────────┘                    │   │
│  │                     │                                    │   │
│  │           ┌─────────▼──────────┐                         │   │
│  │           │ Team Name Mapper   │                         │   │
│  │           │ • Canonical names  │                         │   │
│  │           │ • Fuzzy matching   │                         │   │
│  │           │ • Provider aliases │                         │   │
│  │           └────────────────────┘                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Background Jobs (BullMQ)                                 │   │
│  │                                                           │   │
│  │  Odds Ingestion ──► Scheduled & on-demand odds refresh  │   │
│  │  Notifications ───► Expo push notifications              │   │
│  │  Analytics ───────► ROI, CLV, win rate calculations      │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────┬─────────────────────────────────┬───────────────┘
                │                                 │
                │                                 │
    ┌───────────▼───────────┐       ┌────────────▼──────────┐
    │   PostgreSQL 16       │       │      Redis 7          │
    │   with pgvector       │       │                       │
    │                       │       │ • Caching             │
    │ • Users & Bets        │       │ • Rate Limiting       │
    │ • Events & Markets    │       │ • Idempotency Keys    │
    │ • Odds Snapshots      │       │ • BullMQ Queues       │
    │ • Messages & Docs     │       │ • Session Storage     │
    │ • Vector Embeddings   │       └───────────────────────┘
    └───────────────────────┘
                │
                │
    ┌───────────▼───────────┐
    │   External Services   │
    │                       │
    │ • Auth0 (JWT)         │
    │ • Unabated API        │
    │ • The Odds API        │
    │ • Expo Push           │
    │ • Model Service (LLM) │
    └───────────────────────┘
```

## Data Flow Diagrams

### 1. Odds Aggregation Flow

```
User Request ──► Controller ──► OddsService
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
          Check Redis Cache                 Cache Miss
                    │                               │
            ┌───────┴─────┐                        │
            │             │                        │
         Cache Hit    Cache Miss                   │
            │             │                        │
            │             └────────────────────────┘
            │                                      │
            │                    ┌─────────────────▼──────────────┐
            │                    │ Determine Provider(s)           │
            │                    │ • MMA/UFC → The Odds API        │
            │                    │ • Other → Unabated              │
            │                    └─────────────────┬───────────────┘
            │                                      │
            │                    ┌─────────────────▼──────────────┐
            │                    │ Fetch from Provider API         │
            │                    │ • HTTP request with API key     │
            │                    │ • Parse response                │
            │                    │ • Handle errors/retries         │
            │                    └─────────────────┬───────────────┘
            │                                      │
            │                    ┌─────────────────▼──────────────┐
            │                    │ Normalize Team Names            │
            │                    │ • Lookup canonical mappings     │
            │                    │ • Fuzzy match if needed         │
            │                    │ • Log unmapped teams            │
            │                    └─────────────────┬───────────────┘
            │                                      │
            │                    ┌─────────────────▼──────────────┐
            │                    │ Transform to Internal Format    │
            │                    │ • Convert odds formats          │
            │                    │ • Structure markets             │
            │                    │ • Add metadata                  │
            │                    └─────────────────┬───────────────┘
            │                                      │
            │                    ┌─────────────────▼──────────────┐
            │                    │ Store in Redis Cache            │
            │                    │ TTL: 30-120 seconds            │
            │                    └─────────────────┬───────────────┘
            │                                      │
            └──────────────────────────────────────┘
                                      │
                        ┌─────────────▼──────────────┐
                        │ Calculate Best Odds        │
                        │ • Group by outcome          │
                        │ • Find best price           │
                        │ • Calculate advantage       │
                        └─────────────────┬───────────┘
                                          │
                        ┌─────────────────▼──────────────┐
                        │ Return to User                 │
                        │ • Aggregated odds              │
                        │ • Best prices highlighted      │
                        │ • Multiple sportsbooks         │
                        └────────────────────────────────┘
```

### 2. Bet Workflow (Three Phases)

```
PHASE 1: PLANNING
─────────────────
User: "I want to bet $50 on the Lakers to win"
    │
    ▼
Mobile App ──POST /api/bets/plan──► API ──► Model Service
                                             (LLM Analysis)
                                                  │
    ┌─────────────────────────────────────────────┘
    │
    ▼
API receives structured recommendation:
{
  "confidence": 0.85,
  "reasoning": "Lakers are 3-point favorites...",
  "suggestedBets": [
    { "market": "MONEYLINE", "outcome": "home", ... }
  ]
}
    │
    ▼
Mobile App displays recommendation to user


PHASE 2: CONFIRMATION
─────────────────────
User approves bet with stake
    │
    ▼
Mobile App ──POST /api/bets/confirm──► API
                Idempotency-Key: xyz        │
                                            │
    ┌───────────────────────────────────────┘
    │
    ▼
API validates:
  ✓ Event exists
  ✓ Market exists  
  ✓ Sportsbook active
  ✓ Odds still available
    │
    ▼
Create Bet Record:
{
  "id": "bet_123",
  "status": "CONFIRMED",
  "userId": "user_456",
  "stake": 50.00,
  "oddsAmerican": -110,
  "confirmedAt": "2025-10-01T19:00:00Z"
}
    │
    ▼
Return bet details to mobile app


PHASE 3: DEEP LINK GENERATION
──────────────────────────────
User ready to place bet
    │
    ▼
Mobile App ──POST /api/bets/{betId}/deep-link──► API
                                                   │
    ┌──────────────────────────────────────────────┘
    │
    ▼
API generates sportsbook-specific deep link:
  • Template: "fanduel://sports/{sport}/{league}"
  • Variables: sport, teams, market, outcome
  • Platform: iOS scheme or Android package
    │
    ▼
Update bet status: "GUIDED"
    │
    ▼
Return deep link:
{
  "deepLink": "fanduel://sports/nba/lakers-celtics",
  "sportsbook": "FanDuel",
  "instructions": "Open this link to place your bet"
}
    │
    ▼
Mobile App opens deep link → User directed to sportsbook app
```

### 3. Real-time Chat with SSE

```
User opens chat
    │
    ▼
Mobile App ──GET /api/chat/conversations/{id}/stream──► API
                                                          │
    ┌─────────────────────────────────────────────────────┘
    │
    ▼
SSE Connection Established
    │
    ├──► Heartbeat every 30s: { type: "heartbeat" }
    │
    ├──► LLM Response Chunks:
    │    { type: "chunk", content: "Based on the odds..." }
    │
    ├──► System Messages:
    │    { type: "odds_update", data: { market: "...", change: +5 } }
    │
    ├──► Bet Status Updates:
    │    { type: "bet_status", status: "CONFIRMED" }
    │
    └──► Connection Management:
         • Automatic reconnection
         • Reconnection token
         • Error handling
```

## Database Schema Design

### Core Principles

1. **Immutability**: Odds snapshots are append-only
2. **Normalization**: Canonical team names prevent duplicates
3. **Flexibility**: JSONB fields for extensibility
4. **Performance**: Strategic indexes on hot paths
5. **Scalability**: Partitioning ready for large tables

### Key Relationships

```
User ─┬─► UserSportsbookLink ─► Sportsbook
      ├─► Bet ──┬─► Event ─► Market ─► OddsSnapshot
      │         └─► Sportsbook
      ├─► Message
      └─► (Expo Push Tokens)

Document ─► Chunk (with pgvector embedding)

TeamMapping (canonical names + aliases)
```

### Indexes

```sql
-- High-frequency queries
CREATE INDEX idx_events_sport_time ON events(sport_type, start_time);
CREATE INDEX idx_odds_market_time ON odds_snapshots(market_id, timestamp DESC);
CREATE INDEX idx_bets_user_created ON bets(user_id, created_at DESC);

-- Vector similarity search
CREATE INDEX idx_chunks_embedding ON chunks 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Covering indexes for common queries
CREATE INDEX idx_events_upcoming ON events(start_time, status)
  WHERE status = 'SCHEDULED' AND start_time > NOW();
```

## Security Architecture

### Authentication Flow

```
1. User logs in via Auth0 (mobile app)
   ↓
2. Auth0 returns JWT token
   ↓
3. Mobile app includes token in API requests:
   Authorization: Bearer <jwt>
   ↓
4. API validates token:
   • Signature verification (JWKS)
   • Expiration check
   • Audience validation
   • Issuer validation
   ↓
5. Extract user identity (Auth0 sub)
   ↓
6. Attach to request context
   ↓
7. RolesGuard checks permissions (if needed)
   ↓
8. Execute controller method
```

### Rate Limiting Strategy

```
Layer 1: Global Rate Limit
  • 100 req/min per IP (unauthenticated)
  
Layer 2: User Rate Limit  
  • 100 req/min per user (authenticated)
  • 500 req/min for premium users
  
Layer 3: Endpoint-Specific
  • Odds refresh: 10 req/min
  • Bet confirmation: 20 req/min
  • Chat streaming: 5 concurrent connections

Implementation: Redis sliding window counters
```

### Idempotency

```
Request Flow with Idempotency:

1. Client generates unique key: uuid()
2. Request includes: Idempotency-Key: <uuid>
3. Middleware checks Redis:
   Key exists? → Return cached response (200)
   Key missing? → Continue to handler
4. Handler processes request
5. Response stored in Redis (24h TTL)
6. Return response to client

Guarantees:
  • No duplicate bet confirmations
  • Safe retries for network failures
  • Exactly-once semantics for mutations
```

## Scalability Considerations

### Horizontal Scaling

```
Load Balancer
    │
    ├─► API Instance 1 ─┐
    ├─► API Instance 2 ─┼─► Shared PostgreSQL
    ├─► API Instance 3 ─┤   (connection pooling)
    └─► API Instance N ─┘
            │
            └─► Shared Redis
                (distributed cache & queues)
```

### Caching Strategy

```
Level 1: Redis Cache (L1)
  • Odds data: 30-120s TTL
  • Event lists: 2min TTL
  • User profiles: 5min TTL
  
Level 2: Database Query Cache
  • PostgreSQL query result cache
  • Materialized views for analytics
  
Level 3: CDN (future)
  • Static sportsbook logos
  • Public documentation
```

### Queue Processing

```
Odds Ingestion Queue:
  Workers: 3
  Concurrency: 3/worker = 9 total
  Rate Limit: 10 jobs/minute
  Retry: Exponential backoff (3 attempts)
  
Notifications Queue:
  Workers: 5
  Concurrency: 5/worker = 25 total
  No retry (fire-and-forget acceptable)
  
Analytics Queue:
  Workers: 2
  Concurrency: 2/worker = 4 total
  (CPU-intensive, limited concurrency)
```

## Monitoring & Observability

### Key Metrics

```
Golden Signals:
  • Latency: p50, p95, p99 response times
  • Traffic: Requests per second
  • Errors: Error rate by endpoint
  • Saturation: CPU, memory, DB connections

Business Metrics:
  • Odds refresh success rate
  • Bet confirmation rate
  • User active sessions
  • Cache hit ratio
  • Queue depth & lag
```

### Distributed Tracing

```
Request Journey:
Mobile App → [trace_id: xyz123]
    ↓
API Gateway → [span: http_request]
    ↓
OddsService.aggregateOdds() → [span: odds_aggregation]
    ├─► Redis.cacheGet() → [span: cache_lookup]
    ├─► UnabatedAdapter.fetchOdds() → [span: external_api]
    ├─► PrismaService.upsert() → [span: db_query]
    └─► Redis.cacheSet() → [span: cache_write]
    
All spans linked by trace_id for end-to-end visibility
```

### Logging Standards

```json
{
  "timestamp": "2025-10-01T19:00:00.000Z",
  "level": "info",
  "requestId": "req_abc123",
  "userId": "user_456",
  "message": "Bet confirmed successfully",
  "context": {
    "betId": "bet_789",
    "stake": 50.00,
    "sportsbook": "fanduel"
  }
}
```

## Deployment Architecture

### Production Topology

```
┌─────────────────────────────────────────────────┐
│              Load Balancer (AWS ALB)            │
└───────────────────┬─────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
┌───────▼────────┐    ┌─────────▼───────┐
│ API Instance 1 │    │ API Instance 2  │
│ (ECS/K8s Pod)  │    │ (ECS/K8s Pod)   │
└───────┬────────┘    └─────────┬───────┘
        │                       │
        └───────────┬───────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
┌───────▼────────┐    ┌─────────▼────────┐
│  RDS PostgreSQL│    │ ElastiCache Redis│
│   Multi-AZ     │    │   Cluster Mode   │
└────────────────┘    └──────────────────┘
```

### CI/CD Pipeline

```
GitHub Push
    ↓
GitHub Actions Triggered
    ├─► Lint & Type Check
    ├─► Unit Tests
    ├─► Integration Tests
    ├─► Security Scan (Trivy)
    └─► Build Docker Image
         ↓
    Push to ECR/Registry
         ↓
    Deploy to Staging
         ↓
    Smoke Tests
         ↓
    Manual Approval
         ↓
    Deploy to Production
         ↓
    Health Checks
```

## Future Enhancements

### Planned Features

1. **GraphQL API**: Flexible queries for mobile app
2. **WebSocket Support**: Bi-directional real-time communication
3. **Multi-region Deployment**: Lower latency globally
4. **Advanced Analytics**: ML-powered bet insights
5. **Social Features**: Share bets, leaderboards
6. **Affiliate Integration**: Sportsbook referral tracking

### Scalability Roadmap

1. **Read Replicas**: Separate read/write traffic
2. **Sharding**: Partition users across databases
3. **Message Queue**: Replace BullMQ with Kafka/SQS
4. **Microservices**: Split odds, bets, chat into separate services
5. **Event Sourcing**: Append-only event log for audit trail

---

**Document Version**: 1.0
**Last Updated**: October 1, 2025
**Maintained By**: Bet Think Engineering Team

