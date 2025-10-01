/**
 * Odds conversion utilities
 */

import * as crypto from 'crypto';

export class OddsUtils {
  /**
   * Convert American odds to decimal
   */
  static americanToDecimal(american: number): number {
    if (american > 0) {
      return Number((american / 100 + 1).toFixed(4));
    } else {
      return Number((100 / Math.abs(american) + 1).toFixed(4));
    }
  }

  /**
   * Convert decimal odds to American
   */
  static decimalToAmerican(decimal: number): number {
    if (decimal >= 2.0) {
      return Math.round((decimal - 1) * 100);
    } else {
      return Math.round(-100 / (decimal - 1));
    }
  }

  /**
   * Calculate implied probability from American odds
   */
  static impliedProbability(american: number): number {
    if (american > 0) {
      return Number((100 / (american + 100)).toFixed(4));
    } else {
      return Number((Math.abs(american) / (Math.abs(american) + 100)).toFixed(4));
    }
  }

  /**
   * Calculate juice/vig from two-way market odds
   */
  static calculateJuice(side1American: number, side2American: number): number {
    const prob1 = this.impliedProbability(side1American);
    const prob2 = this.impliedProbability(side2American);
    return Number(((prob1 + prob2 - 1) * 100).toFixed(2));
  }

  /**
   * Calculate expected value (EV) percentage
   */
  static calculateEV(odds: number, trueProbability: number): number {
    const decimal = this.americanToDecimal(odds);
    return Number(((trueProbability * decimal - 1) * 100).toFixed(2));
  }

  /**
   * Determine if odds represent +EV
   */
  static isPositiveEV(odds: number, trueProbability: number): boolean {
    return this.calculateEV(odds, trueProbability) > 0;
  }

  /**
   * Find best odds from multiple sportsbooks
   */
  static findBestOdds(oddsArray: Array<{ sportsbook: string; odds: number }>): {
    sportsbook: string;
    odds: number;
    advantage?: number;
  } | null {
    if (!oddsArray || oddsArray.length === 0) return null;

    const best = oddsArray.reduce((prev, current) => {
      return current.odds > prev.odds ? current : prev;
    });

    // Calculate advantage over average
    const avgOdds = oddsArray.reduce((sum, item) => sum + item.odds, 0) / oddsArray.length;
    const advantage = Number((((best.odds - avgOdds) / Math.abs(avgOdds)) * 100).toFixed(2));

    return {
      ...best,
      advantage,
    };
  }

  /**
   * Create a hash for deduplication
   */
  static createSnapshotHash(
    marketId: string,
    sportsbookId: string,
    outcome: string,
    odds: number,
  ): string {
    const data = `${marketId}:${sportsbookId}:${outcome}:${odds}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}
