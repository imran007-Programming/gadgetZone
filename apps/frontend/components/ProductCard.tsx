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
    <div className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200/80 transition duration-300 hover:-translate-y-1 hover:shadow-lg hover:ring-lime-500/40">
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-square overflow-hidden bg-zinc-100"
      >
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
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
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <Link href={`/products/${product.slug}`}>
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-900 transition hover:text-lime-700">
            {product.name}
          </h3>
        </Link>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="flex flex-col">
            <span className="font-display text-base font-bold text-lime-700">
              {formatPrice(product.price)}
            </span>
            {hasDiscount && (
              <span className="text-xs text-zinc-400 line-through">
                {formatPrice(product.comparePrice!)}
              </span>
            )}
          </div>
          <button
            onClick={quickAdd}
            disabled={outOfStock}
            aria-label={`Add ${product.name} to cart`}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-lime-500 text-white shadow-sm transition hover:bg-lime-600 disabled:opacity-30"
          >
            <ShoppingCart className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
