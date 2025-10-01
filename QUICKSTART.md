# 🚀 Quick Start Guide

Get Bet Think API up and running in 5 minutes!

## Prerequisites

- **Docker** and **Docker Compose** installed
- **Node.js 20+** (optional, for local development without Docker)
- **Auth0 account** (free tier works)
- **API keys** from Unabated and The Odds API

## Step 1: Clone and Configure

```bash
# Clone the repository
git clone <repository-url>
cd bt_api

# Copy environment template
cp .env.example .env
```

## Step 2: Set Up Auth0

1. Go to [Auth0 Dashboard](https://manage.auth0.com/)
2. Create a new API:
   - Name: `Bet Think API`
   - Identifier: `https://api.betthink.com`
3. Update `.env`:
   ```env
   AUTH0_DOMAIN=your-tenant.us.auth0.com
   AUTH0_AUDIENCE=https://api.betthink.com
   AUTH0_ISSUER=https://your-tenant.us.auth0.com/
   ```

## Step 3: Get API Keys

### Unabated API
1. Sign up at [Unabated](https://unabated.com)
2. Get your API key from dashboard
3. Add to `.env`:
   ```env
   UNABATED_API_KEY=your_key_here
   ```

### The Odds API
1. Sign up at [The Odds API](https://the-odds-api.com)
2. Get your API key
3. Add to `.env`:
   ```env
   THE_ODDS_API_KEY=your_key_here
   ```

## Step 4: Start with Docker 🐳

```bash
# Start all services
docker-compose up -d

# Check services are running
docker-compose ps

# View logs
docker-compose logs -f api
```

That's it! The API will be available at:
- **API**: http://localhost:3000/api
- **Swagger Docs**: http://localhost:3000/api/docs
- **Jaeger UI**: http://localhost:16686 (tracing)

## Step 5: Test the API

### Get a Test Token

1. Create a test user in Auth0
2. Use Auth0's "Test" tab to get a JWT token
3. Copy the access token

### Make Your First Request

```bash
# Health check (no auth required)
curl http://localhost:3000/api/health

# Get upcoming events (requires auth)
curl http://localhost:3000/api/events/upcoming \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get sportsbooks
curl http://localhost:3000/api/sportsbooks \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Step 6: Seed Sample Data

```bash
# Run seed script to populate initial data
docker-compose exec api npm run db:seed
```

This creates:
- ✅ Popular sportsbooks (FanDuel, DraftKings, etc.)
- ✅ Team canonical mappings
- ✅ Sample events
- ✅ Sample RAG documents

## 🎯 Next Steps

### Explore the API

Open Swagger docs at http://localhost:3000/api/docs to:
- Browse all available endpoints
- Test endpoints interactively
- View request/response schemas

### Try the Bet Workflow

1. **Plan a Bet**
   ```bash
   POST /api/bets/plan
   {
     "query": "I want to bet $50 on the Lakers moneyline"
   }
   ```

2. **Confirm the Bet**
   ```bash
   POST /api/bets/confirm
   {
     "eventId": "...",
     "marketId": "...",
     "sportsbookId": "...",
     "selectedOutcome": "home",
     "stake": 50,
     "oddsAmerican": -110
   }
   ```

3. **Get Deep Link**
   ```bash
   POST /api/bets/{betId}/deep-link
   ```

### Fetch Live Odds

```bash
# Trigger odds refresh
curl -X POST "http://localhost:3000/api/odds/refresh?sport=NFL" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get aggregated odds
curl "http://localhost:3000/api/odds/aggregate?sport=NFL" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Monitor Background Jobs

View BullMQ job logs:

```bash
# Check database for job logs
docker-compose exec postgres psql -U postgres -d betthink \
  -c "SELECT * FROM job_logs ORDER BY created_at DESC LIMIT 10;"
```

## 🔧 Development Mode

For active development with hot reload:

```bash
# Start dependencies only
docker-compose up -d postgres redis jaeger

# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed data
npm run db:seed

# Start in dev mode (hot reload)
npm run start:dev
```

## 🛠️ Useful Commands

```bash
# View all services
docker-compose ps

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v

# Restart API only
docker-compose restart api

# Access database
docker-compose exec postgres psql -U postgres -d betthink

# Access Redis CLI
docker-compose exec redis redis-cli

# Run tests
npm test

# Check Prisma Studio (database GUI)
npm run prisma:studio
```

## 📚 Learn More

- [Full README](./README.md) - Complete documentation
- [API Documentation](http://localhost:3000/api/docs) - Interactive API docs
- [Contributing Guide](./CONTRIBUTING.md) - How to contribute

## ❓ Troubleshooting

### Port Already in Use

If port 3000, 5432, or 6379 is already in use:

```bash
# Check what's using the port
lsof -i :3000

# Kill the process or change ports in docker-compose.yml
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# View PostgreSQL logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Migration Errors

```bash
# Reset database (dev only - destroys data!)
docker-compose exec api npm run db:reset

# Or manually
docker-compose down -v
docker-compose up -d
```

## 🎉 Success!

You now have a fully functional Bet Think API running locally!

**What's Next?**
- Read the [README](./README.md) for in-depth documentation
- Explore the codebase structure
- Try building a feature
- Set up your mobile app to connect

**Need Help?**
- Check [CONTRIBUTING.md](./CONTRIBUTING.md)
- Open an issue on GitHub
- Review the Swagger documentation

Happy coding! 🚀

