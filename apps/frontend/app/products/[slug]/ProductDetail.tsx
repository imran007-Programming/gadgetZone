"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api";
import { useCartStore } from "@/lib/store/cart";
import { useToast } from "@/lib/toast";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/lib/types";
import { BackLink, EmptyState, ErrorState } from "@/components/ui";
import WishlistButton from "@/components/WishlistButton";
import ProductReviews from "@/components/ProductReviews";

/**
 * Interactive half of the product page. The server page renders the first
 * paint with `initialProduct`, so this component only handles quantity,
 * cart and wishlist actions plus a background refetch.
 */
export default function ProductDetail({
  slug,
  initialProduct,
}: {
  slug: string;
  initialProduct: Product;
}) {
  const toast = useToast();
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const addItem = useCartStore((s) => s.addItem);
  const openDrawer = useCartStore((s) => s.openDrawer);

  const productQuery = useQuery({
    queryKey: ["product", slug],
    queryFn: () => apiClient.get<Product>(`/products/${encodeURIComponent(slug)}`),
    initialData: initialProduct,
  });

  const handleAdd = async () => {
    const p = productQuery.data;
    if (!p) return;
    setAdding(true);
    try {
      await addItem(p, qty);
      toast.success(`Added ${qty} × "${p.name}" to cart`);
      openDrawer();
    } finally {
      setAdding(false);
    }
  };

  if (productQuery.isError) {
    const err = productQuery.error;
    if (err instanceof ApiError && err.status === 404) {
      return (
        <EmptyState
          title="Product not found"
          hint="It may have been removed."
          action={<BackLink href="/products" label="Back to products" />}
        />
      );
    }
    return (
      <ErrorState message={err.message} onRetry={() => productQuery.refetch()} />
    );
  }

  const p = productQuery.data;
  // Gallery from the API; fall back to the cover for products without a gallery yet.
  const gallery = p.images?.length
    ? p.images.map((img) => img.url)
    : p.imageUrl
      ? [p.imageUrl]
      : [];
  const outOfStock = p.stock <= 0;
  const hasDiscount = p.comparePrice != null && p.comparePrice > p.price;

  return (
    <div className="space-y-6">
      <BackLink href="/products" label="Back to products" />
      <div className="grid gap-8 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">
            {gallery[activeImage] ? (
              <Image
                key={gallery[activeImage]}
                src={gallery[activeImage]}
                alt={p.name}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-contain p-4 sm:p-6"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                No image yet
              </div>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {gallery.map((url, i) => (
                <button
                  key={url}
                  onClick={() => setActiveImage(i)}
                  aria-label={`Show image ${i + 1}`}
                  aria-pressed={i === activeImage}
                  className={`relative aspect-square overflow-hidden rounded-lg bg-white ring-2 transition ${
                    i === activeImage ? "ring-primary-600" : "ring-transparent hover:ring-zinc-300"
                  }`}
                >
                  <Image src={url} alt="" fill sizes="120px" className="object-contain p-1" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {(p.brand || p.category) && (
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-600">
              {p.brand && (
                <Link href={`/brands/${p.brand.slug}`} className="hover:underline">
                  {p.brand.name}
                </Link>
              )}
              {p.brand && p.category && <span className="mx-2 text-zinc-300">·</span>}
              {p.category && (
                <Link href={`/products?category=${p.category.slug}`} className="hover:underline">
                  {p.category.name}
                </Link>
              )}
            </p>
          )}
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-3xl sm:font-bold">
              {p.name}
            </h1>
            {/* Brand badge: opens the brand page with its other products */}
            {p.brand && (
              <Link
                href={`/brands/${p.brand.slug}`}
                title={`More from ${p.brand.name}`}
                aria-label={`See all ${p.brand.name} products`}
                className="group flex shrink-0 flex-col items-center gap-1"
              >
                <span className="relative flex h-16 w-24 items-center justify-center overflow-hidden rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-zinc-200 transition group-hover:-translate-y-0.5 group-hover:shadow-md group-hover:ring-primary-400">
                  {p.brand.logoUrl ? (
                    <Image src={p.brand.logoUrl} alt={p.brand.name} fill sizes="96px" className="object-contain p-2.5" />
                  ) : (
                    <span className="font-display text-sm font-bold text-zinc-700">{p.brand.name}</span>
                  )}
                </span>
                <span className="text-[11px] font-medium text-zinc-400 transition group-hover:text-primary-600">
                  More from {p.brand.name} →
                </span>
              </Link>
            )}
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-zinc-900">
              {formatPrice(p.price)}
            </span>
            {hasDiscount && (
              <>
                <span className="text-lg text-zinc-500 line-through">
                  {formatPrice(p.comparePrice!)}
                </span>
                <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700">
                  Save {formatPrice(p.comparePrice! - p.price)}
                </span>
              </>
            )}
          </div>

          <p
            className={`text-sm font-medium ${
              outOfStock ? "text-rose-600" : p.stock < 10 ? "text-amber-400" : "text-emerald-400"
            }`}
          >
            {outOfStock
              ? "Out of stock"
              : p.stock < 10
                ? `Only ${p.stock} left in stock`
                : "In stock"}
          </p>

          <p className="text-sm leading-relaxed text-zinc-500">{p.description}</p>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-lg ring-1 ring-zinc-300">
              <button
                aria-label="Decrease quantity"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="p-2.5 text-zinc-500 transition hover:text-primary-600"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-10 text-center text-sm font-semibold">{qty}</span>
              <button
                aria-label="Increase quantity"
                onClick={() => setQty((q) => Math.min(p.stock || 99, q + 1))}
                disabled={outOfStock}
                className="p-2.5 text-zinc-500 transition hover:text-primary-600 disabled:opacity-30"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={handleAdd}
              disabled={outOfStock || adding}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-primary-600 disabled:opacity-40 sm:flex-none sm:px-10"
            >
              <ShoppingCart className="h-4 w-4" />
              {adding ? "Adding…" : "Add to cart"}
            </button>
            <WishlistButton product={p} />
          </div>
        </div>
      </div>

      <ProductReviews productId={p.id} />
    </div>
  );
}
