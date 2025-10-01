import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { americanToDecimal } from '@common/utils/odds.util';
import { CanonicalMappingService } from '../services/canonical-mapping.service';

@Injectable()
export class TheOddsApiAdapter {
  private readonly logger = new Logger(TheOddsApiAdapter.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
    private mappingService: CanonicalMappingService,
  ) {
    this.apiKey = this.configService.get<string>('ODDS_API_KEY');
    this.baseUrl = this.configService.get<string>('ODDS_API_BASE_URL');
  }

  async fetchOdds(event: { id: string; sport: string }): Promise<Array<Record<string, unknown>>> {
    try {
      const externalId = event.externalIds?.odds_api;
      if (!externalId) {
        this.logger.warn(`No Odds API external ID for event ${event.id}`);
        return [];
      }

      // The Odds API uses sport keys and event IDs
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/sports/mma_mixed_martial_arts/odds`, {
          params: {
            apiKey: this.apiKey,
            regions: 'us',
            markets: 'h2h,spreads,totals',
            oddsFormat: 'american',
            eventIds: externalId,
          },
        }),
      );

      const rawOdds = response.data;
      return this.normalizeOdds(event, rawOdds);
    } catch (error) {
      this.logger.error(`Failed to fetch The Odds API data: ${error.message}`);
      throw error;
    }
  }

  private normalizeOdds(
    event: { id: string; sport: string },
    rawOdds: Array<Record<string, unknown>>,
  ): Array<Record<string, unknown>> {
    const normalized = [];

    for (const eventData of rawOdds) {
      if (!eventData.bookmakers) continue;

      for (const bookmaker of eventData.bookmakers) {
        const sportsbookMapping = this.mappingService.mapSportsbook(bookmaker.key, 'odds_api');

        if (!sportsbookMapping) {
          this.logger.warn(`No mapping found for sportsbook: ${bookmaker.key}`);
          continue;
        }

        for (const market of bookmaker.markets) {
          const marketType = this.mappingService.mapMarketType(market.key);

          // Find matching market in database
          const dbMarket = event.markets.find((m) => m.marketType === marketType);
          if (!dbMarket) continue;

          for (const outcome of market.outcomes) {
            const americanOdds = outcome.price;
            const decimalOdds = americanToDecimal(americanOdds);

            normalized.push({
              eventId: event.id,
              marketId: dbMarket.id,
              sportsbookId: sportsbookMapping.id,
              outcome: this.normalizeOutcome(outcome.name),
              americanOdds,
              decimalOdds,
              metadata: {
                provider: 'odds_api',
                rawData: outcome,
              },
            });
          }
        }
      }
    }

    return normalized;
  }

  private normalizeOutcome(outcome: string): string {
    // For MMA, outcomes are fighter names
    return outcome.trim();
  }
}
