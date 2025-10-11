/**
 * @betthink/shared Package - Usage Examples
 * 
 * This file contains real-world examples of using the shared package
 * throughout the BetThink API. These examples demonstrate best practices
 * and common patterns.
 */

import {
  // Types
  type Odds,
  type Market,
  type Bet,
  type User,
  type RiskSettings,
  
  // Enums
  MarketType,
  BetStatus,
  
  // Odds Utilities
  americanToDecimal,
  calculateExpectedValue,
  calculatePayout,
  calculateKellyCriterion,
  calculateVigPercentage,
  isLowVigMarket,
  removeVigProportional,
  
  // Team Mapping
  canonicalizeTeamName,
  fuzzyMatchTeam,
  
  // Deep Linking
  buildDeepLink,
  supportsDeepLinking,
  
  // Error Handling
  ValidationError,
  NotFoundError,
  isAppError,
} from '@betthink/shared';

// ============================================================================
// EXAMPLE 1: Odds Conversion and Calculations
// ============================================================================

/**
 * Convert odds and calculate payout for a bet
 */
export function calculateBetPayout(americanOdds: number, stake: number) {
  // Convert American odds to all formats
  const odds: Odds = {
    american: americanOdds,
    decimal: americanToDecimal(americanOdds),
    fractional: '', // Optional if not needed
    impliedProbability: 0, // Will be calculated by utility
  };

  // Calculate potential payout
  const { profit, totalPayout } = calculatePayout(odds, stake);

  return {
    odds,
    stake,
    profit,
    totalPayout,
    roi: (profit / stake) * 100, // ROI percentage
  };
}

// Example usage:
// const payout = calculateBetPayout(-110, 100);
// console.log(`Betting $${payout.stake} at ${payout.odds.american} returns $${payout.profit} profit`);

// ============================================================================
// EXAMPLE 2: Expected Value (EV) Analysis
// ============================================================================

/**
 * Analyze a betting opportunity for expected value
 */
export function analyzeEV(
  americanOdds: number,
  userEstimatedWinProbability: number, // 0-1
  stake: number = 100
) {
  const odds: Odds = {
    american: americanOdds,
    decimal: americanToDecimal(americanOdds),
    fractional: '',
    impliedProbability: 0,
  };

  const { ev, evPercentage } = calculateExpectedValue(
    odds,
    userEstimatedWinProbability,
    stake
  );

  return {
    odds: americanOdds,
    bookmakerImpliedProb: 1 / odds.decimal,
    userEstimatedProb: userEstimatedWinProbability,
    edge: userEstimatedWinProbability - (1 / odds.decimal),
    ev,
    evPercentage,
    isPositiveEV: evPercentage > 0,
    recommendation: evPercentage > 5 ? 'STRONG BET' : 
                   evPercentage > 0 ? 'SLIGHT EDGE' : 
                   'AVOID',
  };
}

// Example usage:
// const analysis = analyzeEV(-110, 0.55); // You think 55% chance to win
// if (analysis.isPositiveEV) {
//   console.log(`+EV opportunity! Expected value: ${analysis.evPercentage.toFixed(2)}%`);
// }

// ============================================================================
// EXAMPLE 3: Kelly Criterion Stake Sizing
// ============================================================================

/**
 * Calculate optimal bet size using Kelly Criterion
 */
export function calculateOptimalStake(
  americanOdds: number,
  userWinProbability: number,
  bankroll: number,
  kellyFraction: number = 0.25 // Use quarter Kelly by default (conservative)
) {
  const odds: Odds = {
    american: americanOdds,
    decimal: americanToDecimal(americanOdds),
    fractional: '',
    impliedProbability: 0,
  };

  const kelly = calculateKellyCriterion(
    odds,
    userWinProbability,
    bankroll,
    kellyFraction
  );

  return {
    fullKellyStake: kelly.fullKellyStake,
    recommendedStake: kelly.recommendedStake,
    kellyPercentage: kelly.kellyPercentage,
    percentageOfBankroll: (kelly.recommendedStake / bankroll) * 100,
    warning: kelly.warning,
  };
}

// Example usage:
// const staking = calculateOptimalStake(-110, 0.55, 10000, 0.25);
// console.log(`Recommended stake: $${staking.recommendedStake.toFixed(2)} (${staking.percentageOfBankroll.toFixed(2)}% of bankroll)`);

// ============================================================================
// EXAMPLE 4: Vig Analysis and Fair Odds
// ============================================================================

/**
 * Analyze market vig and calculate fair odds
 */
export function analyzeMarketVig(americanOdds: number[]) {
  // Convert all odds
  const oddsArray: Odds[] = americanOdds.map(american => ({
    american,
    decimal: americanToDecimal(american),
    fractional: '',
    impliedProbability: 0,
  }));

  // Calculate vig
  const vigPercentage = calculateVigPercentage(oddsArray);
  const isLowVig = isLowVigMarket(oddsArray, 1.0); // 1% threshold

  // Remove vig to get fair probabilities
  const fairProbabilities = removeVigProportional(oddsArray);

  // Calculate fair odds (no vig)
  const fairOdds = fairProbabilities.map(prob => {
    const fairDecimal = 1 / prob;
    // Convert back to American
    const fairAmerican = fairDecimal >= 2.0
      ? Math.round((fairDecimal - 1) * 100)
      : Math.round(-100 / (fairDecimal - 1));
    return { prob, american: fairAmerican, decimal: fairDecimal };
  });

  return {
    vigPercentage,
    isLowVig,
    originalOdds: americanOdds,
    fairOdds,
    vigFreeMarket: vigPercentage < 1,
  };
}

// Example usage:
// const market = analyzeMarketVig([-110, -110]); // Typical two-way market
// console.log(`Market vig: ${market.vigPercentage.toFixed(2)}%`);
// console.log(`Fair odds: ${market.fairOdds[0].american} / ${market.fairOdds[1].american}`);

// ============================================================================
// EXAMPLE 5: Team Name Resolution
// ============================================================================

/**
 * Resolve provider team name to canonical ID
 */
export function resolveTeamName(providerTeamName: string): {
  canonicalId: string | null;
  confidence: number;
  method: 'exact' | 'fuzzy' | 'failed';
} {
  // Try exact match first
  const exact = canonicalizeTeamName(providerTeamName);
  if (exact) {
    return { canonicalId: exact, confidence: 1.0, method: 'exact' };
  }

  // Try fuzzy matching
  const fuzzy = fuzzyMatchTeam(providerTeamName, 0.85);
  if (fuzzy) {
    return {
      canonicalId: fuzzy.canonicalId,
      confidence: fuzzy.confidence,
      method: 'fuzzy',
    };
  }

  // Failed to resolve
  return { canonicalId: null, confidence: 0, method: 'failed' };
}

// Example usage:
// const result = resolveTeamName('LA Lakers');
// if (result.canonicalId) {
//   console.log(`Resolved to: ${result.canonicalId} (${result.method}, ${result.confidence * 100}% confidence)`);
// }

// ============================================================================
// EXAMPLE 6: Deep Link Generation
// ============================================================================

/**
 * Generate deep link for a bet
 */
export function generateBetDeepLink(
  sportsbookId: string,
  eventId: string,
  marketType: MarketType,
  selection: string,
  odds: number,
  stake: number
) {
  // Check if sportsbook supports deep linking
  if (!supportsDeepLinking(sportsbookId)) {
    return {
      supported: false,
      message: `Deep linking not supported for ${sportsbookId}`,
      fallbackUrl: `https://${sportsbookId}.com/sports`,
    };
  }

  // Build deep link
  const result = buildDeepLink(sportsbookId, {
    eventId,
    marketType,
    selection,
    odds,
    stake,
  });

  if (!result) {
    return {
      supported: true,
      success: false,
      message: 'Failed to generate deep link',
    };
  }

  return {
    supported: true,
    success: true,
    url: result.url,
    scheme: result.scheme,
    supportsPrePopulation: result.supportsPrePopulation,
    requiresAuth: result.requiresAuth,
    notes: result.notes,
  };
}

// Example usage:
// const link = generateBetDeepLink(
//   'draftkings',
//   'evt_12345',
//   MarketType.MONEYLINE,
//   'home',
//   -110,
//   50
// );
// if (link.success) {
//   console.log(`Open this link: ${link.url}`);
// }

// ============================================================================
// EXAMPLE 7: Complete Bet Analysis Pipeline
// ============================================================================

/**
 * Complete analysis of a betting opportunity
 */
export function analyzeBettingOpportunity(params: {
  americanOdds: number;
  userWinProbability: number;
  bankroll: number;
  maxBetPercentage: number;
  kellyFraction: number;
  stake?: number;
}) {
  const {
    americanOdds,
    userWinProbability,
    bankroll,
    maxBetPercentage,
    kellyFraction,
    stake,
  } = params;

  // Convert odds
  const odds: Odds = {
    american: americanOdds,
    decimal: americanToDecimal(americanOdds),
    fractional: '',
    impliedProbability: 0,
  };

  // Calculate EV
  const evAnalysis = calculateExpectedValue(odds, userWinProbability, 100);

  // Calculate Kelly stake
  const kellyStake = calculateKellyCriterion(
    odds,
    userWinProbability,
    bankroll,
    kellyFraction
  );

  // Apply risk limits
  const maxAllowedStake = (bankroll * maxBetPercentage) / 100;
  const recommendedStake = Math.min(kellyStake.recommendedStake, maxAllowedStake);
  const actualStake = stake || recommendedStake;

  // Calculate payout
  const { profit, totalPayout } = calculatePayout(odds, actualStake);

  return {
    // Odds info
    odds: {
      american: americanOdds,
      decimal: odds.decimal,
      impliedProbability: 1 / odds.decimal,
    },

    // EV analysis
    expectedValue: {
      ev: evAnalysis.ev,
      evPercentage: evAnalysis.evPercentage,
      isPositiveEV: evAnalysis.evPercentage > 0,
      edge: userWinProbability - (1 / odds.decimal),
    },

    // Stake sizing
    staking: {
      kellyStake: kellyStake.recommendedStake,
      kellyPercentage: kellyStake.kellyPercentage,
      maxAllowedStake,
      recommendedStake,
      actualStake,
      warning: kellyStake.warning,
    },

    // Payout calculation
    payout: {
      stake: actualStake,
      profit,
      totalPayout,
      roi: (profit / actualStake) * 100,
    },

    // Overall recommendation
    recommendation: {
      shouldBet: evAnalysis.evPercentage > 0 && actualStake <= maxAllowedStake,
      confidence:
        evAnalysis.evPercentage > 5
          ? 'HIGH'
          : evAnalysis.evPercentage > 2
          ? 'MEDIUM'
          : evAnalysis.evPercentage > 0
          ? 'LOW'
          : 'AVOID',
      reasoning: generateReasoning(evAnalysis.evPercentage, kellyStake.warning),
    },
  };
}

function generateReasoning(evPercentage: number, kellyWarning?: string): string {
  if (evPercentage > 5) {
    return 'Strong positive EV opportunity. Recommended bet.';
  } else if (evPercentage > 2) {
    return 'Moderate positive EV. Consider betting.';
  } else if (evPercentage > 0) {
    return 'Slight positive EV. Bet if confident in your analysis.';
  } else if (kellyWarning) {
    return `Negative EV. ${kellyWarning}`;
  } else {
    return 'Negative EV. Avoid this bet.';
  }
}

// Example usage:
/*
const analysis = analyzeBettingOpportunity({
  americanOdds: -110,
  userWinProbability: 0.55,
  bankroll: 10000,
  maxBetPercentage: 5,
  kellyFraction: 0.25,
});

console.log('Betting Opportunity Analysis:');
console.log('----------------------------');
console.log(`Odds: ${analysis.odds.american} (${(analysis.odds.impliedProbability * 100).toFixed(1)}% implied)`);
console.log(`Your Edge: ${(analysis.expectedValue.edge * 100).toFixed(2)}%`);
console.log(`Expected Value: ${analysis.expectedValue.evPercentage.toFixed(2)}%`);
console.log(`Recommended Stake: $${analysis.staking.recommendedStake.toFixed(2)}`);
console.log(`Potential Profit: $${analysis.payout.profit.toFixed(2)}`);
console.log(`Confidence: ${analysis.recommendation.confidence}`);
console.log(`Reasoning: ${analysis.recommendation.reasoning}`);
*/

// ============================================================================
// EXAMPLE 8: Error Handling
// ============================================================================

/**
 * Example of using shared error classes
 */
export async function validateBetRequest(betId: string, userId: string): Promise<Bet> {
  // Simulate database lookup
  const bet: Bet | null = null as any; // Replace with: await prisma.bet.findUnique(...)

  if (!bet) {
    throw new NotFoundError('Bet', betId);
  }

  if (bet.userId !== userId) {
    throw new ValidationError('Bet does not belong to user', {
      betId,
      userId,
      actualUserId: bet.userId,
    });
  }

  return bet;
}

// Usage in error handler:
/*
try {
  const bet = await validateBetRequest(betId, userId);
  // ... process bet
} catch (error) {
  if (isAppError(error)) {
    return {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      statusCode: error.statusCode,
    };
  }
  throw error;
}
*/

// ============================================================================
// EXPORT ALL EXAMPLES
// ============================================================================

export const examples = {
  calculateBetPayout,
  analyzeEV,
  calculateOptimalStake,
  analyzeMarketVig,
  resolveTeamName,
  generateBetDeepLink,
  analyzeBettingOpportunity,
  validateBetRequest,
};

