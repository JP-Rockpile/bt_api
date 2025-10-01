import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/database/prisma.service';
import { Prisma } from '@prisma/client';

export interface AnalyticsJobData {
  userId: string;
  type: 'roi_calculation' | 'clv_analysis' | 'win_rate_analysis';
  timeRange?: {
    startDate: string;
    endDate: string;
  };
}

@Processor('analytics', {
  concurrency: 2,
})
export class AnalyticsProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsProcessor.name);

  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job<AnalyticsJobData>): Promise<Record<string, unknown>> {
    const { userId, type, timeRange } = job.data;

    this.logger.log(`Processing analytics job ${job.id} for user ${userId}: ${type}`);

    try {
      let result: Record<string, unknown>;

      switch (type) {
        case 'roi_calculation':
          result = await this.calculateROI(userId, timeRange);
          break;
        case 'clv_analysis':
          result = await this.analyzeClosingLineValue(userId, timeRange);
          break;
        case 'win_rate_analysis':
          result = await this.analyzeWinRate(userId, timeRange);
          break;
        default:
          throw new Error(`Unknown analytics type: ${type}`);
      }

      this.logger.log(`Analytics job ${job.id} completed: ${type}`);

      return {
        type,
        userId,
        result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Analytics job ${job.id} failed: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  private async calculateROI(userId: string, timeRange?: { startDate: string; endDate: string }) {
    const where: Prisma.BetWhereInput = {
      userId,
      status: 'SETTLED',
    };

    if (timeRange) {
      where.settledAt = {
        gte: new Date(timeRange.startDate),
        lte: new Date(timeRange.endDate),
      };
    }

    const bets = await this.prisma.bet.findMany({
      where,
      select: {
        stake: true,
        payout: true,
        result: true,
      },
    });

    const totalStaked = bets.reduce((sum, bet) => sum + Number(bet.stake), 0);
    const totalReturned = bets.reduce((sum, bet) => sum + (Number(bet.payout) || 0), 0);
    const netProfit = totalReturned - totalStaked;
    const roi = totalStaked > 0 ? (netProfit / totalStaked) * 100 : 0;

    return {
      totalBets: bets.length,
      totalStaked,
      totalReturned,
      netProfit,
      roi: Number(roi.toFixed(2)),
    };
  }

  private async analyzeClosingLineValue(
    userId: string,
    timeRange?: { startDate: string; endDate: string },
  ) {
    const where: Prisma.BetWhereInput = {
      userId,
      status: { in: ['PLACED', 'SETTLED'] },
    };

    if (timeRange) {
      where.confirmedAt = {
        gte: new Date(timeRange.startDate),
        lte: new Date(timeRange.endDate),
      };
    }

    const bets = await this.prisma.bet.findMany({
      where,
      include: {
        market: {
          include: {
            oddsSnapshots: {
              where: {
                outcome: { not: '' },
              },
              orderBy: { timestamp: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    let positiveCLV = 0;
    let negativeCLV = 0;
    let totalCLV = 0;

    for (const bet of bets) {
      const confirmedOdds = bet.oddsAmerican;
      const closingSnapshot = bet.market?.oddsSnapshots?.find(
        (s: { outcome: string | null; sportsbookId: string }) =>
          s.outcome === bet.selectedOutcome && s.sportsbookId === bet.sportsbookId,
      );

      if (closingSnapshot) {
        const closingOdds = closingSnapshot.oddsAmerican;
        const clv = closingOdds - confirmedOdds;

        totalCLV += clv;
        if (clv > 0) positiveCLV++;
        else if (clv < 0) negativeCLV++;
      }
    }

    return {
      totalBets: bets.length,
      positiveCLV,
      negativeCLV,
      avgCLV: bets.length > 0 ? Number((totalCLV / bets.length).toFixed(2)) : 0,
      clvRate: bets.length > 0 ? Number(((positiveCLV / bets.length) * 100).toFixed(2)) : 0,
    };
  }

  private async analyzeWinRate(userId: string, timeRange?: { startDate: string; endDate: string }) {
    const where: Prisma.BetWhereInput = {
      userId,
      status: 'SETTLED',
    };

    if (timeRange) {
      where.settledAt = {
        gte: new Date(timeRange.startDate),
        lte: new Date(timeRange.endDate),
      };
    }

    const bets = await this.prisma.bet.findMany({
      where,
      include: {
        event: {
          select: {
            sportType: true,
            league: true,
          },
        },
        market: {
          select: {
            marketType: true,
          },
        },
        sportsbook: {
          select: {
            displayName: true,
          },
        },
      },
    });

    const wins = bets.filter((bet) => bet.result === 'WIN').length;
    const losses = bets.filter((bet) => bet.result === 'LOSS').length;
    const pushes = bets.filter((bet) => bet.result === 'PUSH').length;

    // Segment by sport
    const bySport: Record<
      string,
      { total: number; wins: number; losses: number; winRate?: number }
    > = {};
    for (const bet of bets) {
      const sport = bet.event.sportType;
      if (!bySport[sport]) {
        bySport[sport] = { total: 0, wins: 0, losses: 0 };
      }
      bySport[sport].total++;
      if (bet.result === 'WIN') bySport[sport].wins++;
      if (bet.result === 'LOSS') bySport[sport].losses++;
    }

    // Calculate win rate percentages
    for (const sport in bySport) {
      const { total, wins } = bySport[sport];
      bySport[sport].winRate = total > 0 ? Number(((wins / total) * 100).toFixed(2)) : 0;
    }

    return {
      overall: {
        total: bets.length,
        wins,
        losses,
        pushes,
        winRate: bets.length > 0 ? Number(((wins / bets.length) * 100).toFixed(2)) : 0,
      },
      bySport,
    };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Analytics job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Analytics job ${job.id} failed: ${error.message}`);
  }
}
