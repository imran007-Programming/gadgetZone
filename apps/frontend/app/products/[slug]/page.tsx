import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { apiClient, ApiError } from "@/lib/api";
import type { Product } from "@/lib/types";
import ProductDetail from "./ProductDetail";

// Rendered per request so price and stock are always current. Without this,
// a build-time failure (API not reachable during `next build`) would be cached.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

async function getProduct(slug: string): Promise<Product> {
  try {
    return await apiClient.get<Product>(`/products/${encodeURIComponent(slug)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await apiClient.get<Product>(`/products/${encodeURIComponent(slug)}`);
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
  const { slug } = await params;
  const product = await getProduct(slug);
  return <ProductDetail slug={slug} initialProduct={product} />;
}
