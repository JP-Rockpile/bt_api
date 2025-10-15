import { Module, Controller, Get } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { Request, Response } from 'express';

// Configuration
import { configuration } from './config/configuration';
import { validationSchema } from './config/validation';

// Core modules
import { DatabaseModule } from './common/database/database.module';
import { RedisModule } from './common/redis/redis.module';
import { AuthModule } from './common/auth/auth.module';

// Feature modules
import { UsersModule } from './modules/users/users.module';
import { EventsModule } from './modules/events/events.module';
import { MarketsModule } from './modules/markets/markets.module';
import { OddsModule } from './modules/odds/odds.module';
import { BetsModule } from './modules/bets/bets.module';
import { ChatModule } from './modules/chat/chat.module';
import { HealthModule } from './modules/health/health.module';
import { SportsbooksModule } from './modules/sportsbooks/sportsbooks.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { UnabatedModule } from './modules/unabated/unabated.module';

// Queue modules
import { QueuesModule } from './queues/queues.module';
import { Public } from './common/auth/decorators/public.decorator';

// Root health check for Render
@Controller()
export class RootController {
  @Get()
  @Public()
  healthCheck() {
    return { status: 'ok', message: 'API is running. Visit /api/docs for documentation.' };
  }
}

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: validationSchema,
      envFilePath: ['.env.local', '.env'],
    }),

    // Structured logging
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        transport:
          process.env.LOG_PRETTY_PRINT === 'true'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  translateTime: 'SYS:standard',
                  ignore: 'pid,hostname',
                },
              }
            : undefined,
        serializers: {
          req: (req: Request & { id?: string; user?: { userId?: string } }) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            userId: req.user?.userId,
          }),
          res: (res: Response) => ({
            statusCode: res.statusCode,
          }),
        },
        customProps: (req: Request & { id?: string; user?: { userId?: string } }) => ({
          requestId: req.id,
          userId: req.user?.userId,
        }),
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie'],
          remove: true,
        },
      },
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10) * 1000,
        limit: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
      },
    ]),

    // BullMQ job queues
    BullModule.forRoot({
      connection: process.env.REDIS_URL 
        ? process.env.REDIS_URL
        : {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            password: process.env.REDIS_PASSWORD || undefined,
            db: parseInt(process.env.REDIS_DB || '0', 10),
          },
    }),

    // Core infrastructure
    DatabaseModule,
    RedisModule,
    AuthModule,

    // Feature modules
    UsersModule,
    SportsbooksModule,
    EventsModule,
    MarketsModule,
    OddsModule,
    BetsModule,
    ChatModule,
    DocumentsModule,
    HealthModule,
    UnabatedModule,

    // Background jobs
    QueuesModule,
  ],
  controllers: [RootController],
})
export class AppModule {}
