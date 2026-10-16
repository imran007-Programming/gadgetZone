import Image from "next/image";
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
import type { Banner, Brand, Category, ProductsResponse } from "@/lib/types";
import ProductCard from "@/components/ProductCard";
import BannerCarousel from "@/components/BannerCarousel";

async function getBanners(): Promise<Banner[]> {
  try {
    return await apiClient.get<Banner[]>("/banners");
  } catch {
    return [];
  }
}

async function getBrands(): Promise<Brand[]> {
  try {
    return await apiClient.get<Brand[]>("/brands");
  } catch {
    return [];
  }
}

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

// Render per request. The API is not reachable during `next build` in Docker, so a
// statically prerendered homepage would cache empty sections and keep serving them.
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
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary-700 sm:text-xs">
          {eyebrow}
        </p>
        <h2 className="mt-1 font-display text-lg font-semibold tracking-tight text-zinc-900 sm:text-2xl sm:font-bold">
          {title}
        </h2>
      </div>
      <Link
        href={href}
        className="shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium sm:px-4 sm:py-2 sm:text-sm text-zinc-700 shadow-sm transition hover:border-primary-600 hover:text-primary-700"
      >
        View all →
      </Link>
    </div>
  );
}

export default async function HomePage() {
  const [banners, brands, categories, arrivals, trending] = await Promise.all([
    getBanners(),
    getBrands(),
    getCategories(),
    getNewArrivals(),
    getTrending(),
  ]);

  return (
    <div className="space-y-12">
      {/* Banner carousel (managed in Admin → Banners) */}
      <BannerCarousel banners={banners} />

      {/* Category tiles */}
      <section className="animate-fade-up">
        <SectionHeader eyebrow="Browse" title="Shop by category" href="/products" />
        {categories.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-500">
            Categories are unavailable right now.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:gap-3 lg:grid-cols-7">
            {categories.filter((c) => !c.parentId).map((c) => {
              const Icon = CATEGORY_ICONS[c.slug] ?? Plug;
              return (
                <Link
                  key={c.id}
                  href={`/products?category=${encodeURIComponent(c.slug)}`}
                  className="group flex flex-col items-center gap-1.5 rounded-xl bg-white px-1 py-2.5 text-center sm:gap-2.5 sm:rounded-2xl shadow-sm ring-1 ring-zinc-200/80 transition duration-300 hover:-translate-y-0.5 hover:shadow-md hover:ring-primary-600/50 sm:p-5"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 sm:h-12 sm:w-12 sm:rounded-2xl text-primary-700 transition group-hover:bg-primary-600 group-hover:text-white">
                    <Icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.8} />
                  </span>
                  <span className="text-[10px] font-medium leading-tight text-zinc-700 sm:text-xs">
                    {c.name}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Shop by brand */}
      {brands.some((b) => b.productCount > 0) && (
        <section>
          <SectionHeader eyebrow="Top brands" title="Shop by brand" href="/brands" />
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {brands
              .filter((b) => b.productCount > 0)
              .map((b) => (
                <Link
                  key={b.id}
                  href={`/brands/${b.slug}`}
                  className="group flex flex-col items-center justify-center gap-1 rounded-2xl bg-white px-3 py-4 text-center shadow-sm ring-1 ring-zinc-200/80 transition duration-300 hover:-translate-y-0.5 hover:shadow-md hover:ring-primary-600/50"
                >
                  {b.logoUrl ? (
                    <span className="relative h-10 w-full">
                      <Image src={b.logoUrl} alt={b.name} fill sizes="120px" className="object-contain" />
                    </span>
                  ) : (
                    <span className="font-display text-base font-bold tracking-tight text-zinc-800 group-hover:text-primary-600">
                      {b.name}
                    </span>
                  )}
                  <span className="text-[11px] text-zinc-400">
                    {b.productCount} item{b.productCount === 1 ? "" : "s"}
                  </span>
                </Link>
              ))}
          </div>
        </section>
      )}

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
