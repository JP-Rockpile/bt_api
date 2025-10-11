/**
 * Central re-export of shared utilities for use across the API
 * 
 * This file provides a single import point for all shared utilities,
 * organized by category for easy discovery.
 * 
 * Updated for @betthink/shared v0.2.0
 */

// ============================================================================
// ODDS CONVERSION UTILITIES
// ============================================================================
export {
  // Format conversions
  americanToDecimal,
  americanToFractional,
  americanToImpliedProbability,
  decimalToAmerican,
  decimalToFractional,
  decimalToImpliedProbability,
  fractionalToAmerican,
  fractionalToDecimal,
  fractionalToImpliedProbability,
  impliedProbabilityToAmerican,
  impliedProbabilityToDecimal,
  impliedProbabilityToFractional,
  // Simplified converter (v0.2.0)
  convertOdds,
  convertToAllFormats,
  validateOdds,
} from '@betthink/shared';

// ============================================================================
// VIG & MARGIN CALCULATIONS
// ============================================================================
export {
  calculateOverround,
  calculateVigPercentage,
  calculateHoldPercentage,
  removeVigProportional,
  removeVigPower,
  removeVigAdditive,
  getFairOdds,
  getFairProbability,
  calculateTwoWayMargin,
  isLowVigMarket,
  calculateEffectiveVig,
} from '@betthink/shared';

// ============================================================================
// BETTING CALCULATIONS
// ============================================================================
export {
  calculateExpectedValue,
  calculateClosingLineValue,
  calculatePayout,
  calculateParlayOdds,
  calculateParlayProbability,
  detectArbitrage,
  calculateHedge,
  calculateBreakevenWinRate,
  calculateRequiredOdds,
  calculateROI,
} from '@betthink/shared';

// ============================================================================
// STAKE SIZING
// ============================================================================
export {
  calculateKellyCriterion,
  calculateFixedPercentageStake,
  calculateUnitStake,
  calculateFixedStake,
  calculateStake,
  validateStake,
  calculateRecommendedUnitSize,
} from '@betthink/shared';

// ============================================================================
// TEAM & LEAGUE CANONICALIZATION
// ============================================================================
export {
  normalizeString,
  canonicalizeTeamName,
  canonicalizeLeagueName,
  normalizePlayerName,
  levenshteinDistance,
  calculateSimilarity,
  fuzzyMatchTeam,
  fuzzyMatchLeague,
  registerTeamMapping,
  registerLeagueMapping,
  generateDisplayName,
  matchPlayerNames,
  parsePlayerName,
} from '@betthink/shared';

// ============================================================================
// DEEP LINKING
// ============================================================================
export {
  buildDeepLink,
  buildDeepLinkUrl, // v0.2.0 - Build custom deep links with query params
  supportsDeepLinking,
  getSupportedSportsbooks,
  deepLinkRegistry,
  DraftKingsDeepLinkBuilder,
  FanDuelDeepLinkBuilder,
  BetMGMDeepLinkBuilder,
  CaesarsDeepLinkBuilder,
  PointsBetDeepLinkBuilder,
  DeepLinkBuilder,
  DeepLinkRegistry,
} from '@betthink/shared';

// ============================================================================
// STRING UTILITIES (v0.2.0)
// ============================================================================
export {
  truncate,
  capitalize,
} from '@betthink/shared';

// ============================================================================
// VALIDATION UTILITIES (v0.2.0)
// ============================================================================
export {
  isValidEmail,
  isValidUUID,
} from '@betthink/shared';

// ============================================================================
// DATE/TIME UTILITIES (v0.2.0)
// ============================================================================
export {
  formatRelativeTime,
} from '@betthink/shared';

// ============================================================================
// ASYNC/RETRY UTILITIES (v0.2.0)
// ============================================================================
export {
  sleep,
  exponentialBackoff,
} from '@betthink/shared';

// ============================================================================
// PLATFORM DETECTION (v0.2.0)
// ============================================================================
export {
  isIOS,
  isAndroid,
} from '@betthink/shared';

// ============================================================================
// ERROR HANDLING
// ============================================================================
export {
  AppError,
  ValidationError,
  ApiError as ApiErrorClass,
  ConversionError,
  CalculationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  TimeoutError,
  isAppError,
  formatErrorResponse,
  sanitizeError, // v0.2.0 - Safe error extraction
} from '@betthink/shared';

