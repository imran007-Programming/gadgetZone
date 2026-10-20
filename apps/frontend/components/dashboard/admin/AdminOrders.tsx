"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useToast } from "@/lib/toast";
import type { AdminStats, Order, OrderStatus } from "@/lib/types";
import { shippingAddressLines } from "@/lib/utils";
import {
  Badge,
  Card,
  CardHead,
  ErrorBox,
  Kpi,
  Loading,
  Modal,
  OrderBadge,
  bdNumber,
  matchesSearch,
  useAdminSearch,
} from "./kit";

const FILTERS: { label: string; value: OrderStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "Paid", value: "PAID" },
  { label: "Shipped", value: "SHIPPED" },
  { label: "Delivered", value: "DELIVERED" },
  { label: "Cancelled", value: "CANCELLED" },
];

/** Mirrors the API's admin transitions so the modal only offers valid moves. */
const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PAID", "CANCELLED"],
  PAID: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function customerName(o: Order) {
  return o.user?.name ?? o.guestName ?? o.shippingAddress?.name ?? "Guest";
}

/** Contact mobile: the number typed at checkout, else the account's profile number. */
export function customerPhone(o: Order) {
  return o.guestPhone ?? o.shippingAddress?.phone ?? o.user?.phone ?? null;
}

/**
 * Orders placed with this phone number: red when they cancel more than they receive
 * (likely a fake or unreliable buyer), green when they only receive.
 */
function PhoneHistoryBadge({ order, long = false }: { order: Order; long?: boolean }) {
  const h = order.phoneHistory;
  if (!h) return null;
  if (h.total <= 1) return <Badge tone="neutral">New number</Badge>;
  const tone = h.cancelled > h.delivered ? "red" : h.cancelled === 0 && h.delivered > 0 ? "green" : "amber";
  const text = long
    ? `This number: ${h.total} orders · ${h.delivered} delivered · ${h.cancelled} cancelled`
    : `${h.total} orders · ${h.delivered} ✓ · ${h.cancelled} ✕`;
  return (
    <span title={`${h.total} orders from this number: ${h.delivered} delivered, ${h.cancelled} cancelled`}>
      <Badge tone={tone}>{text}</Badge>
    </span>
  );
}

function paymentLabel(method?: string) {
  if (!method) return "—";
  return method.toLowerCase() === "cod" ? "COD" : method.charAt(0).toUpperCase() + method.slice(1);
}

function orderDate(o: Order) {
  return new Date(o.createdAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

export default function AdminOrders() {
  const search = useAdminSearch();
  const [filter, setFilter] = useState<OrderStatus | "ALL">("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const ordersQuery = useQuery({
    queryKey: ["admin", "orders"],
    queryFn: () => apiClient.get<Order[]>("/admin/orders"),
  });
  const statsQuery = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => apiClient.get<AdminStats>("/admin/stats"),
  });

  if (ordersQuery.isPending) return <Loading label="Loading orders…" />;
  if (ordersQuery.isError)
    return <ErrorBox message={(ordersQuery.error as Error).message} onRetry={() => ordersQuery.refetch()} />;

  const orders = ordersQuery.data;
  const byStatus = statsQuery.data?.ordersByStatus;
  const pending = byStatus?.PENDING ?? orders.filter((o) => o.status === "PENDING").length;
  const shipped = byStatus?.SHIPPED ?? orders.filter((o) => o.status === "SHIPPED").length;
  const cancelled = byStatus?.CANCELLED ?? orders.filter((o) => o.status === "CANCELLED").length;

  const rows = orders.filter(
    (o) =>
      (filter === "ALL" || o.status === filter) &&
      matchesSearch(
        search,
        o.id,
        customerName(o),
        o.user?.email,
        o.guestEmail,
        o.guestPhone,
        o.paymentMethod,
        o.status,
      ),
  );
  const selected = orders.find((o) => o.id === selectedId) ?? null;

  return (
    <section>
      <div className="grid kpi-grid">
        <Kpi label="Total orders" value={bdNumber(orders.length)} sub="All time" />
        <Kpi
          label="Pending"
          value={bdNumber(pending)}
          sub="Awaiting payment or processing"
          pill={pending > 0 ? { text: "ACTION NEEDED", tone: "warn" } : undefined}
        />
        <Kpi label="Shipped" value={bdNumber(shipped)} sub="On the way to customers" />
        <Kpi label="Cancelled" value={bdNumber(cancelled)} sub="Stock restored" />
      </div>

      <Card>
        <CardHead
          title="All orders"
          right={
            <div className="chips">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  className={`chip${filter === f.value ? " active" : ""}`}
                  onClick={() => setFilter(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          }
        />
        {rows.length === 0 ? (
          <div className="empty">{orders.length === 0 ? "No orders yet" : "No orders match this filter"}</div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th className="num">Items</th>
                  <th className="num">Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id} className="clickable" onClick={() => setSelectedId(o.id)}>
                    <td className="mono">#{o.id.slice(-8).toUpperCase()}</td>
                    <td>
                      <div className="prod-name">{customerName(o)}</div>
                      {customerPhone(o) && (
                        <div className="muted mono" style={{ fontSize: 12 }}>
                          {customerPhone(o)}
                        </div>
                      )}
                      <div style={{ marginTop: 4 }}>
                        <PhoneHistoryBadge order={o} />
                      </div>
                    </td>
                    <td className="num">{o.items.reduce((n, i) => n + i.quantity, 0)}</td>
                    <td className="num">৳{bdNumber(o.totalAmount)}</td>
                    <td>
                      <Badge tone="neutral">{paymentLabel(o.paymentMethod)}</Badge>
                    </td>
                    <td>
                      <OrderBadge status={o.status} />
                    </td>
                    <td className="muted">{orderDate(o)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
          Click any row to view the full order and update its status.
        </p>
      </Card>

      {selected && <OrderDetail order={selected} onClose={() => setSelectedId(null)} />}
    </section>
  );
}

function OrderDetail({ order, onClose }: { order: Order; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [nextStatus, setNextStatus] = useState<OrderStatus | "">("");

  const statusMutation = useMutation({
    mutationFn: (status: OrderStatus) => apiClient.patch<Order>(`/admin/orders/${order.id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      setNextStatus("");
      toast.success("Order status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const steps: { label: string; status: OrderStatus }[] = [
    { label: "Order placed", status: "PENDING" },
    { label: "Paid", status: "PAID" },
    { label: "Shipped", status: "SHIPPED" },
    { label: "Delivered", status: "DELIVERED" },
  ];
  const currentIdx = steps.findIndex((s) => s.status === order.status);
  const subtotal = order.items.reduce((n, i) => n + i.unitPrice * i.quantity, 0);
  const discount = order.discountAmount ?? 0;
  // Stored on newer orders; older ones: total = subtotal - discount + shipping
  const shipping = order.shippingFee ?? Math.max(order.totalAmount + discount - subtotal, 0);
  const zoneLabel =
    order.shippingZone === "inside_dhaka"
      ? "Inside Dhaka"
      : order.shippingZone === "outside_dhaka"
        ? "Outside Dhaka"
        : null;
  const email = order.user?.email ?? order.guestEmail;
  const phone = customerPhone(order);
  const address = order.shippingAddress;
  const options = NEXT_STATUS[order.status];

  return (
    <Modal title={`Order #${order.id.slice(-8).toUpperCase()}`} onClose={onClose} wide={980}>
      <div className="order-grid">
        <div>
          <div className="card soft mb">
            <div className="sec-title" style={{ marginBottom: 10 }}>
              Customer
            </div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{customerName(order)}</div>
            {phone && (
              <a
                href={`tel:${phone}`}
                className="mono"
                style={{
                  display: "inline-block",
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: "var(--accent-hi)",
                  margin: "2px 0",
                }}
              >
                {phone}
              </a>
            )}
            {order.phoneHistory && (
              <div style={{ margin: "4px 0 6px" }}>
                <PhoneHistoryBadge order={order} long />
              </div>
            )}
            <div className="muted" style={{ fontSize: 12.5 }}>
              {email || (!phone && "No contact details")}
              {address && (
                <>
                  <br />
                  {shippingAddressLines(address).join(", ")}
                </>
              )}
            </div>
            {order.billingAddress && (
              <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
                <b>Billing:</b> {order.billingAddress.name} · {order.billingAddress.phone}
                <br />
                {order.billingAddress.street}, {order.billingAddress.district}
              </div>
            )}
            {order.notes && (
              <div style={{ fontSize: 12.5, marginTop: 8 }}>
                <b>Order notes:</b> <span className="muted">{order.notes}</span>
              </div>
            )}
          </div>

          <div className="card soft mb">
            <div className="sec-title" style={{ marginBottom: 10 }}>
              Items
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <tbody>
                  {order.items.map((it) => (
                    <tr key={it.id}>
                      <td className="prod-name">{it.product?.name ?? "Deleted product"}</td>
                      <td className="num">×{it.quantity}</td>
                      <td className="num">৳{bdNumber(it.unitPrice * it.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="kv">
              <span className="k">Subtotal</span>
              <span className="v">৳{bdNumber(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="kv">
                <span className="k">
                  Coupon <span className="mono">{order.couponCode}</span>
                </span>
                <span className="v" style={{ color: "var(--green)" }}>
                  −৳{bdNumber(discount)}
                </span>
              </div>
            )}
            {shipping > 0 && (
              <div className="kv">
                <span className="k">Delivery{zoneLabel ? ` (${zoneLabel})` : ""}</span>
                <span className="v">৳{bdNumber(shipping)}</span>
              </div>
            )}
            {order.transactionId && (
              <div className="kv">
                <span className="k">bKash / Nagad Txn ID</span>
                <span className="v mono" style={{ color: "var(--accent-hi)" }}>
                  {order.transactionId}
                </span>
              </div>
            )}
            <div className="kv">
              <span className="k">Payment</span>
              <span className="v">{paymentLabel(order.paymentMethod)}</span>
            </div>
            <div className="kv">
              <span className="k">Total</span>
              <span className="v" style={{ color: "var(--accent-hi)" }}>
                ৳{bdNumber(order.totalAmount)}
              </span>
            </div>
          </div>
        </div>
        <div className="order-side">
          <div className="card soft mb">
            <div className="sec-title" style={{ marginBottom: 12 }}>
              Status timeline
            </div>
            {order.status === "CANCELLED" ? (
              <div className="tl-step cancel">
                <div className="tl-dot">✕</div>
                <div>
                  <div className="tl-title">Order cancelled</div>
                  <div className="tl-sub">Stock was restored</div>
                </div>
              </div>
            ) : (
              steps.map((s, i) => {
                const cls = i < currentIdx ? "done" : i === currentIdx ? "now" : "";
                return (
                  <div className={`tl-step ${cls}`} key={s.status}>
                    <div className="tl-dot">{i < currentIdx ? "✓" : i + 1}</div>
                    <div>
                      <div className="tl-title">{s.label}</div>
                      <div className="tl-sub">
                        {i === 0 ? orderDate(order) : i === currentIdx ? "Current step" : ""}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {options.length > 0 ? (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <select
                className="input"
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value as OrderStatus)}
                aria-label="New status"
              >
                <option value="">Move to…</option>
                {options.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
              <button
                className="btn"
                disabled={!nextStatus || statusMutation.isPending}
                onClick={() => nextStatus && statusMutation.mutate(nextStatus)}
              >
                {statusMutation.isPending ? "Updating…" : "Update"}
              </button>
            </div>
          ) : (
            <p className="muted" style={{ fontSize: 12.5 }}>
              This order is {order.status.toLowerCase()}; no further status changes are possible.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
