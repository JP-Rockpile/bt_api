import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../redis/redis.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IdempotencyMiddleware.name);

  constructor(
    private redisService: RedisService,
    private configService: ConfigService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    interface RequestWithUser extends Request {
      user?: { userId?: string };
    }

    const idempotencyKey = req.headers['idempotency-key'] as string;

    // Only process for mutation methods
    if (!idempotencyKey || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }

    const userId = (req as RequestWithUser).user?.userId || 'anonymous';
    const fullKey = `${userId}:${req.path}:${idempotencyKey}`;

    try {
      // Check if we've seen this key before
      const cached = await this.redisService.getIdempotencyKey(fullKey);

      if (cached) {
        this.logger.debug(`Idempotency key hit: ${fullKey}`);
        return res.status(cached.statusCode).json(cached.body);
      }

      // Capture the response
      const originalJson = res.json.bind(res);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res.json = function (body: any) {
        const statusCode = res.statusCode;

        // Store in Redis if successful
        if (statusCode >= 200 && statusCode < 300) {
          const ttlHours = this.configService.get<number>('security.idempotencyKeyTtlHours') || 24;

          this.redisService
            .storeIdempotencyKey(
              fullKey,
              {
                statusCode,
                body,
              },
              ttlHours,
            )
            .catch((err) => {
              this.logger.error(`Failed to store idempotency key: ${err.message}`);
            });
        }

        return originalJson(body);
      }.bind(this);

      next();
    } catch (error) {
      this.logger.error(`Idempotency middleware error: ${error.message}`);
      next();
    }
  }
}
