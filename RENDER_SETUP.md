# 🚀 Render.com Development Setup Guide

This guide will walk you through setting up a PostgreSQL database and Redis on Render.com for your development environment.

## Prerequisites

- A Render.com account (free tier works fine for development)
- Auth0 account
- API keys from Unabated and The Odds API

---

## Step 1: Create PostgreSQL Database on Render

### 1.1 Create the Database

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"PostgreSQL"**
3. Configure your database:
   - **Name**: `betthink-dev-db` (or your preferred name)
   - **Database**: `betthink_db`
   - **User**: `betthink_user` (auto-generated)
   - **Region**: Choose closest to you (e.g., Oregon, Ohio)
   - **Plan**: Free tier is fine for development
4. Click **"Create Database"**

### 1.2 Enable pgvector Extension

After the database is created:

1. Go to your database dashboard in Render
2. Scroll down to **"Connect"** section
3. Click **"External Database URL"** to see connection info
4. Connect using the **PSQL Command** shown or use a database client
5. Run this command to enable pgvector:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

You can do this via Render's web console or by connecting with psql:

```bash
# Use the PSQL command from Render dashboard, then run:
psql <your-external-database-url>
# Then in psql:
CREATE EXTENSION IF NOT EXISTS vector;
\q
```

### 1.3 Get Your Connection String

In your Render PostgreSQL dashboard, copy the **Internal Database URL**:

```
postgresql://betthink_user:xxxxxxxxxxx@dpg-xxxxx-xxx.oregon-postgres.render.com/betthink_db
```

> **Note**: Use **Internal Database URL** if deploying your API on Render too (faster, no external internet).
> Use **External Database URL** if connecting from your local machine or other cloud providers.

---

## Step 2: Create Redis on Render

### 2.1 Create Redis Instance

1. In Render Dashboard, click **"New +"** → **"Redis"**
2. Configure:
   - **Name**: `betthink-dev-redis`
   - **Region**: Same as your database for best performance
   - **Plan**: Free tier (sufficient for development)
   - **Maxmemory Policy**: `allkeys-lru` (recommended)
3. Click **"Create Redis"**

### 2.2 Get Redis Connection Details

From your Redis dashboard, copy:
- **Internal Redis URL**: `redis://red-xxxxx:6379`
- **Host**: `red-xxxxx.oregon-redis.render.com`
- **Port**: `6379`
- Connection string includes password if set

---

## Step 3: Configure Your `.env` File

Create a `.env` file in your project root with the following configuration:

```bash
# ============================================================================
# APPLICATION
# ============================================================================
NODE_ENV=development
PORT=3000
API_PREFIX=api
API_VERSION=v1

# ============================================================================
# DATABASE - PostgreSQL (From Render)
# ============================================================================
# Paste your Render PostgreSQL connection string here
DATABASE_URL=postgresql://betthink_user:xxxxxxxxxxxx@dpg-xxxxx.oregon-postgres.render.com/betthink_db
DATABASE_POOL_SIZE=10

# ============================================================================
# REDIS - Cache and Queue (From Render)
# ============================================================================
# Paste your Render Redis details here
REDIS_HOST=red-xxxxx.oregon-redis.render.com
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password-if-set
REDIS_DB=0
REDIS_TLS_ENABLED=false

# ============================================================================
# AUTH0 - Authentication
# ============================================================================
# Get these from https://manage.auth0.com/
# Applications > APIs > Your API
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_AUDIENCE=https://api.betthink.com
AUTH0_ISSUER=https://your-tenant.us.auth0.com/

# ============================================================================
# ODDS PROVIDERS - API Keys
# ============================================================================
# Unabated: https://unabated.com
UNABATED_API_KEY=your_unabated_api_key_here
UNABATED_BASE_URL=https://api.unabated.com/v1

# The Odds API: https://the-odds-api.com
THE_ODDS_API_KEY=your_the_odds_api_key_here
THE_ODDS_API_BASE_URL=https://api.the-odds-api.com/v4

# ============================================================================
# EXPO - Push Notifications (Optional for now)
# ============================================================================
EXPO_ACCESS_TOKEN=

# ============================================================================
# RATE LIMITING
# ============================================================================
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_PREMIUM_MAX_REQUESTS=500

# ============================================================================
# CACHING
# ============================================================================
ODDS_CACHE_TTL_SECONDS=30
EVENTS_CACHE_TTL_SECONDS=120

# ============================================================================
# BACKGROUND QUEUES
# ============================================================================
ODDS_REFRESH_INTERVAL_MINUTES=3
ODDS_URGENT_REFRESH_INTERVAL_MINUTES=1

# ============================================================================
# OBSERVABILITY
# ============================================================================
OTEL_ENABLED=false
OTEL_SERVICE_NAME=bt-api
JAEGER_ENDPOINT=http://localhost:4318/v1/traces

# Logging
LOG_LEVEL=info
LOG_PRETTY_PRINT=true

# ============================================================================
# CORS
# ============================================================================
# Add your frontend URLs here (comma-separated)
CORS_ORIGINS=http://localhost:19006
CORS_CREDENTIALS=true

# ============================================================================
# FEATURE FLAGS
# ============================================================================
FEATURE_ODDS_AGGREGATION=true
FEATURE_PUSH_NOTIFICATIONS=false
FEATURE_ANALYTICS_QUEUE=true

# ============================================================================
# SECURITY
# ============================================================================
IDEMPOTENCY_KEY_TTL_HOURS=24
JWT_CACHE_TTL_SECONDS=3600
```

---

## Step 4: Initialize Your Database

Once your `.env` file is configured, run these commands:

```bash
# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate:dev

# Seed initial data (sportsbooks, team mappings, etc.)
npm run db:seed
```

---

## Step 5: Start Your Development Server

```bash
# Start the API
npm run start:dev
```

Your API should now be running at:
- **API**: http://localhost:3000/api
- **Swagger Docs**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/api/health

---

## Testing the Connection

### Test Database Connection

```bash
# Open Prisma Studio to view your database
npm run prisma:studio
```

### Test Redis Connection

```bash
# Check health endpoint (includes Redis check)
curl http://localhost:3000/api/health
```

### Test API

```bash
# Health check (no auth required)
curl http://localhost:3000/api/health

# Check if database is connected
curl http://localhost:3000/api/health/ready
```

---

## Troubleshooting

### Issue: "Database does not exist"

**Solution**: The database should be auto-created by Render. If not:
1. Connect to Render PostgreSQL via their web console
2. Create the database manually:
   ```sql
   CREATE DATABASE betthink_db;
   ```

### Issue: "pgvector extension not found"

**Solution**: Make sure you ran the extension command:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Issue: "Connection refused" to Redis

**Solution**: 
1. Make sure your Redis instance is running in Render
2. Check that you're using the correct host and port
3. For local development with Render Redis, use **External** connection details
4. Verify `REDIS_TLS_ENABLED` is set correctly (usually `false` for Render free tier)

### Issue: SSL/TLS connection errors

**Solution**: Add `?sslmode=require` to your DATABASE_URL:
```
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
```

### Issue: Prisma migration fails

**Solution**: Run migrations in deployment mode instead:
```bash
npm run prisma:migrate:deploy
```

---

## Cost Considerations

### Render Free Tier Limits:

**PostgreSQL Free Tier:**
- 90 days free trial
- 256 MB RAM
- 1 GB disk space
- Perfect for development

**Redis Free Tier:**
- 25 MB RAM
- Good for development/testing

For production or heavy development, consider upgrading to paid plans.

---

## Next Steps

1. ✅ Database and Redis are set up on Render
2. ✅ `.env` file is configured
3. ✅ Database is migrated and seeded
4. ✅ API is running locally

**Now you can:**
- Run e2e tests: `npm run test:e2e`
- Deploy your API to Render
- Connect your mobile app
- Start building features!

---

## Additional Resources

- [Render PostgreSQL Docs](https://render.com/docs/databases)
- [Render Redis Docs](https://render.com/docs/redis)
- [Prisma with Render](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-render)
- [Project README](./README.md)
- [Quick Start Guide](./QUICKSTART.md)

---

## Security Notes

⚠️ **Important:**
- Never commit your `.env` file to Git
- Use Render's environment variables for production deployments
- Rotate your API keys regularly
- Use strong passwords for production databases
- Enable connection pooling for better performance

---

Need help? Check the [CONTRIBUTING.md](./CONTRIBUTING.md) or open an issue on GitHub.

Happy coding! 🚀

