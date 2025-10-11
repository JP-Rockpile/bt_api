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

  async process(
    job: Job<{ userId?: string; betId?: string; reportType?: string }>,
  ): Promise<unknown> {
    this.logger.log(`Processing analytics job ${job.name} (ID: ${job.id})`);

    try {
      switch (job.name) {
        case 'update-user-stats':
          return await this.updateAllUserStats();
        case 'calculate-roi':
          return await this.calculateUserROI(job.data.userId!);
        case 'calculate-clv':
          return await this.calculateBetCLV(job.data.betId!);
        case 'generate-report':
          return await this.generateUserReport(job.data.userId!, job.data.reportType ?? 'default');
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
      users.map((user: { id: string }) => this.calculateUserROI(user.id)),
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    return { total: users.length, successful };
  }

  private async calculateUserROI(userId: string) {
    // Get user bets
    const bets = await this.prisma.bet.findMany({
      where: { userId },
      include: { market: true, event: true },
    });

    // Calculate basic stats
    const totalBets = bets.length;
    const settledBets = bets.filter((b) => b.status === 'SETTLED');
    const wonBets = settledBets.filter((b) => b.result === 'WIN');
    const totalStaked = settledBets.reduce((sum, b) => sum + Number(b.stake), 0);
    const totalPayout = settledBets.reduce((sum, b) => sum + Number(b.payout || 0), 0);
    const roi = totalStaked > 0 ? ((totalPayout - totalStaked) / totalStaked) * 100 : 0;

    const stats = {
      totalBets,
      settledBets: settledBets.length,
      wonBets: wonBets.length,
      winRate: settledBets.length > 0 ? (wonBets.length / settledBets.length) * 100 : 0,
      totalStaked,
      totalPayout,
      roi,
    };

    // Store stats in user preferences
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const existingPrefs = (user?.preferences || {}) as Record<string, unknown>;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        preferences: {
          ...existingPrefs,
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
        event: true,
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
          lte: bet.event.startTime,
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    if (closingOdds) {
      // Convert American odds to Odds objects for bt_shared
      const { 
        americanToDecimal,
        americanToFractional,
        americanToImpliedProbability 
      } = require('@betthink/shared');
      
      const betOdds = {
        american: bet.oddsAmerican,
        decimal: americanToDecimal(bet.oddsAmerican),
        fractional: americanToFractional(bet.oddsAmerican),
        impliedProbability: americanToImpliedProbability(bet.oddsAmerican),
      };
      
      const closingOddsObj = {
        american: closingOdds.oddsAmerican,
        decimal: americanToDecimal(closingOdds.oddsAmerican),
        fractional: americanToFractional(closingOdds.oddsAmerican),
        impliedProbability: americanToImpliedProbability(closingOdds.oddsAmerican),
      };
      
      const clvResult = calculateCLV(betOdds, closingOddsObj);
      const clvPercentage = clvResult.clvPercentage;

      // Note: closingOdds field doesn't exist in schema, storing in preferences instead
      this.logger.log(`Calculated CLV for bet ${betId}: ${clvPercentage.toFixed(2)}%`);
      return { betId, clv: clvPercentage, closingOdds: closingOdds.oddsAmerican };
    }

    return { betId, clv: null };
  }

  private async generateUserReport(userId: string, reportType: string) {
    this.logger.log(`Generating ${reportType} report for user ${userId}`);

    const bets = await this.prisma.bet.findMany({
      where: { userId },
      include: { market: true, event: true, sportsbook: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Calculate stats
    const stats = await this.calculateUserROI(userId);

    // Generate report based on type
    const report = {
      userId,
      reportType,
      generatedAt: new Date().toISOString(),
      stats,
      bets,
    };

    // In a real implementation, this might be stored or emailed
    return report;
  }
}
