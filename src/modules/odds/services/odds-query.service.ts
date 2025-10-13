import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OddsService } from '../odds.service';
import { EventsService } from '../../events/events.service';
import { GetBestPriceDto } from '../dto';

@Injectable()
export class OddsQueryService {
  private readonly logger = new Logger(OddsQueryService.name);

  constructor(
    private readonly odds: OddsService,
    private readonly events: EventsService,
  ) {}

  async getBestPrice(dto: GetBestPriceDto) {
    // Parse date or default to today
    const targetDate = dto.date ? new Date(dto.date) : new Date();
    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

    // Find events matching league + date
    const eventsForDay = await this.events.findAll({
      sport: dto.league,
      startDate: start,
      endDate: end,
      status: 'SCHEDULED',
    });

    // Fuzzy match team (home or away)
    const teamLower = dto.team.toLowerCase();
    const candidate = eventsForDay.find((e: any) => {
      const ht = (e.homeTeamCanonical || e.homeTeam || '').toLowerCase();
      const at = (e.awayTeamCanonical || e.awayTeam || '').toLowerCase();
      const matchesTeam = ht.includes(teamLower) || at.includes(teamLower);

      if (!dto.opponent) return matchesTeam;

      const oppLower = dto.opponent.toLowerCase();
      const matchesOpponent = ht.includes(oppLower) || at.includes(oppLower);
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

