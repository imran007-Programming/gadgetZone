/**
 * Typed API client for the NestJS backend.
 *
 * Isomorphic: safe to import from server components (public endpoints only —
 * the in-memory token is null on the server) and client components.
 * - Base URL from NEXT_PUBLIC_API_URL (default http://localhost:3000).
 * - Access token lives ONLY in module memory (never localStorage).
 * - Every request sends `credentials: 'include'` so the httpOnly
 *   `refresh_token` cookie travels with /auth/* calls.
 * - On 401 the client calls POST /auth/refresh ONCE and retries the
 *   original request a single time.
 * - Success envelopes `{ success: true, data }` are unwrapped automatically.
 */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:3000";

let accessToken: string | null = null;

/** Refresh token backup for browsers blocking cross-site cookies (e.g. Safari ITP). */
const REFRESH_KEY = "gadgetlax-refresh";

function getStoredRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function setStoredRefreshToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) localStorage.setItem(REFRESH_KEY, token);
    else localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* ignore */
  }
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

/** Call POST /auth/refresh using the httpOnly cookie (or stored token fallback). Returns the new access token or null. */
export async function refreshAccessToken(): Promise<string | null> {
  try {
    const stored = getStoredRefreshToken();
    const res = await fetch(`${API_URL}/auth/refresh`, {
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

type ApiOptions = Omit<RequestInit, "body"> & { body?: unknown };

export async function api<T>(
  path: string,
  options: ApiOptions = {},
  retryOn401 = true
): Promise<T> {
  const doFetch = async (token: string | null) => {
    const headers = new Headers();
    if (options.body !== undefined) headers.set("Content-Type", "application/json");
    if (options.headers) {
      new Headers(options.headers).forEach((v, k) => headers.set(k, v));
    }
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      credentials: "include",
      // Fail fast (10s) so builds and pages never hang on a slow/dead API.
      signal: AbortSignal.timeout(10000),
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
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
