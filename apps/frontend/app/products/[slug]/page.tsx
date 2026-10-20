import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { apiClient, ApiError } from "@/lib/api";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { Product } from "@/lib/types";
import ProductDetail from "./ProductDetail";

/**
 * Cached on the Next server; the admin panel drops the "products" tag when it saves a product.
 * Orders change stock without the admin panel, so the 60s revalidate is the fallback, and
 * ProductDetail refetches the product in the browser on mount, so live stock shows right away.
 * cache(): generateMetadata and the page share one request per render.
 */
const fetchProduct = cache((slug: string) =>
  apiClient.get<Product>(`/products/${encodeURIComponent(slug)}`, {
    next: { revalidate: 60, tags: [CACHE_TAGS.products] },
  })
);

type Params = { params: Promise<{ slug: string }> };

async function getProduct(slug: string): Promise<Product> {
  try {
    return await fetchProduct(slug);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await fetchProduct(slug);
    return {
      title: `${product.name} — GadgetLax`,
      description: product.description?.slice(0, 160),
      openGraph: { images: [product.imageUrl] },
    };
  } catch {
    // notFound() is handled by the page itself so the response gets a real 404 status
    return { title: "Product — GadgetLax" };
  }
}

export default async function ProductPage({ params }: Params) {
  // Render per request, never at build time: the API is not reachable during `next build` in Docker
  await connection();
  const { slug } = await params;
  const product = await getProduct(slug);
  return <ProductDetail slug={slug} initialProduct={product} />;
}
