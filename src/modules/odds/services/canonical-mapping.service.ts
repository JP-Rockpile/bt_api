import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';

@Injectable()
export class CanonicalMappingService {
  private readonly logger = new Logger(CanonicalMappingService.name);
  private sportsbookCache: Map<string, any> = new Map();

  constructor(private prisma: PrismaService) {
    this.loadSportsbookMappings();
  }

  private async loadSportsbookMappings() {
    const sportsbooks = await this.prisma.sportsbook.findMany();
    sportsbooks.forEach((book) => {
      if (book.providerKey) {
        this.sportsbookCache.set(book.providerKey, book);
      }
    });
    this.logger.log(`Loaded ${sportsbooks.length} sportsbook mappings`);
  }

  mapSportsbook(providerKey: string, provider: string): any | null {
    const cacheKey = `${provider}:${providerKey}`;
    return this.sportsbookCache.get(cacheKey) || null;
  }

  mapMarketType(providerMarketType: string): string {
    const mappings: Record<string, string> = {
      // Unabated
      'moneyline': 'MONEYLINE',
      'spread': 'SPREAD',
      'total': 'TOTAL',
      'prop': 'PROP',
      
      // The Odds API
      'h2h': 'MONEYLINE',
      'spreads': 'SPREAD',
      'totals': 'TOTAL',
    };

    return mappings[providerMarketType.toLowerCase()] || 'MONEYLINE';
  }

  async findCanonicalTeam(teamName: string, sport: string, league: string) {
    // Try exact match first
    let team = await this.prisma.canonicalTeam.findFirst({
      where: {
        canonicalName: teamName,
        sport,
        league,
      },
    });

    if (team) return team;

    // Try aliases
    team = await this.prisma.canonicalTeam.findFirst({
      where: {
        sport,
        league,
        aliases: {
          has: teamName,
        },
      },
    });

    if (team) return team;

    // Try fuzzy match (simple contains)
    const teams = await this.prisma.canonicalTeam.findMany({
      where: { sport, league },
    });

    for (const t of teams) {
      if (
        t.canonicalName.toLowerCase().includes(teamName.toLowerCase()) ||
        teamName.toLowerCase().includes(t.canonicalName.toLowerCase())
      ) {
        return t;
      }
    }

    this.logger.warn(`No canonical mapping found for team: ${teamName} (${sport}/${league})`);
    return null;
  }
}

