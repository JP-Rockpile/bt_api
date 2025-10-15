import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UnabatedService } from './services/unabated.service';
import { Public } from '../../common/auth/decorators/public.decorator';

@ApiTags('unabated')
@Controller('unabated')
export class UnabatedController {
  constructor(private readonly unabatedService: UnabatedService) {}

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @Public() // Make this public for now, add auth later if needed
  @ApiOperation({ 
    summary: 'Trigger manual data sync',
    description: 'Syncs bet types, market sources, events, and market lines from Unabated API'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Sync completed successfully',
    schema: {
      type: 'object',
      properties: {
        betTypes: { type: 'number', example: 1134 },
        sources: { type: 'number', example: 45 },
        events: { type: 'number', example: 250 },
        lines: { type: 'number', example: 3500 },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Sync failed' })
  async syncData(
    @Body() body?: { leagues?: string[] },
  ) {
    const leagues = body?.leagues;
    return await this.unabatedService.syncData(leagues);
  }
}

