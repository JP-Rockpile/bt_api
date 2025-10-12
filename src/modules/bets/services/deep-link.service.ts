import { Injectable, Logger } from '@nestjs/common';
import { buildDeepLink, supportsDeepLinking } from '@betthink/shared';
import type { MarketType } from '@betthink/shared';
import type { Prisma } from '@prisma/client';

// Define DeepLinkParams locally since it's not exported from main index
interface DeepLinkParams {
  eventId?: string;
  eventName?: string;
  marketType?: MarketType;
  selection?: string;
  stake?: number;
  odds?: number;
}

interface BetWithRelations {
  sportsbook: {
    name: string;
    key: string; // Prisma uses 'key', not 'providerKey'
    deepLinkTemplate?: string | null;
  };
  event: {
    externalIds?: Prisma.JsonValue;
  };
  market: {
    marketType: string;
  };
  selectedOutcome: string;
  oddsAmerican: number;
  stake: number | { toNumber(): number };
}

@Injectable()
export class DeepLinkService {
  private readonly logger = new Logger(DeepLinkService.name);

  /**
   * Generate sportsbook-specific deep link using shared package utilities
   */
  generateDeepLink(bet: BetWithRelations): string | null {
    const sportsbook = bet.sportsbook;
    const sportsbookId = sportsbook.key.toLowerCase();

    try {
      // Get the event ID for this sportsbook
      const externalIds = bet.event.externalIds as Record<string, unknown> | null | undefined;
      const eventId = externalIds?.[sportsbook.key] as string | undefined;

      // Check if the shared package supports this sportsbook
      if (supportsDeepLinking(sportsbookId)) {
        const stake = typeof bet.stake === 'number' ? bet.stake : bet.stake.toNumber();

        const params: DeepLinkParams = {
          eventId,
          marketType: bet.market.marketType as MarketType,
          selection: bet.selectedOutcome,
          odds: bet.oddsAmerican,
          stake,
        };

        const result = buildDeepLink(sportsbookId, params);

        if (result) {
          this.logger.log(
            `Generated deep link for ${sportsbook.name} (${result.scheme}): ${result.url}`,
          );
          if (result.notes) {
            this.logger.debug(`Deep link notes: ${result.notes}`);
          }
          return result.url;
        }
      }

      // Fallback to legacy template-based approach if not supported by shared package
      if (sportsbook.deepLinkTemplate && eventId) {
        return this.generateLegacyDeepLink(bet);
      }

      this.logger.warn(`No deep link support for sportsbook: ${sportsbook.name}`);
      return null;
    } catch (error) {
      this.logger.error(`Failed to generate deep link: ${error.message}`);
      return null;
    }
  }

  /**
   * Legacy deep link generation for sportsbooks not yet in shared package
   */
  private generateLegacyDeepLink(bet: BetWithRelations): string | null {
    const sportsbook = bet.sportsbook;

    if (!sportsbook.deepLinkTemplate) {
      return null;
    }

    try {
      let deepLink = sportsbook.deepLinkTemplate;
      const externalIds = bet.event.externalIds as Record<string, unknown> | null | undefined;
      const eventId = (externalIds?.[sportsbook.key] as string | undefined) || '';
      const stake = typeof bet.stake === 'number' ? bet.stake : bet.stake.toNumber();

      // Replace template variables
      deepLink = deepLink.replace('{eventId}', eventId);
      deepLink = deepLink.replace('{marketType}', bet.market.marketType.toLowerCase());
      deepLink = deepLink.replace('{outcome}', encodeURIComponent(bet.selectedOutcome));
      deepLink = deepLink.replace('{odds}', bet.oddsAmerican.toString());
      deepLink = deepLink.replace('{stake}', stake.toString());

      this.logger.log(`Generated legacy deep link for ${sportsbook.name}: ${deepLink}`);
      return deepLink;
    } catch (error) {
      this.logger.error(`Failed to generate legacy deep link: ${error.message}`);
      return null;
    }
  }

  /**
   * Generate a fallback web link if deep linking fails
   */
  generateWebLink(bet: BetWithRelations): string {
    const sportsbook = bet.sportsbook;
    const sportsbookId = sportsbook.key.toLowerCase();

    // Try to use the shared package's web domain
    if (supportsDeepLinking(sportsbookId)) {
      const result = buildDeepLink(sportsbookId, {});
      if (result) {
        return result.url;
      }
    }

    // Fallback to generic web URL
    return `https://${sportsbook.name.toLowerCase().replace(/\s+/g, '')}.com/sports`;
  }
}
