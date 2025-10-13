import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiSecurity } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { FlexibleAuthGuard } from '../../common/auth/guards/flexible-auth.guard';
import { OddsService } from './odds.service';
import { OddsQueryService } from './services/odds-query.service';
import { GetBestPriceDto } from './dto';

@ApiTags('odds')
@Controller('odds')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('auth0-jwt')
export class OddsController {
  constructor(
    private oddsService: OddsService,
    private oddsQueryService: OddsQueryService,
  ) {}

  @Get('aggregate')
  @ApiOperation({ summary: 'Aggregate odds from all providers for a sport' })
  @ApiQuery({ name: 'sport', required: true, example: 'NFL' })
  @ApiQuery({ name: 'league', required: false, example: 'NFL' })
  @ApiResponse({ status: 200, description: 'Aggregated odds data' })
  async aggregateOdds(@Query('sport') sport: string, @Query('league') league?: string) {
    return this.oddsService.aggregateOdds(sport, league);
  }

  @Get('event/:eventId')
  @ApiOperation({ summary: 'Get all odds for a specific event' })
  @ApiResponse({ status: 200, description: 'Event odds with best prices' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getEventOdds(@Param('eventId') eventId: string) {
    return this.oddsService.getEventOdds(eventId);
  }

  @Get('market/:marketId/best')
  @ApiOperation({ summary: 'Get best available odds for a market' })
  @ApiResponse({ status: 200, description: 'Best odds across all sportsbooks' })
  @ApiResponse({ status: 404, description: 'Market not found' })
  async getBestOdds(@Param('marketId') marketId: string) {
    return this.oddsService.getBestOdds(marketId);
  }

  @Get('market/:marketId/historical')
  @ApiOperation({ summary: 'Get historical odds for closing line value analysis' })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  @ApiResponse({ status: 200, description: 'Historical odds snapshots' })
  async getHistoricalOdds(
    @Param('marketId') marketId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.oddsService.getHistoricalOdds(
      marketId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger manual odds refresh for a sport' })
  @ApiQuery({ name: 'sport', required: true })
  @ApiQuery({ name: 'league', required: false })
  @ApiResponse({ status: 202, description: 'Refresh job queued' })
  async refreshOdds(@Query('sport') sport: string, @Query('league') league?: string) {
    const oddsData = await this.oddsService.aggregateOdds(sport, league);
    const storedCount = await this.oddsService.storeOddsSnapshots(oddsData);

    return {
      message: 'Odds refresh completed',
      storedSnapshots: storedCount,
      eventsProcessed: oddsData.length,
    };
  }

  // Tool endpoints for bt_model
  @Post('tools/best-price')
  @UseGuards(FlexibleAuthGuard)
  @ApiSecurity('service-token')
  @ApiOperation({ summary: '[bt_model tool] Get best available odds for a team/market' })
  @ApiResponse({ status: 200, description: 'Best odds found' })
  @ApiResponse({ status: 404, description: 'No matching event or market found' })
  async getBestPrice(@Body() dto: GetBestPriceDto) {
    return this.oddsQueryService.getBestPrice(dto);
  }
}
