"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import type { Order } from "@/lib/types";
import { EmptyState, ErrorState, RequireAuth, Spinner, StatusBadge } from "@/components/ui";

export default function OrdersPage() {
  return (
    <RequireAuth>
      <OrdersContent />
    </RequireAuth>
  );
}

function OrdersContent() {
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

  if (orders.length === 0) {
    return (
      <EmptyState
        title="No orders yet"
        hint="Your order history will appear here."
        action={
          <Link
            href="/products"
            className="rounded-lg bg-lime-400 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-lime-300"
          >
            Start shopping
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-50">My orders</h1>
      <ul className="space-y-3">
        {orders.map((o) => (
          <li key={o.id}>
            <Link
              href={`/orders/${o.id}`}
              className="flex items-center justify-between gap-4 rounded-xl bg-zinc-900 p-4 ring-1 ring-zinc-800 transition hover:shadow-md"
            >
              <div>
                <p className="font-mono text-sm font-semibold text-zinc-50">
                  #{o.id.slice(0, 8)}
                </p>
                <p className="text-xs text-zinc-500">
                  {new Date(o.createdAt).toLocaleDateString()} · {o.items.length} item
                  {o.items.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-zinc-50">
                  {formatPrice(o.totalAmount)}
                </span>
                <StatusBadge status={o.status} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
