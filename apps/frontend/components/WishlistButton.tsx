"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useWishlist } from "@/lib/wishlist";
import { useToast } from "@/lib/toast";

/**
 * Heart toggle for the wishlist. Requires login — redirects to /login
 * otherwise. Stops event propagation so it can sit inside cards/links.
 */
export default function WishlistButton({
  productId,
  productSlug,
  className = "",
}: {
  productId: string;
  productSlug?: string;
  className?: string;
}) {
  const { isAuthenticated } = useAuth();
  const { isWishlisted, toggle, togglePending } = useWishlist();
  const toast = useToast();
  const router = useRouter();

  const active = isWishlisted(productId);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      toast.error("Please log in to use your wishlist");
      const next = productSlug ? `/products/${encodeURIComponent(productSlug)}` : "/wishlist";
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    toggle(productId);
  };

  return (
    <button
      onClick={handleClick}
      disabled={togglePending}
      aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={active}
      className={`flex h-9 w-9 items-center justify-center rounded-full ring-1 backdrop-blur transition ${
        active
          ? "bg-lime-400 text-zinc-950 ring-lime-400"
          : "bg-zinc-950/60 text-zinc-300 ring-zinc-700 hover:text-lime-300 hover:ring-lime-400/60"
      } ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={2}
        className="h-[18px] w-[18px]"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
        />
      </svg>
    </button>
  );
}
