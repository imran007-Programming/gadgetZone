"use client";

import Image from "next/image";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { formatPrice } from "@/lib/utils";
import type { Order, ReturnStatus } from "@/lib/types";
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
        <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl sm:font-bold text-zinc-900">
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
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-zinc-200">
                  <Image
                    src={item.product.imageUrl}
                    alt={item.product.name}
                    fill
                    sizes="48px"
                    className="object-contain p-0.5"
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
        {(order.discountAmount ?? 0) > 0 && (
          <div className="mt-3 flex justify-between border-t border-zinc-200 pt-3 text-sm">
            <span className="text-zinc-500">
              Coupon <span className="font-mono font-semibold text-zinc-700">{order.couponCode}</span>
            </span>
            <span className="font-semibold text-primary-700">−{formatPrice(order.discountAmount ?? 0)}</span>
          </div>
        )}
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

      {order.status === "DELIVERED" && <ReturnSection order={order} />}

      {order.status === "PENDING" && (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => payMutation.mutate()}
            disabled={payMutation.isPending}
            className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-40"
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

const RETURN_REASONS = [
  "Defective or not working",
  "Wrong item received",
  "Damaged in delivery",
  "Not as described",
  "Changed my mind",
];

const RETURN_LABEL: Record<ReturnStatus, { text: string; className: string }> = {
  REQUESTED: { text: "Return requested", className: "bg-amber-100 text-amber-700" },
  APPROVED: { text: "Return approved", className: "bg-sky-100 text-sky-700" },
  REJECTED: { text: "Return rejected", className: "bg-rose-100 text-rose-700" },
  REFUNDED: { text: "Refunded", className: "bg-emerald-100 text-emerald-700" },
};

/** Return status for a delivered order, or a form to request one. */
function ReturnSection({ order }: { order: Order }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(RETURN_REASONS[0]);
  const [details, setDetails] = useState("");
  const current = order.returnRequest ?? null;
  // A rejected request can be followed by a new one; open or refunded ones cannot
  const canRequest = !current || current.status === "REJECTED";

  const requestMutation = useMutation({
    mutationFn: () => apiClient.post("/returns", { orderId: order.id, reason, details: details.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", order.id] });
      setOpen(false);
      setDetails("");
      toast.success("Return requested. We'll review it shortly.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-xl bg-zinc-50 p-5 ring-1 ring-zinc-200">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500">
        <RotateCcw className="h-4 w-4" />
        Returns
      </h2>

      {current && (
        <div className="mb-3 space-y-1 text-sm">
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${RETURN_LABEL[current.status].className}`}>
            {RETURN_LABEL[current.status].text}
          </span>
          <p className="text-zinc-600">Reason: {current.reason}</p>
          {current.refundAmount != null && (
            <p className="text-zinc-600">
              Refund: <span className="font-semibold text-zinc-900">{formatPrice(current.refundAmount)}</span>
            </p>
          )}
          {current.adminNote && <p className="text-zinc-500">Note from the store: {current.adminNote}</p>}
        </div>
      )}

      {canRequest &&
        (open ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              requestMutation.mutate();
            }}
            className="space-y-3"
          >
            <label className="block text-sm font-medium text-zinc-700">
              Reason
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
              >
                {RETURN_REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-zinc-700">
              Details (optional)
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Tell us what went wrong"
                className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={requestMutation.isPending}
                className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40"
              >
                {requestMutation.isPending ? "Sending…" : "Submit request"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-zinc-600 ring-1 ring-zinc-300 hover:bg-white"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-300 hover:bg-white"
          >
            {current ? "Request again" : "Request a return"}
          </button>
        ))}
    </div>
  );
}
