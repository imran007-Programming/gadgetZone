import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { apiClient } from "@/lib/api";
import type { Brand } from "@/lib/types";

export const metadata: Metadata = {
  title: "All Brands — GadgetLax",
  description: "Shop gadgets by brand: Apple, Sony, Samsung, JBL, Anker and more.",
};

// Brands change from the admin dashboard, so render per request
export const dynamic = "force-dynamic";

async function getBrands(): Promise<Brand[]> {
  try {
    return await apiClient.get<Brand[]>("/brands");
  } catch {
    return [];
  }
}

export default async function BrandsPage() {
  const brands = await getBrands();

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-zinc-500">
        <Link href="/" className="hover:text-primary-600">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-zinc-300" />
        <span className="font-semibold text-zinc-900">Brands</span>
      </nav>

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary-600">Shop by brand</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-zinc-900">All brands</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {brands.length} brand{brands.length === 1 ? "" : "s"} — pick one to see all its products.
        </p>
      </div>

      {brands.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-500">
          Brands are unavailable right now.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {brands.map((b) => (
            <Link
              key={b.id}
              href={`/brands/${b.slug}`}
              className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200/80 transition duration-300 hover:-translate-y-0.5 hover:shadow-md hover:ring-primary-600/50"
            >
              <div className="relative aspect-[16/7] bg-gradient-to-br from-zinc-100 to-zinc-200">
                {b.bannerUrl && (
                  <Image src={b.bannerUrl} alt="" fill sizes="(max-width: 640px) 50vw, 25vw" className="object-cover" />
                )}
              </div>
              <div className="flex items-center gap-3 px-4 pb-4">
                <span className="relative -mt-6 flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white font-display text-lg font-bold text-zinc-700 shadow ring-1 ring-zinc-200">
                  {b.logoUrl ? (
                    <Image src={b.logoUrl} alt="" fill sizes="56px" className="object-contain p-1.5" />
                  ) : (
                    b.name.slice(0, 2).toUpperCase()
                  )}
                </span>
                <span className="min-w-0 pt-2">
                  <span className="block truncate font-semibold text-zinc-900 group-hover:text-primary-600">{b.name}</span>
                  <span className="block text-xs text-zinc-500">
                    {b.productCount} product{b.productCount === 1 ? "" : "s"}
                  </span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
