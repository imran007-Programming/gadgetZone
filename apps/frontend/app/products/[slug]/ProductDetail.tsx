"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, ShoppingCart, Zap } from "lucide-react";
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
export default function ProductDetail({ slug, initialProduct }: { slug: string; initialProduct: Product }) {
  const toast = useToast();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [buying, setBuying] = useState(false);
  // The bottom buy bar shows once the main buy buttons have scrolled up out of view
  const actionsRef = useRef<HTMLDivElement>(null);
  const [showBar, setShowBar] = useState(false);
  // True only in the browser, where document.body exists for the portal
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
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

  const handleBuyNow = async () => {
    const p = productQuery.data;
    if (!p) return;
    setBuying(true);
    try {
      await addItem(p, qty);
      router.push(`/checkout?added=${encodeURIComponent(p.name)}`);
    } catch {
      setBuying(false);
    }
  };

  useEffect(() => {
    const el = actionsRef.current;
    if (!el) return;
    let frame = 0;
    // Shown once the buy buttons have scrolled up behind the sticky header
    const update = () => {
      frame = 0;
      const headerBottom = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
      setShowBar(el.getBoundingClientRect().bottom < Math.max(headerBottom, 0));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [productQuery.isError]);

  // Lets the back-to-top button move up while the bar is on screen
  useEffect(() => {
    const root = document.documentElement;
    if (showBar) root.dataset.buybar = "";
    else delete root.dataset.buybar;
    return () => {
      delete root.dataset.buybar;
    };
  }, [showBar]);

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
    return <ErrorState message={err.message} onRetry={() => productQuery.refetch()} />;
  }

  const p = productQuery.data;
  // Gallery from the API; fall back to the cover for products without a gallery yet.
  const gallery = p.images?.length ? p.images.map((img) => img.url) : p.imageUrl ? [p.imageUrl] : [];
  const outOfStock = p.stock <= 0;
  const hasDiscount = p.comparePrice != null && p.comparePrice > p.price;

  return (
    <div className="space-y-6">
      <BackLink href="/products" label="Back to products" />
      {/* Gallery takes 40% on wider screens, so the details and buttons get more room */}
      <div className="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex flex-col gap-3">
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">
            {gallery[activeImage] ? (
              <Image
                key={gallery[activeImage]}
                src={gallery[activeImage]}
                alt={p.name}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1450px) 40vw, 580px"
                className="object-contain p-4 sm:p-6"
                preload
                fetchPriority="high"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-zinc-400">No image yet</div>
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
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-3xl sm:font-bold">{p.name}</h1>
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
                    <Image
                      src={p.brand.logoUrl}
                      alt={p.brand.name}
                      fill
                      sizes="96px"
                      className="object-contain p-2.5"
                    />
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
            <span className="text-3xl font-bold text-zinc-900">{formatPrice(p.price)}</span>
            {hasDiscount && (
              <>
                <span className="text-lg text-zinc-500 line-through">{formatPrice(p.comparePrice!)}</span>
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
            {outOfStock ? "Out of stock" : p.stock < 10 ? `Only ${p.stock} left in stock` : "In stock"}
          </p>

          <p className="text-sm leading-relaxed text-zinc-500">{p.description}</p>

          <div ref={actionsRef} className="mt-2 flex flex-wrap items-center gap-3">
            <QtyStepper qty={qty} setQty={setQty} max={p.stock || 99} disabled={outOfStock} />
            <button
              onClick={handleAdd}
              disabled={outOfStock || adding}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow transition hover:bg-primary-700 disabled:opacity-40 sm:flex-none sm:px-8"
            >
              <ShoppingCart className="h-4 w-4" />
              {adding ? "Adding…" : "Add to cart"}
            </button>
            <button
              onClick={handleBuyNow}
              disabled={outOfStock || buying}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow transition hover:bg-zinc-700 disabled:opacity-40 sm:flex-none sm:px-8"
            >
              <Zap className="h-4 w-4" />
              {buying ? "Please wait…" : "Buy now"}
            </button>
            <WishlistButton product={p} />
          </div>
        </div>
      </div>

      <ProductReviews productId={p.id} />

      {/* Bottom buy bar: slides up once the main buy buttons scroll out of view.
          Portaled to <body>: a transformed ancestor would otherwise pin it to the page, not the screen. */}
      {mounted &&
        createPortal(
          <div
            aria-hidden={!showBar}
            inert={!showBar}
            className={`fixed inset-x-0 bottom-[calc(62px+env(safe-area-inset-bottom))] z-30 border-t border-zinc-200 bg-white/95 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-transform duration-300 ease-out md:bottom-0 md:z-40 ${
              showBar ? "translate-y-0" : "pointer-events-none translate-y-[calc(100%+80px)]"
            }`}
          >
            <div className="mx-auto flex max-w-[1450px] items-center gap-3 px-4 py-2.5 sm:gap-4 sm:px-6 md:py-3">
              <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-zinc-200 md:h-14 md:w-14">
                {p.imageUrl && <Image src={p.imageUrl} alt="" fill sizes="56px" className="object-contain p-1" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="hidden truncate text-sm font-medium text-zinc-800 sm:block md:text-base">{p.name}</p>
                <p className="text-base font-bold text-primary-600 sm:hidden">{formatPrice(p.price)}</p>
              </div>
              <span className="hidden shrink-0 text-xl font-bold text-primary-600 sm:block">
                {formatPrice(p.price)}
              </span>
              <div className="hidden md:block">
                <QtyStepper qty={qty} setQty={setQty} max={p.stock || 99} disabled={outOfStock} rounded />
              </div>
              <button
                onClick={handleAdd}
                disabled={outOfStock || adding}
                className="shrink-0 rounded-lg bg-primary-600 px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-primary-700 disabled:opacity-40 sm:px-6 sm:text-sm md:py-3"
              >
                {adding ? "Adding…" : "Add To Cart"}
              </button>
              <button
                onClick={handleBuyNow}
                disabled={outOfStock || buying}
                className="shrink-0 rounded-lg bg-zinc-900 px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-40 sm:px-6 sm:text-sm md:py-3"
              >
                {buying ? "Wait…" : "Buy Now"}
              </button>
            </div>
          </div>,
          document.body,
        )}
      {/* Room at the end of the page so the bar never covers the last content */}
      <div aria-hidden className="h-16 md:h-20" />
    </div>
  );
}

const noopSubscribe = () => () => {};

function QtyStepper({
  qty,
  setQty,
  max,
  disabled,
  rounded = false,
}: {
  qty: number;
  setQty: (update: (q: number) => number) => void;
  max: number;
  disabled: boolean;
  rounded?: boolean;
}) {
  return (
    <div className={`flex items-center ring-1 ring-zinc-300 ${rounded ? "rounded-full" : "rounded-lg"}`}>
      <button
        aria-label="Decrease quantity"
        onClick={() => setQty((q) => Math.max(1, q - 1))}
        className="p-2.5 text-zinc-500 transition hover:text-primary-600"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-10 border-x border-zinc-200 text-center text-sm font-semibold">{qty}</span>
      <button
        aria-label="Increase quantity"
        onClick={() => setQty((q) => Math.min(max, q + 1))}
        disabled={disabled}
        className="p-2.5 text-zinc-500 transition hover:text-primary-600 disabled:opacity-30"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
