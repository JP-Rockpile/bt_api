import { Injectable, Logger } from '@nestjs/common';
import { buildDeepLink, supportsDeepLinking } from '@betthink/shared';
import type { MarketType } from '@betthink/shared';

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
    providerKey: string;
    deepLinkTemplate?: string;
  };
  event: {
    externalIds?: Record<string, string>;
  };
  market: {
    marketType: string;
  };
  selectedOutcome: string;
  americanOdds: number;
  stake: number;
}

@Injectable()
export class DeepLinkService {
  private readonly logger = new Logger(DeepLinkService.name);

  /**
   * Generate sportsbook-specific deep link using shared package utilities
   */
  generateDeepLink(bet: BetWithRelations): string | null {
    const sportsbook = bet.sportsbook;
    const sportsbookId = sportsbook.providerKey.toLowerCase();

    try {
      // Get the event ID for this sportsbook
      const eventId = bet.event.externalIds?.[sportsbook.providerKey];

      // Check if the shared package supports this sportsbook
      if (supportsDeepLinking(sportsbookId)) {
        const params: DeepLinkParams = {
          eventId,
          marketType: bet.market.marketType as MarketType,
          selection: bet.selectedOutcome,
          odds: bet.americanOdds,
          stake: bet.stake,
        };

        const result = buildDeepLink(sportsbookId, params);
        
        if (result) {
          this.logger.log(
            `Generated deep link for ${sportsbook.name} (${result.scheme}): ${result.url}`
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

      // Replace template variables
      deepLink = deepLink.replace(
        '{eventId}',
        bet.event.externalIds?.[sportsbook.providerKey] || '',
      );
      deepLink = deepLink.replace('{marketType}', bet.market.marketType.toLowerCase());
      deepLink = deepLink.replace('{outcome}', encodeURIComponent(bet.selectedOutcome));
      deepLink = deepLink.replace('{odds}', bet.americanOdds.toString());
      deepLink = deepLink.replace('{stake}', bet.stake.toString());

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
    const sportsbookId = sportsbook.providerKey.toLowerCase();

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
