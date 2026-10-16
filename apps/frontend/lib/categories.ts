import { useQuery } from "@tanstack/react-query";
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

/** Storefront category tree, shared cache with every other ["categories"] query. */
export function useCategoryTree() {
  const query = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiClient.get<Category[]>("/categories"),
    staleTime: 10 * 60 * 1000,
  });
  return { ...query, tree: buildCategoryTree(query.data ?? []) };
}

export function useSiteSettings() {
  return useQuery({
    queryKey: ["site-settings"],
    queryFn: () => apiClient.get<SiteSettings>("/settings"),
    staleTime: 5 * 60 * 1000,
  });
}
