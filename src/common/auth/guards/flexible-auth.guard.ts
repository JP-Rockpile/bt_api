import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ServiceAuthGuard } from './service-auth.guard';

@Injectable()
export class FlexibleAuthGuard implements CanActivate {
  constructor(
    private jwtAuthGuard: JwtAuthGuard,
    private serviceAuthGuard: ServiceAuthGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Check if service token is present
    const serviceToken = request.headers['x-service-token'];
    if (serviceToken) {
      return this.serviceAuthGuard.canActivate(context);
    }

    // Fall back to JWT authentication
    const result = this.jwtAuthGuard.canActivate(context);
    
    // Handle both sync and async returns from JwtAuthGuard
    if (result instanceof Promise) {
      return result;
    }
    
    return result as boolean;
  }
}

