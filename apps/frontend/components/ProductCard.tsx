"use client";

import Image from "next/image";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/lib/types";
import WishlistButton from "./WishlistButton";
import { useCartStore } from "@/lib/store/cart";
import { useToast } from "@/lib/toast";

export default function ProductCard({ product }: { product: Product }) {
  const outOfStock = product.stock <= 0;
  const hasDiscount =
    product.comparePrice != null && product.comparePrice > product.price;
  const addItem = useCartStore((s) => s.addItem);
  const openDrawer = useCartStore((s) => s.openDrawer);
  const toast = useToast();

  const quickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock) return;
    addItem(
      {
        id: product.id,
        slug: product.slug,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
      },
      1
    );
    toast.success(`Added "${product.name}" to cart`);
    openDrawer();
  };

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl bg-white sm:rounded-[22px] shadow-[0_2px_16px_rgba(0,0,0,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_8px_28px_rgba(0,0,0,0.10)]">
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-square overflow-hidden bg-white"
      >
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
            className="object-contain p-3 transition duration-500 group-hover:scale-105 sm:p-4"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-zinc-400">
            No image yet
          </div>
        )}
        <div className="absolute right-2 top-2 sm:right-2.5 sm:top-2.5">
          <WishlistButton product={product} compact />
        </div>
        {hasDiscount && (
          <span className="absolute left-2 top-2 rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-bold sm:left-2.5 sm:top-2.5 sm:px-2.5 sm:py-1 sm:text-[11px] text-white shadow">
            -{Math.round((1 - product.price / product.comparePrice!) * 100)}%
          </span>
        )}
        {outOfStock && (
          <span className="absolute inset-x-0 bottom-0 bg-white/85 py-1.5 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500 backdrop-blur-sm">
            Out of stock
          </span>
        )}
        {/* Floating cart button: rises from below on hover (always visible on touch) */}
        {!outOfStock && (
          <button
            onClick={quickAdd}
            aria-label={`Add ${product.name} to cart`}
            className="absolute bottom-1 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-white text-zinc-800 shadow-[0_6px_20px_rgba(0,0,0,0.14)] transition-all duration-300 hover:bg-zinc-50 lg:translate-y-[160%] lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100 sm:bottom-3 sm:h-12 sm:w-12 sm:rounded-2xl"
          >
            <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        )}
      </Link>
      <div className="flex flex-1 flex-col px-2.5 pb-3 pt-3 text-center sm:px-4 sm:pb-5 sm:pt-7">
        {product.brand && (
          <Link
            href={`/brands/${product.brand.slug}`}
            className="mb-0.5 text-[9px] font-medium uppercase tracking-widest sm:mb-1 sm:text-[11px] text-zinc-500 transition hover:text-primary-600"
          >
            {product.brand.name}
          </Link>
        )}
        <Link href={`/products/${product.slug}`}>
          <h3 className="line-clamp-2 min-h-[2.6em] text-[13px] font-medium leading-snug sm:text-[15px] text-zinc-800 transition hover:text-primary-700">
            {product.name}
          </h3>
        </Link>
        <p className="mt-1 font-display text-[15px] font-semibold text-primary-600 sm:mt-1.5 sm:text-lg">
          {formatPrice(product.price)}
        </p>
        {hasDiscount && (
          <p className="text-[11px] text-zinc-500 line-through sm:text-xs">
            {formatPrice(product.comparePrice!)}
          </p>
        )}
      </div>
    </div>
  );
}
