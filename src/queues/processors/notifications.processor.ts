import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { PrismaService } from '../../common/database/prisma.service';

export interface NotificationJobData {
  userId: string;
  type: 'bet_confirmed' | 'odds_movement' | 'bet_settled' | 'promotion';
  title: string;
  body: string;
  data?: Record<string, any>;
}

@Processor('notifications', {
  concurrency: 5,
})
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);
  private expo: Expo;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    super();

    const accessToken = this.config.get<string>('expo.accessToken');
    this.expo = new Expo({
      accessToken,
    });
  }

  async process(job: Job<NotificationJobData>): Promise<any> {
    const { userId, type, title, body, data } = job.data;

    this.logger.log(`Processing notification job ${job.id} for user ${userId}: ${type}`);

    try {
      // Get user's push tokens
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { expoPushTokens: true, pushNotificationsEnabled: true },
      });

      if (!user || !user.pushNotificationsEnabled) {
        this.logger.debug(`User ${userId} has notifications disabled`);
        return { sent: false, reason: 'notifications_disabled' };
      }

      if (!user.expoPushTokens || user.expoPushTokens.length === 0) {
        this.logger.debug(`User ${userId} has no push tokens registered`);
        return { sent: false, reason: 'no_tokens' };
      }

      // Build push messages
      const messages: ExpoPushMessage[] = user.expoPushTokens
        .filter((token) => Expo.isExpoPushToken(token))
        .map((token) => ({
          to: token,
          sound: 'default',
          title,
          body,
          data: {
            type,
            ...data,
          },
        }));

      if (messages.length === 0) {
        this.logger.warn(`User ${userId} has no valid Expo push tokens`);
        return { sent: false, reason: 'invalid_tokens' };
      }

      // Send notifications
      const chunks = this.expo.chunkPushNotifications(messages);
      const tickets = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          this.logger.error(`Error sending notification chunk: ${error.message}`);
        }
      }

      this.logger.log(`Sent ${tickets.length} notifications for job ${job.id}`);

      return {
        sent: true,
        ticketCount: tickets.length,
        type,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Notification job ${job.id} failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Notification job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Notification job ${job.id} failed: ${error.message}`);
  }
}

