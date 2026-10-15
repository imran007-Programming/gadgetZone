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
import BannerCarousel from "@/components/BannerCarousel";

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

// Cache the homepage for 5 minutes (ISR) — instant loads, fresh data in background.
export const revalidate = 300;

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
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">
          {eyebrow}
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-zinc-900">
          {title}
        </h2>
      </div>
      <Link
        href={href}
        className="shrink-0 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-blue-600 hover:text-blue-700"
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
      {/* Banner carousel */}
      <BannerCarousel />

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
                  className="group flex flex-col items-center gap-2.5 rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-zinc-200/80 transition duration-300 hover:-translate-y-0.5 hover:shadow-md hover:ring-blue-600/50 sm:p-5"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white">
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
            {trending.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
