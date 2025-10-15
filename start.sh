#!/bin/sh
set -e

echo "🔄 Running database migrations..."

# Retry migrate deploy to handle DB DNS/startup delays in Render
MAX_RETRIES=12
SLEEP_SECONDS=5
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

