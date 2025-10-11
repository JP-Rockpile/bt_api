/**
 * Odds conversion utilities - Re-exported from @betthink/shared
 * 
 * This file wraps utilities from the shared package in a class-based API
 * for backward compatibility with existing code that uses OddsUtils.method()
 */

import * as crypto from 'crypto';
import {
  americanToDecimal as _americanToDecimal,
  decimalToAmerican as _decimalToAmerican,
  americanToImpliedProbability,
  americanToFractional,
  calculateTwoWayMargin,
  calculateExpectedValue,
} from '@betthink/shared';
import type { Odds } from '@betthink/shared';

// Helper function to convert American odds to full Odds object
function convertAmericanToOdds(american: number): Odds {
  return {
    american,
    decimal: _americanToDecimal(american),
    fractional: americanToFractional(american),
    impliedProbability: americanToImpliedProbability(american),
  };
}

export class OddsUtils {
  /**
   * Convert American odds to decimal
   */
  static americanToDecimal(american: number): number {
    return _americanToDecimal(american);
  }

  /**
   * Convert decimal odds to American
   */
  static decimalToAmerican(decimal: number): number {
    return _decimalToAmerican(decimal);
  }

  /**
   * Calculate implied probability from American odds
   */
  static impliedProbability(american: number): number {
    return americanToImpliedProbability(american);
  }

  /**
   * Calculate juice/vig from two-way market odds
   */
  static calculateJuice(side1American: number, side2American: number): number {
    const result = calculateTwoWayMargin(
      { american: side1American } as any,
      { american: side2American } as any
    );
    return result.marginPercentage;
  }

  /**
   * Calculate expected value (EV) percentage
   */
  static calculateEV(odds: number, trueProbability: number): number {
    const oddsObj = convertAmericanToOdds(odds);
    const result = calculateExpectedValue(oddsObj, trueProbability, 100);
    return result.evPercentage;
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
