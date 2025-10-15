import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private configService: ConfigService) {
    const redisConfig = this.configService.get('redis');

    // Use REDIS_URL if provided, otherwise fall back to individual config
    const connectionConfig = redisConfig.url && redisConfig.url !== 'redis://localhost:6379'
      ? redisConfig.url
      : {
          host: redisConfig.host,
          port: redisConfig.port,
          password: redisConfig.password,
          db: redisConfig.db,
          ...(redisConfig.tls ? { tls: {} } : {}),
        };

    this.client = new Redis(connectionConfig, {
      // Avoid connection storms on startup / rate-limited providers
      lazyConnect: true,
      retryStrategy: (times: number) => {
        // Exponential backoff up to 30s
        const delay = Math.min(1000 * Math.pow(2, times), 30000);
        return delay;
      },
      maxRetriesPerRequest: null, // Required by BullMQ for blocking operations
      enableReadyCheck: false, // Disable to avoid conflicts with blocking ops
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis connection error', error);
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connected');
    });
  }

  async onModuleInit() {
    try {
      // Stagger initial connect to reduce concurrent AUTH bursts
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await this.client.connect();
      await this.client.ping();
      this.logger.log('Redis client initialized successfully');
    } catch (error) {
      this.logger.warn('Redis connection failed - running in degraded mode', error);
    }
  }

  async onModuleDestroy() {
    try {
      await this.client.quit();
      this.logger.log('Redis client disconnected');
    } catch (error) {
      this.logger.warn('Redis disconnection failed', error);
    }
  }

  getClient(): Redis {
    return this.client;
  }

  /**
   * Rate limiting using sliding window counter
   */
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
  }> {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    const pipeline = this.client.pipeline();

    // Remove old entries
    pipeline.zremrangebyscore(key, '-inf', windowStart);

    // Count current requests
    pipeline.zcard(key);

    // Add current request
    pipeline.zadd(key, now, `${now}-${Math.random()}`);

    // Set expiry
    pipeline.expire(key, windowSeconds);

    const results = await pipeline.exec();

    // Get count from ZCARD result
    const count = (results?.[1]?.[1] as number) || 0;

    const allowed = count < limit;
    const remaining = Math.max(0, limit - count - 1);
    const resetAt = now + windowSeconds * 1000;

    return { allowed, remaining, resetAt };
  }

  /**
   * Cache with TTL
   */
  async cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.client.setex(key, ttlSeconds, JSON.stringify(value));
  }

  async cacheGet<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async cacheDel(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * Idempotency key storage
   */
  async storeIdempotencyKey(
    key: string,
    response: { statusCode: number; body: unknown },
    ttlHours: number,
  ): Promise<void> {
    await this.client.setex(`idempotency:${key}`, ttlHours * 3600, JSON.stringify(response));
  }

  async getIdempotencyKey(key: string): Promise<{
    statusCode: number;
    body: unknown;
  } | null> {
    const value = await this.client.get(`idempotency:${key}`);
    return value ? JSON.parse(value) : null;
  }

  /**
   * Distributed lock
   */
  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(`lock:${key}`, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async releaseLock(key: string): Promise<void> {
    await this.client.del(`lock:${key}`);
  }
}
