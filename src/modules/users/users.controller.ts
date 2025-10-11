import { Controller, Get, Put, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { UsersService } from './users.service';

@ApiTags('auth')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('auth0-jwt')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile with sportsbook links' })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.usersService.findOne(userId);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({ status: 200, description: 'Updated user profile' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() updates: { preferences?: Record<string, unknown>; deviceTokens?: string[] },
  ) {
    return this.usersService.updateProfile(userId, updates);
  }

  @Post('me/sportsbooks/:sportsbookId')
  @ApiOperation({ summary: 'Link a sportsbook to user account' })
  @ApiResponse({ status: 201, description: 'Sportsbook linked' })
  async linkSportsbook(
    @CurrentUser('id') userId: string,
    @Param('sportsbookId') sportsbookId: string,
    @Body('preferenceOrder') preferenceOrder?: number,
  ) {
    return this.usersService.linkSportsbook(userId, sportsbookId, preferenceOrder);
  }

  @Delete('me/sportsbooks/:sportsbookId')
  @ApiOperation({ summary: 'Unlink a sportsbook from user account' })
  @ApiResponse({ status: 200, description: 'Sportsbook unlinked' })
  async unlinkSportsbook(
    @CurrentUser('id') userId: string,
    @Param('sportsbookId') sportsbookId: string,
  ) {
    await this.usersService.unlinkSportsbook(userId, sportsbookId);
    return { message: 'Sportsbook unlinked successfully' };
  }

  @Post('me/push-token')
  @ApiOperation({ summary: 'Register Expo push notification token' })
  @ApiResponse({ status: 200, description: 'Push token registered' })
  async updatePushToken(@CurrentUser('id') userId: string, @Body('token') token: string) {
    return this.usersService.updatePushToken(userId, token);
  }
}
