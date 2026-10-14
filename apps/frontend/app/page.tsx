import Link from "next/link";
import { apiClient } from "@/lib/api";
import type { Category, ProductsResponse } from "@/lib/types";
import ProductCard from "@/components/ProductCard";

// Render on demand — never block the build on API availability.
export const dynamic = "force-dynamic";

async function getCategories(): Promise<Category[]> {
  try {
    return await apiClient.get<Category[]>("/categories");
  } catch {
    return [];
  }
}

async function getFeatured(): Promise<ProductsResponse | null> {
  try {
    return await apiClient.get<ProductsResponse>("/products?limit=8&sort=newest");
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const [categories, featured] = await Promise.all([getCategories(), getFeatured()]);

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 px-6 py-14 text-white sm:px-12 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-200">
            New season collection
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Everything you love, in one place.
          </h1>
          <p className="mt-4 max-w-xl text-indigo-100">
            Shop electronics, fashion, home goods and more — with fast checkout
            and order tracking built in.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/products"
              className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-indigo-700 shadow hover:bg-indigo-50"
            >
              Shop all products
            </Link>
            <Link
              href="/products?sort=price-asc"
              className="rounded-xl px-6 py-3 text-sm font-semibold text-white ring-1 ring-white/40 hover:bg-white/10"
            >
              Deals under $50
            </Link>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Shop by category</h2>
          <Link href="/products" className="text-sm font-medium text-indigo-600 hover:underline">
            View all →
          </Link>
        </div>
        {categories.length === 0 ? (
          <p className="text-sm text-slate-500">Categories are unavailable right now.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/products?category=${encodeURIComponent(c.slug)}`}
                className="rounded-xl bg-white p-4 text-center ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                {c.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">{c.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Featured */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">New arrivals</h2>
          <Link href="/products?sort=newest" className="text-sm font-medium text-indigo-600 hover:underline">
            View all →
          </Link>
        </div>
        {!featured || featured.items.length === 0 ? (
          <p className="text-sm text-slate-500">No products yet — check back soon.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {featured.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
