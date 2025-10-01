import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OddsService } from '../../modules/odds/odds.service';
import { PrismaService } from '../../common/database/prisma.service';
import { Prisma } from '@prisma/client';

export interface OddsIngestionJobData {
  sport: string;
  league?: string;
  eventId?: string;
  priority?: 'normal' | 'urgent';
}

@Processor('odds-ingestion', {
  concurrency: 3,
  limiter: {
    max: 10,
    duration: 60000, // 10 requests per minute
  },
})
export class OddsIngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(OddsIngestionProcessor.name);

  constructor(
    private oddsService: OddsService,
    private prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<OddsIngestionJobData>): Promise<{ stored: number; total: number }> {
    const { sport, league, eventId, priority } = job.data;

    this.logger.log(
      `Processing odds ingestion job ${job.id}: ${sport}${league ? `/${league}` : ''}${eventId ? ` (event: ${eventId})` : ''} [${priority || 'normal'}]`,
    );

    try {
      // Log job start
      await this.prisma.jobLog.create({
        data: {
          jobId: job.id || 'unknown',
          queueName: 'odds-ingestion',
          jobType: eventId ? 'event-refresh' : 'sport-refresh',
          status: 'ACTIVE',
          inputData: job.data as Prisma.InputJsonValue,
          startedAt: new Date(),
        },
      });

      let oddsData;
      if (eventId) {
        // Refresh specific event
        oddsData = await this.oddsService.aggregateOdds(sport, league);
        oddsData = oddsData.filter((od) => od.eventExternalId === eventId);
      } else {
        // Refresh entire sport/league
        oddsData = await this.oddsService.aggregateOdds(sport, league);
      }

      const storedCount = await this.oddsService.storeOddsSnapshots(oddsData);

      const logResult = {
        eventsProcessed: oddsData.length,
        snapshotsStored: storedCount,
        timestamp: new Date().toISOString(),
      };

      // Log completion
      await this.prisma.jobLog.updateMany({
        where: { jobId: job.id },
        data: {
          status: 'COMPLETED',
          outputData: logResult as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });

      this.logger.log(
        `Odds ingestion job ${job.id} completed: ${storedCount} snapshots from ${oddsData.length} events`,
      );

      return { stored: storedCount, total: oddsData.length };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Odds ingestion job ${job.id} failed: ${errorMessage}`, errorStack);

      // Log failure
      await this.prisma.jobLog.updateMany({
        where: { jobId: job.id },
        data: {
          status: 'FAILED',
          error: errorMessage,
          completedAt: new Date(),
        },
      });

      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed with error: ${error.message}`);
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`Job ${job.id} is now active`);
  }
}
