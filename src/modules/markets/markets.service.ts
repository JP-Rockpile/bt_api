import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class MarketsService {
  constructor(private prisma: PrismaService) {}

  async findByEvent(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException(`Event ${eventId} not found`);
    }

    return this.prisma.market.findMany({
      where: { eventId },
      include: {
        oddsSnapshots: {
          orderBy: { timestamp: 'desc' },
          take: 20,
          include: {
            sportsbook: {
              select: {
                id: true,
                key: true,
                name: true,
                displayName: true,
              },
            },
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const market = await this.prisma.market.findUnique({
      where: { id },
      include: {
        event: true,
        oddsSnapshots: {
          orderBy: { timestamp: 'desc' },
          take: 50,
          include: {
            sportsbook: true,
          },
        },
      },
    });

    if (!market) {
      throw new NotFoundException(`Market ${id} not found`);
    }

    return market;
  }
}
