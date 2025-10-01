import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { EventStatus, Prisma } from '@prisma/client';

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private config: ConfigService,
  ) {}

  async findAll(filters?: {
    sport?: string;
    league?: string;
    startDate?: Date;
    endDate?: Date;
    status?: EventStatus;
  }) {
    const cacheKey = `events:${JSON.stringify(filters || {})}`;
    const cacheTtl = this.config.get<number>('cache.eventsTtl') || 120;

    // Check cache
    const cached = await this.redis.cacheGet(cacheKey);
    if (cached) {
      return cached;
    }

    const where: Prisma.EventWhereInput = {};

    if (filters?.sport) {
      where.sportType = filters.sport;
    }

    if (filters?.league) {
      where.league = filters.league;
    }

    if (filters?.startDate || filters?.endDate) {
      where.startTime = {};
      if (filters.startDate) where.startTime.gte = filters.startDate;
      if (filters.endDate) where.startTime.lte = filters.endDate;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    const events = await this.prisma.event.findMany({
      where,
      orderBy: { startTime: 'asc' },
      include: {
        markets: {
          select: {
            id: true,
            marketType: true,
            parameters: true,
          },
        },
      },
    });

    // Cache results
    await this.redis.cacheSet(cacheKey, events, cacheTtl);

    return events;
  }

  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        markets: {
          include: {
            oddsSnapshots: {
              orderBy: { timestamp: 'desc' },
              take: 10,
              include: {
                sportsbook: true,
              },
            },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Event ${id} not found`);
    }

    return event;
  }

  async getUpcoming(sport?: string, limit: number = 50) {
    const where: Prisma.EventWhereInput = {
      startTime: {
        gte: new Date(),
      },
      status: 'SCHEDULED',
    };

    if (sport) {
      where.sportType = sport;
    }

    return this.prisma.event.findMany({
      where,
      orderBy: { startTime: 'asc' },
      take: limit,
      include: {
        markets: {
          select: {
            id: true,
            marketType: true,
          },
        },
      },
    });
  }

  async getLive(sport?: string) {
    const where: Prisma.EventWhereInput = {
      status: 'LIVE',
    };

    if (sport) {
      where.sportType = sport;
    }

    return this.prisma.event.findMany({
      where,
      orderBy: { startTime: 'asc' },
      include: {
        markets: {
          select: {
            id: true,
            marketType: true,
          },
        },
      },
    });
  }
}
