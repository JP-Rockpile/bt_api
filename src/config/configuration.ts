export const configuration = () => ({
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    apiPrefix: process.env.API_PREFIX || 'api',
    apiVersion: process.env.API_VERSION || '1',
  },

  auth0: {
    domain: process.env.AUTH0_DOMAIN,
    audience: process.env.AUTH0_AUDIENCE,
    issuer: process.env.AUTH0_ISSUER,
  },

  database: {
    url: process.env.DATABASE_URL,
    poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '10', 10),
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    // Legacy support for individual variables (deprecated)
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    tls: process.env.REDIS_TLS_ENABLED === 'true',
  },

  oddsProviders: {
    unabated: {
      apiKey: process.env.UNABATED_API_KEY,
      baseUrl: process.env.UNABATED_BASE_URL || 'https://api.unabated.com/v1',
    },
    theOddsApi: {
      apiKey: process.env.THE_ODDS_API_KEY,
      baseUrl: process.env.THE_ODDS_API_BASE_URL || 'https://api.the-odds-api.com/v4',
    },
  },

  expo: {
    accessToken: process.env.EXPO_ACCESS_TOKEN,
  },

  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    premiumMaxRequests: parseInt(process.env.RATE_LIMIT_PREMIUM_MAX_REQUESTS || '500', 10),
  },

  cache: {
    oddsTtl: parseInt(process.env.ODDS_CACHE_TTL_SECONDS || '30', 10),
    eventsTtl: parseInt(process.env.EVENTS_CACHE_TTL_SECONDS || '120', 10),
  },

  queues: {
    oddsRefreshInterval: parseInt(process.env.ODDS_REFRESH_INTERVAL_MINUTES || '3', 10),
    oddsUrgentRefreshInterval: parseInt(
      process.env.ODDS_URGENT_REFRESH_INTERVAL_MINUTES || '1',
      10,
    ),
  },

  observability: {
    otelEnabled: process.env.OTEL_ENABLED === 'true',
    otelServiceName: process.env.OTEL_SERVICE_NAME || 'bt-api',
    jaegerEndpoint: process.env.JAEGER_ENDPOINT,
  },

  cors: {
    origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:19006'],
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },

  features: {
    oddsAggregation: process.env.FEATURE_ODDS_AGGREGATION !== 'false',
    pushNotifications: process.env.FEATURE_PUSH_NOTIFICATIONS !== 'false',
    analyticsQueue: process.env.FEATURE_ANALYTICS_QUEUE !== 'false',
  },

  security: {
    idempotencyKeyTtlHours: parseInt(process.env.IDEMPOTENCY_KEY_TTL_HOURS || '24', 10),
    jwtCacheTtl: parseInt(process.env.JWT_CACHE_TTL_SECONDS || '3600', 10),
    btModelServiceToken: process.env.BT_MODEL_SERVICE_TOKEN,
  },

  btModel: {
    baseUrl: process.env.BT_MODEL_BASE_URL || 'http://localhost:8000',
    timeout: parseInt(process.env.BT_MODEL_TIMEOUT || '30000', 10),
    enabled: process.env.BT_MODEL_ENABLED !== 'false',
  },
});

export type Configuration = ReturnType<typeof configuration>;
