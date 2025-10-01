import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { OddsUtils } from '../../common/utils/odds.utils';
import { PlanBetDto } from './dto/plan-bet.dto';
import { ConfirmBetDto } from './dto/confirm-bet.dto';
import { Prisma } from '@prisma/client';

type BetWithRelations = Prisma.BetGetPayload<{
  include: {
    event: true;
    market: true;
    sportsbook: true;
  };
}>;

@Injectable()
export class BetsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Plan a bet - LLM will analyze intent and return recommendation
   * Note: Actual LLM interaction happens in model service, this is the API endpoint
   */
  async planBet(userId: string, planBetDto: PlanBetDto) {
    // This endpoint would typically:
    // 1. Forward the query to the model service
    // 2. Model service uses LLM to analyze betting intent
    // 3. Return structured recommendation with reasoning

    // For now, returning a placeholder response
    return {
      message: 'Bet planning endpoint - integrate with model service for LLM analysis',
      query: planBetDto.query,
      recommendation: {
        // This would come from LLM
        confidence: 0.75,
        reasoning: 'Placeholder - implement LLM integration via model service',
        suggestedBets: [],
      },
    };
  }

  /**
   * Confirm a bet - user has approved, lock in details
   */
  async confirmBet(userId: string, confirmBetDto: ConfirmBetDto) {
    // Validate event exists
    const event = await this.prisma.event.findUnique({
      where: { id: confirmBetDto.eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Validate market exists
    const market = await this.prisma.market.findUnique({
      where: { id: confirmBetDto.marketId },
    });

    if (!market) {
      throw new NotFoundException('Market not found');
    }

    // Validate sportsbook exists
    const sportsbook = await this.prisma.sportsbook.findUnique({
      where: { id: confirmBetDto.sportsbookId },
    });

    if (!sportsbook || !sportsbook.isActive) {
      throw new BadRequestException('Invalid or inactive sportsbook');
    }

    // Calculate decimal odds
    const oddsDecimal = OddsUtils.americanToDecimal(confirmBetDto.oddsAmerican);

    // Create bet record
    const bet = await this.prisma.bet.create({
      data: {
        userId,
        eventId: confirmBetDto.eventId,
        marketId: confirmBetDto.marketId,
        sportsbookId: confirmBetDto.sportsbookId,
        selectedOutcome: confirmBetDto.selectedOutcome,
        stake: confirmBetDto.stake,
        oddsAmerican: confirmBetDto.oddsAmerican,
        oddsDecimal,
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
      include: {
        event: true,
        market: true,
        sportsbook: true,
      },
    });

    return bet;
  }

  /**
   * Generate deep link for placing bet at sportsbook
   */
  async generateDeepLink(userId: string, betId: string) {
    const bet = await this.prisma.bet.findUnique({
      where: { id: betId },
      include: {
        event: true,
        market: true,
        sportsbook: true,
      },
    });

    if (!bet) {
      throw new NotFoundException('Bet not found');
    }

    if (bet.userId !== userId) {
      throw new BadRequestException('Bet does not belong to user');
    }

    if (bet.status !== 'CONFIRMED') {
      throw new BadRequestException('Bet must be confirmed before generating deep link');
    }

    // Generate deep link based on sportsbook template
    const deepLink = this.buildDeepLink(bet);

    // Update bet with deep link and change status to GUIDED
    await this.prisma.bet.update({
      where: { id: betId },
      data: {
        deepLink,
        status: 'GUIDED',
        guidedAt: new Date(),
      },
    });

    return {
      betId: bet.id,
      deepLink,
      sportsbook: bet.sportsbook.displayName,
      instructions: `Open this link in your mobile browser to be guided to ${bet.sportsbook.displayName}`,
    };
  }

  /**
   * Get user's bet history
   */
  async getUserBets(userId: string, status?: string) {
    const where: Prisma.BetWhereInput = { userId };

    if (status) {
      where.status = status;
    }

    return this.prisma.bet.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        event: {
          select: {
            sportType: true,
            league: true,
            homeTeam: true,
            awayTeam: true,
            startTime: true,
            status: true,
          },
        },
        market: {
          select: {
            marketType: true,
            parameters: true,
          },
        },
        sportsbook: {
          select: {
            displayName: true,
            logoUrl: true,
          },
        },
      },
    });
  }

  /**
   * Get single bet details
   */
  async getBet(userId: string, betId: string) {
    const bet = await this.prisma.bet.findUnique({
      where: { id: betId },
      include: {
        event: true,
        market: true,
        sportsbook: true,
      },
    });

    if (!bet) {
      throw new NotFoundException('Bet not found');
    }

    if (bet.userId !== userId) {
      throw new BadRequestException('Bet does not belong to user');
    }

    return bet;
  }

  /**
   * Build deep link URL based on sportsbook configuration
   */
  private buildDeepLink(bet: BetWithRelations): string {
    const template = bet.sportsbook.deepLinkTemplate;

    if (!template) {
      // Fallback to web URL
      return bet.sportsbook.webUrl || `https://${bet.sportsbook.key}.com`;
    }

    // Replace template variables
    return template
      .replace('{sport}', bet.event.sportType.toLowerCase())
      .replace('{league}', bet.event.league.toLowerCase())
      .replace('{home}', encodeURIComponent(bet.event.homeTeam))
      .replace('{away}', encodeURIComponent(bet.event.awayTeam))
      .replace('{market}', bet.market.marketType.toLowerCase())
      .replace('{outcome}', bet.selectedOutcome);
  }
}
