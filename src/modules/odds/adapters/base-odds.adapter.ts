import { Logger } from '@nestjs/common';

export interface OddsData {
  eventExternalId: string;
  sportType: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  startTime: Date;
  markets: MarketOdds[];
}

export interface MarketOdds {
  marketType: string;
  parameters?: Record<string, any>;
  outcomes: OutcomeOdds[];
}

export interface OutcomeOdds {
  outcome: string;
  sportsbook: string;
  oddsAmerican: number;
  oddsDecimal: number;
}

export abstract class BaseOddsAdapter {
  protected readonly logger: Logger;

  constructor(loggerContext: string) {
    this.logger = new Logger(loggerContext);
  }

  /**
   * Fetch odds for a specific sport/league
   */
  abstract fetchOdds(sport: string, league?: string): Promise<OddsData[]>;

  /**
   * Fetch odds for a specific event
   */
  abstract fetchEventOdds(eventId: string): Promise<OddsData | null>;

  /**
   * Map provider-specific team names to canonical names
   */
  abstract mapTeamName(providerName: string, sport: string, league: string): Promise<string>;

  /**
   * Get supported sports and leagues
   */
  abstract getSupportedSports(): string[];

  /**
   * Validate API connectivity and credentials
   */
  abstract healthCheck(): Promise<boolean>;
}

