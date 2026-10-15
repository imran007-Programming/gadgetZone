"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useToast } from "@/lib/toast";
import type { AdminReturn, ReturnStatus } from "@/lib/types";
import {
  Badge,
  Card,
  CardHead,
  ErrorBox,
  Field,
  Kpi,
  Loading,
  Modal,
  bdNumber,
  matchesSearch,
  useAdminSearch,
  type BadgeTone,
} from "./kit";

const FILTERS: { label: string; value: ReturnStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Requested", value: "REQUESTED" },
  { label: "Approved", value: "APPROVED" },
  { label: "Refunded", value: "REFUNDED" },
  { label: "Rejected", value: "REJECTED" },
];

const TONE: Record<ReturnStatus, BadgeTone> = {
  REQUESTED: "amber",
  APPROVED: "blue",
  REFUNDED: "green",
  REJECTED: "red",
};

/** Same rules as the API: what an admin can do next. */
const NEXT: Record<ReturnStatus, ReturnStatus[]> = {
  REQUESTED: ["APPROVED", "REJECTED"],
  APPROVED: ["REFUNDED", "REJECTED"],
  REJECTED: [],
  REFUNDED: [],
};

export function ReturnBadge({ status }: { status: ReturnStatus }) {
  return <Badge tone={TONE[status]}>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>;
}

function shortDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

export default function AdminReturns() {
  const search = useAdminSearch();
  const [filter, setFilter] = useState<ReturnStatus | "ALL">("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const returnsQuery = useQuery({
    queryKey: ["admin", "returns"],
    queryFn: () => apiClient.get<AdminReturn[]>("/admin/returns"),
  });

  if (returnsQuery.isPending) return <Loading label="Loading returns…" />;
  if (returnsQuery.isError)
    return <ErrorBox message={(returnsQuery.error as Error).message} onRetry={() => returnsQuery.refetch()} />;

  const returns = returnsQuery.data;
  const count = (s: ReturnStatus) => returns.filter((r) => r.status === s).length;
  const refunded = returns
    .filter((r) => r.status === "REFUNDED")
    .reduce((n, r) => n + (r.refundAmount ?? 0), 0);
  const rows = returns.filter(
    (r) =>
      (filter === "ALL" || r.status === filter) &&
      matchesSearch(search, r.id, r.order.id, r.user.name, r.user.email, r.reason, ...r.order.items.map((i) => i.name)),
  );
  const selected = returns.find((r) => r.id === selectedId) ?? null;

  return (
    <section>
      <div className="grid kpi-grid">
        <Kpi label="Return requests" value={bdNumber(returns.length)} sub="All time" />
        <Kpi
          label="Pending review"
          value={bdNumber(count("REQUESTED"))}
          sub="Awaiting decision"
          pill={count("REQUESTED") > 0 ? { text: "REVIEW", tone: "warn" } : undefined}
        />
        <Kpi label="Approved" value={bdNumber(count("APPROVED"))} sub="Waiting for refund" />
        <Kpi label="Refunds issued" currency value={bdNumber(refunded)} sub={`${count("REFUNDED")} refunded`} />
      </div>

      <Card>
        <CardHead
          title="Return requests"
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
          <div className="empty">
            {returns.length === 0
              ? "No return requests yet. Customers can request a return from a delivered order."
              : "No returns match"}
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Return</th>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Products</th>
                  <th>Reason</th>
                  <th className="num">Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="clickable" onClick={() => setSelectedId(r.id)}>
                    <td className="mono">RTN-{r.id.slice(-6).toUpperCase()}</td>
                    <td className="mono muted">#{r.order.id.slice(-8).toUpperCase()}</td>
                    <td className="prod-name">{r.user.name}</td>
                    <td className="muted">
                      {r.order.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}
                    </td>
                    <td className="muted">{r.reason}</td>
                    <td className="num">৳{bdNumber(r.refundAmount ?? r.order.totalAmount)}</td>
                    <td>
                      <ReturnBadge status={r.status} />
                    </td>
                    <td className="muted">{shortDate(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
          Click a request to approve, reject or refund it. Refunding puts the items back in stock.
        </p>
      </Card>

      {selected && <ReturnDecision request={selected} onClose={() => setSelectedId(null)} />}
    </section>
  );
}

function ReturnDecision({ request, onClose }: { request: AdminReturn; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [note, setNote] = useState(request.adminNote ?? "");
  const [refund, setRefund] = useState(String(request.order.totalAmount));

  const decide = useMutation({
    mutationFn: (status: ReturnStatus) =>
      apiClient.patch<AdminReturn>(`/admin/returns/${request.id}`, {
        status,
        adminNote: note,
        ...(status === "REFUNDED" && { refundAmount: Number(refund) }),
      }),
    onSuccess: (_r, status) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "returns"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast.success(
        status === "APPROVED" ? "Return approved" : status === "REFUNDED" ? "Refund recorded, stock restored" : "Return rejected",
      );
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const options = NEXT[request.status];

  return (
    <Modal title={`Return RTN-${request.id.slice(-6).toUpperCase()}`} onClose={onClose}>
      <div className="card soft mb">
        <div className="kv">
          <span className="k">Customer</span>
          <span className="v" style={{ fontWeight: 600 }}>
            {request.user.name} · {request.user.email}
          </span>
        </div>
        <div className="kv">
          <span className="k">Order</span>
          <span className="v mono">#{request.order.id.slice(-8).toUpperCase()}</span>
        </div>
        <div className="kv">
          <span className="k">Status</span>
          <ReturnBadge status={request.status} />
        </div>
        <div className="kv">
          <span className="k">Reason</span>
          <span className="v" style={{ fontWeight: 600 }}>
            {request.reason}
          </span>
        </div>
        {request.details && (
          <p className="muted" style={{ fontSize: 12.5, padding: "10px 0 0" }}>
            “{request.details}”
          </p>
        )}
      </div>

      <div className="card soft mb">
        <div className="sec-title" style={{ marginBottom: 10 }}>
          Items
        </div>
        {request.order.items.map((i) => (
          <div className="kv" key={i.productId}>
            <span className="k">
              {i.name} ×{i.quantity}
            </span>
            <span className="v">৳{bdNumber(i.unitPrice * i.quantity)}</span>
          </div>
        ))}
        <div className="kv">
          <span className="k">Order total</span>
          <span className="v" style={{ color: "var(--accent-hi)" }}>
            ৳{bdNumber(request.order.totalAmount)}
          </span>
        </div>
        {request.refundAmount != null && (
          <div className="kv">
            <span className="k">Refunded</span>
            <span className="v" style={{ color: "var(--green)" }}>
              ৳{bdNumber(request.refundAmount)}
            </span>
          </div>
        )}
      </div>

      {options.length === 0 ? (
        <p className="muted" style={{ fontSize: 12.5 }}>
          This request is {request.status.toLowerCase()}; no further action is possible.
          {request.adminNote && <><br />Note: {request.adminNote}</>}
        </p>
      ) : (
        <>
          <Field label="Note to customer (optional)">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Pickup booked for tomorrow" style={{ minHeight: 70 }} />
          </Field>
          {options.includes("REFUNDED") && (
            <Field label="Refund amount (৳)">
              <input type="number" min={0} max={request.order.totalAmount} value={refund} onChange={(e) => setRefund(e.target.value)} />
            </Field>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {options.includes("APPROVED") && (
              <button className="btn" disabled={decide.isPending} onClick={() => decide.mutate("APPROVED")}>
                Approve return
              </button>
            )}
            {options.includes("REFUNDED") && (
              <button
                className="btn"
                disabled={decide.isPending || !(Number(refund) >= 0)}
                onClick={() => decide.mutate("REFUNDED")}
              >
                Mark refunded · ৳{bdNumber(Number(refund) || 0)}
              </button>
            )}
            <button
              className="btn ghost"
              disabled={decide.isPending}
              onClick={() => {
                if (window.confirm("Reject this return request?")) decide.mutate("REJECTED");
              }}
            >
              Reject
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
