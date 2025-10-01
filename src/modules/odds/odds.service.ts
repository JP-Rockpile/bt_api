import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { UnabatedAdapter } from './adapters/unabated.adapter';
import { TheOddsApiAdapter } from './adapters/theodds.adapter';
import { OddsUtils } from '../../common/utils/odds.utils';
import { OddsData } from './adapters/base-odds.adapter';

@Injectable()
export class OddsService {
  private readonly logger = new Logger(OddsService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private config: ConfigService,
    private unabatedAdapter: UnabatedAdapter,
    private theoddsAdapter: TheOddsApiAdapter,
  ) {}

  /**
   * Aggregate odds from all providers for a specific sport
   */
  async aggregateOdds(sport: string, league?: string): Promise<OddsData[]> {
    const cacheKey = `odds:${sport}:${league || 'all'}`;
    const cacheTtl = this.config.get<number>('cache.oddsTtl') || 30;

    // Check cache
    const cached = await this.redis.cacheGet<OddsData[]>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for odds: ${cacheKey}`);
      return cached;
    }

    // Fetch from appropriate provider(s)
    let oddsData: OddsData[] = [];

    if (['MMA', 'UFC', 'BOXING'].includes(sport.toUpperCase())) {
      // Use The Odds API for MMA/Boxing
      oddsData = await this.theoddsAdapter.fetchOdds(sport, league);
    } else {
      // Use Unabated for all other sports
      oddsData = await this.unabatedAdapter.fetchOdds(sport, league);
    }

    // Store in cache
    await this.redis.cacheSet(cacheKey, oddsData, cacheTtl);

    return oddsData;
  }

  /**
   * Get odds for a specific event
   */
  async getEventOdds(eventId: string): Promise<{
    event: {
      id: string;
      sportType: string;
      league: string;
      homeTeam: string;
      awayTeam: string;
      startTime: Date;
      status: string;
    };
    markets: Array<{
      marketId: string;
      marketType: string;
      parameters: unknown;
      outcomes: Record<
        string,
        Array<{ sportsbookId: string; oddsAmerican: number; oddsDecimal: number; timestamp: Date }>
      >;
      bestOdds: Record<string, ReturnType<typeof OddsUtils.findBestOdds>>;
    }>;
  }> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        markets: {
          include: {
            oddsSnapshots: {
              orderBy: { timestamp: 'desc' },
              take: 100,
            },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Event ${eventId} not found`);
    }

    // Group latest odds by market and sportsbook
    const marketOdds = event.markets.map((market) => {
      const latestOddsByBook = new Map();

      for (const snapshot of market.oddsSnapshots) {
        const key = `${snapshot.sportsbookId}:${snapshot.outcome}`;
        if (!latestOddsByBook.has(key)) {
          latestOddsByBook.set(key, snapshot);
        }
      }

      const outcomes: Record<
        string,
        Array<{
          sportsbookId: string;
          oddsAmerican: number;
          oddsDecimal: number;
          timestamp: Date;
        }>
      > = {};
      for (const [, snapshot] of latestOddsByBook) {
        if (!outcomes[snapshot.outcome]) {
          outcomes[snapshot.outcome] = [];
        }
        outcomes[snapshot.outcome].push({
          sportsbookId: snapshot.sportsbookId,
          oddsAmerican: snapshot.oddsAmerican,
          oddsDecimal: Number(snapshot.oddsDecimal),
          timestamp: snapshot.timestamp,
        });
      }

      // Calculate best odds for each outcome
      const bestOdds: Record<string, ReturnType<typeof OddsUtils.findBestOdds>> = {};
      for (const [outcome, odds] of Object.entries(outcomes)) {
        bestOdds[outcome] = OddsUtils.findBestOdds(
          odds.map((o) => ({
            sportsbook: o.sportsbookId,
            odds: o.oddsAmerican,
          })),
        );
      }

      return {
        marketId: market.id,
        marketType: market.marketType,
        parameters: market.parameters,
        outcomes,
        bestOdds,
      };
    });

    return {
      event: {
        id: event.id,
        sportType: event.sportType,
        league: event.league,
        homeTeam: event.homeTeam,
        awayTeam: event.awayTeam,
        startTime: event.startTime,
        status: event.status,
      },
      markets: marketOdds,
    };
  }

  /**
   * Get best available odds for a specific market
   */
  async getBestOdds(marketId: string): Promise<{
    market: {
      id: string;
      marketType: string;
      parameters: unknown;
      event: {
        id: string;
        homeTeam: string;
        awayTeam: string;
        startTime: Date;
      };
    };
    odds: Record<
      string,
      Array<{ sportsbookId: string; oddsAmerican: number; oddsDecimal: number; timestamp: Date }>
    >;
    bestOdds: Record<string, ReturnType<typeof OddsUtils.findBestOdds>>;
  }> {
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
      include: {
        event: true,
        oddsSnapshots: {
          orderBy: { timestamp: 'desc' },
          take: 50,
        },
      },
    });

    if (!market) {
      throw new NotFoundException(`Market ${marketId} not found`);
    }

    // Get latest odds per sportsbook per outcome
    const latestOdds = new Map();
    for (const snapshot of market.oddsSnapshots) {
      const key = `${snapshot.sportsbookId}:${snapshot.outcome}`;
      if (!latestOdds.has(key)) {
        latestOdds.set(key, snapshot);
      }
    }

    // Group by outcome
    const outcomeOdds: Record<
      string,
      Array<{
        sportsbookId: string;
        oddsAmerican: number;
        oddsDecimal: number;
        timestamp: Date;
      }>
    > = {};
    for (const [, snapshot] of latestOdds) {
      if (!outcomeOdds[snapshot.outcome]) {
        outcomeOdds[snapshot.outcome] = [];
      }
      outcomeOdds[snapshot.outcome].push({
        sportsbookId: snapshot.sportsbookId,
        oddsAmerican: snapshot.oddsAmerican,
        oddsDecimal: Number(snapshot.oddsDecimal),
        timestamp: snapshot.timestamp,
      });
    }

    // Find best odds for each outcome
    const bestOdds: Record<string, ReturnType<typeof OddsUtils.findBestOdds>> = {};
    for (const [outcome, odds] of Object.entries(outcomeOdds)) {
      bestOdds[outcome] = OddsUtils.findBestOdds(
        odds.map((o) => ({
          sportsbook: o.sportsbookId,
          odds: o.oddsAmerican,
        })),
      );
    }

    return {
      market: {
        id: market.id,
        marketType: market.marketType,
        parameters: market.parameters,
        event: {
          id: market.event.id,
          homeTeam: market.event.homeTeam,
          awayTeam: market.event.awayTeam,
          startTime: market.event.startTime,
        },
      },
      odds: outcomeOdds,
      bestOdds,
    };
  }

  /**
   * Store odds snapshots from aggregated data
   */
  async storeOddsSnapshots(oddsData: OddsData[]): Promise<number> {
    let storedCount = 0;

    for (const eventData of oddsData) {
      try {
        // Find or create event
        const externalIds = { provider: eventData.eventExternalId };
        const event = await this.prisma.event.upsert({
          where: {
            id: eventData.eventExternalId, // This might need adjustment based on your schema
          },
          update: {
            startTime: eventData.startTime,
            updatedAt: new Date(),
          },
          create: {
            sportType: eventData.sportType,
            league: eventData.league,
            homeTeam: eventData.homeTeam,
            awayTeam: eventData.awayTeam,
            homeTeamCanonical: eventData.homeTeam,
            awayTeamCanonical: eventData.awayTeam,
            startTime: eventData.startTime,
            externalIds: externalIds,
            status: 'SCHEDULED',
          },
        });

        // Process markets and odds
        for (const marketData of eventData.markets) {
          const marketKey = `${marketData.marketType}:${JSON.stringify(marketData.parameters || {})}`;

          const market = await this.prisma.market.upsert({
            where: {
              eventId_marketKey: {
                eventId: event.id,
                marketKey,
              },
            },
            update: {},
            create: {
              eventId: event.id,
              marketType: marketData.marketType,
              parameters: marketData.parameters,
              marketKey,
            },
          });

          // Store odds snapshots
          for (const outcome of marketData.outcomes) {
            const sportsbook = await this.prisma.sportsbook.findUnique({
              where: { key: outcome.sportsbook },
            });

            if (!sportsbook) {
              this.logger.warn(`Sportsbook not found: ${outcome.sportsbook}`);
              continue;
            }

            const snapshotHash = OddsUtils.createSnapshotHash(
              market.id,
              sportsbook.id,
              outcome.outcome,
              outcome.oddsAmerican,
            );

            // Check if this exact snapshot already exists recently (last 5 minutes)
            const recentSnapshot = await this.prisma.oddsSnapshot.findFirst({
              where: {
                snapshotHash,
                timestamp: {
                  gte: new Date(Date.now() - 5 * 60 * 1000),
                },
              },
            });

            if (!recentSnapshot) {
              await this.prisma.oddsSnapshot.create({
                data: {
                  eventId: event.id,
                  marketId: market.id,
                  sportsbookId: sportsbook.id,
                  outcome: outcome.outcome,
                  oddsAmerican: outcome.oddsAmerican,
                  oddsDecimal: outcome.oddsDecimal,
                  snapshotHash,
                  timestamp: new Date(),
                },
              });
              storedCount++;
            }
          }
        }
      } catch (error) {
        this.logger.error(`Failed to store odds for event: ${error.message}`, error.stack);
      }
    }

    this.logger.log(`Stored ${storedCount} new odds snapshots`);
    return storedCount;
  }

  /**
   * Get historical odds for closing line value analysis
   */
  async getHistoricalOdds(
    marketId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<
    Array<{
      id: string;
      timestamp: Date;
      oddsAmerican: number;
      oddsDecimal: number;
      sportsbookId: string;
      outcome: string;
    }>
  > {
    const where: { marketId: string; timestamp?: { gte?: Date; lte?: Date } } = { marketId };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    const snapshots = await this.prisma.oddsSnapshot.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      include: {
        sportsbook: true,
      },
    });

    return snapshots.map((snapshot) => ({
      id: snapshot.id,
      timestamp: snapshot.timestamp,
      oddsAmerican: snapshot.oddsAmerican,
      oddsDecimal: Number(snapshot.oddsDecimal),
      sportsbookId: snapshot.sportsbookId,
      outcome: snapshot.outcome,
    }));
  }
}
