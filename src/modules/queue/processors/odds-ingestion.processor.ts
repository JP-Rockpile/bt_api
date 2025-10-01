import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OddsService } from '@modules/odds/odds.service';
import { PrismaService } from '@common/prisma/prisma.service';

@Processor('odds-ingestion')
export class OddsIngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(OddsIngestionProcessor.name);

  constructor(
    private oddsService: OddsService,
    private prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    this.logger.log(`Processing job ${job.name} (ID: ${job.id})`);

    try {
      // Log job start
      await this.logJob(job.id, 'odds-ingestion', job.name, 'ACTIVE');

      let result;
      switch (job.name) {
        case 'refresh-all-active':
          result = await this.refreshAllActiveEvents();
          break;
        case 'refresh-event':
          result = await this.refreshEvent(job.data.eventId);
          break;
        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }

      // Log job completion
      await this.logJob(job.id, 'odds-ingestion', job.name, 'COMPLETED', result);
      return result;
    } catch (error) {
      this.logger.error(`Job failed: ${error.message}`, error.stack);
      
      // Log job failure
      await this.logJob(job.id, 'odds-ingestion', job.name, 'FAILED', null, error.message);
      throw error;
    }
  }

  private async refreshAllActiveEvents() {
    // Get all active events
    const events = await this.prisma.event.findMany({
      where: {
        status: 'SCHEDULED',
        startTime: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
        },
      },
      take: 100,
    });

    this.logger.log(`Refreshing odds for ${events.length} events`);

    const results = await Promise.allSettled(
      events.map((event) => this.oddsService.refreshOddsForEvent(event.id)),
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return {
      total: events.length,
      successful,
      failed,
    };
  }

  private async refreshEvent(eventId: string) {
    return this.oddsService.refreshOddsForEvent(eventId);
  }

  private async logJob(
    jobId: string,
    queueName: string,
    jobType: string,
    status: string,
    metadata?: any,
    error?: string,
  ) {
    try {
      await this.prisma.jobLog.create({
        data: {
          jobId,
          queueName,
          jobType,
          status: status as any,
          metadata,
          error,
          startedAt: status === 'ACTIVE' ? new Date() : undefined,
          completedAt: ['COMPLETED', 'FAILED'].includes(status) ? new Date() : undefined,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to log job: ${err.message}`);
    }
  }
}

