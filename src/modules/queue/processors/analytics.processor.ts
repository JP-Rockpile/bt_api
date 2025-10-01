import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '@common/prisma/prisma.service';
import { BetsService } from '@modules/bets/bets.service';
import { calculateCLV } from '@common/utils/odds.util';

@Processor('analytics')
export class AnalyticsProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsProcessor.name);

  constructor(
    private prisma: PrismaService,
    private betsService: BetsService,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    this.logger.log(`Processing analytics job ${job.name} (ID: ${job.id})`);

    try {
      switch (job.name) {
        case 'update-user-stats':
          return await this.updateAllUserStats();
        case 'calculate-roi':
          return await this.calculateUserROI(job.data.userId);
        case 'calculate-clv':
          return await this.calculateBetCLV(job.data.betId);
        case 'generate-report':
          return await this.generateUserReport(job.data.userId, job.data.reportType);
        default:
          throw new Error(`Unknown analytics job type: ${job.name}`);
      }
    } catch (error) {
      this.logger.error(`Analytics job failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async updateAllUserStats() {
    const users = await this.prisma.user.findMany({
      select: { id: true },
    });

    this.logger.log(`Updating stats for ${users.length} users`);

    const results = await Promise.allSettled(
      users.map((user) => this.calculateUserROI(user.id)),
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    return { total: users.length, successful };
  }

  private async calculateUserROI(userId: string) {
    const stats = await this.betsService.getUserBetStats(userId);
    
    // Store stats in user preferences or a separate stats table
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        preferences: {
          ...(await this.prisma.user.findUnique({ where: { id: userId } })).preferences,
          stats,
          statsUpdatedAt: new Date().toISOString(),
        },
      },
    });

    return stats;
  }

  private async calculateBetCLV(betId: string) {
    const bet = await this.prisma.bet.findUnique({
      where: { id: betId },
      include: {
        market: true,
      },
    });

    if (!bet) {
      throw new Error('Bet not found');
    }

    // Get closing odds (last odds before event start)
    const closingOdds = await this.prisma.oddsSnapshot.findFirst({
      where: {
        marketId: bet.marketId,
        outcome: bet.selectedOutcome,
        sportsbookId: bet.sportsbookId,
        timestamp: {
          lte: bet.market.event.startTime,
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    if (closingOdds) {
      const clv = calculateCLV(bet.americanOdds, closingOdds.americanOdds);
      
      await this.prisma.bet.update({
        where: { id: betId },
        data: { closingOdds: closingOdds.americanOdds },
      });

      this.logger.log(`Calculated CLV for bet ${betId}: ${clv.toFixed(2)}%`);
      return { betId, clv };
    }

    return { betId, clv: null };
  }

  private async generateUserReport(userId: string, reportType: string) {
    this.logger.log(`Generating ${reportType} report for user ${userId}`);

    const stats = await this.betsService.getUserBetStats(userId);
    const bets = await this.betsService.getUserBets(userId);

    // Generate report based on type
    const report = {
      userId,
      reportType,
      generatedAt: new Date().toISOString(),
      stats,
      bets: bets.slice(0, 10), // Last 10 bets
    };

    // In a real implementation, this might be stored or emailed
    return report;
  }
}

