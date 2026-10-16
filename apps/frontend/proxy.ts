import { NextResponse, type NextRequest } from "next/server";

/**
 * Admin portal on its own subdomain.
 *
 * - admin.<domain>: everything is the admin app. "/" → /admin (sign-in if
 *   needed) and "/login" → /admin/login; storefront pages are not served there.
 * - main domain: with ADMIN_URL set (e.g. https://admin.example.com), /admin
 *   links are sent to the portal. Without it /admin keeps working on the main
 *   host, which is what localhost and a LAN IP (no subdomains) need.
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const { pathname, search } = request.nextUrl;
  const onAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");

  if (host.startsWith("admin.")) {
    if (onAdminPath) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = pathname === "/" ? "/admin" : `/admin${pathname}`;
    return NextResponse.redirect(url);
  }

  const adminUrl = process.env.ADMIN_URL;
  if (onAdminPath && adminUrl) {
    return NextResponse.redirect(new URL(`${pathname}${search}`, adminUrl));
  }
  return NextResponse.next();
}

export const config = {
  // Pages only: skip Next internals, API routes and files with an extension (images, icons…)
  matcher: ["/((?!_next/|api/|.*\\..*).*)"],
};
