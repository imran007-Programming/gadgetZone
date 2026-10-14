import Link from "next/link";
import {
  Camera,
  Cpu,
  Gamepad2,
  Headphones,
  Home,
  Plug,
  Watch,
  type LucideIcon,
} from "lucide-react";
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

async function getNewArrivals(): Promise<ProductsResponse | null> {
  try {
    return await apiClient.get<ProductsResponse>("/products?limit=8&sort=newest");
  } catch {
    return null;
  }
}

async function getTrending(): Promise<ProductsResponse | null> {
  try {
    return await apiClient.get<ProductsResponse>("/products?limit=8&sort=price-desc");
  } catch {
    return null;
  }
}

// Render on demand — never block the build on API availability.
export const dynamic = "force-dynamic";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  audio: Headphones,
  wearables: Watch,
  "smart-home": Home,
  "mobile-accessories": Plug,
  computing: Cpu,
  "cameras-drones": Camera,
  gaming: Gamepad2,
};

function SectionHeader({
  eyebrow,
  title,
  href,
}: {
  eyebrow: string;
  title: string;
  href: string;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-lime-700">
          {eyebrow}
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-zinc-900">
          {title}
        </h2>
      </div>
      <Link
        href={href}
        className="shrink-0 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-lime-500 hover:text-lime-700"
      >
        View all →
      </Link>
    </div>
  );
}

export default async function HomePage() {
  const [categories, arrivals, trending] = await Promise.all([
    getCategories(),
    getNewArrivals(),
    getTrending(),
  ]);

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-lime-500 via-lime-400 to-emerald-400">
        <div className="bg-dots absolute inset-0" aria-hidden />
        <div className="relative px-6 py-14 sm:px-12 sm:py-20">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/25 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-white backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            New season collection
          </p>
          <h1 className="mt-5 max-w-xl font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl">
            Gadgets you&apos;ll love, prices you&apos;ll like.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/90 sm:text-base">
            Audio, wearables, smart home and gaming gear — curated, tested and
            shipped fast.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/products"
              className="rounded-full bg-white px-7 py-3 text-sm font-bold text-lime-700 shadow-lg transition hover:bg-lime-50"
            >
              Shop all products
            </Link>
            <Link
              href="/products?sort=price-asc"
              className="rounded-full px-7 py-3 text-sm font-semibold text-white ring-2 ring-white/60 transition hover:bg-white/10"
            >
              Deals under $50
            </Link>
          </div>
        </div>
      </section>

      {/* Category tiles */}
      <section className="animate-fade-up">
        <SectionHeader eyebrow="Browse" title="Shop by category" href="/products" />
        {categories.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-500">
            Categories are unavailable right now.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {categories.map((c) => {
              const Icon = CATEGORY_ICONS[c.slug] ?? Plug;
              return (
                <Link
                  key={c.id}
                  href={`/products?category=${encodeURIComponent(c.slug)}`}
                  className="group flex flex-col items-center gap-2.5 rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-zinc-200/80 transition duration-300 hover:-translate-y-0.5 hover:shadow-md hover:ring-lime-500/50 sm:p-5"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-100 text-lime-700 transition group-hover:bg-lime-500 group-hover:text-white">
                    <Icon className="h-6 w-6" strokeWidth={1.8} />
                  </span>
                  <span className="text-xs font-semibold leading-tight text-zinc-800">
                    {c.name}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* New arrivals */}
      <section>
        <SectionHeader eyebrow="Fresh drops" title="New arrivals" href="/products?sort=newest" />
        {!arrivals || arrivals.items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-500">
            No products yet — check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {arrivals.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* Trending */}
      <section>
        <SectionHeader eyebrow="Popular" title="Trending now" href="/products" />
        {!trending || trending.items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-500">
            No products yet — check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {trending.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
