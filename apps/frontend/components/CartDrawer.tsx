"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { useCartStore, selectItemCount, selectSubtotal } from "@/lib/store/cart";
import { useToast } from "@/lib/toast";
import { formatPrice } from "@/lib/utils";
import { Spinner } from "@/components/ui";

/**
 * Slide-over cart drawer powered by the Zustand cart store.
 * Works for guests (localStorage) and logged-in users (server-synced).
 */
export default function CartDrawer() {
  const isOpen = useCartStore((s) => s.isOpen);
  const close = useCartStore((s) => s.closeDrawer);
  const items = useCartStore((s) => s.items);
  const loading = useCartStore((s) => s.loading);
  const setQty = useCartStore((s) => s.setQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const itemCount = useCartStore(selectItemCount);
  const subtotal = useCartStore(selectSubtotal);
  const toast = useToast();
  const router = useRouter();

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

  const go = (href: string) => {
    close();
    router.push(href);
  };

  const handleRemove = async (productId: string, name: string) => {
    await removeItem(productId);
    toast.success(`Removed "${name}" from cart`);
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <button
        aria-label="Close cart"
        onClick={close}
        className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl ring-1 ring-zinc-200 animate-slide-in-right sm:max-w-md">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <h2 className="font-display flex items-center gap-2 text-lg font-bold text-zinc-900">
            <ShoppingCart className="h-5 w-5 text-lime-600" />
            Your cart
            {itemCount > 0 && (
              <span className="rounded-full bg-lime-100 px-2 py-0.5 text-xs font-bold text-lime-700">
                {itemCount}
              </span>
            )}
          </h2>
          <button
            onClick={close}
            aria-label="Close"
            className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && <Spinner label="Loading cart…" />}
          {!loading && items.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 ring-1 ring-zinc-200">
                <ShoppingCart className="h-7 w-7 text-zinc-400" />
              </span>
              <p className="font-semibold text-zinc-800">Your cart is empty</p>
              <p className="text-sm text-zinc-500">
                Browse the catalog and add something you like.
              </p>
              <button
                onClick={() => go("/products")}
                className="mt-2 rounded-full bg-lime-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-lime-600"
              >
                Shop products
              </button>
            </div>
          )}
          {!loading && items.length > 0 && (
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={item.productId}
                  className="flex gap-3 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200"
                >
                  <Link
                    href={`/products/${item.slug}`}
                    onClick={close}
                    className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-200"
                  >
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/products/${item.slug}`}
                        onClick={close}
                        className="truncate text-sm font-semibold text-zinc-900 hover:text-lime-700"
                      >
                        {item.name}
                      </Link>
                      <button
                        onClick={() => handleRemove(item.productId, item.name)}
                        className="shrink-0 rounded p-1 text-zinc-400 transition hover:text-rose-600"
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <div className="flex items-center rounded-lg bg-white ring-1 ring-zinc-200">
                        <button
                          aria-label="Decrease quantity"
                          onClick={() => setQty(item.productId, item.quantity - 1)}
                          className="p-1.5 text-zinc-500 transition hover:text-lime-600"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-7 text-center text-sm font-semibold text-zinc-900">
                          {item.quantity}
                        </span>
                        <button
                          aria-label="Increase quantity"
                          onClick={() => setQty(item.productId, item.quantity + 1)}
                          className="p-1.5 text-zinc-500 transition hover:text-lime-600"
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
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-zinc-200 bg-white px-5 py-4">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Subtotal</span>
              <span className="font-display text-lg font-bold text-zinc-900">
                {formatPrice(subtotal)}
              </span>
            </div>
            <button
              onClick={() => go("/checkout")}
              className="btn-glow mt-3 w-full rounded-full bg-lime-500 px-4 py-3 text-sm font-semibold text-white hover:bg-lime-600"
            >
              Checkout
            </button>
            <button
              onClick={() => go("/cart")}
              className="mt-2 w-full rounded-full px-4 py-2.5 text-sm font-medium text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-100"
            >
              View full cart
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
