#!/bin/sh
set -e

# Don't override DATABASE_URL - use Render's environment variable!
echo "🔍 Using DATABASE_URL from environment"

# Parse database connection details
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:/]*\).*/\1/p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')

echo "📊 Database connection details:"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   Database: $DB_NAME"
echo "   Full URL (masked): $(echo "$DATABASE_URL" | sed 's/:\/\/[^:]*:[^@]*@/:\/\/****:****@/')"

# Test DNS resolution
echo "🔍 Testing DNS resolution..."
if nslookup "$DB_HOST" > /dev/null 2>&1; then
  echo "✅ DNS resolution successful"
  nslookup "$DB_HOST" 2>&1 | head -5
else
  echo "❌ DNS resolution failed for $DB_HOST"
  echo "Trying alternative DNS lookup methods..."
  getent hosts "$DB_HOST" || echo "getent also failed"
  host "$DB_HOST" || echo "host command also failed"
fi

# Test network connectivity
echo "🔍 Testing network connectivity..."
if nc -zv -w5 "$DB_HOST" "$DB_PORT" 2>&1; then
  echo "✅ Port $DB_PORT is open on $DB_HOST"
else
  echo "❌ Cannot connect to $DB_HOST:$DB_PORT"
  echo "Trying ping (may not work in container)..."
  ping -c 2 "$DB_HOST" 2>&1 || echo "Ping failed (expected in most containers)"
fi

# Initial delay to let database come up fully
echo "⏳ Waiting 15 seconds for database to be ready..."
sleep 15

echo "🔄 Running database migrations..."

# Retry migrate deploy to handle DB DNS/startup delays in Render
MAX_RETRIES=30
SLEEP_SECONDS=10
COUNT=0
until npx prisma migrate deploy 2>&1; do
  COUNT=$((COUNT+1))
  if [ "$COUNT" -ge "$MAX_RETRIES" ]; then
    echo "❌ Migrations failed after $COUNT attempts."
    echo "Final diagnostic attempt..."
    echo "DATABASE_URL=$DATABASE_URL" | sed 's/:\/\/[^:]*:[^@]*@/:\/\/****:****@/'
    npx prisma migrate deploy --schema=./prisma/schema.prisma 2>&1
    exit 1
  fi
  echo "⚠️  Migration attempt $COUNT failed. Retrying in ${SLEEP_SECONDS}s..."
  
  # Additional debugging every 5 attempts
  if [ $((COUNT % 5)) -eq 0 ]; then
    echo "📊 Re-checking connectivity..."
    nc -zv -w5 "$DB_HOST" "$DB_PORT" 2>&1 || echo "Still cannot connect"
  fi
  
  sleep $SLEEP_SECONDS
done

echo "🚀 Starting application..."
node dist/main.js

