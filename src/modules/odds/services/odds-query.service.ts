import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OddsService } from '../odds.service';
import { EventsService } from '../../events/events.service';
import { GetBestPriceDto } from '../dto';
import { PrismaService } from '../../../common/database/prisma.service';
import { TeamMappingUtils } from '../../../common/utils/team-mapping.utils';

@Injectable()
export class OddsQueryService {
  private readonly logger = new Logger(OddsQueryService.name);

  constructor(
    private readonly odds: OddsService,
    private readonly events: EventsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Find team by name using fuzzy matching with team_mappings table
   * Checks canonical names and aliases
   */
  async findTeamByName(teamName: string, league: string): Promise<string | null> {
    // Normalize the input
    const normalizedInput = TeamMappingUtils.normalize(teamName);

    // First, try direct match on canonical name (case-insensitive)
    const directMatch = await this.prisma.teamMapping.findFirst({
      where: {
        league,
        canonicalName: {
          contains: teamName,
          mode: 'insensitive',
        },
      },
    });

    if (directMatch) {
      this.logger.debug(`Direct match found: ${teamName} -> ${directMatch.canonicalName}`);
      return directMatch.canonicalName;
    }

    // Get all team mappings for the league
    const allMappings = await this.prisma.teamMapping.findMany({
      where: { league },
    });

    // Check aliases in the JSON field
    for (const mapping of allMappings) {
      const aliases = mapping.aliases as any;
      
      // Check provider-specific aliases (unabated, theodds, etc.)
      if (aliases && typeof aliases === 'object') {
        const allAliases: string[] = [];
        
        // Collect all alias values
        for (const key of Object.keys(aliases)) {
          if (key === 'variants' && Array.isArray(aliases.variants)) {
            allAliases.push(...aliases.variants);
          } else if (typeof aliases[key] === 'string') {
            allAliases.push(aliases[key]);
          }
        }
        
        // Check if any alias matches (case-insensitive)
        for (const alias of allAliases) {
          if (typeof alias === 'string' && alias.toLowerCase().includes(teamName.toLowerCase())) {
            this.logger.debug(`Alias match found: ${teamName} -> ${mapping.canonicalName} (via ${alias})`);
            return mapping.canonicalName;
          }
        }
      }
    }

    // Fall back to fuzzy matching
    const canonicalNames = allMappings.map((m) => {
      const aliases = m.aliases as any;
      const variants = aliases?.variants || [];
      return {
        name: m.canonicalName,
        aliases: Array.isArray(variants) ? variants : [],
      };
    });

    const bestMatch = TeamMappingUtils.findBestMatch(teamName, canonicalNames, 0.7); // Lower threshold for better matching

    if (bestMatch) {
      this.logger.debug(
        `Fuzzy match found: ${teamName} -> ${bestMatch.name} (score: ${bestMatch.score})`,
      );
      return bestMatch.name;
    }

    this.logger.warn(`No team mapping found for "${teamName}" in league ${league}`);
    return null;
  }

  async getBestPrice(dto: GetBestPriceDto) {
    // Parse date or default to today
    const targetDate = dto.date ? new Date(dto.date) : new Date();
    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

    // Use fuzzy team name matching to find canonical team names
    const canonicalTeam = await this.findTeamByName(dto.team, dto.league);
    const canonicalOpponent = dto.opponent
      ? await this.findTeamByName(dto.opponent, dto.league)
      : null;

    // Find events matching league + date
    const eventsForDay = (await this.events.findAll({
      sport: dto.league,
      startDate: start,
      endDate: end,
      status: 'SCHEDULED',
    })) as any[];

    // Match using canonical names with fallback to direct name matching
    const candidate = eventsForDay.find((e: any) => {
      const homeTeam = e.homeTeamCanonical || e.homeTeam || '';
      const awayTeam = e.awayTeamCanonical || e.awayTeam || '';

      // Try matching with canonical name first
      let matchesTeam = false;
      if (canonicalTeam) {
        matchesTeam =
          homeTeam.toLowerCase().includes(canonicalTeam.toLowerCase()) ||
          awayTeam.toLowerCase().includes(canonicalTeam.toLowerCase());
      }

      // Fallback to direct string matching if no canonical match
      if (!matchesTeam) {
        const teamLower = dto.team.toLowerCase();
        matchesTeam =
          homeTeam.toLowerCase().includes(teamLower) ||
          awayTeam.toLowerCase().includes(teamLower);
      }

      if (!dto.opponent) return matchesTeam;

      // Match opponent if provided
      let matchesOpponent = false;
      if (canonicalOpponent) {
        matchesOpponent =
          homeTeam.toLowerCase().includes(canonicalOpponent.toLowerCase()) ||
          awayTeam.toLowerCase().includes(canonicalOpponent.toLowerCase());
      }

      // Fallback for opponent
      if (!matchesOpponent) {
        const oppLower = dto.opponent.toLowerCase();
        matchesOpponent =
          homeTeam.toLowerCase().includes(oppLower) || awayTeam.toLowerCase().includes(oppLower);
      }

      return matchesTeam && matchesOpponent;
    });

    if (!candidate) {
      throw new NotFoundException(
        `No ${dto.league} game found for ${dto.team}${dto.opponent ? ` vs ${dto.opponent}` : ''} on ${dto.date || 'today'}`,
      );
    }

    // Load odds for the event
    const eventOdds = await this.odds.getEventOdds(candidate.id);

    // Map market type
    const marketTypeMap: Record<string, string> = {
      moneyline: 'MONEYLINE',
      spread: 'SPREAD',
      total: 'TOTAL_OVER', // or TOTAL_UNDER; for simplicity pick one or return both
    };
    const marketType = marketTypeMap[dto.market];

    const market = eventOdds.markets.find((m: any) => m.marketType === marketType);

    if (!market) {
      throw new NotFoundException(
        `No ${dto.market} market available for ${eventOdds.event.awayTeam} @ ${eventOdds.event.homeTeam}`,
      );
    }

    // Build response with best odds per outcome
    const bestOdds: Record<string, any> = {};
    for (const [outcome, best] of Object.entries(market.bestOdds || {})) {
      if (best && typeof best === 'object' && 'odds' in best && 'sportsbook' in best) {
        bestOdds[outcome] = {
          outcome,
          sportsbook: best.sportsbook,
          oddsAmerican: best.odds,
        };
      }
    }

    return {
      event: {
        id: eventOdds.event.id,
        league: eventOdds.event.league,
        homeTeam: eventOdds.event.homeTeam,
        awayTeam: eventOdds.event.awayTeam,
        startTime: eventOdds.event.startTime,
      },
      market: {
        id: market.marketId,
        type: dto.market,
        bestOdds,
      },
    };
  }
}

