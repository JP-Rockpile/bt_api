/**
 * E2E Test Setup
 * This file configures environment variables before tests run
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/betthink_test?schema=public';
process.env.DATABASE_POOL_SIZE = '5';

// Redis configuration
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';
process.env.REDIS_DB = '1'; // Use separate Redis DB for tests
process.env.REDIS_TLS_ENABLED = 'false';

// Auth0 (mock values for testing)
process.env.AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || 'test.auth0.com';
process.env.AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE || 'http://localhost:3000';
process.env.AUTH0_ISSUER = process.env.AUTH0_ISSUER || 'https://test.auth0.com/';

// API Keys (mock values for testing)
process.env.UNABATED_API_KEY = process.env.UNABATED_API_KEY || 'test_key';
process.env.THE_ODDS_API_KEY = process.env.THE_ODDS_API_KEY || 'test_key';
process.env.EXPO_ACCESS_TOKEN = process.env.EXPO_ACCESS_TOKEN || 'test_token';
process.env.BT_MODEL_SERVICE_TOKEN = process.env.BT_MODEL_SERVICE_TOKEN || 'test_bt_model_service_token_for_e2e_testing_123456';

// Rate Limiting
process.env.RATE_LIMIT_TTL = '60';
process.env.RATE_LIMIT_MAX_REQUESTS = '1000';
process.env.RATE_LIMIT_PREMIUM_MAX_REQUESTS = '5000';

// Cache Settings
process.env.ODDS_CACHE_TTL_SECONDS = '30';
process.env.EVENTS_CACHE_TTL_SECONDS = '120';

// Queue Settings
process.env.ODDS_REFRESH_INTERVAL_MINUTES = '3';
process.env.ODDS_URGENT_REFRESH_INTERVAL_MINUTES = '1';

// Feature Flags (Disable features that require external services in tests)
process.env.FEATURE_ODDS_AGGREGATION = 'false';
process.env.FEATURE_PUSH_NOTIFICATIONS = 'false';
process.env.FEATURE_ANALYTICS_QUEUE = 'false';

// Observability (Disabled in tests)
process.env.OTEL_ENABLED = 'false';
process.env.LOG_LEVEL = 'error';

// CORS
process.env.CORS_ORIGINS = 'http://localhost:19006';
process.env.CORS_CREDENTIALS = 'true';

// Security
process.env.IDEMPOTENCY_KEY_TTL_HOURS = '24';
process.env.JWT_CACHE_TTL_SECONDS = '3600';

// API Configuration
process.env.PORT = '3001';
process.env.API_PREFIX = 'api';
process.env.API_VERSION = 'v1';

