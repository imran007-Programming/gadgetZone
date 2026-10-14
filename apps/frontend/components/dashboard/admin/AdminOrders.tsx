"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { formatPrice } from "@/lib/utils";
import type { Order, OrderStatus } from "@/lib/types";
import { EmptyState, ErrorState, Spinner, StatusBadge } from "@/components/ui";

const ORDER_STATUSES: OrderStatus[] = ["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"];

export default function AdminOrders() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");

  const ordersQuery = useQuery({
    queryKey: ["admin", "orders", statusFilter],
    queryFn: () =>
      apiClient.get<Order[]>(`/admin/orders${statusFilter ? `?status=${statusFilter}` : ""}`),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      apiClient.patch<Order>(`/admin/orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast.success("Order status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (ordersQuery.isPending) return <Spinner label="Loading orders…" />;
  if (ordersQuery.isError)
    return (
      <ErrorState
        message={(ordersQuery.error as Error).message}
        onRetry={() => ordersQuery.refetch()}
      />
    );

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900">
        Orders
      </h1>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-zinc-500">Status filter</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900"
        >
          <option value="">All</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {ordersQuery.data.length === 0 ? (
        <EmptyState title="No orders found" />
      ) : (
        <>
          {/* Mobile cards */}
          <ul className="space-y-3 lg:hidden">
            {ordersQuery.data.map((o) => (
              <li key={o.id} className="rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-zinc-900">
                    #{o.id.slice(0, 8)}
                  </span>
                  <StatusBadge status={o.status} />
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-xs text-zinc-500">
                    {new Date(o.createdAt).toLocaleDateString()}
                  </span>
                  <span className="font-bold text-zinc-900">{formatPrice(o.totalAmount)}</span>
                </div>
                <select
                  value={o.status}
                  onChange={(e) =>
                    statusMutation.mutate({ id: o.id, status: e.target.value as OrderStatus })
                  }
                  disabled={statusMutation.isPending}
                  className="mt-3 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900"
                  aria-label={`Update status for order ${o.id.slice(0, 8)}`}
                >
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-xl bg-zinc-50 ring-1 ring-zinc-200 lg:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {ordersQuery.data.map((o) => (
                  <tr key={o.id} className="hover:bg-white">
                    <td className="px-4 py-3 font-mono text-xs">#{o.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {new Date(o.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-medium">{formatPrice(o.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={o.status}
                        onChange={(e) =>
                          statusMutation.mutate({ id: o.id, status: e.target.value as OrderStatus })
                        }
                        disabled={statusMutation.isPending}
                        className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900"
                        aria-label={`Update status for order ${o.id.slice(0, 8)}`}
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="text-xs text-zinc-500">
        Valid transitions: PENDING → PAID/CANCELLED, PAID → SHIPPED, SHIPPED →
        DELIVERED. Invalid moves are rejected by the API.
      </p>
    </div>
  );
}
