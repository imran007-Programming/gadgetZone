"use client";

import Image from "next/image";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useWishlist } from "@/lib/wishlist";
import { formatPrice } from "@/lib/utils";
import {
  EmptyState,
  ErrorState,
  RequireAuth,
  Spinner,
} from "@/components/ui";
import WishlistButton from "@/components/WishlistButton";

export default function WishlistPage() {
  return (
    <RequireAuth>
      <WishlistContent />
    </RequireAuth>
  );
}

function WishlistContent() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { items, isPending, isError, remove } = useWishlist();

  const moveToCart = useMutation({
    mutationFn: async (productId: string) => {
      await apiClient.post("/cart/items", { productId, quantity: 1 });
      await apiClient.del(`/wishlist/${productId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      toast.success("Moved to cart");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending) return <Spinner label="Loading wishlist…" />;
  if (isError)
    return <ErrorState message="Couldn't load your wishlist." onRetry={() => window.location.reload()} />;

  if (items.length === 0) {
    return (
      <EmptyState
        title="Your wishlist is empty"
        hint="Tap the heart on any product to save it here."
        action={
          <Link
            href="/products"
            className="rounded-full bg-lime-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-lime-300"
          >
            Discover products
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-50">
        Wishlist ({items.length} item{items.length === 1 ? "" : "s"})
      </h1>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ productId, product }) => {
          const outOfStock = product.stock <= 0;
          const hasDiscount =
            product.comparePrice != null && product.comparePrice > product.price;
          return (
            <li
              key={productId}
              className="group relative flex flex-col overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-zinc-800 transition hover:ring-lime-400/40"
            >
              <div className="absolute right-2.5 top-2.5 z-10">
                <WishlistButton productId={productId} productSlug={product.slug} />
              </div>
              <Link href={`/products/${product.slug}`} className="relative aspect-[4/3] overflow-hidden bg-zinc-800">
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                {outOfStock && (
                  <span className="absolute inset-x-0 bottom-0 bg-zinc-950/80 py-1.5 text-center text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    Out of stock
                  </span>
                )}
              </Link>
              <div className="flex flex-1 flex-col gap-1.5 p-4">
                <Link href={`/products/${product.slug}`}>
                  <h3 className="line-clamp-2 font-display text-sm font-semibold text-zinc-100 hover:text-lime-300">
                    {product.name}
                  </h3>
                </Link>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-lg font-bold text-zinc-50">
                    {formatPrice(product.price)}
                  </span>
                  {hasDiscount && (
                    <span className="text-xs text-zinc-500 line-through">
                      {formatPrice(product.comparePrice!)}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => moveToCart.mutate(productId)}
                    disabled={outOfStock || moveToCart.isPending}
                    className="flex-1 rounded-full bg-lime-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-lime-300 disabled:opacity-40"
                  >
                    Move to cart
                  </button>
                  <button
                    onClick={() => remove(productId)}
                    className="rounded-full px-4 py-2 text-sm font-medium text-rose-400 ring-1 ring-zinc-700 transition hover:bg-zinc-800"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
