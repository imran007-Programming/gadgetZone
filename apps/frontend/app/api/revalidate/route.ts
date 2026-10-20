import { revalidateTag } from "next/cache";
import { apiClient } from "@/lib/api";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { User } from "@/lib/types";

const ALLOWED_TAGS = new Set<string>(Object.values(CACHE_TAGS));

/**
 * Drops cached public data after the admin panel changes it (see revalidateCache).
 * Admin only: the caller's access token is checked against the API, so visitors
 * can't keep wiping the cache.
 */
export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ") || authorization === "Bearer ") {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  let user: User;
  try {
    user = await apiClient.get<User>("/auth/me", { headers: { Authorization: authorization }, cache: "no-store" });
  } catch {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return Response.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { tags?: unknown } | null;
  const tags = Array.isArray(body?.tags)
    ? body.tags.filter((t): t is string => typeof t === "string" && ALLOWED_TAGS.has(t))
    : [];
  if (tags.length === 0) {
    return Response.json({ message: "No known tags to revalidate" }, { status: 400 });
  }

  // expire: 0 makes the next request fetch fresh data instead of serving the old copy
  // once more, which matters for the checkout's bKash/Nagad numbers and delivery fees.
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
  return Response.json({ revalidated: tags });
}
