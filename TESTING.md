# Testing Guide

This document provides information on running tests for the bt-api project.

## Prerequisites

Before running tests, ensure you have the following services running:

1. **PostgreSQL** (with pgvector extension)
2. **Redis**

## Running Tests Locally

### Option 1: Using Docker Compose (Recommended)

The easiest way to run tests locally is to use Docker Compose to start the required services:

```bash
# Start PostgreSQL and Redis services
docker-compose up -d postgres redis

# Wait for services to be healthy
docker-compose ps

# Set environment to test mode
export NODE_ENV=test

# Run migrations
npm run prisma:migrate

# Run E2E tests
npm run test:e2e

# Run unit tests
npm test
```

### Option 2: Manual Service Setup

If you prefer to manage services manually:

1. **Start PostgreSQL:**
   ```bash
   # Using Docker
   docker run -d \
     --name bt_postgres_test \
     -e POSTGRES_USER=postgres \
     -e POSTGRES_PASSWORD=postgres \
     -e POSTGRES_DB=betthink_test \
     -p 5432:5432 \
     pgvector/pgvector:pg16
   ```

2. **Start Redis:**
   ```bash
   # Using Docker
   docker run -d \
     --name bt_redis_test \
     -p 6379:6379 \
     redis:7-alpine
   ```

3. **Set Environment Variables:**
   Create a `.env.test` file with the following content:
   ```env
   NODE_ENV=test
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/betthink_test?schema=public
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_DB=1
   # ... (see .env.example for all required variables)
   ```

4. **Run Tests:**
   ```bash
   npm run test:e2e
   ```

## CI/CD Testing

Tests run automatically in GitHub Actions when you push code or create a pull request. The CI workflow:

1. Sets up PostgreSQL and Redis as service containers
2. Installs dependencies
3. Runs Prisma migrations
4. Executes unit tests
5. Executes E2E tests
6. Runs linting

### Required GitHub Secrets

The CI workflow uses test/mock values for sensitive credentials. For production deployments, you'll need to set up the following secrets in your GitHub repository:

- `AUTH0_DOMAIN`
- `AUTH0_AUDIENCE`
- `AUTH0_ISSUER`
- `UNABATED_API_KEY`
- `THE_ODDS_API_KEY`
- `EXPO_ACCESS_TOKEN` (optional)

## Test Configuration

### Environment Variables for Testing

Key environment variables that differ in test mode:

- `NODE_ENV=test` - Enables test mode with relaxed validation
- `DATABASE_URL` - Points to test database
- `REDIS_DB=1` - Uses separate Redis database for tests
- `LOG_LEVEL=error` - Reduces log noise during tests
- `FEATURE_PUSH_NOTIFICATIONS=false` - Disables push notifications
- `FEATURE_ANALYTICS_QUEUE=false` - Disables analytics queue

### Test Types

1. **Unit Tests** (`npm test`)
   - Tests individual services and components
   - Located in `src/**/*.spec.ts`
   - Run with Jest

2. **E2E Tests** (`npm run test:e2e`)
   - Tests full application flow
   - Located in `test/**/*.e2e-spec.ts`
   - Uses supertest for HTTP testing
   - Requires database and Redis connections

## Writing Tests

### E2E Test Example

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Feature (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/endpoint (GET)', () => {
    return request(app.getHttpServer())
      .get('/endpoint')
      .expect(200);
  });
});
```

## Troubleshooting

### Tests Failing Due to Missing Services

**Error:** `Connection refused` or `ECONNREFUSED`

**Solution:** Ensure PostgreSQL and Redis are running:
```bash
docker-compose ps
# or
docker ps | grep -E 'postgres|redis'
```

### Database Migration Issues

**Error:** Database schema out of sync

**Solution:** Run migrations:
```bash
npm run prisma:migrate
```

### Port Conflicts

**Error:** `EADDRINUSE` or port already in use

**Solution:** 
1. Check for processes using the ports:
   ```bash
   lsof -i :5432  # PostgreSQL
   lsof -i :6379  # Redis
   lsof -i :3000  # API
   ```
2. Stop conflicting services or use different ports in your test configuration

### Tests Timing Out

**Error:** Test timeout exceeded

**Solution:** The E2E tests have a 30-second timeout. If tests are timing out:
1. Check that services are responding quickly
2. Ensure database is not overloaded
3. Increase timeout in `test/jest-e2e.json`:
   ```json
   {
     "testTimeout": 60000
   }
   ```

## Cleaning Up

After running tests, you can clean up test data:

```bash
# Reset the test database
npm run db:reset

# Or stop and remove test containers
docker-compose down -v
```

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Always clean up test data in `afterEach` or `afterAll` hooks
3. **Mocking**: Mock external API calls to avoid rate limits and ensure consistent results
4. **Speed**: Keep tests fast by only testing what's necessary
5. **Coverage**: Aim for high test coverage, especially for critical business logic

## Additional Resources

- [NestJS Testing Documentation](https://docs.nestjs.com/fundamentals/testing)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)

