"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { formatPrice } from "@/lib/utils";
import type { Order } from "@/lib/types";
import { BackLink, ErrorState, RequireAuth, Spinner, StatusBadge } from "@/components/ui";

export default function OrderDetailPage() {
  return (
    <RequireAuth>
      <OrderDetailContent />
    </RequireAuth>
  );
}

function OrderDetailContent() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  const orderQuery = useQuery({
    queryKey: ["order", id],
    queryFn: () => apiClient.get<Order>(`/orders/${id}`),
  });

  const cancelMutation = useMutation({
    mutationFn: () => apiClient.post<Order>(`/orders/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order cancelled");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const payMutation = useMutation({
    mutationFn: () => apiClient.post<Order>(`/orders/${id}/pay`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Payment successful");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (orderQuery.isPending) return <Spinner label="Loading order…" />;
  if (orderQuery.isError)
    return (
      <ErrorState
        message={(orderQuery.error as Error).message}
        onRetry={() => orderQuery.refetch()}
      />
    );

  const order = orderQuery.data;
  const addr = order.shippingAddress;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink href="/orders" label="Back to orders" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900">
          Order <span className="font-mono">#{order.id.slice(0, 8)}</span>
        </h1>
        <StatusBadge status={order.status} />
      </div>

      <div className="rounded-xl bg-zinc-50 p-5 ring-1 ring-zinc-200">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500">
          Items
        </h2>
        <ul className="divide-y divide-zinc-200">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-3">
              {item.product?.imageUrl && (
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                  <Image
                    src={item.product.imageUrl}
                    alt={item.product.name}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-900">
                  {item.product?.name ?? "Product"}
                </p>
                <p className="text-xs text-zinc-500">
                  {item.quantity} × {formatPrice(item.unitPrice)}
                </p>
              </div>
              <p className="text-sm font-bold text-zinc-900">
                {formatPrice(item.quantity * Number(item.unitPrice))}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-zinc-200 pt-3">
          <span className="text-sm font-medium text-zinc-500">Total</span>
          <span className="text-base font-bold text-zinc-900">
            {formatPrice(order.totalAmount)}
          </span>
        </div>
      </div>

      <div className="rounded-xl bg-zinc-50 p-5 ring-1 ring-zinc-200">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-500">
          Shipping address
        </h2>
        <p className="text-sm text-zinc-700">
          {addr.name}
          <br />
          {addr.street}
          <br />
          {addr.city}, {addr.postalCode}
          <br />
          {addr.country}
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Placed on {new Date(order.createdAt).toLocaleString()}
        </p>
      </div>

      {order.status === "PENDING" && (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => payMutation.mutate()}
            disabled={payMutation.isPending}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-40"
          >
            {payMutation.isPending ? "Processing…" : "Pay now (mock)"}
          </button>
          <button
            onClick={() => {
              if (window.confirm("Cancel this order? Stock will be restored."))
                cancelMutation.mutate();
            }}
            disabled={cancelMutation.isPending}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-40"
          >
            {cancelMutation.isPending ? "Cancelling…" : "Cancel order"}
          </button>
        </div>
      )}

      {(payMutation.isError || cancelMutation.isError) && (
        <p className="text-sm text-rose-600">
          {((payMutation.error ?? cancelMutation.error) as Error).message}
        </p>
      )}
    </div>
  );
}
