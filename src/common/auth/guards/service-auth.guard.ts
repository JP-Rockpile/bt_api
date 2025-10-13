import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class ServiceAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const serviceToken = request.headers['x-service-token'];

    if (!serviceToken || serviceToken !== process.env.BT_MODEL_SERVICE_TOKEN) {
      throw new UnauthorizedException('Invalid service token');
    }

    // Extract user_id from X-User-Id header for ownership checks
    const userId = request.headers['x-user-id'];
    if (userId) {
      request.user = { id: userId, type: 'SERVICE' };
    }

    return true;
  }
}

