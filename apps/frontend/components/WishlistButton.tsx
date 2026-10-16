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
  compact = false,
}: {
  product: WishlistProduct;
  className?: string;
  /** Smaller on mobile (product cards); full size from sm up. */
  compact?: boolean;
}) {
  const toggle = useWishlistStore((s) => s.toggle);
  const toast = useToast();

  const normalized = normalize(product);
  // Subscribe to items directly so the component re-renders on change
  const active = useWishlistStore((s) =>
    s.items.some((i) => i.productId === normalized.id)
  );

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Capture button position SYNCHRONOUSLY (before any async work)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (rect.left + rect.width / 2) / window.innerWidth;
    const y = (rect.top + rect.height / 2) / window.innerHeight;
    const wasActive = active;

    // Fire confetti IMMEDIATELY for instant feedback
    // canvas-confetti is loaded on first use so it stays out of the initial bundle
    if (!wasActive) {
      const colors = ["#ff5c38", "#ff7a59", "#f472b6", "#fbbf24", "#34d399"];
      import("canvas-confetti").then(({ default: confetti }) => {
        confetti({
          particleCount: 80,
          spread: 100,
          startVelocity: 40,
          origin: { x, y },
          colors,
          disableForReducedMotion: true,
        });
        setTimeout(() => {
          confetti({ particleCount: 40, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors, disableForReducedMotion: true });
          confetti({ particleCount: 40, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors, disableForReducedMotion: true });
        }, 150);
      });
    }

    toggle(normalized).then(() => {
      toast.success(wasActive ? "Removed from wishlist" : "Added to wishlist");
    });
  };

  return (
    <button
      onClick={handleClick}
      aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={active}
      className={`flex ${compact ? "h-7 w-7 sm:h-9 sm:w-9" : "h-9 w-9"} items-center justify-center rounded-full shadow-sm ring-1 backdrop-blur transition ${
        active
          ? "bg-primary-600 text-white ring-primary-600"
          : "bg-white/90 text-zinc-500 ring-zinc-200 hover:text-primary-600 hover:ring-primary-600/60"
      } ${className}`}
    >
      <Heart
        className={compact ? "h-3.5 w-3.5 sm:h-[18px] sm:w-[18px]" : "h-[18px] w-[18px]"}
        fill={active ? "currentColor" : "none"}
        strokeWidth={2}
      />
    </button>
  );
}
