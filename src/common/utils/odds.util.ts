/**
 * Utility functions for odds calculations and conversions
 */

/**
 * Convert American odds to decimal odds
 */
export function americanToDecimal(americanOdds: number): number {
  if (americanOdds > 0) {
    return (americanOdds / 100) + 1;
  } else {
    return (100 / Math.abs(americanOdds)) + 1;
  }
}

/**
 * Convert decimal odds to American odds
 */
export function decimalToAmerican(decimalOdds: number): number {
  if (decimalOdds >= 2.0) {
    return Math.round((decimalOdds - 1) * 100);
  } else {
    return Math.round(-100 / (decimalOdds - 1));
  }
}

/**
 * Calculate implied probability from American odds
 */
export function impliedProbability(americanOdds: number): number {
  if (americanOdds > 0) {
    return 100 / (americanOdds + 100);
  } else {
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }
}

/**
 * Calculate juice (vig) from two-way market odds
 */
export function calculateJuice(odds1: number, odds2: number): number {
  const prob1 = impliedProbability(odds1);
  const prob2 = impliedProbability(odds2);
  return (prob1 + prob2 - 1) * 100;
}

/**
 * Calculate expected value (EV)
 */
export function calculateEV(
  stake: number,
  americanOdds: number,
  trueProbability: number,
): number {
  const decimalOdds = americanToDecimal(americanOdds);
  const payout = stake * decimalOdds;
  return trueProbability * payout - stake;
}

/**
 * Calculate potential payout from stake and odds
 */
export function calculatePayout(stake: number, americanOdds: number): number {
  const decimalOdds = americanToDecimal(americanOdds);
  return stake * decimalOdds;
}

/**
 * Find best odds from multiple sportsbooks
 */
export interface OddsOption {
  sportsbookId: string;
  sportsbookName: string;
  americanOdds: number;
  decimalOdds: number;
}

export function findBestOdds(options: OddsOption[]): OddsOption | null {
  if (options.length === 0) return null;
  
  return options.reduce((best, current) => {
    // Higher American odds are better (both positive and negative)
    // For negative odds, closer to 0 is better (-110 > -120)
    // For positive odds, higher is better (+150 > +120)
    if (current.americanOdds > 0 && best.americanOdds > 0) {
      return current.americanOdds > best.americanOdds ? current : best;
    } else if (current.americanOdds < 0 && best.americanOdds < 0) {
      return current.americanOdds > best.americanOdds ? current : best;
    } else {
      return current.americanOdds > best.americanOdds ? current : best;
    }
  });
}

/**
 * Identify positive EV opportunities
 */
export function identifyPlusEV(
  odds: OddsOption[],
  fairOdds: number,
  threshold: number = 0.02, // 2% edge
): OddsOption[] {
  const fairProb = impliedProbability(fairOdds);
  
  return odds.filter((option) => {
    const impliedProb = impliedProbability(option.americanOdds);
    const edge = fairProb - impliedProb;
    return edge >= threshold;
  });
}

/**
 * Calculate Closing Line Value (CLV)
 */
export function calculateCLV(betOdds: number, closingOdds: number): number {
  const betProb = impliedProbability(betOdds);
  const closingProb = impliedProbability(closingOdds);
  return ((closingProb - betProb) / betProb) * 100;
}

