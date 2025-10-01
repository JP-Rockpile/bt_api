import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private configService: ConfigService) {
    const redisConfig = this.configService.get('redis');

    this.client = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      db: redisConfig.db,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      ...(redisConfig.tls ? { tls: {} } : {}),
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis connection error', error);
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connected');
    });
  }

  async onModuleInit() {
    await this.client.ping();
    this.logger.log('Redis client initialized successfully');
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('Redis client disconnected');
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
  async cacheSet(key: string, value: any, ttlSeconds: number): Promise<void> {
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
    response: { statusCode: number; body: any },
    ttlHours: number,
  ): Promise<void> {
    await this.client.setex(
      `idempotency:${key}`,
      ttlHours * 3600,
      JSON.stringify(response),
    );
  }

  async getIdempotencyKey(key: string): Promise<{
    statusCode: number;
    body: any;
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

