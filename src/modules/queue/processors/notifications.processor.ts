import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { PrismaService } from '@common/prisma/prisma.service';

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);
  private expo: Expo;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    super();
    this.expo = new Expo({
      accessToken: this.config.get('EXPO_ACCESS_TOKEN'),
    });
  }

  async process(job: Job<Record<string, unknown>>): Promise<unknown> {
    this.logger.log(`Processing notification job ${job.name} (ID: ${job.id})`);

    try {
      switch (job.name) {
        case 'bet-confirmation':
          return await this.sendBetConfirmation(job.data);
        case 'odds-movement':
          return await this.sendOddsMovement(job.data);
        case 'promotion':
          return await this.sendPromotion(job.data);
        default:
          throw new Error(`Unknown notification type: ${job.name}`);
      }
    } catch (error) {
      this.logger.error(`Notification job failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async sendBetConfirmation(data: { userId: string; betId: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
    });

    const bet = await this.prisma.bet.findUnique({
      where: { id: data.betId },
      include: {
        event: true,
        market: true,
        sportsbook: true,
      },
    });

    if (!user?.deviceTokens || user.deviceTokens.length === 0) {
      this.logger.warn(`No device tokens for user ${data.userId}`);
      return;
    }

    const messages: ExpoPushMessage[] = user.deviceTokens
      .filter((token) => Expo.isExpoPushToken(token))
      .map((token) => ({
        to: token,
        sound: 'default',
        title: 'Bet Confirmed! 🎯',
        body: `${bet.selectedOutcome} at ${bet.americanOdds > 0 ? '+' : ''}${bet.americanOdds} on ${bet.sportsbook.displayName}`,
        data: { betId: data.betId },
      }));

    return this.sendPushNotifications(messages);
  }

  private async sendOddsMovement(data: {
    userId: string;
    marketId: string;
    oldOdds: number;
    newOdds: number;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!user?.deviceTokens || user.deviceTokens.length === 0) {
      return;
    }

    const messages: ExpoPushMessage[] = user.deviceTokens
      .filter((token) => Expo.isExpoPushToken(token))
      .map((token) => ({
        to: token,
        sound: 'default',
        title: 'Odds Movement Alert 📊',
        body: `Odds moved from ${data.oldOdds} to ${data.newOdds}`,
        data: { marketId: data.marketId },
      }));

    return this.sendPushNotifications(messages);
  }

  private async sendPromotion(data: { userId: string; promotionData: Record<string, unknown> }) {
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!user?.deviceTokens || user.deviceTokens.length === 0) {
      return;
    }

    const messages: ExpoPushMessage[] = user.deviceTokens
      .filter((token) => Expo.isExpoPushToken(token))
      .map((token) => ({
        to: token,
        sound: 'default',
        title: data.promotionData.title || 'Special Offer! 🎁',
        body: data.promotionData.message,
        data: data.promotionData,
      }));

    return this.sendPushNotifications(messages);
  }

  private async sendPushNotifications(messages: ExpoPushMessage[]) {
    if (messages.length === 0) {
      return { sent: 0 };
    }

    const chunks = this.expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        this.logger.error(`Failed to send push notification chunk: ${error.message}`);
      }
    }

    this.logger.log(`Sent ${tickets.length} push notifications`);
    return { sent: tickets.length, tickets };
  }
}
