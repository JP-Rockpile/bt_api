import { Injectable, Logger } from '@nestjs/common';
import { BetTypeRaw, MarketSourceRaw } from '../interfaces/unabated.interfaces';

@Injectable()
export class DataNormalizerService {
  private readonly logger = new Logger(DataNormalizerService.name);

  normalizeBetType(raw: BetTypeRaw) {
    return {
      id: raw.id,
      name: raw.name,
      description: raw.description || null,
      betOn: raw.betOn || null,
      sides: this.normalizeSidesField(raw.sides),
      canDraw: raw.canDraw || false,
      hasPoints: raw.hasPoints || false,
      selectionCount: raw.selectionCount || null,
      betRange: raw.betRange || null,
      isFuture: raw.isFuture || false,
      modifiedOn: raw.modifiedOn ? new Date(raw.modifiedOn) : null,
    };
  }

  /**
   * Normalize the sides field to a string or null
   * Handles both numeric and string values from the API
   */
  private normalizeSidesField(sides: any): string | null {
    if (sides === null || sides === undefined) {
      return null;
    }
    
    // Convert to string (handles both numbers and strings)
    return String(sides);
  }

  normalizeMarketSource(raw: MarketSourceRaw) {
    return {
      id: String(raw.id),
      name: raw.name,
      sourceType: raw.type || 'sportsbook',
      logoUrl: raw.logoUrl || null,
      thumbnailUrl: raw.thumbnailUrl || null,
      siteUrl: raw.siteUrl || null,
      isActive: raw.isActive !== false,
      statusId: raw.statusId || null,
      propsStatusId: raw.propsStatusId || null,
      futuresStatusId: raw.futuresStatusId || null,
      sourceMetadata: raw as any,
    };
  }

  extractEventsFromSnapshot(snapshotData: any, leagueId: string): any[] {
    const events = [];
    const seenEventIds = new Set<string>();

    const periodTypes = snapshotData.periodTypes || {};

    for (const [_periodTypeName, periodData] of Object.entries(periodTypes)) {
      if (typeof periodData !== 'object' || !periodData) continue;

      for (const timing of ['pregame', 'live']) {
        const timingData = (periodData as any)[timing] || {};

        for (const [eventKey, eventData] of Object.entries(timingData)) {
          if (typeof eventData !== 'object' || !eventData) continue;
          const event = eventData as any;

          const eventId = String(event.eventId);
          if (!eventId || seenEventIds.has(eventId)) continue;

          // Skip eventId=0 (futures don't have real events)
          if (eventId === '0') continue;

          const startTime = event.eventStart ? new Date(event.eventStart) : null;

          const eventTeams = event.eventTeams || {};
          let homeTeamId = null;
          let awayTeamId = null;

          for (const teamData of Object.values(eventTeams)) {
            if (typeof teamData !== 'object' || !teamData) continue;
            const team = teamData as any;
            const teamId = String(team.teamId);
            const sideIndex = team.sideIndex;

            if (sideIndex === 1) homeTeamId = teamId;
            else if (sideIndex === 0) awayTeamId = teamId;
          }

          const isLive = event.isLive || false;
          const statusId = event.statusId;
          let status = 'scheduled';
          if (isLive) status = 'live';
          else if (statusId === 2) status = 'final';

          events.push({
            id: eventId,
            leagueId: leagueId.toUpperCase(),
            startTime,
            homeTeamId,
            awayTeamId,
            status,
            eventMetadata: {
              eventName: event.eventName,
              betTypeId: event.betTypeId,
              statusId,
              isLive,
              key: eventKey,
            },
          });

          seenEventIds.add(eventId);
        }
      }
    }

    this.logger.debug(`Extracted ${events.length} events`);
    return events;
  }

  extractMarketLinesFromSnapshot(snapshotData: any, leagueId: string, marketType: string): any[] {
    const lines = [];
    const periodTypes = snapshotData.periodTypes || {};
    const isPropMarket = marketType.toLowerCase() === 'props';
    const isFuturesMarket = marketType.toLowerCase() === 'futures';

    for (const [periodTypeName, periodData] of Object.entries(periodTypes)) {
      if (typeof periodData !== 'object' || !periodData) continue;

      for (const timing of ['pregame', 'live']) {
        const timingData = (periodData as any)[timing] || {};

        for (const eventData of Object.values(timingData)) {
          if (typeof eventData !== 'object' || !eventData) continue;
          const event = eventData as any;

          const eventId = String(event.eventId);
          const betTypeId = event.betTypeId;
          const betSubType = event.betSubType || null;
          const sides = event.sides || {};

          for (const sideData of Object.values(sides)) {
            if (typeof sideData !== 'object' || !sideData) continue;
            const side = sideData as any;

            const sideIndex = side.sideIndex;
            const personId = side.personId ? String(side.personId) : null;
            const teamId = side.teamId ? String(side.teamId) : null;
            const sideName = side.sideName || null;

            // Determine outcome based on market type
            let outcome = 'unknown';
            if (isFuturesMarket) {
              // Futures: use sideName if available, otherwise use team/player info
              if (sideName) {
                outcome = sideName;
              } else if (teamId) {
                // For team futures with over/under (like season wins)
                if (sideIndex === 1) outcome = 'over';
                else if (sideIndex === 0) outcome = 'under';
              } else if (personId) {
                // For player futures (like MVP), outcome is just the selection
                outcome = 'win';
              }
            } else if (isPropMarket || personId) {
              // Props: sideIndex 1 = over/yes, sideIndex 0 = under/no
              if (sideIndex === 1) outcome = 'over';
              else if (sideIndex === 0) outcome = 'under';
            } else {
              // Straight markets: sideIndex 1 = home, sideIndex 0 = away
              if (sideIndex === 1) outcome = 'home';
              else if (sideIndex === 0) outcome = 'away';
            }

            const marketSourceLines = side.marketSourceLines || {};

            for (const [sourceId, lineData] of Object.entries(marketSourceLines)) {
              if (typeof lineData !== 'object' || !lineData) continue;
              const line = lineData as any;

              if (line.disabled) continue;

              const marketLineId = String(line.marketLineId);
              const price = line.price;
              const point = line.points;

              let decimalOdds = line.sourceFormat === 2 ? line.sourcePrice : null;
              if (!decimalOdds && price) {
                decimalOdds = price > 0 ? price / 100 + 1 : 100 / Math.abs(price) + 1;
              }

              const updatedAt = line.modifiedOn ? new Date(line.modifiedOn) : new Date();

              lines.push({
                id: marketLineId,
                eventId,
                sourceId: String(sourceId),
                marketType,
                periodType: periodTypeName,
                outcome,
                point,
                price,
                decimalOdds,
                isProp: isPropMarket,
                playerId: personId,
                betTypeId: betTypeId || null,
                betSubType: betSubType ? String(betSubType) : null,
                updatedAt,
              });
            }
          }
        }
      }
    }

    this.logger.debug(`Extracted ${lines.length} market lines`);
    return lines;
  }

  extractTeamsFromSnapshot(snapshotData: any, leagueId: string): any[] {
    const teams = new Map<string, any>();
    const periodTypes = snapshotData.periodTypes || {};

    for (const periodData of Object.values(periodTypes)) {
      if (typeof periodData !== 'object' || !periodData) continue;

      for (const timing of ['pregame', 'live']) {
        const timingData = (periodData as any)[timing] || {};

        for (const eventData of Object.values(timingData)) {
          if (typeof eventData !== 'object' || !eventData) continue;
          const event = eventData as any;

          const eventTeams = event.eventTeams || {};

          for (const teamData of Object.values(eventTeams)) {
            if (typeof teamData !== 'object' || !teamData) continue;
            const team = teamData as any;

            const teamId = String(team.teamId);
            if (teamId && !teams.has(teamId)) {
              teams.set(teamId, {
                id: teamId,
                name: `Team ${teamId}`,
                shortName: null,
                abbreviation: null,
                leagueId: leagueId.toUpperCase(),
              });
            }
          }
        }
      }
    }

    this.logger.debug(`Extracted ${teams.size} teams`);
    return Array.from(teams.values());
  }

  extractPlayersFromSnapshot(snapshotData: any, leagueId: string): any[] {
    const players = new Map<string, any>();
    const periodTypes = snapshotData.periodTypes || {};

    for (const periodData of Object.values(periodTypes)) {
      if (typeof periodData !== 'object' || !periodData) continue;

      for (const timing of ['pregame', 'live']) {
        const timingData = (periodData as any)[timing] || {};

        for (const eventData of Object.values(timingData)) {
          if (typeof eventData !== 'object' || !eventData) continue;
          const event = eventData as any;

          const playerPosition = event.playerPosition || null;
          const sides = event.sides || {};

          // Extract team information for player association
          const eventTeams = event.eventTeams || {};
          const teamIds = Object.values(eventTeams).map((t: any) => String(t.teamId));

          for (const sideData of Object.values(sides)) {
            if (typeof sideData !== 'object' || !sideData) continue;
            const side = sideData as any;

            const personId = side.personId;
            if (personId && !players.has(String(personId))) {
              // Try to determine which team the player belongs to
              // In props, both sides reference the same player, so we use the first team
              const teamId = teamIds.length > 0 ? teamIds[0] : null;

              players.set(String(personId), {
                id: String(personId),
                name: `Player ${personId}`, // Name not provided in odds API
                teamId,
                leagueId: leagueId.toUpperCase(),
                position: playerPosition,
              });
            }
          }
        }
      }
    }

    this.logger.debug(`Extracted ${players.size} players`);
    return Array.from(players.values());
  }
}
