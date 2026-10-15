/**
 * Auth flow e2e: register → duplicate 409 → login → me 200 → me 401 →
 * refresh rotation → reuse 401 → logout.
 *
 * Requires PostgreSQL. Point TEST_DATABASE_URL at an EMPTY test database,
 * run the migrations against it once, then run the suite:
 *
 *   DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy
 *   npm run test:e2e
 *
 * Without TEST_DATABASE_URL the suite skips itself (no database available).
 * Even with it set, the suite skips if the database is unreachable.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-min-16-chars';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-min-16-chars';

const RUN_ID = Date.now().toString(36);
const EMAIL = `auth-e2e-${RUN_ID}@example.com`;
const PASSWORD = 'StrongPass1';

function refreshCookieFrom(res: { headers: Record<string, unknown> }) {
  const setCookie = res.headers['set-cookie'] as string[] | undefined;
  const hit = setCookie?.find((c) => c.startsWith('refresh_token='));
  if (!hit) throw new Error('refresh_token cookie missing in response');
  return hit.split(';')[0];
}

describe.skipIf(!TEST_DATABASE_URL)('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // Vitest 4 hooks get no skip(); remember the failure and skip each test instead
  let dbUnavailable = false;
  beforeEach((ctx) => {
    if (dbUnavailable) ctx.skip();
  });

  beforeAll(async () => {
    try {
      const moduleFixture: TestingModule =
        await Test.createTestingModule({ imports: [AppModule] }).compile();
      app = moduleFixture.createNestApplication();
      app.use(cookieParser());
      app.useGlobalPipes(
        new ValidationPipe({ whitelist: true, transform: true }),
      );
      app.useGlobalFilters(new HttpExceptionFilter());
      app.useGlobalInterceptors(new TransformInterceptor());
      // PrismaService connects here; throws when the DB is unreachable.
      await app.init();
      prisma = app.get(PrismaService);
    } catch {
      await app?.close().catch(() => undefined);
      dbUnavailable = true;
    }
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({ where: { email: EMAIL } });
    }
    await app?.close();
  });

  it('registers a new customer (201)', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: EMAIL, password: PASSWORD, name: 'E2E User' })
      .expect(201)
      .expect((res) => {
        expect(res.body.data.email).toBe(EMAIL);
        expect(res.body.data.role).toBe('CUSTOMER');
        expect(res.body.data).not.toHaveProperty('passwordHash');
      });
  });

  it('rejects a duplicate registration (409)', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: EMAIL, password: PASSWORD, name: 'E2E Dup' })
      .expect(409);
  });

  let oldRefreshCookie: string;
  let newRefreshCookie: string;

  it('logs in, returning an access token and a refresh cookie', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.accessToken).toBeTruthy();
        oldRefreshCookie = refreshCookieFrom(res);
        expect(oldRefreshCookie).toContain('refresh_token=');
      });
  });

  it('rejects login with a wrong password (401)', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: 'WrongPass1' })
      .expect(401);
  });

  let accessToken: string;

  it('GET /auth/me returns the user with a bearer token (200)', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200)
      .expect((res) => {
        accessToken = res.body.data.accessToken;
      });

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.data.email).toBe(EMAIL);
      });
  });

  it('GET /auth/me rejects a missing token (401)', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('rotates the refresh token (200) and issues a new cookie', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', oldRefreshCookie)
      .expect(200)
      .expect((res) => {
        expect(res.body.data.accessToken).toBeTruthy();
        newRefreshCookie = refreshCookieFrom(res);
        expect(newRefreshCookie).not.toBe(oldRefreshCookie);
      });
  });

  it('rejects reuse of the rotated-out refresh token (401)', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', oldRefreshCookie)
      .expect(401);
  });

  it('logs out and the current refresh token stops working', async () => {
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', newRefreshCookie)
      .expect(200)
      .expect((res) => {
        expect(res.body.data.message).toBe('Logged out');
      });

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', newRefreshCookie)
      .expect(401);
  });
});
