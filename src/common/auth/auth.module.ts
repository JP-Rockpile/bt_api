import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { Auth0Strategy } from './strategies/auth0.strategy';
import { RolesGuard } from './guards/roles.guard';
import { UsersModule } from '../../modules/users/users.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}), // Configuration handled by Auth0Strategy
    UsersModule,
  ],
  providers: [Auth0Strategy, RolesGuard],
  exports: [PassportModule, RolesGuard],
})
export class AuthModule {}
