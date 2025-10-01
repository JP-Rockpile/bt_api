# Bet Think API

Production-grade NestJS backend service for Bet Think - Authenticated gateway, odds aggregation engine, chat message coordinator, and asynchronous job processor.

## 🏗️ Architecture Overview

```
┌─────────────────┐
│  Mobile App     │
│  (React Native) │
└────────┬────────┘
         │ REST + SSE
         │ JWT Auth
┌────────▼────────────────────────────────────────────────┐
│                    BT API (NestJS)                       │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Controllers & Guards (Auth0 JWT)                │   │
│  ├──────────────────────────────────────────────────┤   │
│  │  Services Layer                                  │   │
│  │  - Events   - Bets      - Chat                   │   │
│  │  - Odds     - Users     - Documents              │   │
│  ├──────────────────────────────────────────────────┤   │
│  │  Odds Aggregation Engine                         │   │
│  │  ┌──────────────┐    ┌──────────────┐            │   │
│  │  │ Unabated     │    │ The Odds API │            │   │
│  │  │ Adapter      │    │ (MMA Focus)  │            │   │
│  │  └──────────────┘    └──────────────┘            │   │
│  │           │                  │                    │   │
│  │           └──────┬───────────┘                    │   │
│  │                  │                                │   │
│  │         ┌────────▼────────┐                       │   │
│  │         │ Canonical Team  │                       │   │
│  │         │ Mapping System  │                       │   │
│  │         └─────────────────┘                       │   │
│  ├──────────────────────────────────────────────────┤   │
│  │  Background Jobs (BullMQ)                        │   │
│  │  - Odds Ingestion  - Notifications  - Analytics  │   │
│  └──────────────────────────────────────────────────┘   │
└───────────┬──────────────────────────┬─────────────────┘
            │                          │
    ┌───────▼────────┐        ┌────────▼────────┐
    │  PostgreSQL    │        │     Redis       │
    │  (pgvector)    │        │  Cache + Queue  │
    └────────────────┘        └─────────────────┘
            │
    ┌───────▼────────┐
    │   Model API    │
    │  (LLM Service) │
    └────────────────┘
```

## 🚀 Features

### Core Functionality

- **Auth0 JWT Authentication** - Secure endpoint protection with role-based access control
- **Odds Aggregation** - Multi-provider odds fetching with canonical team mapping
- **Bet Workflow** - Three-phase bet process (plan → confirm → guide)
- **Real-time Updates** - Server-Sent Events (SSE) for chat streaming
- **Vector Search** - pgvector-powered semantic search for RAG documents
- **Background Jobs** - BullMQ queues for odds refresh, notifications, and analytics
- **Idempotency** - Redis-backed idempotency key support for mutation operations
- **Rate Limiting** - Multi-layer rate limiting with Redis sliding windows
- **Distributed Tracing** - OpenTelemetry instrumentation with Jaeger support

### Database Schema

#### Key Entities

- **Users** - Auth0 sub as primary identifier, preferences, push tokens
- **Sportsbooks** - Deep link templates, supported markets, logos
- **Events** - Sports events with canonical team mappings
- **Markets** - Event-specific betting markets (moneyline, spread, totals)
- **OddsSnapshots** - Append-only immutable odds records with deduplication
- **Bets** - User bets with status tracking and deep links
- **Messages** - Chat history for LLM conversations
- **Documents & Chunks** - RAG context with pgvector embeddings

## 📋 Prerequisites

- **Node.js** 20+
- **PostgreSQL** 12+ with pgvector extension
- **Redis** 7+
- **Docker** & Docker Compose (for local development)

## 🛠️ Installation

### 1. Clone and Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Configure the following required variables:

#### Auth0 Configuration
```env
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_AUDIENCE=https://api.betthink.com
AUTH0_ISSUER=https://your-tenant.us.auth0.com/
```

#### Database (PostgreSQL with pgvector)
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/betthink?schema=public
```

#### Redis
```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

#### Odds Providers
```env
UNABATED_API_KEY=your_unabated_api_key
THE_ODDS_API_KEY=your_odds_api_key
```

#### Expo Push Notifications
```env
EXPO_ACCESS_TOKEN=your_expo_access_token
```

### 3. Database Setup

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed initial data (sportsbooks, team mappings, sample events)
npm run db:seed
```

### 4. Start Development Server

```bash
npm run start:dev
```

The API will be available at:
- **API**: http://localhost:3000/api
- **Swagger Docs**: http://localhost:3000/api/docs
- **OpenAPI JSON**: http://localhost:3000/api/docs-json

## 🐳 Docker Development

Start all services with Docker Compose:

```bash
docker-compose up -d
```

This starts:
- PostgreSQL with pgvector (port 5432)
- Redis (port 6379)
- API service (port 3000)
- Jaeger (optional, port 16686)

## 📚 API Endpoints

### Authentication (Auth0 JWT Required)

All endpoints require a valid Auth0 JWT token in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

### Events

- `GET /api/events` - List events (filters: sport, league, date range, status)
- `GET /api/events/upcoming` - Upcoming scheduled events
- `GET /api/events/live` - Currently live events
- `GET /api/events/:id` - Event details with markets

### Odds

- `GET /api/odds/aggregate` - Aggregate odds from all providers
- `GET /api/odds/event/:eventId` - All odds for specific event
- `GET /api/odds/market/:marketId/best` - Best available odds for market
- `GET /api/odds/market/:marketId/historical` - Historical odds for CLV analysis
- `POST /api/odds/refresh` - Trigger manual odds refresh

### Markets

- `GET /api/markets/event/:eventId` - All markets for an event
- `GET /api/markets/:id` - Market details with odds history

### Bets (Three-Phase Workflow)

**Phase 1: Planning**
```http
POST /api/bets/plan
Content-Type: application/json

{
  "query": "Bet $50 on Lakers moneyline",
  "context": {}
}
```

**Phase 2: Confirmation**
```http
POST /api/bets/confirm
Content-Type: application/json
Idempotency-Key: unique-key-12345

{
  "eventId": "evt_123",
  "marketId": "mkt_456",
  "sportsbookId": "sb_789",
  "selectedOutcome": "home",
  "stake": 50,
  "oddsAmerican": -110
}
```

**Phase 3: Deep Link Generation**
```http
POST /api/bets/:betId/deep-link
```

**Bet History**
- `GET /api/bets` - User bet history (filter by status)
- `GET /api/bets/:betId` - Bet details

### Chat (SSE Streaming)

- `GET /api/chat/conversations` - User conversations
- `GET /api/chat/conversations/:id/history` - Message history
- `POST /api/chat/conversations/:id/messages` - Send message
- `GET /api/chat/conversations/:id/stream` (SSE) - Real-time updates

### Users

- `GET /api/users/me` - Current user profile
- `PUT /api/users/me` - Update profile
- `POST /api/users/me/sportsbooks/:id` - Link sportsbook
- `DELETE /api/users/me/sportsbooks/:id` - Unlink sportsbook
- `POST /api/users/me/push-token` - Register push notification token

### Sportsbooks

- `GET /api/sportsbooks` - List all sportsbooks
- `GET /api/sportsbooks/:id` - Sportsbook details

### Documents (RAG)

- `GET /api/documents` - List documents
- `GET /api/documents/:id` - Document with chunks
- `POST /api/documents/search` - Vector similarity search

### Health

- `GET /api/health` - Basic health check (public)
- `GET /api/health/ready` - Readiness check with dependencies (public)

## 🎯 Odds Aggregation System

### Adapters

#### Unabated Adapter
- **Coverage**: NFL, NBA, MLB, NHL, NCAAF, NCAAB, Soccer
- **Features**: Comprehensive market coverage, sharp pricing
- **Location**: `src/modules/odds/adapters/unabated.adapter.ts`

#### The Odds API Adapter
- **Coverage**: MMA (UFC), Boxing
- **Features**: Specialized combat sports coverage
- **Location**: `src/modules/odds/adapters/theodds.adapter.ts`

### Canonical Team Mapping

The system maintains a canonical team mapping table to normalize team names across providers:

```typescript
{
  canonicalName: "Kansas City Chiefs",
  sport: "NFL",
  league: "NFL",
  aliases: {
    unabated: "Kansas City Chiefs",
    theodds: "Kansas City Chiefs",
    variants: ["KC Chiefs", "Chiefs"]
  }
}
```

**Fuzzy Matching**: Uses Levenshtein distance algorithm to handle name variations
**Threshold**: 85% similarity score required for automatic matching
**Manual Review**: Ambiguous cases logged for admin review

### Best Price Calculation

```typescript
// Find best odds across all sportsbooks
const bestOdds = OddsUtils.findBestOdds([
  { sportsbook: 'fanduel', odds: -110 },
  { sportsbook: 'draftkings', odds: -105 },
  { sportsbook: 'betmgm', odds: -108 }
]);
// Returns: { sportsbook: 'draftkings', odds: -105, advantage: 2.4 }
```

## 🔄 Background Jobs (BullMQ)

### Odds Ingestion Queue

**Purpose**: Fetch and store odds snapshots

**Schedule**:
- Regular refresh: Every 3-5 minutes
- Urgent refresh: Every 1 minute (events starting soon)
- On-demand: Triggered by user requests

**Retry Logic**: Exponential backoff with dead letter queue

```typescript
{
  sport: "NFL",
  league: "NFL",
  priority: "urgent"
}
```

### Notifications Queue

**Purpose**: Send push notifications via Expo

**Triggers**:
- Bet confirmations
- Significant odds movements (>10% change)
- Bet settlements
- Promotional messages

**Concurrency**: 5 workers

### Analytics Queue

**Purpose**: Compute-intensive calculations

**Job Types**:
- **ROI Calculation**: Net profit and return on investment
- **CLV Analysis**: Closing line value tracking
- **Win Rate Analysis**: Segmented by sport/market/sportsbook

**Concurrency**: 2 workers (CPU-intensive)

## 🔐 Security Features

### Idempotency

Prevent duplicate mutations using idempotency keys:

```http
POST /api/bets/confirm
Idempotency-Key: unique-key-12345
Content-Type: application/json

{ ... }
```

Keys are stored in Redis with 24-hour TTL. Duplicate requests return cached response.

### Rate Limiting

**Global**: 100 requests per minute per IP
**Authenticated**: 100 requests per minute per user
**Premium**: 500 requests per minute
**Expensive Endpoints**: Custom limits (e.g., 10 odds refreshes/minute)

### Input Validation

All DTOs validated using `class-validator`:

```typescript
export class ConfirmBetDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsNumber()
  @IsPositive()
  @Min(1)
  stake: number;
  
  // ... more validations
}
```

## 📊 Observability

### Structured Logging (Pino)

All logs include:
- Request ID
- User ID (where applicable)
- Timestamp
- Log level
- Relevant metadata

Sensitive data (JWT tokens, passwords) automatically redacted.

### Distributed Tracing (OpenTelemetry)

Instrumented operations:
- HTTP requests
- Database queries
- Redis operations
- External API calls
- Queue job processing

Export traces to Jaeger:

```env
OTEL_ENABLED=true
JAEGER_ENDPOINT=http://localhost:14268/api/traces
```

View traces at http://localhost:16686

### Metrics & Monitoring

**Key Metrics to Monitor**:
- API response times (p50, p95, p99)
- Provider API failure rates
- Queue depths and processing times
- Database connection pool exhaustion
- Cache hit/miss ratios
- Rate limit violations

## 🧪 Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
npm run test:e2e
```

Requires PostgreSQL and Redis instances. Uses docker-compose services in CI.

### Coverage

```bash
npm run test:cov
```

Target coverage: 80%+ on critical paths (bet confirmation, odds aggregation)

## 🚢 Deployment

### Build Docker Image

```bash
docker build -t bt-api:latest .
```

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure Auth0 production credentials
- [ ] Set secure database passwords
- [ ] Enable Redis TLS if required
- [ ] Configure CORS for production domains
- [ ] Set up database backups
- [ ] Enable OpenTelemetry tracing
- [ ] Configure log aggregation (e.g., CloudWatch, Datadog)
- [ ] Set up monitoring alerts
- [ ] Review rate limits and quotas
- [ ] Test graceful shutdown

### Database Migrations

**Development**:
```bash
npm run prisma:migrate
```

**Production** (zero-downtime):
```bash
npm run prisma:migrate:prod
```

Migrations are run automatically in docker-compose via entrypoint script.

## 🗂️ Project Structure

```
bt_api/
├── src/
│   ├── common/                    # Shared utilities
│   │   ├── auth/                  # Auth0 JWT guards & strategies
│   │   ├── database/              # Prisma service
│   │   ├── redis/                 # Redis service
│   │   ├── filters/               # Exception filters
│   │   ├── interceptors/          # Response transformers
│   │   ├── middleware/            # Idempotency, etc.
│   │   ├── tracing/               # OpenTelemetry setup
│   │   └── utils/                 # Odds calculations, team mapping
│   │
│   ├── modules/                   # Feature modules
│   │   ├── events/                # Events CRUD
│   │   ├── markets/               # Markets management
│   │   ├── odds/                  # Odds aggregation
│   │   │   ├── adapters/          # Provider adapters
│   │   │   │   ├── base-odds.adapter.ts
│   │   │   │   ├── unabated.adapter.ts
│   │   │   │   └── theodds.adapter.ts
│   │   │   ├── odds.service.ts
│   │   │   └── odds.controller.ts
│   │   ├── bets/                  # Bet workflow
│   │   ├── users/                 # User management
│   │   ├── sportsbooks/           # Sportsbook CRUD
│   │   ├── chat/                  # Chat & SSE
│   │   ├── documents/             # RAG documents
│   │   └── health/                # Health checks
│   │
│   ├── queues/                    # BullMQ processors
│   │   ├── processors/
│   │   │   ├── odds-ingestion.processor.ts
│   │   │   ├── notifications.processor.ts
│   │   │   └── analytics.processor.ts
│   │   └── queues.module.ts
│   │
│   ├── config/                    # Configuration
│   │   ├── configuration.ts
│   │   └── validation.ts
│   │
│   ├── app.module.ts
│   └── main.ts
│
├── prisma/
│   ├── schema.prisma              # Database schema
│   ├── migrations/                # Migration files
│   ├── seed.ts                    # Seed script
│   └── init.sql                   # pgvector setup
│
├── test/
│   └── jest-e2e.json
│
├── .github/
│   └── workflows/
│       └── ci.yml                 # CI/CD pipeline
│
├── docker-compose.yml             # Local development stack
├── Dockerfile                     # Production image
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 🔧 Troubleshooting

### Database Connection Issues

**Problem**: `Can't reach database server`

**Solution**:
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Verify connection string
echo $DATABASE_URL

# Test connection
npx prisma db pull
```

### pgvector Extension Not Found

**Problem**: `extension "vector" does not exist`

**Solution**:
```sql
-- Connect to database as superuser
CREATE EXTENSION IF NOT EXISTS vector;

-- Or use init.sql in docker-compose
```

### Redis Connection Failures

**Problem**: `Redis connection refused`

**Solution**:
```bash
# Check Redis is running
docker-compose ps redis

# Test connection
redis-cli -h localhost -p 6379 ping
```

### Provider API Rate Limiting

**Problem**: `429 Too Many Requests from Unabated/The Odds API`

**Solution**:
- Increase `ODDS_REFRESH_INTERVAL_MINUTES`
- Reduce concurrent workers in queue processor
- Implement request throttling in adapter
- Consider caching strategy

### Odds Not Updating

**Problem**: Stale odds data

**Solution**:
```bash
# Check queue jobs
# Access BullMQ dashboard or logs

# Manually trigger refresh
curl -X POST http://localhost:3000/api/odds/refresh?sport=NFL

# Check job logs in database
SELECT * FROM job_logs ORDER BY created_at DESC LIMIT 10;
```

## 🤝 Contributing

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit changes (`git commit -m 'Add amazing feature'`)
3. Push to branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

## 📄 License

Proprietary - Bet Think

## 🙏 Acknowledgments

- **NestJS** - Progressive Node.js framework
- **Prisma** - Next-generation ORM
- **BullMQ** - Redis-based queue
- **Auth0** - Authentication & authorization
- **pgvector** - Vector similarity search
- **OpenTelemetry** - Observability standard

