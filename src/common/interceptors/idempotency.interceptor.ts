import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { PrismaService } from '@common/prisma/prisma.service';
import { createHash } from 'crypto';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(private prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request & { user?: { userId?: string } }>();
    const response = context.switchToHttp().getResponse<Response>();

    // Only apply to POST, PUT, PATCH
    if (!['POST', 'PUT', 'PATCH'].includes(request.method)) {
      return next.handle();
    }

    const idempotencyKey = request.headers['idempotency-key'] as string;

    if (!idempotencyKey) {
      return next.handle();
    }

    try {
      // Check if this idempotency key exists
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: { id: idempotencyKey },
      });

      if (existing) {
        // Check if expired
        if (existing.expiresAt < new Date()) {
          await this.prisma.idempotencyKey.delete({
            where: { id: idempotencyKey },
          });
        } else {
          // Return cached response
          this.logger.log(`Returning cached response for idempotency key: ${idempotencyKey}`);
          response.status(existing.statusCode);
          return of(JSON.parse(existing.responseBody));
        }
      }

      // Process new request
      return next.handle().pipe(
        tap(async (data) => {
          const ttlHours = parseInt(process.env.IDEMPOTENCY_TTL_HOURS || '24', 10);
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + ttlHours);

          try {
            await this.prisma.idempotencyKey.create({
              data: {
                id: idempotencyKey,
                statusCode: response.statusCode,
                responseBody: JSON.stringify(data),
                expiresAt,
                userId: request.user?.userId || 'anonymous',
                endpoint: request.url,
                method: request.method,
              },
            });
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to store idempotency key: ${errorMessage}`);
          }
        }),
      );
    } catch (error: unknown) {
      if (error instanceof ConflictException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Idempotency check failed: ${errorMessage}`);
      return next.handle();
    }
  }

  private createRequestHash(request: Request): string {
    interface RequestWithUser extends Request {
      user?: { sub?: string };
    }

    const data = JSON.stringify({
      method: request.method,
      url: request.url,
      body: request.body,
      userId: (request as RequestWithUser).user?.sub,
    });

    return createHash('sha256').update(data).digest('hex');
  }
}
