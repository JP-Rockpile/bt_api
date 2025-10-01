import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiSecurity,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { BetsService } from './bets.service';
import { PlanBetDto } from './dto/plan-bet.dto';
import { ConfirmBetDto } from './dto/confirm-bet.dto';

@ApiTags('bets')
@Controller('bets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('auth0-jwt')
export class BetsController {
  constructor(private betsService: BetsService) {}

  @Post('plan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Plan a bet - LLM analyzes intent and returns recommendation',
    description:
      'Phase 1 of bet workflow: User expresses betting intent, LLM provides structured recommendation with reasoning',
  })
  @ApiResponse({ status: 200, description: 'Bet recommendation from LLM' })
  async planBet(@CurrentUser('userId') userId: string, @Body() planBetDto: PlanBetDto) {
    return this.betsService.planBet(userId, planBetDto);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.CREATED)
  @ApiSecurity('idempotency-key')
  @ApiOperation({
    summary: 'Confirm a bet - User approves recommendation with explicit stake',
    description:
      'Phase 2 of bet workflow: User confirms bet details, creates locked-in bet record with CONFIRMED status',
  })
  @ApiResponse({ status: 201, description: 'Bet confirmed and locked in' })
  @ApiResponse({ status: 404, description: 'Event, market, or sportsbook not found' })
  @ApiResponse({ status: 400, description: 'Invalid bet parameters' })
  async confirmBet(@CurrentUser('userId') userId: string, @Body() confirmBetDto: ConfirmBetDto) {
    return this.betsService.confirmBet(userId, confirmBetDto);
  }

  @Post(':betId/deep-link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate deep link for sportsbook',
    description:
      'Phase 3 of bet workflow: Generate sportsbook-specific deep link for mobile app to open, updates status to GUIDED',
  })
  @ApiResponse({ status: 200, description: 'Deep link generated' })
  @ApiResponse({ status: 404, description: 'Bet not found' })
  @ApiResponse({ status: 400, description: 'Bet not in correct status' })
  async generateDeepLink(@CurrentUser('userId') userId: string, @Param('betId') betId: string) {
    return this.betsService.generateDeepLink(userId, betId);
  }

  @Get()
  @ApiOperation({ summary: 'Get user bet history' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by bet status' })
  @ApiResponse({ status: 200, description: 'List of user bets' })
  async getUserBets(@CurrentUser('userId') userId: string, @Query('status') status?: string) {
    return this.betsService.getUserBets(userId, status);
  }

  @Get(':betId')
  @ApiOperation({ summary: 'Get bet details' })
  @ApiResponse({ status: 200, description: 'Bet details' })
  @ApiResponse({ status: 404, description: 'Bet not found' })
  async getBet(@CurrentUser('userId') userId: string, @Param('betId') betId: string) {
    return this.betsService.getBet(userId, betId);
  }
}
