import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { SportsbooksService } from './sportsbooks.service';

@ApiTags('sportsbooks')
@Controller('sportsbooks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('auth0-jwt')
export class SportsbooksController {
  constructor(private sportsbooksService: SportsbooksService) {}

  @Get()
  @ApiOperation({ summary: 'List all sportsbooks' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'List of sportsbooks' })
  async findAll(@Query('activeOnly') activeOnly?: string) {
    const active = activeOnly === 'false' ? false : true;
    return this.sportsbooksService.findAll(active);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sportsbook by ID' })
  @ApiResponse({ status: 200, description: 'Sportsbook details' })
  async findOne(@Param('id') id: string) {
    return this.sportsbooksService.findOne(id);
  }
}

