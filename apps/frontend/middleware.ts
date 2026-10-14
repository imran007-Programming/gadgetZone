import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Route protection.
 *
 * The backend issues the refresh token as an httpOnly cookie named
 * `refresh_token` with `path: '/'`, so it IS visible to middleware here
 * (httpOnly only blocks client-side JS, not the server).
 *
 * This is a lightweight presence check for UX (fast redirect to /login).
 * It does NOT verify the token — the API is the real enforcer and every
 * protected page also guards client-side via useRequireAuth().
 */
const PROTECTED_PREFIXES = ["/cart", "/orders", "/account", "/admin", "/wishlist"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (!isProtected) return NextResponse.next();

  const hasSession = req.cookies.has("refresh_token");
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/cart/:path*", "/orders/:path*", "/account/:path*", "/admin/:path*", "/wishlist"],
};
