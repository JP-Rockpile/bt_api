# ✅ Local Development Setup Complete!

## What's Running

### 🐳 Docker Containers
```bash
docker-compose ps
```

| Container | Service | Port | Status |
|-----------|---------|------|--------|
| bt_postgres | PostgreSQL 16 + pgvector | 5432 | ✅ Healthy |
| bt_redis | Redis 7 | 6379 | ✅ Healthy |

### 🚀 Application
- **Local API**: http://localhost:3000/api/v1
- **API Docs**: http://localhost:3000/api/docs
- **Status**: ✅ Running with local database

### 📊 Connections
- ✅ **Database**: PostgreSQL (local) - Connected
- ✅ **Redis**: Local Redis - Connected
- ✅ **pgvector**: Extension enabled

## Configuration

### Database URLs
```bash
# Local (current - in use)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/betthink?schema=public

# Production (backed up in .env.render-backup)
# You can switch back anytime by restoring this file
```

### Backup & Restore
```bash
# Your production config is backed up at:
.env.render-backup

# To switch back to production:
cp .env.render-backup .env
# Then restart: npm run start:dev

# To use local again:
cp .env.render-backup .env
# Update DATABASE_URL to local
# Then restart
```

## Seeded Data

Your local database has been populated with:
- ✅ **4 Sportsbooks**: FanDuel, DraftKings, BetMGM, Caesars
- ✅ **3 Team Mappings**: Chiefs, Lakers, Yankees
- ✅ **2 Sample Events**: NFL and NBA games
- ✅ **2 Documents**: Betting guides for RAG

## Testing Your API

### Public Endpoints (No Auth Required)

```bash
# Health check
curl http://localhost:3000/api/v1/health

# Readiness check (database + Redis)
curl http://localhost:3000/api/v1/health/ready
```

### Protected Endpoints (Auth0 JWT Required)

All other endpoints require a valid Auth0 JWT token in the Authorization header:

```bash
# Example: Get sportsbooks
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/api/v1/sportsbooks

# Example: Create conversation
curl -X POST \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"title": "Test Chat", "initialMessage": "Hello!"}' \
     http://localhost:3000/api/v1/chat/conversations

# Example: Get conversation history
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/api/v1/chat/conversations/YOUR_CONVERSATION_ID/history
```

### Getting a JWT Token

You can get a valid JWT token by:
1. **Using your mobile app** - The token is available after login
2. **Using Auth0 Test Token** - Go to Auth0 Dashboard → APIs → Your API → Test
3. **Using Postman** - Set up OAuth 2.0 with your Auth0 credentials

## Database Management

### Prisma Studio (Database GUI)
```bash
# Open Prisma Studio to view/edit data
npm run prisma:studio
# Opens at: http://localhost:5555
```

### Useful Commands

```bash
# View database tables
docker exec -it bt_postgres psql -U postgres -d betthink -c "\dt"

# Check table contents
docker exec -it bt_postgres psql -U postgres -d betthink -c "SELECT * FROM sportsbooks;"

# Reset database (careful!)
npm run db:reset

# Re-seed database
npm run db:seed

# Apply schema changes
npx prisma db push

# Generate Prisma client
npx prisma generate
```

## Redis Management

```bash
# Connect to Redis CLI
docker exec -it bt_redis redis-cli

# Inside Redis CLI:
# KEYS *           # List all keys
# GET key_name     # Get a value
# FLUSHALL         # Clear all data (careful!)
# PING             # Test connection
```

## API Documentation

### Swagger UI
Open http://localhost:3000/api/docs in your browser to:
- 📖 View all endpoints
- 🔐 Test authenticated endpoints (click "Authorize" and paste your JWT)
- 📝 See request/response schemas
- ✨ Try out API calls directly in the browser

### Available Endpoints

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/v1/health` | GET | No | Basic health check |
| `/api/v1/health/ready` | GET | No | Database & Redis check |
| `/api/v1/sportsbooks` | GET | Yes | List all sportsbooks |
| `/api/v1/events/upcoming` | GET | Yes | Upcoming sports events |
| `/api/v1/chat/conversations` | POST | Yes | Create conversation |
| `/api/v1/chat/conversations` | GET | Yes | List conversations |
| `/api/v1/chat/conversations/:id/history` | GET | Yes | Get messages |
| `/api/v1/users/me` | GET | Yes | Current user profile |
| `/api/v1/bets` | GET | Yes | List user bets |
| `/api/v1/odds/event/:id` | GET | Yes | Get odds for event |

## Testing Chat Functionality

### 1. Create a Conversation
```bash
curl -X POST http://localhost:3000/api/v1/chat/conversations \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My First Chat",
    "initialMessage": "What are the best odds for tonight?"
  }'
```

Response:
```json
{
  "conversationId": "abc123...",
  "title": "My First Chat",
  "createdAt": "2025-10-11T17:30:00.000Z"
}
```

### 2. Get Conversation History
```bash
curl http://localhost:3000/api/v1/chat/conversations/abc123.../history \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Send a Message
```bash
curl -X POST http://localhost:3000/api/v1/chat/conversations/abc123.../messages \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Tell me more about spread betting"}'
```

## Container Management

### Start Containers
```bash
docker-compose up -d postgres redis
```

### Stop Containers
```bash
docker-compose down
```

### Stop and Remove All Data
```bash
# ⚠️ WARNING: This will delete all local database data!
docker-compose down -v
```

### View Logs
```bash
# PostgreSQL logs
docker logs bt_postgres

# Redis logs
docker logs bt_redis

# Follow logs in real-time
docker logs -f bt_postgres
```

### Restart Containers
```bash
docker-compose restart postgres redis
```

## Development Workflow

### Starting Your Day
```bash
# 1. Start Docker containers
docker-compose up -d postgres redis

# 2. Start the development server
npm run start:dev

# 3. (Optional) Open Prisma Studio
npm run prisma:studio
```

### Making Schema Changes
```bash
# 1. Edit prisma/schema.prisma

# 2. Apply changes to database
npx prisma db push

# 3. Generate updated Prisma Client
npx prisma generate

# 4. Restart dev server (it should auto-restart with --watch)
```

### Ending Your Day
```bash
# Stop the API (Ctrl+C in terminal)

# Optionally stop Docker containers to save resources
docker-compose stop
```

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm run start:dev
```

### Database Connection Error
```bash
# Check if PostgreSQL is running
docker ps | grep bt_postgres

# Restart PostgreSQL
docker-compose restart postgres

# Check logs
docker logs bt_postgres
```

### Redis Connection Error
```bash
# Check if Redis is running
docker ps | grep bt_redis

# Restart Redis
docker-compose restart redis

# Test connection
docker exec -it bt_redis redis-cli ping
```

### Schema Out of Sync
```bash
# Reset and reapply schema
npx prisma db push --force-reset

# Re-seed data
npm run db:seed
```

## Performance Tips

### Viewing Query Performance
```bash
# Enable query logging in .env
LOG_LEVEL=debug

# Watch slow queries in PostgreSQL
docker exec -it bt_postgres psql -U postgres -d betthink -c \
  "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

### Redis Cache Monitoring
```bash
# Monitor Redis commands in real-time
docker exec -it bt_redis redis-cli MONITOR
```

## Next Steps

1. ✅ **Local Development**: Ready to code!
2. 🧪 **Test Your Endpoints**: Use Swagger UI or your mobile app
3. 🔐 **Get Auth0 Token**: From your app or Auth0 dashboard
4. 💬 **Test Chat**: Create conversations and send messages
5. 📊 **Monitor Data**: Use Prisma Studio to see database changes

## Resources

- **API Docs**: http://localhost:3000/api/docs
- **Prisma Studio**: http://localhost:5555 (after running `npm run prisma:studio`)
- **Docker Dashboard**: Open Docker Desktop app
- **Logs**: `tail -f /tmp/nest-dev.log`

## Production vs Local

| Feature | Local | Production (Render) |
|---------|-------|---------------------|
| Database | localhost:5432 | Render PostgreSQL |
| Redis | localhost:6379 | Render Redis |
| Config | `.env` | Render Environment Variables |
| URL | http://localhost:3000 | https://your-app.onrender.com |
| Auth0 | Same | Same |

To switch back to production database:
```bash
cp .env.render-backup .env
npm run start:dev
```

---

**Status**: 🎉 Everything is working!  
**Local API**: http://localhost:3000/api/v1  
**Database**: PostgreSQL (local)  
**Redis**: Local  
**Ready to develop!** ✨

