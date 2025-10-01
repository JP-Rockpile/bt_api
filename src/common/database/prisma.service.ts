import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  INestApplication,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, 'query' | 'error' | 'info' | 'warn'>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.get<string>('database.url'),
        },
      },
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ],
    } as Prisma.PrismaClientOptions);

    // Log slow queries in production
    if (process.env.NODE_ENV === 'production') {
      this.$on('query', (e: Prisma.QueryEvent) => {
        if (e.duration > 1000) {
          this.logger.warn(`Slow query detected: ${e.query} (${e.duration}ms)`);
        }
      });
    }

    this.$on('error', (e: Prisma.LogEvent) => {
      this.logger.error(`Database error: ${e.message}`);
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected successfully');

    // Enable pgvector extension
    try {
      await this.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector');
      this.logger.log('pgvector extension enabled');
    } catch (error) {
      this.logger.error('Failed to enable pgvector extension', error);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  async enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }

  /**
   * Vector similarity search helper
   */
  async vectorSearch(
    embedding: number[],
    limit: number = 10,
    threshold: number = 0.8,
  ): Promise<
    Array<{
      id: string;
      content: string;
      distance: number;
      documentId: string;
    }>
  > {
    const embeddingStr = `[${embedding.join(',')}]`;

    const results = await this.$queryRawUnsafe<
      Array<{
        id: string;
        content: string;
        distance: number;
        document_id: string;
      }>
    >(
      `
      SELECT 
        id,
        content,
        document_id,
        1 - (embedding <=> $1::vector) as distance
      FROM chunks
      WHERE embedding IS NOT NULL
      AND 1 - (embedding <=> $1::vector) > $2
      ORDER BY embedding <=> $1::vector
      LIMIT $3
    `,
      embeddingStr,
      threshold,
      limit,
    );

    return results.map((r) => ({
      id: r.id,
      content: r.content,
      distance: r.distance,
      documentId: r.document_id,
    }));
  }
}
