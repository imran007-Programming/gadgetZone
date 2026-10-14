"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useCartDrawer } from "@/lib/cart-drawer";
import { formatPrice } from "@/lib/utils";
import type { Cart } from "@/lib/types";
import { Spinner } from "@/components/ui";

/**
 * Slide-over cart drawer. Shares the ["cart"] query key with the /cart page
 * so both stay in sync. Opened from the Header cart icon.
 */
export default function CartDrawer() {
  const { isOpen, close } = useCartDrawer();
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  const cartQuery = useQuery({
    queryKey: ["cart"],
    queryFn: () => apiClient.get<Cart>("/cart"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["cart"] });

  const updateQty = useMutation({
    mutationFn: ({ productId, quantity }: { productId: string; quantity: number }) =>
      apiClient.patch(`/cart/items/${productId}`, { quantity }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const removeItem = useMutation({
    mutationFn: (productId: string) => apiClient.del(`/cart/items/${productId}`),
    onSuccess: () => {
      invalidate();
      toast.success("Removed from cart");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Lock body scroll + close on Escape while open.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, close]);

  if (!isOpen) return null;

  const cart = cartQuery.data;

  const go = (href: string) => {
    close();
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <button
        aria-label="Close cart"
        onClick={close}
        className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm"
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-zinc-950 ring-1 ring-zinc-800 shadow-2xl animate-slide-in-right">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="font-display text-lg font-bold text-zinc-50">
            Your cart
            {cart && cart.itemCount > 0 && (
              <span className="ml-2 rounded-full bg-lime-400/15 px-2 py-0.5 text-xs font-bold text-lime-300">
                {cart.itemCount}
              </span>
            )}
          </h2>
          <button
            onClick={close}
            aria-label="Close"
            className="rounded-full p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {cartQuery.isPending && <Spinner label="Loading cart…" />}
          {cartQuery.isError && (
            <p className="text-sm text-rose-400">
              Couldn&apos;t load your cart. {(cartQuery.error as Error).message}
            </p>
          )}
          {cart && cart.items.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <p className="text-4xl">🛒</p>
              <p className="font-semibold text-zinc-200">Your cart is empty</p>
              <p className="text-sm text-zinc-500">
                Browse the catalog and add something you like.
              </p>
              <button
                onClick={() => go("/products")}
                className="mt-2 rounded-full bg-lime-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-lime-300"
              >
                Shop products
              </button>
            </div>
          )}
          {cart && cart.items.length > 0 && (
            <ul className="space-y-3">
              {cart.items.map((item) => (
                <li
                  key={item.productId}
                  className="flex gap-3 rounded-xl bg-zinc-900 p-3 ring-1 ring-zinc-800"
                >
                  <Link
                    href={`/products/${item.product.slug}`}
                    onClick={close}
                    className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-800"
                  >
                    <Image
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/products/${item.product.slug}`}
                        onClick={close}
                        className="truncate text-sm font-semibold text-zinc-50 hover:text-lime-300"
                      >
                        {item.product.name}
                      </Link>
                      <button
                        onClick={() => removeItem.mutate(item.productId)}
                        className="shrink-0 text-xs font-medium text-rose-400 hover:underline"
                        aria-label={`Remove ${item.product.name}`}
                      >
                        ✕
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <div className="flex items-center rounded-lg ring-1 ring-zinc-700">
                        <button
                          aria-label="Decrease quantity"
                          onClick={() =>
                            item.quantity > 1
                              ? updateQty.mutate({
                                  productId: item.productId,
                                  quantity: item.quantity - 1,
                                })
                              : removeItem.mutate(item.productId)
                          }
                          className="px-2 py-0.5 text-base font-bold text-zinc-400 hover:text-lime-400"
                        >
                          −
                        </button>
                        <span className="w-7 text-center text-sm font-semibold text-zinc-100">
                          {item.quantity}
                        </span>
                        <button
                          aria-label="Increase quantity"
                          onClick={() =>
                            updateQty.mutate({
                              productId: item.productId,
                              quantity: item.quantity + 1,
                            })
                          }
                          className="px-2 py-0.5 text-base font-bold text-zinc-400 hover:text-lime-400"
                        >
                          +
                        </button>
                      </div>
                      <p className="text-sm font-bold text-zinc-50">
                        {formatPrice(item.lineTotal)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {cart && cart.items.length > 0 && (
          <div className="border-t border-zinc-800 px-5 py-4">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Subtotal</span>
              <span className="font-display text-lg font-bold text-zinc-50">
                {formatPrice(cart.subtotal)}
              </span>
            </div>
            <button
              onClick={() => go("/checkout")}
              className="btn-glow mt-3 w-full rounded-full bg-lime-400 px-4 py-3 text-sm font-semibold text-zinc-950 hover:bg-lime-300"
            >
              Checkout
            </button>
            <button
              onClick={() => go("/cart")}
              className="mt-2 w-full rounded-full px-4 py-2.5 text-sm font-medium text-zinc-300 ring-1 ring-zinc-700 hover:bg-zinc-800"
            >
              View full cart
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
