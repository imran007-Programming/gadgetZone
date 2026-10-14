"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { formatPrice } from "@/lib/utils";
import type { Cart } from "@/lib/types";
import {
  BackLink,
  EmptyState,
  ErrorState,
  RequireAuth,
  Spinner,
} from "@/components/ui";

export default function CartPage() {
  return (
    <RequireAuth>
      <CartContent />
    </RequireAuth>
  );
}

function CartContent() {
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

  const clearCart = useMutation({
    mutationFn: () => apiClient.del("/cart"),
    onSuccess: () => {
      invalidate();
      toast.success("Cart cleared");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (cartQuery.isPending) return <Spinner label="Loading cart…" />;
  if (cartQuery.isError)
    return (
      <ErrorState
        message={(cartQuery.error as Error).message}
        onRetry={() => cartQuery.refetch()}
      />
    );

  const cart = cartQuery.data;

  if (cart.items.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        hint="Browse the catalog and add something you like."
        action={
          <Link
            href="/products"
            className="rounded-lg bg-lime-400 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-lime-300"
          >
            Shop products
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-50">
          Cart ({cart.itemCount} item{cart.itemCount === 1 ? "" : "s"})
        </h1>
        <button
          onClick={() => {
            if (window.confirm("Clear the whole cart?")) clearCart.mutate();
          }}
          className="text-sm font-medium text-rose-400 hover:underline"
        >
          Clear cart
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <ul className="space-y-3 lg:col-span-2">
          {cart.items.map((item) => (
            <li
              key={item.productId}
              className="flex gap-4 rounded-xl bg-zinc-900 p-3 ring-1 ring-zinc-800"
            >
              <Link
                href={`/products/${item.product.slug}`}
                className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-800"
              >
                <Image
                  src={item.product.imageUrl}
                  alt={item.product.name}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/products/${item.product.slug}`}
                    className="truncate text-sm font-semibold text-zinc-50 hover:text-lime-300"
                  >
                    {item.product.name}
                  </Link>
                  <button
                    onClick={() => removeItem.mutate(item.productId)}
                    className="text-xs font-medium text-rose-400 hover:underline"
                    aria-label={`Remove ${item.product.name}`}
                  >
                    Remove
                  </button>
                </div>
                <p className="text-xs text-zinc-500">{formatPrice(item.product.price)} each</p>
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
                      className="px-2.5 py-1 text-base font-bold text-zinc-400 hover:text-lime-400"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-semibold">
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
                      className="px-2.5 py-1 text-base font-bold text-zinc-400 hover:text-lime-400"
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

        <aside className="h-fit rounded-xl bg-zinc-900 p-5 ring-1 ring-zinc-800 lg:sticky lg:top-24">
          <h2 className="text-base font-bold text-zinc-50">Order summary</h2>
          <div className="mt-3 flex justify-between text-sm text-zinc-400">
            <span>Subtotal</span>
            <span className="font-semibold text-zinc-50">{formatPrice(cart.subtotal)}</span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Shipping calculated at checkout.
          </p>
          <button
            onClick={() => router.push("/checkout")}
            className="mt-4 w-full rounded-xl bg-lime-400 px-4 py-3 text-sm font-semibold text-zinc-950 hover:bg-lime-300"
          >
            Proceed to checkout
          </button>
          <div className="mt-3">
            <BackLink href="/products" label="Continue shopping" />
          </div>
        </aside>
      </div>
    </div>
  );
}
