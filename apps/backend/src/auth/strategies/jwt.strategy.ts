import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Role } from '../../common/decorators/roles.decorator.js';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  /** Issued-at (seconds), added by the JWT library. */
  iat?: number;
}

/** Shape attached to `request.user` by JwtAuthGuard. */
export interface RequestUser {
  userId: string;
  email: string;
  role: Role;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<RequestUser> {
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
