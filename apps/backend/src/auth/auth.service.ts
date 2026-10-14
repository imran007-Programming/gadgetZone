import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
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

/**
 * Name of the httpOnly cookie carrying the refresh token.
 *
 * Design note: a single cookie with `path: '/'` (rather than a restricted
 * `/auth/refresh` path) so that BOTH /auth/refresh and /auth/logout can
 * read/clear it without juggling two cookies.
 */
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

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

  async login(
    dto: LoginDto,
    res: Response,
  ): Promise<{ accessToken: string }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    // Phase 5: disabled accounts cannot log in (checked after the password so
    // the "disabled" state is only revealed to someone holding the password).
    if (user.isActive === false) {
      throw new UnauthorizedException('Account disabled');
    }
    const accessToken = await this.signAccessToken(user);
    await this.issueRefreshToken(user, res);
    return { accessToken };
  }

  /**
   * Rotating refresh. The refresh token is itself a JWT (signed with
   * JWT_REFRESH_SECRET); we store a bcrypt hash of the full token so that
   * reusing an old (rotated-out) token is detected and revokes the session.
   */
  async refresh(
    req: Request,
    res: Response,
  ): Promise<{ accessToken: string }> {
    const presented = req.cookies?.[REFRESH_TOKEN_COOKIE] as
      | string
      | undefined;
    if (!presented) {
      throw new UnauthorizedException('Refresh token is missing');
    }

    const payload = await this.verifyRefreshToken(presented);
    if (!payload) {
      this.clearRefreshCookie(res);
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.usersService.findById(payload.sub);
    const storedHash = user?.refreshTokenHash ?? null;
    const matches =
      storedHash !== null &&
      (await bcrypt.compare(tokenDigest(presented), storedHash));

    if (!user || !matches) {
      // Token reuse detected (or revoked) — nuke the stored hash so the
      // whole session is dead, then reject.
      if (user) {
        await this.usersService.updateRefreshTokenHash(user.id, null);
      }
      this.clearRefreshCookie(res);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const accessToken = await this.signAccessToken(user);
    await this.issueRefreshToken(user, res); // rotate
    return { accessToken };
  }

  async logout(req: Request, res: Response): Promise<{ message: string }> {
    const presented = req.cookies?.[REFRESH_TOKEN_COOKIE] as
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
    this.clearRefreshCookie(res);
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

  /** Issues a new refresh token, stores its bcrypt hash, sets the cookie. */
  private async issueRefreshToken(user: User, res: Response): Promise<void> {
    const payload: RefreshTokenPayload = { sub: user.id, jti: randomUUID() };
    const token = await this.jwtService.signAsync(payload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshExpiresIn,
    });
    const hash = await bcrypt.hash(tokenDigest(token), BCRYPT_ROUNDS);
    await this.usersService.updateRefreshTokenHash(user.id, hash);
    res.cookie(REFRESH_TOKEN_COOKIE, token, this.refreshCookieOptions());
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
    return {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax',
      path: '/',
    });
  }
}
