import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DeepLinkService {
  private readonly logger = new Logger(DeepLinkService.name);

  /**
   * Generate sportsbook-specific deep link
   * Each sportsbook has its own URL scheme and parameters
   */
  generateDeepLink(bet: any): string {
    const sportsbook = bet.sportsbook;

    if (!sportsbook.deepLinkTemplate) {
      this.logger.warn(`No deep link template for sportsbook: ${sportsbook.name}`);
      return null;
    }

    try {
      // Replace template variables
      let deepLink = sportsbook.deepLinkTemplate;

      // Common replacements
      deepLink = deepLink.replace('{eventId}', bet.event.externalIds?.[sportsbook.providerKey] || '');
      deepLink = deepLink.replace('{marketType}', bet.market.marketType.toLowerCase());
      deepLink = deepLink.replace('{outcome}', encodeURIComponent(bet.selectedOutcome));
      deepLink = deepLink.replace('{odds}', bet.americanOdds.toString());
      deepLink = deepLink.replace('{stake}', bet.stake.toString());

      // Sportsbook-specific logic
      if (sportsbook.name.toLowerCase().includes('draftkings')) {
        deepLink = this.generateDraftKingsLink(bet);
      } else if (sportsbook.name.toLowerCase().includes('fanduel')) {
        deepLink = this.generateFanDuelLink(bet);
      } else if (sportsbook.name.toLowerCase().includes('betmgm')) {
        deepLink = this.generateBetMGMLink(bet);
      }

      this.logger.log(`Generated deep link for ${sportsbook.name}: ${deepLink}`);
      return deepLink;
    } catch (error) {
      this.logger.error(`Failed to generate deep link: ${error.message}`);
      return null;
    }
  }

  private generateDraftKingsLink(bet: any): string {
    // DraftKings deep link format
    const eventId = bet.event.externalIds?.draftkings || '';
    const baseUrl = 'draftkings://sportsbook';
    return `${baseUrl}/event/${eventId}?market=${bet.market.marketType}&selection=${bet.selectedOutcome}`;
  }

  private generateFanDuelLink(bet: any): string {
    // FanDuel deep link format
    const eventId = bet.event.externalIds?.fanduel || '';
    const baseUrl = 'fanduel://sportsbook';
    return `${baseUrl}/event/${eventId}?bet=${bet.selectedOutcome}`;
  }

  private generateBetMGMLink(bet: any): string {
    // BetMGM deep link format
    const eventId = bet.event.externalIds?.betmgm || '';
    const baseUrl = 'betmgm://sports';
    return `${baseUrl}/event/${eventId}?selection=${bet.selectedOutcome}`;
  }

  /**
   * Generate a fallback web link if deep linking fails
   */
  generateWebLink(bet: any): string {
    const sportsbook = bet.sportsbook;
    
    // Most sportsbooks have a web interface
    // This is a fallback for when deep links aren't supported
    return `https://${sportsbook.name.toLowerCase().replace(/\s+/g, '')}.com/sports`;
  }
}

