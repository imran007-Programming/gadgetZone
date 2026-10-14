/**
 * Cart → order → pay / cancel e2e, with stock assertions.
 *
 * Requires PostgreSQL. Point TEST_DATABASE_URL at an EMPTY test database,
 * run the migrations against it once, then run the suite:
 *
 *   DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy
 *   npm run test:e2e
 *
 * Without TEST_DATABASE_URL the suite skips itself (no database available).
 * Even with it set, the suite skips if the database is unreachable.
 *
 * The suite registers a fresh customer, seeds its own category + products
 * directly through Prisma, and cleans everything up in afterAll.
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
const EMAIL = `orders-e2e-${RUN_ID}@example.com`;
const OTHER_EMAIL = `orders-e2e-other-${RUN_ID}@example.com`;
const PASSWORD = 'StrongPass1';
const CATEGORY_SLUG = `e2e-cat-${RUN_ID}`;

const SHIPPING = {
  name: 'E2E Buyer',
  street: '12 Main Street',
  city: 'Dhaka',
  postalCode: '1000',
  country: 'Bangladesh',
};

describe.skipIf(!TEST_DATABASE_URL)('Orders (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let server: unknown;
  let productAId: string;
  let productBId: string;

  const authed = async (email: string) => {
    await request(server as never)
      .post('/auth/register')
      .send({ email, password: PASSWORD, name: 'E2E' })
      .expect(201);
    const login = await request(server as never)
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return login.body.data.accessToken as string;
  };
  const authHeader = (token: string) => ({
    Authorization: `Bearer ${token}`,
  });

  beforeAll(async (ctx) => {
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
      server = app.getHttpServer();

      const category = await prisma.category.create({
        data: { name: `E2E ${RUN_ID}`, slug: CATEGORY_SLUG },
      });
      const productA = await prisma.product.create({
        data: {
          name: 'E2E Alpha Tee',
          slug: `e2e-alpha-${RUN_ID}`,
          description: 'seeded for e2e',
          price: 25.5,
          stock: 10,
          imageUrl: 'e2e-img',
          categoryId: category.id,
        },
      });
      const productB = await prisma.product.create({
        data: {
          name: 'E2E Beta Cap',
          slug: `e2e-beta-${RUN_ID}`,
          description: 'seeded for e2e',
          price: 10,
          stock: 2,
          imageUrl: 'e2e-img',
          categoryId: category.id,
        },
      });
      productAId = productA.id;
      productBId = productB.id;
    } catch {
      await app?.close().catch(() => undefined);
      ctx.skip();
    }
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.orderItem.deleteMany({
        where: { product: { slug: { endsWith: RUN_ID } } },
      });
      await prisma.order.deleteMany({
        where: { user: { email: { in: [EMAIL, OTHER_EMAIL] } } },
      });
      await prisma.cartItem.deleteMany({
        where: { user: { email: { in: [EMAIL, OTHER_EMAIL] } } },
      });
      await prisma.product.deleteMany({ where: { slug: { endsWith: RUN_ID } } });
      await prisma.category.deleteMany({ where: { slug: CATEGORY_SLUG } });
      await prisma.user.deleteMany({
        where: { email: { in: [EMAIL, OTHER_EMAIL] } },
      });
    }
    await app?.close();
  });

  let token: string;
  let orderId: string;

  it('registers + logs in a fresh customer', async () => {
    token = await authed(EMAIL);
    expect(token).toBeTruthy();
  });

  it('rejects adding more than the available stock to the cart (400)', async () => {
    await request(server as never)
      .post('/cart/items')
      .set(authHeader(token))
      .send({ productId: productAId, quantity: 999 })
      .expect(400);
  });

  it('adds an item to the cart with line totals', async () => {
    await request(server as never)
      .post('/cart/items')
      .set(authHeader(token))
      .send({ productId: productAId, quantity: 2 })
      .expect(201)
      .expect((res) => {
        const cart = res.body.data;
        expect(cart.items).toHaveLength(1);
        expect(cart.items[0].lineTotal).toBe(51);
        expect(cart.subtotal).toBe(51);
        expect(cart.itemCount).toBe(2);
      });
  });

  it('rejects raising the cart quantity beyond stock (400)', async () => {
    await request(server as never)
      .patch(`/cart/items/${productAId}`)
      .set(authHeader(token))
      .send({ quantity: 11 })
      .expect(400);
  });

  it('creates an order from the cart with a price snapshot', async () => {
    await request(server as never)
      .post('/orders')
      .set(authHeader(token))
      .send({ shippingAddress: SHIPPING })
      .expect(201)
      .expect((res) => {
        const order = res.body.data;
        expect(order.status).toBe('PENDING');
        expect(order.totalAmount).toBe(51);
        expect(order.items).toHaveLength(1);
        expect(order.items[0].productId).toBe(productAId);
        expect(order.items[0].quantity).toBe(2);
        expect(order.items[0].unitPrice).toBe(25.5);
        orderId = order.id;
      });
  });

  it('decrements stock and empties the cart', async () => {
    const product = await prisma.product.findUnique({
      where: { id: productAId },
    });
    expect(product?.stock).toBe(8);

    const cart = await request(server as never)
      .get('/cart')
      .set(authHeader(token))
      .expect(200);
    expect(cart.body.data.items).toHaveLength(0);
  });

  it('lists the order and fetches it by id', async () => {
    const list = await request(server as never)
      .get('/orders')
      .set(authHeader(token))
      .expect(200);
    expect(list.body.data.some((o: { id: string }) => o.id === orderId)).toBe(
      true,
    );

    await request(server as never)
      .get(`/orders/${orderId}`)
      .set(authHeader(token))
      .expect(200)
      .expect((res) => {
        expect(res.body.data.id).toBe(orderId);
      });
  });

  it('hides another user\u2019s order (404)', async () => {
    const otherToken = await authed(OTHER_EMAIL);
    await request(server as never)
      .get(`/orders/${orderId}`)
      .set(authHeader(otherToken))
      .expect(404);
  });

  it('pays a PENDING order (mock gateway)', async () => {
    await request(server as never)
      .post(`/orders/${orderId}/pay`)
      .set(authHeader(token))
      .expect(201)
      .expect((res) => {
        expect(res.body.data.status).toBe('PAID');
      });
  });

  it('rejects cancelling a PAID order (400)', async () => {
    await request(server as never)
      .post(`/orders/${orderId}/cancel`)
      .set(authHeader(token))
      .expect(400);
  });

  it('cancels a second PENDING order and restores stock', async () => {
    await request(server as never)
      .post('/cart/items')
      .set(authHeader(token))
      .send({ productId: productBId, quantity: 1 })
      .expect(201);

    const created = await request(server as never)
      .post('/orders')
      .set(authHeader(token))
      .send({ shippingAddress: SHIPPING })
      .expect(201);
    const secondOrderId = created.body.data.id as string;

    const before = await prisma.product.findUnique({
      where: { id: productBId },
    });
    expect(before?.stock).toBe(1);

    await request(server as never)
      .post(`/orders/${secondOrderId}/cancel`)
      .set(authHeader(token))
      .expect(201)
      .expect((res) => {
        expect(res.body.data.status).toBe('CANCELLED');
      });

    const after = await prisma.product.findUnique({
      where: { id: productBId },
    });
    expect(after?.stock).toBe(2);
  });
});
