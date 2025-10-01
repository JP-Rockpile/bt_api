import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BaseOddsAdapter, OddsData, MarketOdds } from './base-odds.adapter';
import { OddsUtils } from '../../../common/utils/odds.utils';
import { TeamMappingUtils } from '../../../common/utils/team-mapping.utils';
import { PrismaService } from '../../../common/database/prisma.service';

@Injectable()
export class UnabatedAdapter extends BaseOddsAdapter {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
    private prisma: PrismaService,
  ) {
    super('UnabatedAdapter');
    this.apiKey = this.configService.get<string>('oddsProviders.unabated.apiKey');
    this.baseUrl = this.configService.get<string>('oddsProviders.unabated.baseUrl');
  }

  async fetchOdds(sport: string, league?: string): Promise<OddsData[]> {
    try {
      const url = `${this.baseUrl}/odds`;
      const params: any = {
        sport: sport.toLowerCase(),
      };

      if (league) {
        params.league = league;
      }

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json',
          },
          params,
        }),
      );

      return this.transformUnabatedResponse(response.data);
    } catch (error) {
      this.logger.error(`Failed to fetch odds from Unabated: ${error.message}`, error.stack);
      throw error;
    }
  }

  async fetchEventOdds(eventId: string): Promise<OddsData | null> {
    try {
      const url = `${this.baseUrl}/odds/event/${eventId}`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json',
          },
        }),
      );

      const transformed = this.transformUnabatedResponse([response.data]);
      return transformed[0] || null;
    } catch (error) {
      this.logger.error(
        `Failed to fetch event odds from Unabated: ${error.message}`,
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
              path: ['unabated'],
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

    // If no match found, return original name and log for manual review
    this.logger.warn(
      `No mapping found for team '${providerName}' in ${sport}/${league}. Using original name.`,
    );
    return providerName;
  }

  getSupportedSports(): string[] {
    return ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB', 'SOCCER'];
  }

  async healthCheck(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/health`;
      await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
          timeout: 5000,
        }),
      );
      return true;
    } catch (error) {
      this.logger.error(`Unabated health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Transform Unabated API response to our internal format
   */
  private async transformUnabatedResponse(data: any[]): Promise<OddsData[]> {
    const results: OddsData[] = [];

    for (const event of data) {
      try {
        // Map team names to canonical format
        const homeTeamCanonical = await this.mapTeamName(
          event.home_team,
          event.sport,
          event.league,
        );
        const awayTeamCanonical = await this.mapTeamName(
          event.away_team,
          event.sport,
          event.league,
        );

        const markets: MarketOdds[] = [];

        // Process moneyline
        if (event.markets?.moneyline) {
          markets.push({
            marketType: 'MONEYLINE',
            outcomes: this.extractOutcomes(event.markets.moneyline, ['home', 'away']),
          });
        }

        // Process spreads
        if (event.markets?.spreads) {
          for (const spread of event.markets.spreads) {
            markets.push({
              marketType: 'SPREAD',
              parameters: { line: spread.line },
              outcomes: this.extractOutcomes(spread.odds, ['home', 'away']),
            });
          }
        }

        // Process totals
        if (event.markets?.totals) {
          for (const total of event.markets.totals) {
            markets.push({
              marketType: 'TOTAL_OVER',
              parameters: { line: total.line },
              outcomes: this.extractOutcomes(total.odds, ['over']),
            });
            markets.push({
              marketType: 'TOTAL_UNDER',
              parameters: { line: total.line },
              outcomes: this.extractOutcomes(total.odds, ['under']),
            });
          }
        }

        results.push({
          eventExternalId: event.id || event.event_id,
          sportType: event.sport.toUpperCase(),
          league: event.league.toUpperCase(),
          homeTeam: homeTeamCanonical,
          awayTeam: awayTeamCanonical,
          startTime: new Date(event.start_time || event.commence_time),
          markets,
        });
      } catch (error) {
        this.logger.error(`Failed to transform event: ${error.message}`, error.stack);
      }
    }

    return results;
  }

  /**
   * Extract outcome odds from Unabated format
   */
  private extractOutcomes(oddsData: any, outcomeKeys: string[]): any[] {
    const outcomes = [];

    for (const outcome of outcomeKeys) {
      if (!oddsData[outcome]) continue;

      for (const [sportsbook, odds] of Object.entries(oddsData[outcome])) {
        if (typeof odds === 'number') {
          outcomes.push({
            outcome,
            sportsbook: this.normalizeSportsbookName(sportsbook),
            oddsAmerican: odds,
            oddsDecimal: OddsUtils.americanToDecimal(odds),
          });
        }
      }
    }

    return outcomes;
  }

  /**
   * Normalize sportsbook names to match our database
   */
  private normalizeSportsbookName(name: string): string {
    const mapping: Record<string, string> = {
      'fanduel': 'fanduel',
      'draftkings': 'draftkings',
      'betmgm': 'betmgm',
      'caesars': 'caesars',
      'pointsbet': 'pointsbet',
      'barstool': 'barstool',
      'wynnbet': 'wynnbet',
      'unibet': 'unibet',
    };

    return mapping[name.toLowerCase()] || name.toLowerCase();
  }
}
