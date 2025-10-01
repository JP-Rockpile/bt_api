import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { MarketsService } from './markets.service';

@ApiTags('markets')
@Controller('markets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('auth0-jwt')
export class MarketsController {
  constructor(private marketsService: MarketsService) {}

  @Get('event/:eventId')
  @ApiOperation({ summary: 'Get all markets for an event' })
  @ApiResponse({ status: 200, description: 'List of markets with current odds' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async findByEvent(@Param('eventId') eventId: string) {
    return this.marketsService.findByEvent(eventId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get market details by ID' })
  @ApiResponse({ status: 200, description: 'Market details with odds history' })
  @ApiResponse({ status: 404, description: 'Market not found' })
  async findOne(@Param('id') id: string) {
    return this.marketsService.findOne(id);
  }
}
