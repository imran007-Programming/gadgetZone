import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import type { User } from '@prisma/client';
import { UsersService } from '../users/users.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { SafeUserDto, toSafeUser } from './dto/safe-user.dto.js';
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
} from './strategies/jwt.strategy.js';

/** How long the previous refresh token keeps working after a rotation. */
const REFRESH_GRACE_MS = 60_000;

/** A refresh token is only rotated once it is older than this. */
const REFRESH_ROTATE_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Name of the httpOnly cookie carrying the refresh token.
 *
 * Design note: a single cookie with `path: '/'` (rather than a restricted
 * `/auth/refresh` path) so that BOTH /auth/refresh and /auth/logout can
 * read/clear it without juggling two cookies.
 */
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

/** The admin portal keeps its own session cookie, so it never mixes with a storefront login. */
export const ADMIN_REFRESH_TOKEN_COOKIE = 'admin_refresh_token';

/** Storefront (customer accounts) or admin portal (admin accounts). */
export type AuthAudience = 'customer' | 'admin';

const COOKIE_FOR: Record<AuthAudience, string> = {
  customer: REFRESH_TOKEN_COOKIE,
  admin: ADMIN_REFRESH_TOKEN_COOKIE,
};

const BCRYPT_ROUNDS = 10;

/**
 * SHA-256 pre-hash before bcrypt. bcrypt silently truncates inputs at 72
 * bytes; two JWTs for the same user share an identical prefix (header +
 * sub) longer than that, so comparing raw JWTs would wrongly match a
 * rotated-out token. Hashing first reduces the token to 64 hex chars with
 * full entropy, making the comparison sound.
 */
function tokenDigest(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpiresIn: JwtSignOptions['expiresIn'];
  private readonly refreshExpiresIn: JwtSignOptions['expiresIn'];
  private readonly isProduction: boolean;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.accessSecret = this.configService.getOrThrow<string>(
      'JWT_ACCESS_SECRET',
    );
    this.refreshSecret = this.configService.getOrThrow<string>(
      'JWT_REFRESH_SECRET',
    );
    this.accessExpiresIn = (this.configService.get<string>(
      'JWT_ACCESS_EXPIRES_IN',
    ) ?? '15m') as JwtSignOptions['expiresIn'];
    this.refreshExpiresIn = (this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
    ) ?? '7d') as JwtSignOptions['expiresIn'];
    this.isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
  }

  async register(dto: RegisterDto): Promise<SafeUserDto> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
      role: 'CUSTOMER',
    });
    return toSafeUser(user);
  }

  /**
   * Customer accounts sign in on the storefront and admin accounts on the
   * admin portal; each side rejects the other's accounts.
   */
  async login(
    dto: LoginDto,
    res: Response,
    audience: AuthAudience = 'customer',
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    // Phase 5: disabled accounts cannot log in (checked after the password so
    // the "disabled" state is only revealed to someone holding the password).
    if (user.isActive === false) {
      throw new UnauthorizedException('Account disabled');
    }
    // Same message as a wrong password: the admin login never confirms which emails exist
    if (audience === 'admin' && user.role !== 'ADMIN') {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (audience === 'customer' && user.role === 'ADMIN') {
      throw new ForbiddenException('Admin accounts sign in at the admin portal');
    }
    const accessToken = await this.signAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user, res, audience);
    return { accessToken, refreshToken };
  }

  /**
   * Rotating refresh. The refresh token is itself a JWT (signed with
   * JWT_REFRESH_SECRET); we store a bcrypt hash of the full token so that
   * reusing an old (rotated-out) token is detected and revokes the session.
   */
  async refresh(
    req: Request,
    res: Response,
    audience: AuthAudience = 'customer',
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Accept from cookie (preferred) or request body (for browsers blocking cross-site cookies).
    const presented =
      (req.cookies?.[COOKIE_FOR[audience]] as string | undefined) ??
      (req.body as { refreshToken?: string } | undefined)?.refreshToken;
    if (!presented) {
      throw new UnauthorizedException('Refresh token is missing');
    }

    const payload = await this.verifyRefreshToken(presented);
    if (!payload) {
      this.clearRefreshCookie(res, audience);
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.usersService.findById(payload.sub);
    // A session only refreshes on its own side (storefront ↔ customers, portal ↔ admins)
    if (user && (user.role === 'ADMIN') !== (audience === 'admin')) {
      this.clearRefreshCookie(res, audience);
      throw new UnauthorizedException('Invalid refresh token');
    }
    const storedHash = user?.refreshTokenHash ?? null;
    const digest = tokenDigest(presented);
    const matchesCurrent =
      storedHash !== null && (await bcrypt.compare(digest, storedHash));
    // The token replaced by the last rotation is still accepted for a moment:
    // a reload or a parallel request can lose the response with the new cookie.
    const withinGrace =
      !matchesCurrent &&
      !!user?.prevRefreshTokenHash &&
      !!user.refreshRotatedAt &&
      Date.now() - user.refreshRotatedAt.getTime() < REFRESH_GRACE_MS &&
      (await bcrypt.compare(digest, user.prevRefreshTokenHash));

    if (!user || !(matchesCurrent || withinGrace)) {
      // Token reuse detected (or revoked) — nuke the stored hash so the
      // whole session is dead, then reject.
      if (user) {
        await this.usersService.updateRefreshTokenHash(user.id, null);
      }
      this.clearRefreshCookie(res, audience);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const accessToken = await this.signAccessToken(user);

    if (withinGrace) {
      // A retry with the token from just before the last rotation (its response
      // was lost). Hand out a fresh token, but keep the previous hash and the
      // original rotation time so the grace window is not extended.
      const refreshToken = await this.issueRefreshToken(user, res, audience, (hash) =>
        this.usersService.replaceCurrentRefreshTokenHash(user.id, hash),
      );
      return { accessToken, refreshToken };
    }

    // Rotate at most once a day. Rotating on every call made quick reloads
    // race each other (each aborted request rotated the token the browser still
    // held) and log the user out.
    const ageMs = payload.iat ? Date.now() - payload.iat * 1000 : Infinity;
    if (ageMs < REFRESH_ROTATE_AFTER_MS) {
      return { accessToken, refreshToken: presented };
    }

    // The hash being replaced stays valid for the grace period
    const refreshToken = await this.issueRefreshToken(user, res, audience, (hash) =>
      this.usersService.updateRefreshTokenHash(user.id, hash, storedHash),
    );
    return { accessToken, refreshToken };
  }

  async logout(
    req: Request,
    res: Response,
    audience: AuthAudience = 'customer',
  ): Promise<{ message: string }> {
    const presented = req.cookies?.[COOKIE_FOR[audience]] as
      | string
      | undefined;
    if (presented) {
      const payload = await this.verifyRefreshToken(presented);
      if (payload) {
        const user = await this.usersService.findById(payload.sub);
        if (
          user?.refreshTokenHash &&
          (await bcrypt.compare(tokenDigest(presented), user.refreshTokenHash))
        ) {
          await this.usersService.updateRefreshTokenHash(user.id, null);
        }
      }
    }
    // Always clear the cookie, even if the token was missing/invalid.
    this.clearRefreshCookie(res, audience);
    return { message: 'Logged out' };
  }

  async me(userId: string): Promise<SafeUserDto> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toSafeUser(user);
  }

  // ---------------------------------------------------------------- helpers

  private async signAccessToken(user: User): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as AccessTokenPayload['role'],
    };
    return this.jwtService.signAsync(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessExpiresIn,
    });
  }

  /** Issues a new refresh token, stores its bcrypt hash, sets the cookie. Returns the raw token. */
  private async issueRefreshToken(
    user: User,
    res: Response,
    audience: AuthAudience,
    persist: (hash: string) => Promise<unknown> = (hash) =>
      this.usersService.updateRefreshTokenHash(user.id, hash),
  ): Promise<string> {
    const payload: RefreshTokenPayload = { sub: user.id, jti: randomUUID() };
    const token = await this.jwtService.signAsync(payload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshExpiresIn,
    });
    const hash = await bcrypt.hash(tokenDigest(token), BCRYPT_ROUNDS);
    await persist(hash);
    res.cookie(COOKIE_FOR[audience], token, this.refreshCookieOptions());
    return token;
  }

  private async verifyRefreshToken(
    token: string,
  ): Promise<RefreshTokenPayload | null> {
    try {
      return await this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.refreshSecret,
      });
    } catch {
      return null;
    }
  }

  private refreshCookieOptions(): CookieOptions {
    // Cross-domain (Vercel frontend + Render backend) needs SameSite=None + Secure
    // so the browser sends the cookie. Same-origin dev can use Lax.
    const crossDomain = this.isProduction;
    return {
      httpOnly: true,
      secure: crossDomain ? true : this.isProduction,
      sameSite: crossDomain ? 'none' : 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };
  }

  private clearRefreshCookie(res: Response, audience: AuthAudience): void {
    const crossDomain = this.isProduction;
    res.clearCookie(COOKIE_FOR[audience], {
      httpOnly: true,
      secure: crossDomain ? true : this.isProduction,
      sameSite: crossDomain ? 'none' : 'lax',
      path: '/',
    });
  }
}
