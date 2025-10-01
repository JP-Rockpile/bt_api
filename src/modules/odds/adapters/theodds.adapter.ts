import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BaseOddsAdapter, OddsData, MarketOdds } from './base-odds.adapter';
import { OddsUtils } from '../../../common/utils/odds.utils';
import { TeamMappingUtils } from '../../../common/utils/team-mapping.utils';
import { PrismaService } from '../../../common/database/prisma.service';

/**
 * The Odds API Adapter - Specialized for MMA coverage
 */
@Injectable()
export class TheOddsApiAdapter extends BaseOddsAdapter {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
    private prisma: PrismaService,
  ) {
    super('TheOddsApiAdapter');
    this.apiKey = this.configService.get<string>('oddsProviders.theOddsApi.apiKey');
    this.baseUrl = this.configService.get<string>('oddsProviders.theOddsApi.baseUrl');
  }

  async fetchOdds(sport: string, league?: string): Promise<OddsData[]> {
    try {
      // The Odds API uses sport keys
      const sportKey = this.getSportKey(sport);
      const url = `${this.baseUrl}/sports/${sportKey}/odds`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: {
            apiKey: this.apiKey,
            regions: 'us',
            markets: 'h2h,spreads,totals',
            oddsFormat: 'american',
          },
        }),
      );

      return this.transformTheOddsApiResponse(response.data, sport);
    } catch (error) {
      this.logger.error(`Failed to fetch odds from The Odds API: ${error.message}`, error.stack);
      throw error;
    }
  }

  async fetchEventOdds(eventId: string): Promise<OddsData | null> {
    try {
      const url = `${this.baseUrl}/events/${eventId}/odds`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: {
            apiKey: this.apiKey,
            regions: 'us',
            markets: 'h2h,spreads,totals',
            oddsFormat: 'american',
          },
        }),
      );

      const transformed = this.transformTheOddsApiResponse([response.data], 'MMA');
      return transformed[0] || null;
    } catch (error) {
      this.logger.error(
        `Failed to fetch event odds from The Odds API: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  async mapTeamName(providerName: string, sport: string, league: string): Promise<string> {
    // First, try to find in team_mappings table
    const mapping = await this.prisma.teamMapping.findFirst({
      where: {
        sport,
        league,
        OR: [
          { canonicalName: providerName },
          {
            aliases: {
              path: ['theodds'],
              equals: providerName,
            },
          },
        ],
      },
    });

    if (mapping) {
      return mapping.canonicalName;
    }

    // Fall back to fuzzy matching
    const allMappings = await this.prisma.teamMapping.findMany({
      where: { sport, league },
    });

    const canonicalNames = allMappings.map((m) => ({
      name: m.canonicalName,
      aliases: (m.aliases as any)?.variants || [],
    }));

    const bestMatch = TeamMappingUtils.findBestMatch(providerName, canonicalNames);

    if (bestMatch) {
      this.logger.log(
        `Fuzzy matched '${providerName}' to '${bestMatch.name}' (score: ${bestMatch.score})`,
      );
      return bestMatch.name;
    }

    // For MMA, use the fighter name as-is (individual athletes, not teams)
    this.logger.debug(`Using original fighter name: ${providerName}`);
    return providerName;
  }

  getSupportedSports(): string[] {
    return ['MMA', 'BOXING', 'UFC'];
  }

  async healthCheck(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/sports`;
      await firstValueFrom(
        this.httpService.get(url, {
          params: { apiKey: this.apiKey },
          timeout: 5000,
        }),
      );
      return true;
    } catch (error) {
      this.logger.error(`The Odds API health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get sport key for The Odds API
   */
  private getSportKey(sport: string): string {
    const mapping: Record<string, string> = {
      'MMA': 'mma_mixed_martial_arts',
      'UFC': 'mma_mixed_martial_arts',
      'BOXING': 'boxing_boxing',
    };

    return mapping[sport.toUpperCase()] || sport.toLowerCase();
  }

  /**
   * Transform The Odds API response to our internal format
   */
  private async transformTheOddsApiResponse(data: any[], sport: string): Promise<OddsData[]> {
    const results: OddsData[] = [];

    for (const event of data) {
      try {
        // For MMA, home/away might not apply - use fighter names directly
        const homeTeam = event.home_team || event.teams?.[0] || 'Fighter 1';
        const awayTeam = event.away_team || event.teams?.[1] || 'Fighter 2';

        const homeTeamCanonical = await this.mapTeamName(homeTeam, sport, 'UFC');
        const awayTeamCanonical = await this.mapTeamName(awayTeam, sport, 'UFC');

        const markets: MarketOdds[] = [];

        // Process bookmakers
        if (event.bookmakers && Array.isArray(event.bookmakers)) {
          for (const bookmaker of event.bookmakers) {
            const sportsbookKey = this.normalizeSportsbookName(bookmaker.key);

            for (const market of bookmaker.markets || []) {
              if (market.key === 'h2h') {
                // Moneyline
                const outcomes = market.outcomes.map((outcome: any) => ({
                  outcome: outcome.name === homeTeam ? 'home' : 'away',
                  sportsbook: sportsbookKey,
                  oddsAmerican: outcome.price,
                  oddsDecimal: OddsUtils.americanToDecimal(outcome.price),
                }));

                // Merge outcomes by outcome type
                const existingMarket = markets.find((m) => m.marketType === 'MONEYLINE');
                if (existingMarket) {
                  existingMarket.outcomes.push(...outcomes);
                } else {
                  markets.push({
                    marketType: 'MONEYLINE',
                    outcomes,
                  });
                }
              } else if (market.key === 'spreads') {
                // Spread
                for (const outcome of market.outcomes) {
                  const existingMarket = markets.find(
                    (m) =>
                      m.marketType === 'SPREAD' &&
                      m.parameters?.line === Math.abs(outcome.point),
                  );

                  const outcomeData = {
                    outcome: outcome.name === homeTeam ? 'home' : 'away',
                    sportsbook: sportsbookKey,
                    oddsAmerican: outcome.price,
                    oddsDecimal: OddsUtils.americanToDecimal(outcome.price),
                  };

                  if (existingMarket) {
                    existingMarket.outcomes.push(outcomeData);
                  } else {
                    markets.push({
                      marketType: 'SPREAD',
                      parameters: { line: Math.abs(outcome.point) },
                      outcomes: [outcomeData],
                    });
                  }
                }
              } else if (market.key === 'totals') {
                // Totals
                for (const outcome of market.outcomes) {
                  const marketType =
                    outcome.name === 'Over' ? 'TOTAL_OVER' : 'TOTAL_UNDER';
                  const existingMarket = markets.find(
                    (m) =>
                      m.marketType === marketType &&
                      m.parameters?.line === outcome.point,
                  );

                  const outcomeData = {
                    outcome: outcome.name.toLowerCase(),
                    sportsbook: sportsbookKey,
                    oddsAmerican: outcome.price,
                    oddsDecimal: OddsUtils.americanToDecimal(outcome.price),
                  };

                  if (existingMarket) {
                    existingMarket.outcomes.push(outcomeData);
                  } else {
                    markets.push({
                      marketType,
                      parameters: { line: outcome.point },
                      outcomes: [outcomeData],
                    });
                  }
                }
              }
            }
          }
        }

        results.push({
          eventExternalId: event.id,
          sportType: sport.toUpperCase(),
          league: 'UFC', // Default to UFC for MMA
          homeTeam: homeTeamCanonical,
          awayTeam: awayTeamCanonical,
          startTime: new Date(event.commence_time),
          markets,
        });
      } catch (error) {
        this.logger.error(`Failed to transform event: ${error.message}`, error.stack);
      }
    }

    return results;
  }

  /**
   * Normalize sportsbook names to match our database
   */
  private normalizeSportsbookName(key: string): string {
    const mapping: Record<string, string> = {
      'fanduel': 'fanduel',
      'draftkings': 'draftkings',
      'betmgm': 'betmgm',
      'caesars': 'caesars',
      'pointsbet': 'pointsbet',
      'barstool': 'barstool',
      'wynnbet': 'wynnbet',
      'unibet': 'unibet',
      'bovada': 'bovada',
      'betonlineag': 'betonline',
    };

    return mapping[key.toLowerCase()] || key.toLowerCase();
  }
}

