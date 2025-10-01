import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue('odds-ingestion') private oddsQueue: Queue,
    @InjectQueue('notifications') private notificationsQueue: Queue,
    @InjectQueue('analytics') private analyticsQueue: Queue,
    private config: ConfigService,
  ) {}

  async onModuleInit() {
    this.logger.log('Queue service initialized');
  }

  // ============================================================
  // ODDS INGESTION QUEUE
  // ============================================================

  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduleOddsRefresh() {
    const interval = this.config.get('ODDS_REFRESH_INTERVAL_MINUTES', 3);
    this.logger.log(`Scheduling odds refresh (every ${interval} minutes)`);

    // In a real implementation, you'd fetch active events from DB
    // For now, this is a placeholder
    await this.oddsQueue.add(
      'refresh-all-active',
      {},
      {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );
  }

  async refreshOddsForEvent(eventId: string, priority = 1) {
    return this.oddsQueue.add(
      'refresh-event',
      { eventId },
      {
        priority, // Higher priority for user-requested refreshes
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );
  }

  // ============================================================
  // NOTIFICATIONS QUEUE
  // ============================================================

  async sendBetConfirmationNotification(userId: string, betId: string) {
    return this.notificationsQueue.add(
      'bet-confirmation',
      { userId, betId },
      {
        removeOnComplete: true,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
      },
    );
  }

  async sendOddsMovementNotification(
    userId: string,
    marketId: string,
    oldOdds: number,
    newOdds: number,
  ) {
    return this.notificationsQueue.add(
      'odds-movement',
      { userId, marketId, oldOdds, newOdds },
      {
        removeOnComplete: true,
        attempts: 3,
        backoff: {
          type: 'fixed',
          delay: 2000,
        },
      },
    );
  }

  async sendPromotionNotification(userId: string, promotionData: Record<string, unknown>) {
    return this.notificationsQueue.add(
      'promotion',
      { userId, promotionData },
      {
        removeOnComplete: true,
        attempts: 3,
      },
    );
  }

  // ============================================================
  // ANALYTICS QUEUE
  // ============================================================

  @Cron(CronExpression.EVERY_HOUR)
  async scheduleAnalyticsUpdate() {
    this.logger.log('Scheduling analytics update');

    await this.analyticsQueue.add(
      'update-user-stats',
      {},
      {
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  async calculateUserROI(userId: string) {
    return this.analyticsQueue.add(
      'calculate-roi',
      { userId },
      {
        removeOnComplete: true,
        attempts: 2,
      },
    );
  }

  async calculateCLV(betId: string) {
    return this.analyticsQueue.add(
      'calculate-clv',
      { betId },
      {
        removeOnComplete: true,
        attempts: 2,
      },
    );
  }

  async generateUserReport(userId: string, reportType: string) {
    return this.analyticsQueue.add(
      'generate-report',
      { userId, reportType },
      {
        removeOnComplete: true,
        attempts: 2,
      },
    );
  }

  // ============================================================
  // QUEUE MANAGEMENT
  // ============================================================

  async getQueueStats() {
    const [oddsStats, notificationsStats, analyticsStats] = await Promise.all([
      this.oddsQueue.getJobCounts(),
      this.notificationsQueue.getJobCounts(),
      this.analyticsQueue.getJobCounts(),
    ]);

    return {
      oddsIngestion: oddsStats,
      notifications: notificationsStats,
      analytics: analyticsStats,
    };
  }

  async pauseQueue(queueName: string) {
    const queue = this.getQueue(queueName);
    if (queue) {
      await queue.pause();
      this.logger.log(`Queue paused: ${queueName}`);
    }
  }

  async resumeQueue(queueName: string) {
    const queue = this.getQueue(queueName);
    if (queue) {
      await queue.resume();
      this.logger.log(`Queue resumed: ${queueName}`);
    }
  }

  private getQueue(name: string): Queue | null {
    switch (name) {
      case 'odds-ingestion':
        return this.oddsQueue;
      case 'notifications':
        return this.notificationsQueue;
      case 'analytics':
        return this.analyticsQueue;
      default:
        return null;
    }
  }
}
