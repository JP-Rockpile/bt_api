import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../common/auth/decorators/public.decorator';
import { PrismaService } from '../../common/database/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private config: ConfigService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  async check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: this.config.get('app.nodeEnv'),
    };
  }

  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Readiness check with dependency validation' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async readiness() {
    const checks: {
      database: boolean;
      redis: boolean;
      databaseError?: string;
      redisError?: string;
    } = {
      database: false,
      redis: false,
    };

    // Check database
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch (error: unknown) {
      checks.database = false;
      checks.databaseError = error instanceof Error ? error.message : 'Unknown error';
    }

    // Check Redis
    try {
      await this.redis.getClient().ping();
      checks.redis = true;
    } catch (error: unknown) {
      checks.redis = false;
      checks.redisError = error instanceof Error ? error.message : 'Unknown error';
    }

    const isReady = checks.database && checks.redis;

    return {
      status: isReady ? 'ready' : 'not ready',
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
