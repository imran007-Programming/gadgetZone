"use client";

import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { buildQuery } from "@/lib/utils";
import type { Category, ProductsResponse, ProductSort } from "@/lib/types";
import ProductCard from "@/components/ProductCard";
import { EmptyState, ErrorState, Field, Pagination, Spinner, inputClass } from "@/components/ui";

const SORTS: { value: ProductSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low → high" },
  { value: "price-desc", label: "Price: high → low" },
  { value: "name", label: "Name A–Z" },
];

const LIMIT = 12;

export default function ProductsPage() {
  return (
    <Suspense fallback={<Spinner label="Loading products…" />}>
      <ProductsContent />
    </Suspense>
  );
}

function ProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const params = useMemo(
    () => ({
      search: searchParams.get("q") ?? "",
      category: searchParams.get("category") ?? "",
      minPrice: searchParams.get("minPrice") ?? "",
      maxPrice: searchParams.get("maxPrice") ?? "",
      inStock: searchParams.get("inStock") ?? "",
      sort: (searchParams.get("sort") as ProductSort) || "newest",
      page: Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1),
    }),
    [searchParams]
  );

  const setParam = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in updates)) next.delete("page"); // reset to page 1 on filter change
    router.push(`/products${next.toString() ? `?${next.toString()}` : ""}`, {
      scroll: false,
    });
  };

  const queryString = buildQuery({
    search: params.search || undefined,
    category: params.category || undefined,
    minPrice: params.minPrice || undefined,
    maxPrice: params.maxPrice || undefined,
    inStock: params.inStock === "1" ? "true" : undefined,
    sort: params.sort,
    page: params.page,
    limit: LIMIT,
  });

  const productsQuery = useQuery({
    queryKey: ["products", queryString],
    queryFn: () => apiClient.get<ProductsResponse>(`/products${queryString}`),
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiClient.get<Category[]>("/categories"),
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900">Products</h1>

      {/* Filters — all reflected in the URL */}
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-200 sm:grid-cols-3 lg:grid-cols-6">
        <div className="col-span-2 sm:col-span-1">
          <Field label="Search">
            <input
              className={inputClass}
              placeholder="Search products…"
              defaultValue={params.search}
              key={params.search}
              onKeyDown={(e) => {
                if (e.key === "Enter") setParam({ q: (e.target as HTMLInputElement).value.trim() });
              }}
              onBlur={(e) => {
                if (e.target.value.trim() !== params.search)
                  setParam({ q: e.target.value.trim() });
              }}
            />
          </Field>
        </div>
        <Field label="Category">
          <select
            className={inputClass}
            value={params.category}
            onChange={(e) => setParam({ category: e.target.value })}
          >
            <option value="">All categories</option>
            {categoriesQuery.data?.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Min price">
          <input
            type="number"
            min={0}
            className={inputClass}
            placeholder="0"
            defaultValue={params.minPrice}
            key={`min-${params.minPrice}`}
            onBlur={(e) => setParam({ minPrice: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") setParam({ minPrice: (e.target as HTMLInputElement).value });
            }}
          />
        </Field>
        <Field label="Max price">
          <input
            type="number"
            min={0}
            className={inputClass}
            placeholder="500"
            defaultValue={params.maxPrice}
            key={`max-${params.maxPrice}`}
            onBlur={(e) => setParam({ maxPrice: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") setParam({ maxPrice: (e.target as HTMLInputElement).value });
            }}
          />
        </Field>
        <Field label="Sort by">
          <select
            className={inputClass}
            value={params.sort}
            onChange={(e) => setParam({ sort: e.target.value })}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-end pb-0.5">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-700">
            <input
              type="checkbox"
              checked={params.inStock === "1"}
              onChange={(e) => setParam({ inStock: e.target.checked ? "1" : "" })}
              className="h-4 w-4 rounded border-zinc-300 text-lime-600"
            />
            In stock only
          </label>
        </div>
      </div>

      {/* Results */}
      {productsQuery.isPending ? (
        <Spinner label="Loading products…" />
      ) : productsQuery.isError ? (
        <ErrorState
          message={(productsQuery.error as Error).message}
          onRetry={() => productsQuery.refetch()}
        />
      ) : productsQuery.data.items.length === 0 ? (
        <EmptyState
          title="No products found"
          hint="Try adjusting your search or filters."
          action={
            <button
              onClick={() => router.push("/products")}
              className="rounded-lg bg-lime-500 px-4 py-2 text-sm font-medium text-white hover:bg-lime-600"
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <>
          <p className="text-sm text-zinc-500">
            {productsQuery.data.meta.total} product
            {productsQuery.data.meta.total === 1 ? "" : "s"} found
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {productsQuery.data.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          <Pagination
            page={productsQuery.data.meta.page}
            totalPages={productsQuery.data.meta.totalPages}
            onPage={(p) => setParam({ page: String(p) })}
          />
        </>
      )}
    </div>
  );
}
