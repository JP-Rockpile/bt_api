/**
 * Odds conversion utilities - Re-exported from @betthink/shared
 *
 * This file re-exports utilities from the shared package for backward compatibility
 * and adds any API-specific utilities that don't belong in the shared package.
 */

import * as crypto from 'crypto';

// Re-export odds conversion utilities from shared package
export {
  americanToDecimal,
  decimalToAmerican,
  americanToImpliedProbability as impliedProbability,
  calculateClosingLineValue,
  calculateExpectedValue,
  calculateClosingLineValue as calculateCLV,
} from '@betthink/shared';

// Import for local use
import {
  calculateTwoWayMargin,
  americanToDecimal as _americanToDecimal,
  americanToFractional,
  americanToImpliedProbability,
  calculateExpectedValue as _calculateExpectedValue,
  type Odds,
} from '@betthink/shared';

/**
 * Calculate juice/vig from two-way market odds
 * Note: This wraps the shared package's vig calculation utilities
 */
export function calculateJuice(side1American: number, side2American: number): number {
  const result = calculateTwoWayMargin(
    { american: side1American, decimal: 0, fractional: '', impliedProbability: 0 } as Odds,
    { american: side2American, decimal: 0, fractional: '', impliedProbability: 0 } as Odds,
  );
  return result.marginPercentage;
}

/**
 * Calculate expected value (EV) percentage
 * This is a convenience wrapper around the shared package's calculateExpectedValue
 */
export function calculateEV(odds: number, trueProbability: number): number {
  const oddsObj: Odds = {
    american: odds,
    decimal: _americanToDecimal(odds),
    fractional: americanToFractional(odds),
    impliedProbability: americanToImpliedProbability(odds),
  };
  const result = _calculateExpectedValue(oddsObj, trueProbability, 100);
  return result.evPercentage;
}

/**
 * Determine if odds represent +EV
 */
export function isPositiveEV(odds: number, trueProbability: number): boolean {
  return calculateEV(odds, trueProbability) > 0;
}

/**
 * Find best odds from multiple sportsbooks
 * API-specific utility - doesn't belong in shared package
 */
export function findBestOdds(oddsArray: Array<{ sportsbook: string; odds: number }>): {
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
 * API-specific utility for database operations
 */
export function createSnapshotHash(
  marketId: string,
  sportsbookId: string,
  outcome: string,
  odds: number,
): string {
  const data = `${marketId}:${sportsbookId}:${outcome}:${odds}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}
