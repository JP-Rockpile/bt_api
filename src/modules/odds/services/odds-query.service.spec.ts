import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OddsQueryService } from './odds-query.service';
import { OddsService } from '../odds.service';
import { EventsService } from '../../events/events.service';
import { PrismaService } from '../../../common/database/prisma.service';

describe('OddsQueryService', () => {
  let service: OddsQueryService;
  let prismaService: PrismaService;
  let eventsService: EventsService;
  let oddsService: OddsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OddsQueryService,
        {
          provide: OddsService,
          useValue: {
            getEventOdds: jest.fn(),
          },
        },
        {
          provide: EventsService,
          useValue: {
            findAll: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            teamMapping: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<OddsQueryService>(OddsQueryService);
    prismaService = module.get<PrismaService>(PrismaService);
    eventsService = module.get<EventsService>(EventsService);
    oddsService = module.get<OddsService>(OddsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findTeamByName', () => {
    it('should find team by direct canonical name match', async () => {
      const mockTeam = {
        id: 'team-1',
        canonicalName: 'Milwaukee Brewers',
        sport: 'MLB',
        league: 'MLB',
        aliases: { variants: ['Brewers', 'MIL'] },
        createdAt: new Date(),
        updatedAt: new Date(),
        logoUrl: null,
      };

      jest.spyOn(prismaService.teamMapping, 'findFirst').mockResolvedValue(mockTeam);

      const result = await service.findTeamByName('Brewers', 'MLB');

      expect(result).toBe('Milwaukee Brewers');
      expect(prismaService.teamMapping.findFirst).toHaveBeenCalledWith({
        where: {
          league: 'MLB',
          canonicalName: {
            contains: 'Brewers',
            mode: 'insensitive',
          },
        },
      });
    });

    it('should find team by alias match', async () => {
      const mockTeams = [
        {
          id: 'team-1',
          canonicalName: 'Milwaukee Brewers',
          sport: 'MLB',
          league: 'MLB',
          aliases: { variants: ['Brewers', 'MIL', 'Milwaukee'] },
          createdAt: new Date(),
          updatedAt: new Date(),
          logoUrl: null,
        },
      ];

      jest.spyOn(prismaService.teamMapping, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prismaService.teamMapping, 'findMany').mockResolvedValue(mockTeams);

      const result = await service.findTeamByName('MIL', 'MLB');

      expect(result).toBe('Milwaukee Brewers');
    });

    it('should use fuzzy matching when no direct or alias match found', async () => {
      const mockTeams = [
        {
          id: 'team-1',
          canonicalName: 'Chicago Cubs',
          sport: 'MLB',
          league: 'MLB',
          aliases: { variants: [] }, // Empty variants to force fuzzy matching
          createdAt: new Date(),
          updatedAt: new Date(),
          logoUrl: null,
        },
      ];

      jest.spyOn(prismaService.teamMapping, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prismaService.teamMapping, 'findMany').mockResolvedValue(mockTeams);

      // "Chicago Cobs" (typo) should fuzzy match to "Chicago Cubs" (very close similarity > 70%)
      const result = await service.findTeamByName('Chicago Cobs', 'MLB');

      expect(result).toBe('Chicago Cubs');
    });

    it('should return null when no match found', async () => {
      jest.spyOn(prismaService.teamMapping, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prismaService.teamMapping, 'findMany').mockResolvedValue([]);

      const result = await service.findTeamByName('NonExistentTeam', 'MLB');

      expect(result).toBeNull();
    });

    it('should be case-insensitive', async () => {
      const mockTeam = {
        id: 'team-1',
        canonicalName: 'Milwaukee Brewers',
        sport: 'MLB',
        league: 'MLB',
        aliases: { variants: ['Brewers'] },
        createdAt: new Date(),
        updatedAt: new Date(),
        logoUrl: null,
      };

      jest.spyOn(prismaService.teamMapping, 'findFirst').mockResolvedValue(mockTeam);

      const result = await service.findTeamByName('brewers', 'MLB');

      expect(result).toBe('Milwaukee Brewers');
    });
  });

  describe('getBestPrice', () => {
    it('should throw NotFoundException when no matching event found', async () => {
      jest.spyOn(service, 'findTeamByName').mockResolvedValue('Milwaukee Brewers');
      jest.spyOn(eventsService, 'findAll').mockResolvedValue([]);

      await expect(
        service.getBestPrice({
          league: 'MLB',
          team: 'Brewers',
          market: 'moneyline',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should find event using canonical team name', async () => {
      const mockEvent = {
        id: 'event-1',
        sportType: 'MLB',
        league: 'MLB',
        homeTeam: 'Milwaukee Brewers',
        awayTeam: 'Chicago Cubs',
        homeTeamCanonical: 'Milwaukee Brewers',
        awayTeamCanonical: 'Chicago Cubs',
        startTime: new Date(),
        status: 'SCHEDULED',
        markets: [],
      };

      const mockEventOdds = {
        event: mockEvent,
        markets: [
          {
            marketId: 'market-1',
            marketType: 'MONEYLINE',
            parameters: null,
            outcomes: {},
            bestOdds: {
              home: { sportsbook: 'fanduel', odds: -150 },
              away: { sportsbook: 'draftkings', odds: 130 },
            },
          },
        ],
      };

      jest.spyOn(service, 'findTeamByName').mockResolvedValue('Milwaukee Brewers');
      jest.spyOn(eventsService, 'findAll').mockResolvedValue([mockEvent] as any);
      jest.spyOn(oddsService, 'getEventOdds').mockResolvedValue(mockEventOdds as any);

      const result = await service.getBestPrice({
        league: 'MLB',
        team: 'Brewers',
        market: 'moneyline',
      });

      expect(result).toBeDefined();
      expect(result.event.homeTeam).toBe('Milwaukee Brewers');
      expect(result.market.type).toBe('moneyline');
    });

    it('should match with opponent when provided', async () => {
      const mockEvent = {
        id: 'event-1',
        sportType: 'MLB',
        league: 'MLB',
        homeTeam: 'Milwaukee Brewers',
        awayTeam: 'Chicago Cubs',
        homeTeamCanonical: 'Milwaukee Brewers',
        awayTeamCanonical: 'Chicago Cubs',
        startTime: new Date(),
        status: 'SCHEDULED',
        markets: [],
      };

      const mockEventOdds = {
        event: mockEvent,
        markets: [
          {
            marketId: 'market-1',
            marketType: 'MONEYLINE',
            parameters: null,
            outcomes: {},
            bestOdds: {
              home: { sportsbook: 'fanduel', odds: -150 },
              away: { sportsbook: 'draftkings', odds: 130 },
            },
          },
        ],
      };

      jest
        .spyOn(service, 'findTeamByName')
        .mockResolvedValueOnce('Milwaukee Brewers')
        .mockResolvedValueOnce('Chicago Cubs');
      jest.spyOn(eventsService, 'findAll').mockResolvedValue([mockEvent] as any);
      jest.spyOn(oddsService, 'getEventOdds').mockResolvedValue(mockEventOdds as any);

      const result = await service.getBestPrice({
        league: 'MLB',
        team: 'Brewers',
        opponent: 'Cubs',
        market: 'moneyline',
      });

      expect(result).toBeDefined();
      expect(service.findTeamByName).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException when market not found', async () => {
      const mockEvent = {
        id: 'event-1',
        sportType: 'MLB',
        league: 'MLB',
        homeTeam: 'Milwaukee Brewers',
        awayTeam: 'Chicago Cubs',
        homeTeamCanonical: 'Milwaukee Brewers',
        awayTeamCanonical: 'Chicago Cubs',
        startTime: new Date(),
        status: 'SCHEDULED',
        markets: [],
      };

      const mockEventOdds = {
        event: mockEvent,
        markets: [], // No markets available
      };

      jest.spyOn(service, 'findTeamByName').mockResolvedValue('Milwaukee Brewers');
      jest.spyOn(eventsService, 'findAll').mockResolvedValue([mockEvent] as any);
      jest.spyOn(oddsService, 'getEventOdds').mockResolvedValue(mockEventOdds as any);

      await expect(
        service.getBestPrice({
          league: 'MLB',
          team: 'Brewers',
          market: 'moneyline',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
