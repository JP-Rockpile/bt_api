import { Module, forwardRef } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { Auth0Strategy } from './strategies/auth0.strategy';
import { RolesGuard } from './guards/roles.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ServiceAuthGuard } from './guards/service-auth.guard';
import { FlexibleAuthGuard } from './guards/flexible-auth.guard';
import { SseAuthGuard } from './guards/sse-auth.guard';
import { UsersModule } from '../../modules/users/users.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}), // Configuration handled by Auth0Strategy
    forwardRef(() => UsersModule),
  ],
  providers: [
    Auth0Strategy,
    RolesGuard,
    JwtAuthGuard,
    ServiceAuthGuard,
    FlexibleAuthGuard,
    SseAuthGuard,
  ],
  exports: [
    PassportModule,
    RolesGuard,
    JwtAuthGuard,
    ServiceAuthGuard,
    FlexibleAuthGuard,
    SseAuthGuard,
  ],
})
export class AuthModule {}
