"use client";

import { useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/lib/types";
import { BackLink, EmptyState, ErrorState, Spinner } from "@/components/ui";

export default function ProductDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [qty, setQty] = useState(1);

  const productQuery = useQuery({
    queryKey: ["product", slug],
    queryFn: () => apiClient.get<Product>(`/products/${encodeURIComponent(slug)}`),
  });

  const addMutation = useMutation({
    mutationFn: (quantity: number) =>
      apiClient.post("/cart/items", {
        productId: productQuery.data!.id,
        quantity,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      toast.success("Added to cart");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleAdd = () => {
    if (!isAuthenticated) {
      toast.error("Please log in to add items to your cart");
      router.push(`/login?next=/products/${encodeURIComponent(slug)}`);
      return;
    }
    addMutation.mutate(qty);
  };

  if (productQuery.isPending) return <Spinner label="Loading product…" />;
  if (productQuery.isError) {
    const err = productQuery.error;
    if (err instanceof ApiError && err.status === 404) {
      return (
        <EmptyState
          title="Product not found"
          hint="It may have been removed."
          action={<BackLink href="/products" label="Back to products" />}
        />
      );
    }
    return (
      <ErrorState message={err.message} onRetry={() => productQuery.refetch()} />
    );
  }

  const p = productQuery.data;
  const outOfStock = p.stock <= 0;
  const hasDiscount = p.comparePrice != null && p.comparePrice > p.price;

  return (
    <div className="space-y-6">
      <BackLink href="/products" label="Back to products" />
      <div className="grid gap-8 md:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-zinc-800 ring-1 ring-zinc-800">
          <Image
            src={p.imageUrl}
            alt={p.name}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
            priority
          />
        </div>

        <div className="flex flex-col gap-4">
          {p.category && (
            <p className="text-xs font-semibold uppercase tracking-widest text-lime-400">
              {p.category.name}
            </p>
          )}
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-50">
            {p.name}
          </h1>

          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-zinc-50">
              {formatPrice(p.price)}
            </span>
            {hasDiscount && (
              <>
                <span className="text-lg text-zinc-500 line-through">
                  {formatPrice(p.comparePrice!)}
                </span>
                <span className="rounded-full bg-rose-400/15 px-2.5 py-0.5 text-xs font-bold text-rose-300">
                  Save {formatPrice(p.comparePrice! - p.price)}
                </span>
              </>
            )}
          </div>

          <p
            className={`text-sm font-medium ${
              outOfStock ? "text-rose-400" : p.stock < 10 ? "text-amber-400" : "text-emerald-400"
            }`}
          >
            {outOfStock
              ? "Out of stock"
              : p.stock < 10
                ? `Only ${p.stock} left in stock`
                : "In stock"}
          </p>

          <p className="text-sm leading-relaxed text-zinc-400">{p.description}</p>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-lg ring-1 ring-zinc-700">
              <button
                aria-label="Decrease quantity"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="px-3 py-2 text-lg font-bold text-zinc-400 hover:text-lime-400"
              >
                −
              </button>
              <span className="w-10 text-center text-sm font-semibold">{qty}</span>
              <button
                aria-label="Increase quantity"
                onClick={() => setQty((q) => Math.min(p.stock || 99, q + 1))}
                disabled={outOfStock}
                className="px-3 py-2 text-lg font-bold text-zinc-400 hover:text-lime-400 disabled:opacity-30"
              >
                +
              </button>
            </div>
            <button
              onClick={handleAdd}
              disabled={outOfStock || addMutation.isPending}
              className="flex-1 rounded-xl bg-lime-400 px-6 py-3 text-sm font-semibold text-zinc-950 shadow hover:bg-lime-300 disabled:opacity-40 sm:flex-none sm:px-10"
            >
              {addMutation.isPending ? "Adding…" : "Add to cart"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
