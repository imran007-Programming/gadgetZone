"use client";

import { Heart } from "lucide-react";
import { useWishlistStore, type LocalWishlistItem } from "@/lib/store/wishlist";
import { useToast } from "@/lib/toast";
import type { Product } from "@/lib/types";

type WishlistProduct =
  | (Pick<Product, "id" | "slug" | "name" | "price" | "imageUrl" | "stock"> & {
      comparePrice?: number | null;
    })
  | LocalWishlistItem;

function normalize(p: WishlistProduct) {
  if ("productId" in p) {
    return {
      id: p.productId,
      slug: p.slug,
      name: p.name,
      price: p.price,
      imageUrl: p.imageUrl,
      stock: p.stock,
      comparePrice: p.comparePrice ?? null,
    };
  }
  return p;
}

/**
 * Heart toggle for the wishlist. Works for guests (localStorage) and
 * logged-in users (server-synced). Stops event propagation so it can sit
 * inside cards/links.
 */
export default function WishlistButton({
  product,
  className = "",
}: {
  product: WishlistProduct;
  className?: string;
}) {
  const toggle = useWishlistStore((s) => s.toggle);
  const isWishlisted = useWishlistStore((s) => s.isWishlisted);
  const toast = useToast();

  const normalized = normalize(product);
  const active = isWishlisted(normalized.id);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(normalized).then(() => {
      toast.success(active ? "Removed from wishlist" : "Added to wishlist");
    });
  };

  return (
    <button
      onClick={handleClick}
      aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={active}
      className={`flex h-9 w-9 items-center justify-center rounded-full ring-1 backdrop-blur transition ${
        active
          ? "bg-lime-400 text-zinc-950 ring-lime-400"
          : "bg-zinc-950/60 text-zinc-300 ring-zinc-700 hover:text-lime-300 hover:ring-lime-400/60"
      } ${className}`}
    >
      <Heart
        className="h-[18px] w-[18px]"
        fill={active ? "currentColor" : "none"}
        strokeWidth={2}
      />
    </button>
  );
}
