/**
 * Odds conversion utilities
 */

import * as crypto from 'crypto';

/**
 * Convert American odds to decimal
 */
export function americanToDecimal(american: number): number {
  if (american > 0) {
    return Number((american / 100 + 1).toFixed(4));
  } else {
    return Number((100 / Math.abs(american) + 1).toFixed(4));
  }
}

/**
 * Convert decimal odds to American
 */
export function decimalToAmerican(decimal: number): number {
  if (decimal >= 2.0) {
    return Math.round((decimal - 1) * 100);
  } else {
    return Math.round(-100 / (decimal - 1));
  }
}

/**
 * Calculate implied probability from American odds
 */
export function impliedProbability(american: number): number {
  if (american > 0) {
    return Number((100 / (american + 100)).toFixed(4));
  } else {
    return Number((Math.abs(american) / (Math.abs(american) + 100)).toFixed(4));
  }
}

/**
 * Calculate juice/vig from two-way market odds
 */
export function calculateJuice(side1American: number, side2American: number): number {
  const prob1 = impliedProbability(side1American);
  const prob2 = impliedProbability(side2American);
  return Number(((prob1 + prob2 - 1) * 100).toFixed(2));
}

/**
 * Calculate expected value (EV) percentage
 */
export function calculateEV(odds: number, trueProbability: number): number {
  const decimal = americanToDecimal(odds);
  return Number(((trueProbability * decimal - 1) * 100).toFixed(2));
}

/**
 * Calculate Closing Line Value (CLV)
 * @param betOdds - The odds when the bet was placed
 * @param closingOdds - The odds when the line closed
 * @returns CLV as a percentage
 */
export function calculateCLV(betOdds: number, closingOdds: number): number {
  const betDecimal = americanToDecimal(betOdds);
  const closingDecimal = americanToDecimal(closingOdds);
  return Number((((betDecimal - closingDecimal) / closingDecimal) * 100).toFixed(2));
}

/**
 * Determine if odds represent +EV
 */
export function isPositiveEV(odds: number, trueProbability: number): boolean {
  return calculateEV(odds, trueProbability) > 0;
}

/**
 * Find best odds from multiple sportsbooks
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
