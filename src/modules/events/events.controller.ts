import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { EventsService } from './events.service';
import { EventStatus } from '@prisma/client';

@ApiTags('events')
@Controller('events')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('auth0-jwt')
export class EventsController {
  constructor(private eventsService: EventsService) {}

  @Get()
  @ApiOperation({ summary: 'List events with optional filters' })
  @ApiQuery({ name: 'sport', required: false, example: 'NFL' })
  @ApiQuery({ name: 'league', required: false, example: 'NFL' })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  @ApiQuery({ name: 'status', required: false, enum: EventStatus })
  @ApiResponse({ status: 200, description: 'List of events' })
  async findAll(
    @Query('sport') sport?: string,
    @Query('league') league?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: EventStatus,
  ) {
    return this.eventsService.findAll({
      sport,
      league,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      status,
    });
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming scheduled events' })
  @ApiQuery({ name: 'sport', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiResponse({ status: 200, description: 'Upcoming events' })
  async getUpcoming(@Query('sport') sport?: string, @Query('limit') limit?: number) {
    return this.eventsService.getUpcoming(sport, limit);
  }

  @Get('live')
  @ApiOperation({ summary: 'Get currently live events' })
  @ApiQuery({ name: 'sport', required: false })
  @ApiResponse({ status: 200, description: 'Live events' })
  async getLive(@Query('sport') sport?: string) {
    return this.eventsService.getLive(sport);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event details by ID' })
  @ApiResponse({ status: 200, description: 'Event details with markets and recent odds' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }
}
