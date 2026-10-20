import { useQuery, type QueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { Category, CategoryNode, SiteSettings } from "@/lib/types";

const byPosition = (a: Category, b: Category) =>
  (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name);

/**
 * Groups the flat /categories list into top-level categories with their
 * subcategories, both in display order. A subcategory whose parent is missing
 * is shown as top-level so it never disappears.
 */
export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const ids = new Set(categories.map((c) => c.id));
  const roots = categories.filter((c) => !c.parentId || !ids.has(c.parentId)).sort(byPosition);
  return roots.map((root) => ({
    ...root,
    children: categories.filter((c) => c.parentId === root.id).sort(byPosition),
  }));
}

const CATEGORIES_KEY = ["categories"];
const SITE_SETTINGS_KEY = ["site-settings"];

/** Site settings + categories fetched by the root layout on the server. */
export interface ChromeData {
  settings: SiteSettings | null;
  categories: Category[] | null;
  /** When the server fetched them; a prerendered page's copy counts as stale and refetches. */
  fetchedAt: number;
}

/**
 * Seeds the query cache with the server-fetched header data, so the top bar and
 * category nav are in the first HTML instead of popping in (and shifting the page)
 * after the client fetch.
 */
export function seedChromeData(queryClient: QueryClient, data: ChromeData) {
  if (data.settings) queryClient.setQueryData(SITE_SETTINGS_KEY, data.settings, { updatedAt: data.fetchedAt });
  if (data.categories) queryClient.setQueryData(CATEGORIES_KEY, data.categories, { updatedAt: data.fetchedAt });
}

/** Storefront category tree, shared cache with every other ["categories"] query. */
export function useCategoryTree() {
  const query = useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: () => apiClient.get<Category[]>("/categories"),
    staleTime: 10 * 60 * 1000,
  });
  return { ...query, tree: buildCategoryTree(query.data ?? []) };
}

export function useSiteSettings() {
  return useQuery({
    queryKey: SITE_SETTINGS_KEY,
    queryFn: () => apiClient.get<SiteSettings>("/settings"),
    staleTime: 5 * 60 * 1000,
  });
}
