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
      return;
    }

    this.logger.log('🚀 Initializing Unabated integration...');

    try {
      // Bootstrap on startup
      await this.bootstrap();

      // Start real-time subscriptions
      await this.startRealtime();

      this.logger.log('✅ Unabated integration ready');
    } catch (error) {
      this.logger.error(`Failed to initialize: ${error.message}`);
      // Don't throw - allow app to start even if Unabated fails
      this.logger.warn('⚠️  App starting without Unabated integration');
    }
  }

  private async bootstrap(): Promise<void> {
    this.logger.log('📦 Bootstrapping initial data...');

    // 1. Sync bet types
    await this.syncBetTypes();

    // 2. Sync market sources
    const leagues = this.restSnapshot.getAvailableLeagues();
    const marketTypes = this.configService
      .get<string>('UNABATED_MARKET_TYPES', 'straight,props')
      .split(',');

    for (const league of leagues) {
      for (const marketType of marketTypes) {
        await this.syncMarketSources(league, marketType);
      }
    }

    // 3. Fetch initial snapshots
    for (const league of leagues) {
      for (const marketType of marketTypes) {
        try {
          await this.fetchAndStoreSnapshot(league, marketType);
        } catch (error) {
          this.logger.warn(`Failed to fetch ${league}/${marketType}: ${error.message}`);
        }
      }
    }

    this.logger.log('✅ Bootstrap complete');
  }

  private async syncBetTypes(): Promise<void> {
    this.logger.log('Syncing bet types...');

    const betTypes = await this.restSnapshot.fetchBetTypes();
    const normalized = betTypes.map((bt) => this.normalizer.normalizeBetType(bt));

    for (const betType of normalized) {
      await this.prisma.betType.upsert({
        where: { id: betType.id },
        update: betType,
        create: betType,
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

    // Extract and store teams
    const teams = this.normalizer.extractTeamsFromSnapshot(snapshotData, league);
    for (const team of teams) {
      await this.prisma.team.upsert({
        where: { id: team.id },
        update: team,
        create: team,
      });
    }

    // Extract and store events
    const events = this.normalizer.extractEventsFromSnapshot(snapshotData, league);
    for (const event of events) {
      await this.prisma.unabatedEvent.upsert({
        where: { id: event.id },
        update: event,
        create: event,
      });
    }

    // Extract and store market lines
    const lines = this.normalizer.extractMarketLinesFromSnapshot(snapshotData, league, marketType);

    // Batch upsert in chunks
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

    this.logger.log(
      `✅ Stored: ${events.length} events, ${lines.length} lines for ${league}/${marketType}`,
    );
  }

  private async startRealtime(): Promise<void> {
    this.logger.log('🔌 Starting real-time subscriptions...');

    // Set handler for market line updates
    this.realtime.setMarketLineHandler(async (line: MarketLineUpdate) => {
      await this.handleMarketLineUpdate(line);
    });

    // Subscribe to all leagues
    const leagues = this.restSnapshot.getAvailableLeagues();

    // Start subscription in background (don't await)
    this.realtime.subscribe(leagues).catch((error) => {
      this.logger.error(`Real-time subscription error: ${error.message}`);
    });

    this.logger.log('✅ Real-time subscriptions started');
  }

  private async handleMarketLineUpdate(update: MarketLineUpdate): Promise<void> {
    const marketLineId = String(update.marketLineId); // Convert to string for Prisma

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
        eventId: update.marketLineKey?.split(':')[0] || 'unknown', // Parse from key
        sourceId: String(update.marketSourceId),
        marketType: 'straight', // You may need to parse this from marketLineKey
        outcome: null,
        price: newPrice,
        point: newPoint,
        decimalOdds,
        updatedAt,
      },
    });
  }
}
