import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { PlanBetDto } from './dto/plan-bet.dto';
import { ConfirmBetDto } from './dto/confirm-bet.dto';
import { Prisma, BetStatus } from '@prisma/client';
import { 
  americanToDecimal,
  calculateExpectedValue,
  calculatePayout,
  type Odds 
} from '@betthink/shared';
import { DeepLinkService } from './services/deep-link.service';

type BetWithRelations = Prisma.BetGetPayload<{
  include: {
    event: true;
    market: true;
    sportsbook: true;
  };
}>;

@Injectable()
export class BetsService {
  private readonly logger = new Logger(BetsService.name);

  constructor(
    private prisma: PrismaService,
    private deepLinkService: DeepLinkService,
  ) {}

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

    // Calculate decimal odds using shared utility
    const oddsDecimal = americanToDecimal(confirmBetDto.oddsAmerican);

    // Calculate potential payout using shared utility
    const odds: Odds = {
      american: confirmBetDto.oddsAmerican,
      decimal: oddsDecimal,
      fractional: '', // Not needed for payout calculation
      impliedProbability: 0, // Not needed for payout calculation
    };
    const { profit, totalPayout } = calculatePayout(odds, confirmBetDto.stake);

    // Create bet record
    // Note: Store notes/llmRecommendation in metadata field once schema is updated
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

    this.logger.log(
      `Bet confirmed: ${bet.id} - $${bet.stake} at ${bet.oddsAmerican} odds. ` +
      `Potential profit: $${profit.toFixed(2)}, payout: $${totalPayout.toFixed(2)}`
    );

    return bet;
  }

  /**
   * Generate deep link for placing bet at sportsbook
   * Uses shared package deep linking utilities
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

    // Generate deep link using shared package utilities via DeepLinkService
    const deepLink = this.deepLinkService.generateDeepLink(bet as any);

    if (!deepLink) {
      this.logger.warn(`Failed to generate deep link for bet ${betId}`);
      // Fall back to web link
      const webLink = this.deepLinkService.generateWebLink(bet as any);
      
      return {
        betId: bet.id,
        deepLink: webLink,
        sportsbook: bet.sportsbook.displayName,
        instructions: `Visit ${bet.sportsbook.displayName} to place your bet`,
        isWebFallback: true,
      };
    }

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
      isWebFallback: false,
    };
  }

  /**
   * Get user's bet history
   */
  async getUserBets(userId: string, status?: BetStatus) {
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
   * Calculate expected value for a bet
   * Uses shared package EV calculation
   */
  async calculateBetEV(
    betId: string, 
    trueProbability: number
  ): Promise<{ ev: number; evPercentage: number }> {
    const bet = await this.prisma.bet.findUnique({
      where: { id: betId },
    });

    if (!bet) {
      throw new NotFoundException('Bet not found');
    }

    // Convert Prisma Decimal to number
    const decimalOdds = typeof bet.oddsDecimal === 'number' 
      ? bet.oddsDecimal 
      : Number(bet.oddsDecimal);
    
    const stake = typeof bet.stake === 'number'
      ? bet.stake
      : Number(bet.stake);

    const odds: Odds = {
      american: bet.oddsAmerican,
      decimal: decimalOdds,
      fractional: '', // Not needed for EV
      impliedProbability: 0, // Will be calculated
    };

    return calculateExpectedValue(odds, trueProbability, stake);
  }
}
