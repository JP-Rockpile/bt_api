import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api'),
  API_VERSION: Joi.string().default('v1'),

  // Auth0
  AUTH0_DOMAIN: Joi.string().required(),
  AUTH0_AUDIENCE: Joi.string().required(),
  AUTH0_ISSUER: Joi.string().required(),

  // Database
  DATABASE_URL: Joi.string().required(),
  DATABASE_POOL_SIZE: Joi.number().default(10),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().optional().allow(''),
  REDIS_DB: Joi.number().default(0),
  REDIS_TLS_ENABLED: Joi.boolean().default(false),

  // Odds Providers
  UNABATED_API_KEY: Joi.string().required(),
  UNABATED_BASE_URL: Joi.string().default('https://api.unabated.com/v1'),
  THE_ODDS_API_KEY: Joi.string().required(),
  THE_ODDS_API_BASE_URL: Joi.string().default('https://api.the-odds-api.com/v4'),

  // Expo
  EXPO_ACCESS_TOKEN: Joi.string().optional(),

  // Rate Limiting
  RATE_LIMIT_TTL: Joi.number().default(60),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
  RATE_LIMIT_PREMIUM_MAX_REQUESTS: Joi.number().default(500),

  // Caching
  ODDS_CACHE_TTL_SECONDS: Joi.number().default(30),
  EVENTS_CACHE_TTL_SECONDS: Joi.number().default(120),

  // Queues
  ODDS_REFRESH_INTERVAL_MINUTES: Joi.number().default(3),
  ODDS_URGENT_REFRESH_INTERVAL_MINUTES: Joi.number().default(1),

  // Observability
  OTEL_ENABLED: Joi.boolean().default(false),
  OTEL_SERVICE_NAME: Joi.string().default('bt-api'),
  JAEGER_ENDPOINT: Joi.string().optional(),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid('trace', 'debug', 'info', 'warn', 'error', 'fatal')
    .default('info'),
  LOG_PRETTY_PRINT: Joi.boolean().default(false),

  // CORS
  CORS_ORIGINS: Joi.string().default('http://localhost:19006'),
  CORS_CREDENTIALS: Joi.boolean().default(true),

  // Feature Flags
  FEATURE_ODDS_AGGREGATION: Joi.boolean().default(true),
  FEATURE_PUSH_NOTIFICATIONS: Joi.boolean().default(true),
  FEATURE_ANALYTICS_QUEUE: Joi.boolean().default(true),

  // Security
  IDEMPOTENCY_KEY_TTL_HOURS: Joi.number().default(24),
  JWT_CACHE_TTL_SECONDS: Joi.number().default(3600),
});

