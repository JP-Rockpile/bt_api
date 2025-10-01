import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { passportJwtSecret } from 'jwks-rsa';
import { PrismaService } from '@common/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const auth0Domain = configService.get<string>('AUTH0_DOMAIN');
    const auth0Audience = configService.get<string>('AUTH0_AUDIENCE');
    const auth0Issuer = configService.get<string>('AUTH0_ISSUER');

    if (!auth0Domain || !auth0Audience) {
      throw new Error('AUTH0_DOMAIN and AUTH0_AUDIENCE must be configured');
    }

    super({
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${auth0Domain}/.well-known/jwks.json`,
      }),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience: auth0Audience,
      issuer: auth0Issuer || `https://${auth0Domain}/`,
      algorithms: ['RS256'],
    });
  }

  async validate(payload: any) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    try {
      // Find or create user in database
      let user = await this.prisma.user.findUnique({
        where: { auth0Sub: payload.sub },
      });

      if (!user) {
        // Auto-create user on first login
        user = await this.prisma.user.create({
          data: {
            auth0Sub: payload.sub,
            email: payload.email,
            preferences: {},
          },
        });

        this.logger.log(`New user created: ${user.id} (${payload.sub})`);
      }

      // Return user object that will be attached to request
      return {
        sub: payload.sub,
        email: payload.email,
        userId: user.id,
        roles: payload['https://bet-think.com/roles'] || [],
        permissions: payload.permissions || [],
      };
    } catch (error) {
      this.logger.error(`Token validation error: ${error.message}`);
      throw new UnauthorizedException('Authentication failed');
    }
  }
}

