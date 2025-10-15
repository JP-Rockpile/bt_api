import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * SSE-compatible authentication guard
 * Supports authentication via:
 * 1. Authorization header (preferred for API clients)
 * 2. Query parameter 'token' (for browsers with EventSource)
 *
 * Usage:
 * @UseGuards(SseAuthGuard)
 * @Sse('stream')
 * stream() { ... }
 */
@Injectable()
export class SseAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(SseAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    // Check if token is in query parameter (for SSE from browsers)
    if (request.query?.token && !request.headers.authorization) {
      // Move token from query to Authorization header for passport
      request.headers.authorization = `Bearer ${request.query.token}`;
      this.logger.debug('SSE authentication using query parameter token');
    }

    try {
      const result = await super.canActivate(context);
      this.logger.log(`SSE auth successful for user: ${request.user?.id || request.user?.sub}`);
      return result as boolean;
    } catch (error) {
      this.logger.error('SSE authentication failed:', error.message);
      throw new UnauthorizedException('Invalid or missing authentication token');
    }
  }

  handleRequest<TUser = any>(
    err: unknown,
    user: TUser | false,
    info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      const request = context.switchToHttp().getRequest();
      this.logger.warn(
        `SSE auth failed - Method: ${request.method}, URL: ${request.url}, Error: ${err || 'No user'}`,
      );
      throw err || new UnauthorizedException('Authentication required for SSE connection');
    }
    return user;
  }
}
