import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    // Enable pgvector extension
    await this.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector');
    
    await this.$connect();
    this.logger.log('Database connected successfully');

    // Log queries in development
    if (process.env.NODE_ENV !== 'production') {
      // @ts-ignore
      this.$on('query', (e) => {
        this.logger.debug(`Query: ${e.query}`);
        this.logger.debug(`Duration: ${e.duration}ms`);
      });
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  async enableShutdownHooks(app: any) {
    process.on('SIGINT', async () => {
      await app.close();
    });
    process.on('SIGTERM', async () => {
      await app.close();
    });
  }
}

