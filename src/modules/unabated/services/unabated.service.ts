import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { RestSnapshotService } from './rest-snapshot.service';
import { RealtimeService } from './realtime.service';
import { DataNormalizerService } from './data-normalizer.service';
import { MarketParserService } from './market-parser.service';
import { MarketLineUpdate } from '../interfaces/unabated.interfaces';

@Injectable()
export class UnabatedService implements OnModuleInit {
  private readonly logger = new Logger(UnabatedService.name);

  constructor(
    private prisma: PrismaService,
    private restSnapshot: RestSnapshotService,
    private realtime: RealtimeService,
    private normalizer: DataNormalizerService,
    private marketParser: MarketParserService,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    // Skip Unabated initialization in test environment or when disabled
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_UNABATED_STARTUP === 'true') {
      this.logger.log('⏭️  Skipping Unabated initialization (disabled or test environment)');
      // Still start real-time subscriptions (lightweight)
      if (process.env.NODE_ENV !== 'test') {
        try {
          await this.startRealtime();
          this.logger.log('✅ Real-time subscriptions started (bootstrap skipped)');
        } catch (error) {
          this.logger.warn(`⚠️  Failed to start real-time: ${error.message}`);
        }
      }
      return;
    }

    this.logger.log('🚀 Initializing Unabated integration...');
    this.logger.log('⚡ Deferring Unabated initialization to background (non-blocking)');

    // Run initialization in background to not block server startup
    setImmediate(async () => {
      try {
        const bootstrapOnStartup = this.configService.get<boolean>(
          'UNABATED_BOOTSTRAP_ON_STARTUP',
          false,
        );

        if (bootstrapOnStartup) {
          this.logger.log('📦 Bootstrap enabled - fetching initial data...');
          // Bootstrap on startup
          await this.bootstrap();

          // Small delay to ensure database writes have settled
          this.logger.log('⏳ Waiting 2 seconds before starting real-time feed...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          this.logger.log('⏭️ Bootstrap disabled on startup');
          this.logger.log('💡 Use POST /api/v1/unabated/sync to manually sync data');
          // Still sync bet types as they're lightweight and needed for real-time
          await this.syncBetTypes();
        }

        // Start real-time subscriptions
        await this.startRealtime();

        this.logger.log('✅ Unabated integration ready');
      } catch (error) {
        this.logger.error(`Failed to initialize: ${error.message}`);
        // Don't throw - allow app to start even if Unabated fails
        this.logger.warn('⚠️  Unabated integration failed - data sync will be unavailable');
      }
    });
  }

  /**
   * Public method to manually trigger data sync
   * Can be called from a controller endpoint or cron job
   */
  async syncData(leagues?: string[]): Promise<{
    betTypes: number;
    sources: number;
    events: number;
    lines: number;
  }> {
    this.logger.log('🔄 Starting manual data sync...');
    
    const stats = {
      betTypes: 0,
      sources: 0,
      events: 0,
      lines: 0,
    };

    try {
      // 1. Sync bet types
      await this.syncBetTypes();
      const betTypes = await this.restSnapshot.fetchBetTypes();
      stats.betTypes = betTypes.length;

      // 2. Sync market sources and events for each league
      const leaguesToSync = leagues || this.configService
        .get<string>('UNABATED_LEAGUES', 'NFL')
        .split(',')
        .map((l) => l.trim());
      const marketTypes = this.configService
        .get<string>('UNABATED_MARKET_TYPES', 'straight')
        .split(',')
        .map((m) => m.trim());
      
      for (const league of leaguesToSync) {
        for (const marketType of marketTypes) {
          // Sync market sources
          const sources = await this.restSnapshot.fetchMarketSources(league, marketType);
          stats.sources += sources.length;
          await this.storeMarketSources(sources);

          // Fetch and store snapshot (events and lines)
          const snapshot = await this.restSnapshot.fetchSnapshot(league, marketType);
          const snapshotData = snapshot.data;
          
          const events = this.normalizer.extractEventsFromSnapshot(snapshotData, league);
          const lines = this.normalizer.extractMarketLinesFromSnapshot(snapshotData, league, marketType);
          
          await this.storeEvents(events);
          await this.storeMarketLines(lines);
          
          stats.events += events.length;
          stats.lines += lines.length;
        }
      }

      this.logger.log(`✅ Sync complete: ${stats.betTypes} types, ${stats.sources} sources, ${stats.events} events, ${stats.lines} lines`);
      return stats;
    } catch (error) {
      this.logger.error(`Sync failed: ${error.message}`);
      throw error;
    }
  }

  private async bootstrap(): Promise<void> {
    this.logger.log('📦 Bootstrapping initial data...');

    // 1. Sync bet types
    await this.syncBetTypes();

    // 2. Get configured leagues and market types
    const leagues = this.configService
      .get<string>('UNABATED_LEAGUES', 'NFL')
      .split(',')
      .map((l) => l.trim());
    const marketTypes = this.configService
      .get<string>('UNABATED_MARKET_TYPES', 'straight')
      .split(',')
      .map((m) => m.trim());

    this.logger.log(`🎯 Bootstrapping: ${leagues.join(', ')} - ${marketTypes.join(', ')}`);

    // 3. Sync market sources
    for (const league of leagues) {
      for (const marketType of marketTypes) {
        await this.syncMarketSources(league, marketType);
      }
    }

    // 4. Fetch initial snapshots
    let successCount = 0;
    let failCount = 0;
    const totalSnapshots = leagues.length * marketTypes.length;
    
    for (const league of leagues) {
      for (const marketType of marketTypes) {
        try {
          await this.fetchAndStoreSnapshot(league, marketType);
          successCount++;
        } catch (error) {
          failCount++;
          this.logger.warn(`Failed to fetch ${league}/${marketType}: ${error.message}`);
        }
      }
    }

    this.logger.log(`✅ Bootstrap complete: ${successCount}/${totalSnapshots} snapshots loaded successfully`);
    
    if (failCount > 0) {
      this.logger.warn(`⚠️  ${failCount} snapshots failed to load - some events may be missing`);
    }
  }

  private async syncBetTypes(): Promise<void> {
    this.logger.log('Syncing bet types...');

    const betTypes = await this.restSnapshot.fetchBetTypes();
    const normalized = betTypes.map((bt) => this.normalizer.normalizeBetType(bt));

    for (const betType of normalized) {
      await this.prisma.betType.upsert({
        where: { id: betType.id },
        update: betType as any, // Type assertion needed until Prisma client regenerates from migrated DB
        create: betType as any,
      });
    }

    this.logger.log(`✅ Synced ${normalized.length} bet types`);
  }

  private async syncMarketSources(league: string, marketType: string): Promise<void> {
    this.logger.log(`Syncing market sources for ${league}/${marketType}...`);

    const sources = await this.restSnapshot.fetchMarketSources(league, marketType);
    const normalized = sources.map((s) => this.normalizer.normalizeMarketSource(s));

    for (const source of normalized) {
      await this.prisma.marketSource.upsert({
        where: { id: source.id },
        update: source,
        create: source,
      });
    }

    this.logger.log(`✅ Synced ${normalized.length} market sources`);
  }

  private async fetchAndStoreSnapshot(league: string, marketType: string): Promise<void> {
    this.logger.log(`Fetching snapshot: ${league}/${marketType}`);

    const snapshot = await this.restSnapshot.fetchSnapshot(league, marketType);
    const snapshotData = snapshot.data;

    // Extract and store teams in batches
    const teams = this.normalizer.extractTeamsFromSnapshot(snapshotData, league);
    const TEAM_BATCH = 50;
    for (let i = 0; i < teams.length; i += TEAM_BATCH) {
      const batch = teams.slice(i, i + TEAM_BATCH);
      await Promise.all(
        batch.map((team) =>
          this.prisma.team.upsert({
            where: { id: team.id },
            update: team,
            create: team,
          }),
        ),
      );
    }

    // Extract and store players in batches (for props markets)
    const players = this.normalizer.extractPlayersFromSnapshot(snapshotData, league);
    const PLAYER_BATCH = 50;
    for (let i = 0; i < players.length; i += PLAYER_BATCH) {
      const batch = players.slice(i, i + PLAYER_BATCH);
      await Promise.all(
        batch.map((player) =>
          this.prisma.player.upsert({
            where: { id: player.id },
            update: player,
            create: player,
          }),
        ),
      );
    }

    // Extract and store events in batches
    const events = this.normalizer.extractEventsFromSnapshot(snapshotData, league);
    const EVENT_BATCH = 50;
    for (let i = 0; i < events.length; i += EVENT_BATCH) {
      const batch = events.slice(i, i + EVENT_BATCH);
      await Promise.all(
        batch.map((event) =>
          this.prisma.unabatedEvent.upsert({
            where: { id: event.id },
            update: event,
            create: event,
          }),
        ),
      );
    }

    // For futures markets, ensure a placeholder event with ID '0' exists
    if (marketType.toLowerCase() === 'futures') {
      await this.prisma.unabatedEvent.upsert({
        where: { id: '0' },
        update: {
          leagueId: league.toUpperCase(),
          status: 'scheduled',
        },
        create: {
          id: '0',
          leagueId: league.toUpperCase(),
          startTime: null,
          homeTeamId: null,
          awayTeamId: null,
          status: 'scheduled',
          eventMetadata: {
            eventName: 'Futures Market',
            isFutures: true,
          },
        },
      });
    }

    // Extract and store market lines in smaller batches to reduce memory pressure
    const lines = this.normalizer.extractMarketLinesFromSnapshot(snapshotData, league, marketType);

    // Reduced batch size for better memory management
    const BATCH_SIZE = 50;
    this.logger.log(`Processing ${lines.length} market lines in batches of ${BATCH_SIZE}...`);
    
    for (let i = 0; i < lines.length; i += BATCH_SIZE) {
      const batch = lines.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((line) =>
          this.prisma.marketLine.upsert({
            where: { id: line.id },
            update: line,
            create: line,
          }),
        ),
      );
      
      // Log progress for large datasets
      if (lines.length > 1000 && (i + BATCH_SIZE) % 500 === 0) {
        this.logger.debug(`Processed ${i + BATCH_SIZE}/${lines.length} lines`);
      }
    }

    this.logger.log(
      `✅ Stored: ${teams.length} teams, ${players.length} players, ${events.length} events, ${lines.length} lines for ${league}/${marketType}`,
    );
  }

  private async startRealtime(): Promise<void> {
    this.logger.log('🔌 Starting real-time subscriptions...');

    // Set handler for market line updates
    this.realtime.setMarketLineHandler(async (line: MarketLineUpdate) => {
      await this.handleMarketLineUpdate(line);
    });

    // Subscribe to configured leagues
    const leagues = this.configService
      .get<string>('UNABATED_LEAGUES', 'NFL')
      .split(',')
      .map((l) => l.trim());

    this.logger.log(`📡 Subscribing to real-time updates for: ${leagues.join(', ')}`);

    // Wait for subscription to establish before returning
    // This ensures we don't start receiving updates before bootstrap completes
    try {
      await this.realtime.subscribe(leagues);
      this.logger.log('✅ Real-time WebSocket connected and subscribed');
    } catch (error) {
      this.logger.error(`Real-time subscription error: ${error.message}`);
      throw error;
    }
  }

  private async handleMarketLineUpdate(update: MarketLineUpdate): Promise<void> {
    try {
      const marketLineId = String(update.marketLineId); // Convert to string for Prisma
      const eventId = update.marketLineKey?.split(':')[0];

      if (!eventId) {
        this.logger.warn(`Market line ${marketLineId} has no eventId, skipping`);
        return;
      }

      // Check if UnabatedEvent exists, create placeholder if it doesn't
      let event = await this.prisma.unabatedEvent.findUnique({
        where: { id: eventId },
        select: { id: true },
      });

      if (!event) {
        // Create a placeholder UnabatedEvent for the market line
        // This will be enriched later during periodic sync
        try {
          // Extract league ID from marketLineKey if possible
          const leagueId = update.marketLineKey?.split(':')[1] || 'unknown';
          
          event = await this.prisma.unabatedEvent.create({
            data: {
              id: eventId,
              leagueId: leagueId,
              startTime: new Date(), // Placeholder, will be updated during sync
              status: 'scheduled',
            },
            select: { id: true },
          });
          this.logger.debug(`Created placeholder UnabatedEvent ${eventId} from market line update`);
        } catch (error) {
          // Event might have been created by another concurrent update, try to fetch again
          event = await this.prisma.unabatedEvent.findUnique({
            where: { id: eventId },
            select: { id: true },
          });
          if (!event) {
            this.logger.warn(`Failed to create or find UnabatedEvent ${eventId}, skipping market line`);
            return;
          }
        }
      }

      const newPrice = update.price;
      const newPoint = update.points;
      const updatedAt = update.modifiedOn ? new Date(update.modifiedOn) : new Date();

      // Calculate decimal odds if needed
      let decimalOdds = update.sourceFormat === 2 ? update.sourcePrice : null;
      if (!decimalOdds && newPrice) {
        decimalOdds = newPrice > 0 ? newPrice / 100 + 1 : 100 / Math.abs(newPrice) + 1;
      }

      // Update or create market line
      await this.prisma.marketLine.upsert({
        where: { id: marketLineId },
        update: {
          price: newPrice,
          point: newPoint,
          decimalOdds,
          updatedAt,
        },
        create: {
          id: marketLineId,
          eventId: eventId,
          sourceId: String(update.marketSourceId),
          marketType: 'straight', // You may need to parse this from marketLineKey
          outcome: null,
          price: newPrice,
          point: newPoint,
          decimalOdds,
          updatedAt,
        },
      });
    } catch (error) {
      // Don't let market line errors crash the app
      this.logger.error(`Error in market line handler: ${error.message}`);
    }
  }

  private async storeBetTypes(betTypes: any[]): Promise<void> {
    const normalized = betTypes.map((bt) => this.normalizer.normalizeBetType(bt));
    for (const betType of normalized) {
      await this.prisma.betType.upsert({
        where: { id: betType.id },
        update: betType as any, // Type assertion needed until Prisma client regenerates from migrated DB
        create: betType as any,
      });
    }
  }

  private async storeMarketSources(sources: any[]): Promise<void> {
    const normalized = sources.map((s) => this.normalizer.normalizeMarketSource(s));
    for (const source of normalized) {
      await this.prisma.marketSource.upsert({
        where: { id: source.id },
        update: source,
        create: source,
      });
    }
  }

  private async storeEvents(events: any[]): Promise<void> {
    for (const event of events) {
      await this.prisma.unabatedEvent.upsert({
        where: { id: event.id },
        update: event,
        create: event,
      });
    }
  }

  private async storeMarketLines(lines: any[]): Promise<void> {
    const BATCH_SIZE = 100;
    for (let i = 0; i < lines.length; i += BATCH_SIZE) {
      const batch = lines.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((line) =>
          this.prisma.marketLine.upsert({
            where: { id: line.id },
            update: line,
            create: line,
          }),
        ),
      );
    }
  }
}
