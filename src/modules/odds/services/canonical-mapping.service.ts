import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { Sportsbook } from '@prisma/client';

@Injectable()
export class CanonicalMappingService {
  private readonly logger = new Logger(CanonicalMappingService.name);
  private sportsbookCache: Map<
    string,
    { id: string; name: string; key: string; providerKey: string }
  > = new Map();

  constructor(private prisma: PrismaService) {
    this.loadSportsbookMappings();
  }

  private async loadSportsbookMappings() {
    const sportsbooks = await this.prisma.sportsbook.findMany();
    sportsbooks.forEach((book: Sportsbook) => {
      // Use key as fallback for providerKey if not available
      const providerKey = book.key;
      if (providerKey) {
        this.sportsbookCache.set(providerKey, {
          id: book.id,
          name: book.name,
          key: book.key,
          providerKey,
        });
      }
    });
    this.logger.log(`Loaded ${sportsbooks.length} sportsbook mappings`);
  }

  mapSportsbook(
    providerKey: string,
    provider: string,
  ): { id: string; name: string; key: string } | null {
    const cacheKey = `${provider}:${providerKey}`;
    return this.sportsbookCache.get(cacheKey) || null;
  }

  mapMarketType(providerMarketType: string): string {
    const mappings: Record<string, string> = {
      // Unabated
      moneyline: 'MONEYLINE',
      spread: 'SPREAD',
      total: 'TOTAL',
      prop: 'PROP',

      // The Odds API
      h2h: 'MONEYLINE',
      spreads: 'SPREAD',
      totals: 'TOTAL',
    };

    return mappings[providerMarketType.toLowerCase()] || 'MONEYLINE';
  }

  async findCanonicalTeam(teamName: string, sport: string, league: string) {
    // TODO: canonicalTeam model doesn't exist in schema yet
    // Return null for now until the model is added
    this.logger.warn(
      `canonicalTeam model not yet implemented, cannot find team: ${teamName} in ${sport}/${league}`,
    );
    return null;
  }
}
