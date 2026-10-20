import { getAccessToken } from "@/lib/api";

/** Next.js data-cache tags for public data the admin panel can change. */
export const CACHE_TAGS = {
  settings: "site-settings",
  categories: "categories",
  banners: "banners",
  products: "products",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

/** Admin toast when revalidateCache fails. */
export const STOREFRONT_REFRESH_FAILED =
  "Saved, but the storefront could not be refreshed right away. It updates when its cache expires.";

/**
 * Admin panel: after saving cached public data, drop it from the storefront's server
 * cache (POST /api/revalidate) so the next page load shows the change. Returns false
 * if that failed; the data then refreshes when its time-based revalidate runs out.
 */
export async function revalidateCache(...tags: CacheTag[]): Promise<boolean> {
  try {
    const res = await fetch("/api/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken() ?? ""}` },
      body: JSON.stringify({ tags }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
