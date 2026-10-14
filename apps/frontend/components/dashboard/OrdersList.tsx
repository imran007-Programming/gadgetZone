"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Package, ShoppingBag } from "lucide-react";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import type { Order } from "@/lib/types";
import { EmptyState, ErrorState, Spinner, StatusBadge } from "@/components/ui";

/** Reusable customer orders list (used in the dashboard). */
export default function OrdersList({ compact = false }: { compact?: boolean }) {
  const ordersQuery = useQuery({
    queryKey: ["orders"],
    queryFn: () => apiClient.get<Order[]>("/orders"),
  });

  if (ordersQuery.isPending) return <Spinner label="Loading orders…" />;
  if (ordersQuery.isError)
    return (
      <ErrorState
        message={(ordersQuery.error as Error).message}
        onRetry={() => ordersQuery.refetch()}
      />
    );

  const orders = ordersQuery.data;
  const visible = compact ? orders.slice(0, 5) : orders;

  if (orders.length === 0) {
    return (
      <EmptyState
        title="No orders yet"
        hint="Your order history will appear here."
        action={
          <Link
            href="/products"
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-600"
          >
            <ShoppingBag className="h-4 w-4" />
            Start shopping
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {!compact && (
        <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900">
          My orders
        </h1>
      )}
      <ul className="space-y-3">
        {visible.map((o) => (
          <li key={o.id}>
            <Link
              href={`/orders/${o.id}`}
              className="flex items-center justify-between gap-4 rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-200 transition hover:ring-blue-600/40"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 sm:flex">
                  <Package className="h-5 w-5 text-blue-600" />
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold text-zinc-900">
                    #{o.id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {new Date(o.createdAt).toLocaleDateString()} · {o.items.length} item
                    {o.items.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm font-bold text-zinc-900">
                  {formatPrice(o.totalAmount)}
                </span>
                <StatusBadge status={o.status} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {compact && orders.length > 5 && (
        <Link
          href="/dashboard/orders"
          className="inline-block text-sm font-medium text-blue-600 hover:underline"
        >
          View all {orders.length} orders →
        </Link>
      )}
    </div>
  );
}
