import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { UsersService } from '../../../modules/users/users.service';

export interface JwtPayload {
  sub: string; // Auth0 user ID
  aud: string | string[];
  iss: string;
  iat: number;
  exp: number;
  azp?: string;
  scope?: string;
  permissions?: string[];
  email?: string;
  [key: string]: unknown;
}

export interface RequestUser {
  id: string; // Prisma User ID (CUID)
  userId: string; // Auth0 sub (kept for backward compatibility)
  auth0Sub: string;
  email?: string;
  role?: string;
  permissions?: string[];
}

@Injectable()
export class Auth0Strategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(Auth0Strategy.name);

  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    const auth0Domain = configService.get<string>('auth0.domain');
    const auth0Audience = configService.get<string>('auth0.audience');
    const auth0Issuer = configService.get<string>('auth0.issuer');

    if (!auth0Domain || !auth0Audience || !auth0Issuer) {
      throw new Error('Auth0 configuration is missing');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience: auth0Audience,
      issuer: auth0Issuer,
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${auth0Domain}/.well-known/jwks.json`,
      }),
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    if (!payload.sub) {
      this.logger.warn('JWT payload missing sub claim');
      throw new UnauthorizedException('Invalid token payload');
    }

    // Find or create user in database
    const dbUser = await this.usersService.findOrCreate(payload.sub, payload.email);

    // Extract user information from JWT and database
    const user: RequestUser = {
      id: dbUser.id, // Prisma User ID
      userId: payload.sub, // Auth0 sub (backward compatibility)
      auth0Sub: payload.sub,
      email: payload.email || dbUser.email || undefined,
      role: (payload['https://betthink.com/role'] as string) || dbUser.role || 'USER',
      permissions: payload.permissions || [],
    };

    this.logger.debug(`User authenticated: ${user.auth0Sub} (DB ID: ${user.id})`);

    return user;
  }
}
