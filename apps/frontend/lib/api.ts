/**
 * Typed API client for the NestJS backend.
 *
 * Isomorphic: safe to import from server components (public endpoints only —
 * the in-memory token is null on the server) and client components.
 * - Base URL from NEXT_PUBLIC_API_URL (default http://localhost:3000).
 * - Access token lives ONLY in module memory (never stored).
 * - Every request sends `credentials: 'include'` so the httpOnly
 *   `refresh_token` cookie travels with /auth/* calls; a js-cookie copy on
 *   the storefront domain is the fallback when that cookie is blocked.
 * - On 401 the client calls POST /auth/refresh ONCE and retries the
 *   original request a single time.
 * - Success envelopes `{ success: true, data }` are unwrapped automatically.
 */

import Cookies from "js-cookie";

// Server components run inside the frontend container (Docker), where
// "localhost" is not the API. API_INTERNAL_URL lets SSR reach the backend service.
const API_URL =
  (typeof window === "undefined" && process.env.API_INTERNAL_URL?.replace(/\/$/, "")) ||
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  // Dev fallback: same host as the page, so a phone on the LAN reaches the PC's API
  (typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:3000` : "http://localhost:3000");

let accessToken: string | null = null;

/**
 * Which session this page uses: the admin portal (admin.<domain>, or /admin on
 * the main host) or the storefront. Each side has its own auth endpoints and
 * refresh token, so an admin login never mixes with a customer login.
 */
export type AuthScope = "admin" | "customer";

export function authScope(): AuthScope {
  if (typeof window === "undefined") return "customer";
  const { hostname, pathname } = window.location;
  return hostname.startsWith("admin.") || pathname === "/admin" || pathname.startsWith("/admin/")
    ? "admin"
    : "customer";
}

/** /auth/login → /auth/admin/login on the admin portal (same for refresh and logout). */
export function authPath(action: "login" | "refresh" | "logout"): string {
  return authScope() === "admin" ? `/auth/admin/${action}` : `/auth/${action}`;
}

/**
 * Refresh token backup for browsers that block the API's cross-site cookie
 * (e.g. Safari ITP). Kept in a first-party cookie, one per side.
 */
const refreshKey = () => (authScope() === "admin" ? "gadgetlax-admin-refresh" : "gadgetlax-refresh");
/** Matches the API's refresh token lifetime (JWT_REFRESH_EXPIRES_IN=7d). */
const REFRESH_COOKIE_DAYS = 7;

function refreshCookieOptions(): Cookies.CookieAttributes {
  return {
    expires: REFRESH_COOKIE_DAYS,
    path: "/",
    sameSite: "lax",
    // Only sent over HTTPS in production; plain http://localhost still works in dev
    secure: window.location.protocol === "https:",
  };
}

function getStoredRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  const REFRESH_KEY = refreshKey();
  const fromCookie = Cookies.get(REFRESH_KEY);
  if (fromCookie) return fromCookie;
  // One-time move for sessions saved by the older localStorage version
  try {
    const legacy = localStorage.getItem(REFRESH_KEY);
    if (legacy) {
      localStorage.removeItem(REFRESH_KEY);
      Cookies.set(REFRESH_KEY, legacy, refreshCookieOptions());
      return legacy;
    }
  } catch {
    /* storage blocked */
  }
  return null;
}

export function setStoredRefreshToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) Cookies.set(refreshKey(), token, refreshCookieOptions());
  else Cookies.remove(refreshKey(), { path: "/" });
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export class ApiError extends Error {
  status: number;
  errors?: unknown;
  constructor(message: string, status: number, errors?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: unknown;
  statusCode?: number;
}

async function parseJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

/** In-flight refresh, shared so parallel callers never rotate the same token twice. */
let refreshInFlight: Promise<string | null> | null = null;

/**
 * Call POST /auth/refresh (or /auth/admin/refresh on the admin portal) using the
 * httpOnly cookie (or stored token fallback).
 * Returns the new access token or null. Concurrent calls share one request,
 * because each refresh rotates the token and a second call with the old one
 * would look like token reuse to the API.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doRefresh(): Promise<string | null> {
  try {
    const stored = getStoredRefreshToken();
    const res = await fetch(`${API_URL}${authPath("refresh")}`, {
      method: "POST",
      credentials: "include",
      headers: stored ? { "Content-Type": "application/json" } : undefined,
      body: stored ? JSON.stringify({ refreshToken: stored }) : undefined,
    });
    if (!res.ok) {
      setAccessToken(null);
      setStoredRefreshToken(null);
      return null;
    }
    const json = (await parseJson(res)) as Envelope<{
      accessToken: string;
      refreshToken?: string;
    }>;
    const token = json?.data?.accessToken;
    setAccessToken(typeof token === "string" ? token : null);
    if (typeof json?.data?.refreshToken === "string") {
      setStoredRefreshToken(json.data.refreshToken);
    }
    return getAccessToken();
  } catch {
    setAccessToken(null);
    return null;
  }
}

type ApiOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** Request timeout in ms. Defaults to 10s; use a longer one for uploads. */
  timeoutMs?: number;
};

export async function api<T>(
  path: string,
  options: ApiOptions = {},
  retryOn401 = true
): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const doFetch = async (token: string | null) => {
    const headers = new Headers();
    // FormData sets its own multipart boundary, so only JSON bodies get a content type.
    if (options.body !== undefined && !isFormData) headers.set("Content-Type", "application/json");
    if (options.headers) {
      new Headers(options.headers).forEach((v, k) => headers.set(k, v));
    }
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      credentials: "include",
      // Fail fast (10s by default) so pages never hang on a slow/dead API; uploads pass their own limit.
      signal: AbortSignal.timeout(options.timeoutMs ?? 10000),
      body:
        options.body === undefined
          ? undefined
          : isFormData
            ? (options.body as FormData)
            : JSON.stringify(options.body),
    });
  };

  let res: Response;
  try {
    res = await doFetch(getAccessToken());
  } catch {
    throw new ApiError("API unreachable", 0);
  }

  // Single 401 → refresh → retry. Never retry the auth endpoints themselves.
  if (res.status === 401 && retryOn401 && !path.startsWith("/auth/")) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await doFetch(newToken);
    }
  }

  const json = (await parseJson(res)) as Partial<Envelope<T>> & {
    message?: string;
  };

  if (!res.ok || json.success === false) {
    const message =
      (typeof json.message === "string" && json.message) ||
      `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status, (json as { errors?: unknown }).errors);
  }

  // Unwrap { success: true, data } — fall back to the raw body for safety.
  if (json && typeof json === "object" && "data" in json) {
    return json.data as T;
  }
  return json as T;
}

export const apiClient = {
  get: <T,>(path: string, init?: ApiOptions) => api<T>(path, { ...init, method: "GET" }),
  post: <T,>(path: string, body?: unknown, init?: ApiOptions) =>
    api<T>(path, { ...init, method: "POST", body }),
  patch: <T,>(path: string, body?: unknown, init?: ApiOptions) =>
    api<T>(path, { ...init, method: "PATCH", body }),
  put: <T,>(path: string, body?: unknown, init?: ApiOptions) =>
    api<T>(path, { ...init, method: "PUT", body }),
  del: <T,>(path: string, init?: ApiOptions) => api<T>(path, { ...init, method: "DELETE" }),
};
