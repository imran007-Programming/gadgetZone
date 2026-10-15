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
    <div className="group flex flex-col overflow-hidden rounded-[22px] bg-white shadow-[0_2px_16px_rgba(0,0,0,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_8px_28px_rgba(0,0,0,0.10)]">
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-square overflow-hidden bg-white"
      >
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
          className="object-cover transition duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute right-2.5 top-2.5">
          <WishlistButton product={product} />
        </div>
        {hasDiscount && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-bold text-white shadow">
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
            className="absolute bottom-0 left-1/2 flex h-12 w-12 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-2xl bg-white text-zinc-800 shadow-[0_6px_20px_rgba(0,0,0,0.14)] transition-all duration-300 hover:bg-zinc-50 lg:translate-y-[160%] lg:opacity-0 lg:group-hover:translate-y-1/2 lg:group-hover:opacity-100"
          >
            <ShoppingCart className="h-5 w-5" />
          </button>
        )}
      </Link>
      <div className="flex flex-1 flex-col px-4 pb-5 pt-7 text-center">
        <Link href={`/products/${product.slug}`}>
          <h3 className="line-clamp-2 min-h-[2.6em] text-[15px] font-semibold leading-snug text-zinc-900 transition hover:text-blue-700">
            {product.name}
          </h3>
        </Link>
        <p className="mt-1.5 font-display text-lg font-bold text-blue-600">
          {formatPrice(product.price)}
        </p>
        {hasDiscount && (
          <p className="text-xs text-zinc-400 line-through">
            {formatPrice(product.comparePrice!)}
          </p>
        )}
      </div>
    </div>
  );
}
