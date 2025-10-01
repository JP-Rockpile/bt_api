import { Test, TestingModule } from '@nestjs/testing';
import { OddsService } from './odds.service';
import { PrismaService } from '../../common/database/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { UnabatedAdapter } from './adapters/unabated.adapter';
import { TheOddsApiAdapter } from './adapters/theodds.adapter';

describe('OddsService', () => {
  let service: OddsService;

  const mockPrismaService = {
    event: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    market: {
      upsert: jest.fn(),
    },
    sportsbook: {
      findUnique: jest.fn(),
    },
    oddsSnapshot: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockRedisService = {
    cacheGet: jest.fn(),
    cacheSet: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, number> = {
        'cache.oddsTtl': 30,
      };
      return config[key];
    }),
  };

  const mockUnabatedAdapter = {
    fetchOdds: jest.fn(),
  };

  const mockTheOddsApiAdapter = {
    fetchOdds: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OddsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: UnabatedAdapter, useValue: mockUnabatedAdapter },
        { provide: TheOddsApiAdapter, useValue: mockTheOddsApiAdapter },
      ],
    }).compile();

    service = module.get<OddsService>(OddsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('aggregateOdds', () => {
    it('should return cached odds if available', async () => {
      const cachedData = [
        {
          eventExternalId: 'event_1',
          sportType: 'NFL',
          league: 'NFL',
          homeTeam: 'Chiefs',
          awayTeam: 'Bills',
          startTime: new Date(),
          markets: [],
        },
      ];

      mockRedisService.cacheGet.mockResolvedValue(cachedData);

      const result = await service.aggregateOdds('NFL');

      expect(result).toEqual(cachedData);
      expect(mockRedisService.cacheGet).toHaveBeenCalledWith('odds:NFL:all');
    });

    it('should fetch from Unabated for non-MMA sports', async () => {
      const oddsData = [
        {
          eventExternalId: 'event_1',
          sportType: 'NFL',
          league: 'NFL',
          homeTeam: 'Chiefs',
          awayTeam: 'Bills',
          startTime: new Date(),
          markets: [],
        },
      ];

      mockRedisService.cacheGet.mockResolvedValue(null);
      mockUnabatedAdapter.fetchOdds.mockResolvedValue(oddsData);

      const result = await service.aggregateOdds('NFL');

      expect(mockUnabatedAdapter.fetchOdds).toHaveBeenCalledWith('NFL', undefined);
      expect(mockRedisService.cacheSet).toHaveBeenCalled();
      expect(result).toEqual(oddsData);
    });

    it('should fetch from The Odds API for MMA', async () => {
      const oddsData = [
        {
          eventExternalId: 'event_1',
          sportType: 'MMA',
          league: 'UFC',
          homeTeam: 'Fighter A',
          awayTeam: 'Fighter B',
          startTime: new Date(),
          markets: [],
        },
      ];

      mockRedisService.cacheGet.mockResolvedValue(null);
      mockTheOddsApiAdapter.fetchOdds.mockResolvedValue(oddsData);

      const result = await service.aggregateOdds('MMA');

      expect(mockTheOddsApiAdapter.fetchOdds).toHaveBeenCalledWith('MMA', undefined);
      expect(result).toEqual(oddsData);
    });
  });

  describe('getEventOdds', () => {
    it('should throw NotFoundException if event not found', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(null);

      await expect(service.getEventOdds('invalid_id')).rejects.toThrow(
        'Event invalid_id not found',
      );
    });

    it('should return event odds with best prices', async () => {
      const mockEvent = {
        id: 'event_1',
        sportType: 'NFL',
        league: 'NFL',
        homeTeam: 'Chiefs',
        awayTeam: 'Bills',
        startTime: new Date(),
        status: 'SCHEDULED',
        markets: [
          {
            id: 'market_1',
            marketType: 'MONEYLINE',
            parameters: null,
            oddsSnapshots: [
              {
                sportsbookId: 'sb_1',
                outcome: 'home',
                oddsAmerican: -110,
                oddsDecimal: 1.9091,
                timestamp: new Date(),
              },
              {
                sportsbookId: 'sb_2',
                outcome: 'home',
                oddsAmerican: -105,
                oddsDecimal: 1.9524,
                timestamp: new Date(),
              },
            ],
          },
        ],
      };

      mockPrismaService.event.findUnique.mockResolvedValue(mockEvent);

      const result = await service.getEventOdds('event_1');

      expect(result.event.id).toBe('event_1');
      expect(result.markets).toBeDefined();
      expect(result.markets[0].bestOdds).toBeDefined();
    });
  });
});
