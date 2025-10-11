/**
 * Team name normalization and fuzzy matching utilities
 * Uses bt_shared canonicalization where applicable
 */

import {
  normalizeString,
  canonicalizeTeamName,
  canonicalizeLeagueName,
  fuzzyMatchTeam,
} from '@betthink/shared';

// Re-export shared utilities
export { normalizeString, canonicalizeTeamName, canonicalizeLeagueName, fuzzyMatchTeam };

export class TeamMappingUtils {
  /**
   * Normalize team name for comparison
   * @deprecated Use normalizeString from bt_shared instead
   */
  static normalize(teamName: string): string {
    return normalizeString(teamName);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  static levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
        }
      }
    }

    return dp[m][n];
  }

  /**
   * Calculate similarity score (0-1) using Levenshtein distance
   */
  static similarityScore(str1: string, str2: string): number {
    const normalized1 = this.normalize(str1);
    const normalized2 = this.normalize(str2);

    const maxLength = Math.max(normalized1.length, normalized2.length);
    if (maxLength === 0) return 1.0;

    const distance = this.levenshteinDistance(normalized1, normalized2);
    return 1 - distance / maxLength;
  }

  /**
   * Find best match from a list of canonical names
   */
  static findBestMatch(
    providerName: string,
    canonicalNames: Array<{ name: string; aliases?: string[] }>,
    threshold: number = 0.85,
  ): { name: string; score: number } | null {
    let bestMatch: { name: string; score: number } | null = null;

    for (const canonical of canonicalNames) {
      // Check direct name match
      const nameScore = this.similarityScore(providerName, canonical.name);

      if (nameScore > (bestMatch?.score || 0)) {
        bestMatch = { name: canonical.name, score: nameScore };
      }

      // Check aliases if available
      if (canonical.aliases) {
        for (const alias of canonical.aliases) {
          const aliasScore = this.similarityScore(providerName, alias);
          if (aliasScore > (bestMatch?.score || 0)) {
            bestMatch = { name: canonical.name, score: aliasScore };
          }
        }
      }
    }

    // Return only if above threshold
    return bestMatch && bestMatch.score >= threshold ? bestMatch : null;
  }

  /**
   * Extract common abbreviations
   */
  static extractAbbreviation(teamName: string): string {
    const words = teamName.split(' ');
    return words
      .map((word) => word[0])
      .join('')
      .toUpperCase();
  }
}
