import Link from "next/link";
import { apiClient } from "@/lib/api";
import type { Category, ProductsResponse } from "@/lib/types";
import ProductCard from "@/components/ProductCard";

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

// Render on demand — never block the build on API availability.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categories, featured] = await Promise.all([getCategories(), getFeatured()]);

  return (
    <div className="space-y-14">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-zinc-900 ring-1 ring-zinc-800">
        <div className="bg-grid absolute inset-0" aria-hidden />
        <div
          className="absolute -top-32 left-1/4 h-72 w-72 rounded-full bg-lime-400/20 blur-[120px]"
          aria-hidden
        />
        <div
          className="absolute -bottom-32 right-1/4 h-72 w-72 rounded-full bg-emerald-500/10 blur-[120px]"
          aria-hidden
        />
        <div className="relative px-6 py-16 sm:px-12 sm:py-24">
          <p className="inline-flex items-center gap-2 rounded-full bg-lime-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-lime-300 ring-1 ring-lime-400/30">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lime-400" />
            New season collection
          </p>
          <h1 className="mt-6 max-w-2xl font-display text-4xl font-bold leading-[1.05] tracking-tight text-zinc-50 sm:text-6xl">
            Tech that moves
            <span className="text-lime-400"> at your speed.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            Premium audio, wearables, smart home and gaming gear — curated,
            tested, and shipped fast with live order tracking.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/products"
              className="btn-glow rounded-full bg-lime-400 px-7 py-3.5 text-sm font-bold text-zinc-950 transition hover:bg-lime-300"
            >
              Shop all products
            </Link>
            <Link
              href="/products?sort=price-asc"
              className="rounded-full px-7 py-3.5 text-sm font-semibold text-zinc-200 ring-1 ring-zinc-700 transition hover:bg-zinc-800 hover:text-white"
            >
              Deals under $50
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
            {[
              ["100+", "Premium gadgets"],
              ["4.9★", "Average rating"],
              ["24h", "Fast dispatch"],
            ].map(([v, l]) => (
              <div key={l}>
                <p className="font-display text-2xl font-bold text-zinc-50">{v}</p>
                <p className="mt-0.5 text-xs uppercase tracking-wider text-zinc-500">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="animate-fade-up">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-lime-400/80">
              Browse
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-zinc-50">
              Shop by category
            </h2>
          </div>
          <Link
            href="/products"
            className="text-sm font-medium text-zinc-400 transition hover:text-lime-300"
          >
            View all →
          </Link>
        </div>
        {categories.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-800 px-6 py-10 text-center text-sm text-zinc-500">
            Categories are unavailable right now.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/products?category=${encodeURIComponent(c.slug)}`}
                className="group rounded-2xl bg-zinc-900 p-5 text-center ring-1 ring-zinc-800 transition duration-300 hover:-translate-y-1 hover:ring-lime-400/40"
              >
                <p className="font-display text-sm font-semibold text-zinc-100 transition group-hover:text-lime-300">
                  {c.name}
                </p>
                {c.description && (
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-zinc-500">
                    {c.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Featured */}
      <section>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-lime-400/80">
              Fresh drops
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-zinc-50">
              New arrivals
            </h2>
          </div>
          <Link
            href="/products?sort=newest"
            className="text-sm font-medium text-zinc-400 transition hover:text-lime-300"
          >
            View all →
          </Link>
        </div>
        {!featured || featured.items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-800 px-6 py-10 text-center text-sm text-zinc-500">
            No products yet — check back soon.
          </p>
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
