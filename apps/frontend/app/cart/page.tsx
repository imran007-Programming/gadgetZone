"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useCartStore, selectItemCount, selectSubtotal } from "@/lib/store/cart";
import { useToast } from "@/lib/toast";
import { formatPrice } from "@/lib/utils";
import { EmptyState, Spinner } from "@/components/ui";

export default function CartPage() {
  const toast = useToast();
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const loading = useCartStore((s) => s.loading);
  const hydrated = useCartStore((s) => s.hydrated);
  const setQty = useCartStore((s) => s.setQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const clear = useCartStore((s) => s.clear);
  const itemCount = useCartStore(selectItemCount);
  const subtotal = useCartStore(selectSubtotal);

  if (!hydrated || loading) return <Spinner label="Loading cart…" />;

  if (items.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        hint="Browse the catalog and add something you like."
        action={
          <Link
            href="/products"
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-600"
          >
            <ShoppingCart className="h-4 w-4" />
            Shop products
          </Link>
        }
      />
    );
  }

  const handleRemove = async (productId: string, name: string) => {
    await removeItem(productId);
    toast.success(`Removed "${name}"`);
  };

  const handleClear = async () => {
    if (window.confirm("Clear the whole cart?")) {
      await clear();
      toast.success("Cart cleared");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900">
          Cart ({itemCount} item{itemCount === 1 ? "" : "s"})
        </h1>
        <button
          onClick={handleClear}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-400 hover:underline"
        >
          <Trash2 className="h-4 w-4" />
          Clear cart
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <ul className="space-y-3 lg:col-span-2">
          {items.map((item) => (
            <li
              key={item.productId}
              className="flex gap-4 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200"
            >
              <Link
                href={`/products/${item.slug}`}
                className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-100"
              >
                <Image
                  src={item.imageUrl}
                  alt={item.name}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/products/${item.slug}`}
                    className="truncate text-sm font-semibold text-zinc-900 hover:text-blue-700"
                  >
                    {item.name}
                  </Link>
                  <button
                    onClick={() => handleRemove(item.productId, item.name)}
                    className="shrink-0 rounded p-1 text-zinc-500 transition hover:text-rose-400"
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-zinc-500">{formatPrice(item.price)} each</p>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <div className="flex items-center rounded-lg ring-1 ring-zinc-300">
                    <button
                      aria-label="Decrease quantity"
                      onClick={() => setQty(item.productId, item.quantity - 1)}
                      className="p-2 text-zinc-500 transition hover:text-blue-600"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold text-zinc-900">
                      {item.quantity}
                    </span>
                    <button
                      aria-label="Increase quantity"
                      onClick={() => setQty(item.productId, item.quantity + 1)}
                      className="p-2 text-zinc-500 transition hover:text-blue-600"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-sm font-bold text-zinc-900">
                    {formatPrice(item.price * item.quantity)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit rounded-xl bg-zinc-50 p-5 ring-1 ring-zinc-200 lg:sticky lg:top-24">
          <h2 className="text-base font-bold text-zinc-900">Order summary</h2>
          <div className="mt-3 flex justify-between text-sm text-zinc-500">
            <span>Subtotal</span>
            <span className="font-semibold text-zinc-900">{formatPrice(subtotal)}</span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Shipping calculated at checkout.
          </p>
          <button
            onClick={() => router.push("/checkout")}
            className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-600"
          >
            Proceed to checkout
          </button>
          <Link
            href="/products"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-blue-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
