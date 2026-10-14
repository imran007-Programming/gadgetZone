# ShopStack — Full-Stack E-commerce (Monorepo)

A complete full-stack e-commerce application: a Next.js storefront backed by a
NestJS API with Prisma + PostgreSQL. JWT auth (access token in memory, refresh
token in an httpOnly cookie), cart, orders with a mock payment step, and a
full admin panel.

## Architecture overview

```
fullstack-ecommerce/
├── docker-compose.yml          → PostgreSQL 16 (volume pgdata, healthcheck)
├── apps/
│   ├── backend/                → NestJS 12 API (TypeScript, ESM)
│   │   ├── src/
│   │   │   ├── auth/           → register/login/refresh/logout/me, JWT strategies,
│   │   │   │                     guards, throttled login+register
│   │   │   ├── users/          → user service (routes live under /admin)
│   │   │   ├── products/       → public catalog API
│   │   │   ├── categories/     → public category API
│   │   │   ├── cart/           → authenticated cart API
│   │   │   ├── orders/         → checkout, orders, mock payment
│   │   │   ├── admin/          → ADMIN-only: products, categories, orders, users, stats
│   │   │   ├── prisma/         → PrismaService
│   │   │   ├── config/         → Joi-validated env (fails fast at boot)
│   │   │   └── common/         → guards, decorators (@Public, @Roles, @CurrentUser),
│   │   │                         global exception filter, response interceptor
│   │   ├── prisma/
│   │   │   ├── schema.prisma   → User, Category, Product, CartItem, Order, OrderItem
│   │   │   └── seed.ts         → idempotent seed (admin, 5 customers, 6 categories,
│   │   │                         100 products, sample orders)
│   │   └── test/               → vitest unit + supertest e2e specs
│   └── frontend/               → Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
│       ├── app/                → /, /products, /products/[slug], /cart, /checkout,
│       │                         /orders, /orders/[id], /login, /register, /account, /admin
│       └── lib/                → typed API client, AuthProvider, TanStack Query setup,
│                                 Zod schemas, toast system
```

### Tech stack

| Layer    | Tech |
| -------- | ---- |
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4, TanStack Query, React Hook Form + Zod |
| Backend  | NestJS 12, Prisma ORM 6.19, PostgreSQL 16 |
| Auth     | JWT access (15m, in memory only) + refresh (7d, httpOnly `refresh_token` cookie, hashed in DB, rotated on use). Global `JwtAuthGuard` with `@Public()` opt-out, `RolesGuard` with `@Roles('ADMIN')`. Login/register rate-limited. |
| Validation | class-validator + class-transformer (backend), Zod (frontend) |
| API docs | Swagger UI at `/api/docs` |
| Dev DB   | `docker compose up -d` (PostgreSQL 16) |

### Conventions

- Every success response: `{ success: true, data }` (global `TransformInterceptor`).
- Every error response: `{ success: false, message, errors?, statusCode, timestamp, path }`
  (global `HttpExceptionFilter`).
- Money is `Decimal(10,2)`; order items snapshot `unitPrice` at purchase time.

## Setup & run

Prerequisites: Node.js 20+, npm, Docker + Docker Compose.

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Backend
cd apps/backend
cp .env.example .env            # fill in real secrets
npm install --legacy-peer-deps --ignore-scripts --prefer-offline
npx prisma migrate dev          # create tables
npx prisma db seed              # admin + customers + 100 products + orders
npm run start:dev               # → http://localhost:3000

# 3. Frontend (new terminal, from repo root)
cd apps/frontend
cp .env.example .env            # NEXT_PUBLIC_API_URL=http://localhost:3000
npm install
npm run dev                     # → http://localhost:3001
```

> **npm quirk (this environment):** npm is flaky here — installs need
> `npm install --legacy-peer-deps --ignore-scripts --prefer-offline`.
> Because `--ignore-scripts` skips the Prisma engine download, the engine
> binaries (`schema-engine`, `libquery_engine` for `debian-openssl-3.0.x`)
> were fetched manually into `node_modules/@prisma/engines/`. If
> `node_modules` is ever wiped, reinstall with the flags above and re-download
> the two `.gz` files from
> `https://binaries.prisma.sh/all_commits/c2990dca591cba766e3b7ef5d9e8a84796e47ab7/debian-openssl-3.0.x/`
> into `node_modules/@prisma/engines/`.

> **Prisma pin:** `prisma` and `@prisma/client` are pinned to `^6.19.0` — the
> npm registry currently resolves bare `prisma` to an 8.x RC that has no
> `validate` command. Keep the pin.

- API → http://localhost:3000 · Health → `/health` · Swagger → `/api/docs`
- Storefront → http://localhost:3001

## Test credentials (seeded)

| Role     | Email                        | Password     |
| -------- | ---------------------------- | ------------ |
| Admin    | `admin@example.com`          | `Admin@123`  |
| Customer | `priya.patel@example.com`    | `Customer@123` |
| Customer | `aarav.sharma@example.com`   | `Customer@123` |
| Customer | `ananya.singh@example.com`   | `Customer@123` |
| Customer | `rohan.gupta@example.com`    | `Customer@123` |
| Customer | `vikram.mehta@example.com`   | `Customer@123` |

> Change the admin password before any real deployment — it's only for local dev.

## API endpoints

Base URL `http://localhost:3000`. Auth column: **Public**, **User** (any logged-in
user), or **Admin**.

### Auth

| Method | Path             | Auth   | Notes |
| ------ | ---------------- | ------ | ----- |
| POST   | `/auth/register` | Public | Creates a CUSTOMER; rate-limited |
| POST   | `/auth/login`    | Public | Returns access token; sets httpOnly `refresh_token` cookie; rate-limited |
| POST   | `/auth/refresh`  | Public | Rotates refresh token (reuse detected → all sessions revoked) |
| POST   | `/auth/logout`   | Public | Revokes refresh token, clears cookie |
| GET    | `/auth/me`       | User   | Current user profile |

### Catalog (public)

| Method | Path                | Auth   | Notes |
| ------ | ------------------- | ------ | ----- |
| GET    | `/products`         | Public | `page`, `limit`, `search` (name), `category` (slug), `minPrice`, `maxPrice`, `inStock`, `sort` (`price-asc`/`price-desc`/`newest`/`name`) |
| GET    | `/products/:slug`   | Public | Product detail |
| GET    | `/categories`       | Public | All categories |

### Cart (authenticated)

| Method | Path                        | Auth | Notes |
| ------ | --------------------------- | ---- | ----- |
| GET    | `/cart`                     | User | Own cart with product details |
| POST   | `/cart/items`               | User | Body: `{ productId, quantity }`; validates stock |
| PATCH  | `/cart/items/:productId`    | User | Body: `{ quantity }`; validates stock |
| DELETE | `/cart/items/:productId`    | User | Remove one line |
| DELETE | `/cart`                     | User | Clear cart |

### Orders (authenticated)

| Method | Path                  | Auth | Notes |
| ------ | --------------------- | ---- | ----- |
| POST   | `/orders`             | User | Creates order from cart **in a DB transaction**: re-validates stock, decrements stock, snapshots prices, clears cart. Rejects if any item is out of stock. Body: `{ shippingAddress }` |
| GET    | `/orders`             | User | Own orders |
| GET    | `/orders/:id`         | User | Own order only (403 otherwise) |
| POST   | `/orders/:id/cancel`  | User | Only when `PENDING`; restores stock |
| POST   | `/orders/:id/pay`     | User | Mock payment → marks `PAID`. Payment is behind a `PaymentService` interface so Stripe can be plugged in later |

### Admin (ADMIN role only)

| Method | Path                            | Notes |
| ------ | ------------------------------- | ----- |
| POST   | `/admin/products`               | Create product |
| PATCH  | `/admin/products/:id`           | Update product |
| DELETE | `/admin/products/:id`           | Soft delete (`isActive = false`) |
| PATCH  | `/admin/products/:id/stock`     | Set stock |
| POST   | `/admin/categories`             | Create category |
| PATCH  | `/admin/categories/:id`         | Update category |
| DELETE | `/admin/categories/:id`         | Only if the category has no products |
| GET    | `/admin/orders`                 | All orders, `?status=` filter |
| PATCH  | `/admin/orders/:id/status`      | Valid transitions only (e.g. PENDING→PAID→SHIPPED→DELIVERED; CANCELLED is terminal) |
| GET    | `/admin/users`                  | List customers |
| GET    | `/admin/users/:id/orders`       | One customer's orders |
| PATCH  | `/admin/users/:id/disable`      | Disable account (login blocked) |
| PATCH  | `/admin/users/:id/enable`       | Re-enable account |
| GET    | `/admin/stats`                  | Total revenue, order count by status, low-stock products, new customers (last 30 days) |

Also: `GET /` (hello) and `GET /health` (public).

## Environment variables

### Backend (`apps/backend/.env` — see `.env.example`)

| Variable                 | Purpose |
| ------------------------ | ------- |
| `DATABASE_URL`           | PostgreSQL connection string |
| `JWT_ACCESS_SECRET`      | Secret for access tokens (generate: `openssl rand -base64 32`) |
| `JWT_REFRESH_SECRET`     | Secret for refresh tokens |
| `JWT_ACCESS_EXPIRES_IN`  | e.g. `15m` |
| `JWT_REFRESH_EXPIRES_IN` | e.g. `7d` |
| `FRONTEND_URL`           | Allowed CORS origin (default `http://localhost:3001`) |
| `PORT`                   | Backend port (default `3000`) |

### Frontend (`apps/frontend/.env`)

| Variable              | Purpose |
| --------------------- | ------- |
| `NEXT_PUBLIC_API_URL` | Base URL of the NestJS API, no trailing slash (default `http://localhost:3000`) |

## Tests

```bash
cd apps/backend
npm test                # unit tests (vitest): auth service, order transaction, stock logic
npm run test:e2e        # e2e (supertest): auth + order flow
```

E2E needs PostgreSQL: point `TEST_DATABASE_URL` at an **empty** test database
(the suite runs migrations itself and **skips** if the variable is unset):

```bash
TEST_DATABASE_URL="postgresql://ecommerce:ecommerce@localhost:5433/ecommerce_test?schema=public" \
  npm run test:e2e
```

## Deployment notes

- **Frontend → Vercel:** import `apps/frontend`, set `NEXT_PUBLIC_API_URL` to the
  public backend URL, deploy. (Framework preset: Next.js; no custom build config needed.)
- **Backend → any Node host** (Railway / Render / VPS / Fly.io): needs Node 20+,
  `DATABASE_URL` pointing at a managed Postgres, and real `JWT_*_SECRET` values.
  Build with `npm run build`, run with `npm run start:prod` (or `node dist/main`).
  Run `npx prisma migrate deploy` (not `migrate dev`) on the server, then
  `npx prisma db seed` once.
- **Database → managed Postgres** (Neon / Supabase / RDS). Update `DATABASE_URL`
  everywhere.
- Change the seeded admin password immediately; rotate `JWT_*_SECRET` to fresh
  random values; set `FRONTEND_URL` to the real storefront origin.

## TODO / known limitations

- **No live E2E in this dev VM:** Docker isn't installed here, so PostgreSQL
  couldn't be started locally — unit tests pass, but the DB-backed e2e suite and
  `prisma migrate` were not executed in this environment. Run them on your machine
  (`docker compose up -d`, then the commands above).
- **`middleware.ts` → `proxy.ts`:** Next.js 16 renamed Middleware to Proxy;
  `apps/frontend/middleware.ts` still uses the old convention and should be
  migrated to `proxy.ts`.
- **Admin can't reactivate soft-deleted products:** there is no
  `GET /admin/products` listing (the public `/products` hides `isActive: false`
  items), so a soft-deleted product can only be restored directly in the DB.
  Add an admin product list including inactive items.
- **Mock payment only:** `/orders/:id/pay` simulates payment — wire a real
  provider (Stripe) behind the existing `PaymentService` interface before
  production.
- **No email/notifications, no product images upload** (seed uses
  `picsum.photos` placeholders), no order tracking beyond status.
