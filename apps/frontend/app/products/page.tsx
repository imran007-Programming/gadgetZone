"use client";

import { Suspense, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronRight, X } from "lucide-react";
import { apiClient } from "@/lib/api";
import { buildQuery, formatPrice } from "@/lib/utils";
import type { Brand, Category, ProductsResponse, ProductSort } from "@/lib/types";
import ProductCard from "@/components/ProductCard";
import { EmptyState, ErrorState, Pagination, Spinner } from "@/components/ui";

const SORTS: { value: ProductSort; label: string }[] = [
  { value: "newest", label: "Sort by latest" },
  { value: "price-asc", label: "Price: low → high" },
  { value: "price-desc", label: "Price: high → low" },
  { value: "name", label: "Name A–Z" },
];

const LIMITS = [9, 12, 18, 24];

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
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");

  const params = useMemo(
    () => ({
      search: searchParams.get("q") ?? "",
      category: searchParams.get("category") ?? "",
      // Several brands can be selected: ?brand=sony,apple
      brands: (searchParams.get("brand") ?? "").split(",").filter(Boolean),
      minPrice: searchParams.get("minPrice") ?? "",
      maxPrice: searchParams.get("maxPrice") ?? "",
      inStock: searchParams.get("inStock") ?? "",
      sort: (searchParams.get("sort") as ProductSort) || "newest",
      page: Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1),
      limit: parseInt(searchParams.get("limit") ?? "12", 10) || 12,
    }),
    [searchParams]
  );

  const setParam = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in updates)) next.delete("page");
    router.push(`/products${next.toString() ? `?${next.toString()}` : ""}`, {
      scroll: false,
    });
  };

  const queryString = buildQuery({
    search: params.search || undefined,
    category: params.category || undefined,
    brand: params.brands.length ? params.brands.join(",") : undefined,
    minPrice: params.minPrice || undefined,
    maxPrice: params.maxPrice || undefined,
    inStock: params.inStock === "1" ? "true" : undefined,
    sort: params.sort,
    page: params.page,
    limit: params.limit,
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

  // In a category, only brands that have products there (counts for that category)
  const brandsQuery = useQuery({
    queryKey: ["brands", params.category],
    queryFn: () =>
      apiClient.get<Brand[]>(
        params.category ? `/brands?category=${encodeURIComponent(params.category)}` : "/brands",
      ),
    staleTime: 10 * 60 * 1000,
  });

  const activeCategory = categoriesQuery.data?.find((c) => c.slug === params.category);
  // Built from the URL so a brand from another category can still be removed
  const selectedBrands = params.brands.map((slug) => {
    const known = brandsQuery.data?.find((b) => b.slug === slug);
    return { id: known?.id ?? slug, slug, name: known?.name ?? slug };
  });

  const toggleBrand = (slug: string) => {
    const next = params.brands.includes(slug)
      ? params.brands.filter((b) => b !== slug)
      : [...params.brands, slug];
    setParam({ brand: next.join(",") });
  };

  const applyPriceFilter = () => {
    setParam({ minPrice: priceMin.trim(), maxPrice: priceMax.trim() });
  };

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      {/* Sidebar filters */}
      <aside className="w-full shrink-0 space-y-8 lg:w-60">
        {/* Shop by category */}
        <div>
          <h3 className="mb-3 text-sm font-bold text-zinc-900">Shop By Category</h3>
          <ul className="space-y-1">
            <li>
              <Link
                href="/products"
                className={`block py-1 text-sm transition ${
                  !params.category
                    ? "font-semibold text-primary-600"
                    : "text-zinc-500 hover:text-primary-600"
                }`}
              >
                All Products
              </Link>
            </li>
            {(categoriesQuery.data ?? []).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/products?category=${c.slug}`}
                  className={`block py-1 text-sm transition ${
                    params.category === c.slug
                      ? "font-semibold text-primary-600"
                      : "text-zinc-500 hover:text-primary-600"
                  }`}
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-zinc-200" />

        {/* Shop by brand */}
        {(brandsQuery.data?.length ?? 0) > 0 && (
          <>
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-900">Shop By Brand</h3>
                {params.brands.length > 0 && (
                  <button
                    onClick={() => setParam({ brand: "" })}
                    className="text-xs font-medium text-primary-600 hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              {/* One row per brand: name on the left, logo on the right */}
              <ul className="max-h-80 space-y-1.5 overflow-y-auto p-0.5">
                {brandsQuery.data!.map((b) => {
                  const selected = params.brands.includes(b.slug);
                  return (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() => toggleBrand(b.slug)}
                        aria-pressed={selected}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left transition ${
                          selected
                            ? "bg-primary-50 ring-1 ring-primary-600"
                            : "bg-white ring-1 ring-zinc-200 hover:ring-primary-300"
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            selected ? "border-primary-600 bg-primary-600 text-white" : "border-zinc-300 bg-white"
                          }`}
                        >
                          {selected && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-sm ${selected ? "font-semibold text-primary-700" : "text-zinc-700"}`}>
                            {b.name}
                          </span>
                          <span className="block text-[11px] text-zinc-400">
                            {b.productCount} product{b.productCount === 1 ? "" : "s"}
                          </span>
                        </span>
                        {b.logoUrl && (
                          <span className="relative h-8 w-14 shrink-0">
                            <Image src={b.logoUrl} alt="" fill sizes="56px" className="object-contain" />
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="border-t border-zinc-200" />
          </>
        )}

        {/* Stock status */}
        <div>
          <h3 className="mb-3 text-sm font-bold text-zinc-900">Stock Status</h3>
          <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm text-zinc-600">
            <input
              type="checkbox"
              checked={params.inStock === "1"}
              onChange={(e) => setParam({ inStock: e.target.checked ? "1" : "" })}
              className="h-4 w-4 rounded border-zinc-300 text-primary-600 focus:ring-primary-600"
            />
            In stock
          </label>
        </div>

        <div className="border-t border-zinc-200" />

        {/* Filter by price */}
        <div>
          <h3 className="mb-3 text-sm font-bold text-zinc-900">Filter By Price</h3>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              placeholder="Min"
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyPriceFilter()}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-600"
            />
            <span className="text-zinc-400">—</span>
            <input
              type="number"
              min={0}
              placeholder="Max"
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyPriceFilter()}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-600"
            />
          </div>
          {(params.minPrice || params.maxPrice) && (
            <p className="mt-2 text-xs text-zinc-500">
              Price: {params.minPrice ? formatPrice(Number(params.minPrice)) : "৳ 0"} —{" "}
              {params.maxPrice ? formatPrice(Number(params.maxPrice)) : "∞"}
            </p>
          )}
          <button
            onClick={applyPriceFilter}
            className="mt-3 rounded-lg bg-zinc-100 px-5 py-2 text-xs font-bold uppercase tracking-wide text-zinc-700 transition hover:bg-primary-600 hover:text-white"
          >
            Filter
          </button>
          {(params.minPrice || params.maxPrice) && (
            <button
              onClick={() => {
                setPriceMin("");
                setPriceMax("");
                setParam({ minPrice: "", maxPrice: "" });
              }}
              className="ml-2 text-xs text-zinc-400 underline hover:text-zinc-600"
            >
              Clear
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        {/* Breadcrumb */}
        <nav className="mb-4 flex items-center gap-1.5 text-sm text-zinc-500">
          <Link href="/" className="hover:text-primary-600">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-300" />
          <span className="font-semibold text-zinc-900">
            {activeCategory
              ? activeCategory.name
              : selectedBrands.length === 1
                ? selectedBrands[0].name
                : params.search
                  ? `Search: "${params.search}"`
                  : "All Products"}
          </span>
        </nav>

        {/* Toolbar */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-500">
            {productsQuery.data ? (
              <>
                <span className="font-semibold text-zinc-900">{productsQuery.data.meta.total}</span> products found
              </>
            ) : (
              "Loading…"
            )}
          </p>
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1.5 text-sm">
              <span className="font-semibold text-zinc-700">Show:</span>
              {LIMITS.map((l) => (
                <button
                  key={l}
                  onClick={() => setParam({ limit: String(l) })}
                  className={`px-1 transition ${
                    params.limit === l
                      ? "font-bold text-primary-600 underline"
                      : "text-zinc-500 hover:text-primary-600"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <select
              value={params.sort}
              onChange={(e) => setParam({ sort: e.target.value })}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 outline-none focus:border-primary-600"
              aria-label="Sort products"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected brands */}
        {selectedBrands.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {selectedBrands.map((b) => (
              <button
                key={b.id}
                onClick={() => toggleBrand(b.slug)}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 ring-1 ring-primary-200 hover:bg-primary-100"
                aria-label={`Remove brand filter ${b.name}`}
              >
                {b.name}
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}

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
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                Clear filters
              </button>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {productsQuery.data.items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            <div className="mt-8">
              <Pagination
                page={productsQuery.data.meta.page}
                totalPages={productsQuery.data.meta.totalPages}
                onPage={(p) => setParam({ page: String(p) })}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
