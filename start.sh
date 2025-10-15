#!/bin/sh
set -e

# Don't override DATABASE_URL - use Render's environment variable!
echo "🔍 Using DATABASE_URL from environment"
echo "📊 Database connection info:"
echo "   Host: $(echo "$DATABASE_URL" | sed -n 's/.*@\([^:/]*\).*/\1/p')"

# Initial delay to let database come up fully
echo "⏳ Waiting 10 seconds for database to be ready..."
sleep 10

echo "🔄 Running database migrations..."

# Retry migrate deploy to handle DB DNS/startup delays in Render
MAX_RETRIES=20
SLEEP_SECONDS=10
COUNT=0
until npx prisma migrate deploy; do
  COUNT=$((COUNT+1))
  if [ "$COUNT" -ge "$MAX_RETRIES" ]; then
    echo "❌ Migrations failed after $COUNT attempts. Exiting."
    exit 1
  fi
  echo "⚠️  Migration attempt $COUNT failed. Retrying in ${SLEEP_SECONDS}s..."
  sleep $SLEEP_SECONDS
done

echo "🚀 Starting application..."
node dist/main.js

