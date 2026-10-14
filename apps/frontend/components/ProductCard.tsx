"use client";

import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/lib/types";
import WishlistButton from "./WishlistButton";

export default function ProductCard({ product }: { product: Product }) {
  const outOfStock = product.stock <= 0;
  const hasDiscount =
    product.comparePrice != null && product.comparePrice > product.price;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-zinc-800 transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_-12px_rgba(163,230,53,0.25)] hover:ring-lime-400/40"
    >
      <div className="relative aspect-square overflow-hidden bg-zinc-800">
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover transition duration-500 group-hover:scale-110"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/50 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
        <div className="absolute right-2.5 top-2.5">
          <WishlistButton product={product} />
        </div>
        {hasDiscount && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-lime-400 px-2.5 py-1 text-[11px] font-bold text-zinc-950 shadow-lg">
            -{Math.round((1 - product.price / product.comparePrice!) * 100)}%
          </span>
        )}
        {outOfStock && (
          <span className="absolute inset-x-0 bottom-0 bg-zinc-950/80 py-1.5 text-center text-xs font-semibold uppercase tracking-wider text-zinc-300 backdrop-blur-sm">
            Out of stock
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        {product.category && (
          <p className="text-[11px] font-semibold uppercase tracking-widest text-lime-400/80">
            {product.category.name}
          </p>
        )}
        <h3 className="line-clamp-2 font-display text-sm font-semibold leading-snug text-zinc-100 transition group-hover:text-lime-300">
          {product.name}
        </h3>
        <div className="mt-auto flex items-baseline gap-2 pt-1.5">
          <span className="font-display text-lg font-bold text-zinc-50">
            {formatPrice(product.price)}
          </span>
          {hasDiscount && (
            <span className="text-xs text-zinc-500 line-through">
              {formatPrice(product.comparePrice!)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
