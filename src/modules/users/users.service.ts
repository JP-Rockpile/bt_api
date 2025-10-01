import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findOrCreate(auth0Sub: string, email?: string, username?: string) {
    let user = await this.prisma.user.findUnique({
      where: { auth0Sub },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          auth0Sub,
          email,
          username,
          role: 'USER',
        },
      });
    } else {
      // Update last login
      user = await this.prisma.user.update({
        where: { auth0Sub },
        data: { lastLoginAt: new Date() },
      });
    }

    return user;
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        sportsbookLinks: {
          include: {
            sportsbook: true,
          },
          orderBy: { preferenceOrder: 'asc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(
    userId: string,
    updates: { preferences?: Record<string, unknown>; deviceTokens?: string[] },
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        preferences: updates.preferences as Prisma.InputJsonValue,
        expoPushTokens: updates.deviceTokens,
      },
    });
  }

  async linkSportsbook(userId: string, sportsbookId: string, preferenceOrder?: number) {
    return this.prisma.userSportsbookLink.create({
      data: {
        userId,
        sportsbookId,
        preferenceOrder: preferenceOrder || 999,
        isEnabled: true,
      },
    });
  }

  async unlinkSportsbook(userId: string, sportsbookId: string) {
    await this.prisma.userSportsbookLink.deleteMany({
      where: {
        userId,
        sportsbookId,
      },
    });
  }

  async updatePushToken(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const tokens = user.expoPushTokens || [];
    if (!tokens.includes(token)) {
      tokens.push(token);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { expoPushTokens: tokens },
    });
  }
}
