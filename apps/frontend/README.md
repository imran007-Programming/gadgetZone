# ShopStack Frontend (Next.js)

Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 storefront for the
ShopStack e-commerce monorepo.

## Stack
- Next.js App Router, React 19, TypeScript
- Tailwind CSS v4
- TanStack Query (data fetching), React Hook Form + Zod (forms)
- Tiny hand-rolled toast system (`lib/toast.tsx`) — no extra dependency

## Setup
```bash
cd apps/frontend
cp .env.example .env        # set NEXT_PUBLIC_API_URL (default http://localhost:3000)
npm install
npm run dev                 # → http://localhost:3001
npm run build               # production build
```

The backend must be running (`apps/backend`: `npm run start:dev` on :3000).

## Auth design
- Access token lives **only in module memory** (`lib/api.ts`), never in
  localStorage.
- On app load, `AuthProvider` calls `POST /auth/refresh` (httpOnly cookie)
  then `GET /auth/me`.
- The API client attaches `Authorization: Bearer <token>` and, on a 401,
  refreshes **once** and retries the original request a single time.
- `middleware.ts` does a lightweight presence check for the `refresh_token`
  cookie (it has `path: '/'`, so middleware can see it) and redirects
  unauthenticated visitors away from `/cart /checkout /orders /account /admin*`.
  This is UX-only — the API is the real enforcer, and every protected page
  also guards client-side via `RequireAuth` (with `adminOnly` for `/admin`).

## Pages
| Route | Description |
|---|---|
| `/` | Hero, categories, new arrivals |
| `/products` | Grid; search, category, price range, sort, in-stock, pagination — all in URL query params |
| `/products/[slug]` | Detail, quantity picker, add to cart |
| `/cart` | Cart lines, quantity edit, clear |
| `/checkout` | Shipping form (Zod) → create order → mock payment → success |
| `/orders`, `/orders/[id]` | Order history, detail, cancel/pay when PENDING |
| `/login`, `/register` | Zod-validated forms |
| `/account` | Profile + logout |
| `/admin` | Stats, product CRUD + stock, category CRUD, order status, user enable/disable |

## Test accounts (seeded)
- Admin: `admin@example.com` / `Admin@123`
- Customer: `priya.patel@example.com` / `Customer@123`
