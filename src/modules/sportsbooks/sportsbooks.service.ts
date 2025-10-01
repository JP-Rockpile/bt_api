import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class SportsbooksService {
  constructor(private prisma: PrismaService) {}

  async findAll(activeOnly: boolean = true) {
    const where: { isActive?: boolean } = {};

    if (activeOnly) {
      where.isActive = true;
    }

    return this.prisma.sportsbook.findMany({
      where,
      orderBy: { displayOrder: 'asc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.sportsbook.findUnique({
      where: { id },
    });
  }

  async findByKey(key: string) {
    return this.prisma.sportsbook.findUnique({
      where: { key },
    });
  }
}
