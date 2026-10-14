"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, ShoppingCart, Trash2 } from "lucide-react";
import { useWishlistStore } from "@/lib/store/wishlist";
import { useCartStore } from "@/lib/store/cart";
import { useToast } from "@/lib/toast";
import { formatPrice } from "@/lib/utils";
import { EmptyState, Spinner } from "@/components/ui";
import WishlistButton from "@/components/WishlistButton";

export function WishlistContent() {
  const toast = useToast();
  const items = useWishlistStore((s) => s.items);
  const loading = useWishlistStore((s) => s.loading);
  const hydrated = useWishlistStore((s) => s.hydrated);
  const remove = useWishlistStore((s) => s.remove);
  const addToCart = useCartStore((s) => s.addItem);
  const openDrawer = useCartStore((s) => s.openDrawer);

  if (!hydrated || loading) return <Spinner label="Loading wishlist…" />;

  if (items.length === 0) {
    return (
      <EmptyState
        title="Your wishlist is empty"
        hint="Tap the heart on any product to save it here."
        action={
          <Link
            href="/products"
            className="inline-flex items-center gap-2 rounded-full bg-lime-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-lime-600"
          >
            <Heart className="h-4 w-4" />
            Discover products
          </Link>
        }
      />
    );
  }

  const moveToCart = async (productId: string) => {
    const item = items.find((i) => i.productId === productId);
    if (!item) return;
    await addToCart(
      {
        id: item.productId,
        slug: item.slug,
        name: item.name,
        price: item.price,
        imageUrl: item.imageUrl,
      },
      1
    );
    await remove(productId);
    toast.success(`Moved "${item.name}" to cart`);
    openDrawer();
  };

  const handleRemove = async (productId: string, name: string) => {
    await remove(productId);
    toast.success(`Removed "${name}" from wishlist`);
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900">
        Wishlist ({items.length} item{items.length === 1 ? "" : "s"})
      </h1>

      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {items.map((item) => {
          const outOfStock = item.stock <= 0;
          const hasDiscount =
            item.comparePrice != null && item.comparePrice > item.price;
          return (
            <li
              key={item.productId}
              className="group relative flex flex-col overflow-hidden rounded-2xl bg-zinc-50 ring-1 ring-zinc-200 transition hover:ring-lime-500/40"
            >
              <div className="absolute right-2.5 top-2.5 z-10">
                <WishlistButton product={item} />
              </div>
              <Link
                href={`/products/${item.slug}`}
                className="relative aspect-[4/3] overflow-hidden bg-zinc-100"
              >
                <Image
                  src={item.imageUrl}
                  alt={item.name}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover transition duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                {outOfStock && (
                  <span className="absolute inset-x-0 bottom-0 bg-white/90 py-1.5 text-center text-xs font-semibold uppercase tracking-wider text-zinc-600">
                    Out of stock
                  </span>
                )}
              </Link>
              <div className="flex flex-1 flex-col gap-1.5 p-4">
                <Link href={`/products/${item.slug}`}>
                  <h3 className="line-clamp-2 font-display text-sm font-semibold text-zinc-900 hover:text-lime-700">
                    {item.name}
                  </h3>
                </Link>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-lg font-bold text-zinc-900">
                    {formatPrice(item.price)}
                  </span>
                  {hasDiscount && (
                    <span className="text-xs text-zinc-500 line-through">
                      {formatPrice(item.comparePrice!)}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => moveToCart(item.productId)}
                    disabled={outOfStock}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-lime-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-lime-600 disabled:opacity-40"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Move to cart
                  </button>
                  <button
                    onClick={() => handleRemove(item.productId, item.name)}
                    className="rounded-full p-2 text-rose-400 ring-1 ring-zinc-300 transition hover:bg-zinc-100"
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
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

export default function WishlistPage() {
  return <WishlistContent />;
}
