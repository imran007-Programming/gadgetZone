import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api";
import type { BrandDetail, ProductsResponse } from "@/lib/types";
import ProductCard from "@/components/ProductCard";

// Rendered per request so stock, prices and brand edits are always current
export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low → high" },
  { value: "price-desc", label: "Price: high → low" },
  { value: "name", label: "Name A–Z" },
] as const;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
};

// cache(): generateMetadata and the page share one /brands/:slug request per render
const fetchBrand = cache((slug: string) => apiClient.get<BrandDetail>(`/brands/${encodeURIComponent(slug)}`));

async function getBrand(slug: string): Promise<BrandDetail> {
  try {
    return await fetchBrand(slug);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const brand = await fetchBrand(slug);
    return {
      title: `${brand.name} — GadgetLax`,
      description: brand.description ?? `Shop ${brand.name} gadgets at GadgetLax.`,
      openGraph: brand.bannerUrl ? { images: [brand.bannerUrl] } : undefined,
    };
  } catch {
    return { title: "Brand — GadgetLax" };
  }
}

export default async function BrandPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const sort = SORTS.some((s) => s.value === query.sort) ? query.sort! : "newest";
  const page = Math.max(1, parseInt(query.page ?? "1", 10) || 1);

  // Both only need the slug, so fetch them in parallel
  const [brand, products] = await Promise.all([
    getBrand(slug),
    apiClient
      .get<ProductsResponse>(
        `/products?brand=${encodeURIComponent(slug)}&sort=${sort}&page=${page}&limit=${PAGE_SIZE}`,
      )
      .catch(() => null),
  ]);

  const href = (p: number, s: string = sort) => `/brands/${slug}?sort=${s}${p > 1 ? `&page=${p}` : ""}`;
  const totalPages = products?.meta.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-zinc-500">
        <Link href="/" className="hover:text-primary-600">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-zinc-300" />
        <Link href="/brands" className="hover:text-primary-600">
          Brands
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-zinc-300" />
        <span className="font-semibold text-zinc-900">{brand.name}</span>
      </nav>

      {/* Brand header: cover image with logo and name */}
      <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-200/80">
        <div className="relative aspect-[3/1] bg-gradient-to-br from-zinc-800 to-zinc-950 sm:aspect-[5/1]">
          {brand.bannerUrl && (
            <Image src={brand.bannerUrl} alt={brand.name} fill preload fetchPriority="high" sizes="(max-width: 1450px) 100vw, 1450px" className="object-cover" />
          )}
        </div>
        <div className="flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end">
          <span className="relative -mt-10 flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white font-display text-2xl font-bold text-zinc-700 shadow-md ring-1 ring-zinc-200">
            {brand.logoUrl ? (
              <Image src={brand.logoUrl} alt="" fill sizes="80px" className="object-contain p-2" />
            ) : (
              brand.name.slice(0, 2).toUpperCase()
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-semibold tracking-tight sm:text-3xl sm:font-bold text-zinc-900">{brand.name}</h1>
            {brand.description && <p className="mt-1 max-w-2xl text-sm text-zinc-500">{brand.description}</p>}
          </div>
          <p className="text-sm text-zinc-500">
            <span className="font-semibold text-zinc-900">{brand.productCount}</span> product
            {brand.productCount === 1 ? "" : "s"}
          </p>
        </div>
      </section>

      {/* Sort */}
      <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
        <span className="font-semibold text-zinc-700">Sort:</span>
        {SORTS.map((s) => (
          <Link
            key={s.value}
            href={href(1, s.value)}
            className={`rounded-full px-3 py-1.5 transition ${
              sort === s.value ? "bg-primary-600 font-semibold text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:text-primary-600"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {!products ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-500">
          Products are unavailable right now.
        </p>
      ) : products.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-500">
          No {brand.name} products yet — check back soon.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
          {products.items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
          {page > 1 && (
            <Link href={href(page - 1)} className="flex items-center gap-1 rounded-full bg-white px-4 py-2 text-sm text-zinc-700 ring-1 ring-zinc-200 hover:text-primary-600">
              <ChevronLeft className="h-4 w-4" /> Previous
            </Link>
          )}
          <span className="px-2 text-sm text-zinc-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link href={href(page + 1)} className="flex items-center gap-1 rounded-full bg-white px-4 py-2 text-sm text-zinc-700 ring-1 ring-zinc-200 hover:text-primary-600">
              Next <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
