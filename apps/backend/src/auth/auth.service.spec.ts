import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import { AuthService, REFRESH_TOKEN_COOKIE } from './auth.service.js';

const TEST_SECRETS = {
  JWT_ACCESS_SECRET: 'test-access-secret-min-16-chars',
  JWT_REFRESH_SECRET: 'test-refresh-secret-min-16-chars',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  NODE_ENV: 'test',
};

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: 'CUSTOMER' | 'ADMIN';
  isActive: boolean;
  refreshTokenHash: string | null;
  createdAt: Date;
}

/** In-memory stand-in for UsersService. */
function makeUsersService() {
  const store = new Map<string, StoredUser>();
  let seq = 0;
  return {
    store,
    service: {
      findByEmail: async (email: string): Promise<StoredUser | null> =>
        [...store.values()].find((u) => u.email === email) ?? null,
      findById: async (id: string): Promise<StoredUser | null> =>
        store.get(id) ?? null,
      create: async (data: {
        email: string;
        passwordHash: string;
        name: string;
        role: 'CUSTOMER';
      }): Promise<StoredUser> => {
        seq += 1;
        const user: StoredUser = {
          id: `user_${seq}`,
          isActive: true,
          refreshTokenHash: null,
          createdAt: new Date(),
          ...data,
        };
        store.set(user.id, user);
        return user;
      },
      updateRefreshTokenHash: async (
        id: string,
        refreshTokenHash: string | null,
      ): Promise<StoredUser> => {
        const user = store.get(id);
        if (!user) throw new Error('user not found in mock');
        user.refreshTokenHash = refreshTokenHash;
        return user;
      },
    },
  };
}

function makeConfigService() {
  const get = (key: string): string | undefined =>
    (TEST_SECRETS as Record<string, string>)[key];
  return {
    getOrThrow: (key: string): string => {
      const value = get(key);
      if (value === undefined) throw new Error(`missing ${key}`);
      return value;
    },
    get: (key: string): string | undefined => get(key),
  } as unknown as ConfigService;
}

function makeRes() {
  const cookies: Record<string, { value: string; options: unknown }> = {};
  const res = {
    cookie: (name: string, value: string, options: unknown) => {
      cookies[name] = { value, options };
      return res;
    },
    clearCookie: (name: string) => {
      delete cookies[name];
      return res;
    },
  } as unknown as Response;
  return { res, cookies };
}

function reqWithCookie(token?: string): Request {
  return {
    cookies: token ? { [REFRESH_TOKEN_COOKIE]: token } : {},
  } as unknown as Request;
}

describe('AuthService', () => {
  let authService: AuthService;
  let users: ReturnType<typeof makeUsersService>;

  beforeEach(() => {
    users = makeUsersService();
    authService = new AuthService(
      users.service as never,
      new JwtService({ secret: TEST_SECRETS.JWT_ACCESS_SECRET }),
      makeConfigService(),
    );
  });

  describe('register', () => {
    it('creates a CUSTOMER user with a hashed password and returns a safe user', async () => {
      const result = await authService.register({
        email: 'a@example.com',
        password: 'StrongPass1',
        name: 'Ada',
      });

      expect(result.email).toBe('a@example.com');
      expect(result.role).toBe('CUSTOMER');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('refreshTokenHash');

      const stored = await users.service.findByEmail('a@example.com');
      expect(stored).not.toBeNull();
      expect(stored!.passwordHash).not.toBe('StrongPass1');
      expect(
        await bcrypt.compare('StrongPass1', stored!.passwordHash),
      ).toBe(true);
    });

    it('throws 409 when the email is already taken', async () => {
      await authService.register({
        email: 'dup@example.com',
        password: 'StrongPass1',
        name: 'Ada',
      });
      await expect(
        authService.register({
          email: 'dup@example.com',
          password: 'StrongPass1',
          name: 'Bob',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await authService.register({
        email: 'login@example.com',
        password: 'StrongPass1',
        name: 'Lee',
      });
    });

    it('returns an access token and sets an httpOnly refresh cookie', async () => {
      const { res, cookies } = makeRes();
      const result = await authService.login(
        { email: 'login@example.com', password: 'StrongPass1' },
        res,
      );

      expect(result.accessToken).toBeTruthy();
      const cookie = cookies[REFRESH_TOKEN_COOKIE];
      expect(cookie).toBeDefined();
      expect(cookie.options).toMatchObject({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      });

      const stored = await users.service.findByEmail('login@example.com');
      expect(stored!.refreshTokenHash).toBeTruthy();
    });

    it('throws 401 on wrong password', async () => {
      const { res } = makeRes();
      await expect(
        authService.login(
          { email: 'login@example.com', password: 'WrongPass1' },
          res,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws 401 on unknown email', async () => {
      const { res } = makeRes();
      await expect(
        authService.login(
          { email: 'nobody@example.com', password: 'StrongPass1' },
          res,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh (rotation + reuse detection)', () => {
    let firstRefreshToken: string;

    beforeEach(async () => {
      await authService.register({
        email: 'rot@example.com',
        password: 'StrongPass1',
        name: 'Ro',
      });
      const { res, cookies } = makeRes();
      await authService.login(
        { email: 'rot@example.com', password: 'StrongPass1' },
        res,
      );
      firstRefreshToken = cookies[REFRESH_TOKEN_COOKIE].value;
    });

    it('rotates the refresh token and returns a new access token', async () => {
      const { res, cookies } = makeRes();
      const result = await authService.refresh(
        reqWithCookie(firstRefreshToken),
        res,
      );

      expect(result.accessToken).toBeTruthy();
      const rotated = cookies[REFRESH_TOKEN_COOKIE].value;
      expect(rotated).toBeTruthy();
      expect(rotated).not.toBe(firstRefreshToken);
    });

    it('rejects a reused (rotated-out) refresh token and revokes the session', async () => {
      // First refresh rotates the token.
      const { res: res1 } = makeRes();
      await authService.refresh(reqWithCookie(firstRefreshToken), res1);

      // Reusing the old token is a reuse attack: 401 + session revoked.
      const { res: res2, cookies } = makeRes();
      await expect(
        authService.refresh(reqWithCookie(firstRefreshToken), res2),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(cookies[REFRESH_TOKEN_COOKIE]).toBeUndefined();

      const stored = await users.service.findByEmail('rot@example.com');
      expect(stored!.refreshTokenHash).toBeNull();
    });

    it('throws 401 when the cookie is missing', async () => {
      const { res } = makeRes();
      await expect(
        authService.refresh(reqWithCookie(undefined), res),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws 401 on a tampered token', async () => {
      const { res } = makeRes();
      await expect(
        authService.refresh(reqWithCookie('not-a-real-token'), res),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('revokes the stored hash and clears the cookie', async () => {
      await authService.register({
        email: 'out@example.com',
        password: 'StrongPass1',
        name: 'Out',
      });
      const { res: loginRes, cookies: loginCookies } = makeRes();
      await authService.login(
        { email: 'out@example.com', password: 'StrongPass1' },
        loginRes,
      );
      const token = loginCookies[REFRESH_TOKEN_COOKIE].value;

      const { res, cookies } = makeRes();
      (cookies as Record<string, unknown>)[REFRESH_TOKEN_COOKIE] = {
        value: token,
        options: {},
      };
      const result = await authService.logout(reqWithCookie(token), res);

      expect(result.message).toBe('Logged out');
      expect(cookies[REFRESH_TOKEN_COOKIE]).toBeUndefined();
      const stored = await users.service.findByEmail('out@example.com');
      expect(stored!.refreshTokenHash).toBeNull();

      // The revoked token can no longer be refreshed.
      const { res: res2 } = makeRes();
      await expect(
        authService.refresh(reqWithCookie(token), res2),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('still clears the cookie when no cookie is present', async () => {
      const { res, cookies } = makeRes();
      const result = await authService.logout(reqWithCookie(undefined), res);
      expect(result.message).toBe('Logged out');
      expect(cookies[REFRESH_TOKEN_COOKIE]).toBeUndefined();
    });
  });

  describe('me', () => {
    it('returns the safe user', async () => {
      const created = await authService.register({
        email: 'me@example.com',
        password: 'StrongPass1',
        name: 'Me',
      });
      const result = await authService.me(created.id);
      expect(result.email).toBe('me@example.com');
      expect(result).not.toHaveProperty('passwordHash');
    });
  });
});
