"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useToast } from "@/lib/toast";
import type { AdminStats, Order, User } from "@/lib/types";
import {
  Badge,
  Card,
  CardHead,
  ErrorBox,
  Kpi,
  Loading,
  Modal,
  OrderBadge,
  PALETTE,
  Switch,
  bdNumber,
  matchesSearch,
  useAdminSearch,
} from "./kit";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function avatarColor(name: string) {
  return PALETTE[name.length % PALETTE.length];
}

function joined(date: string) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

export default function AdminCustomers() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const search = useAdminSearch();
  const [selected, setSelected] = useState<User | null>(null);

  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => apiClient.get<User[]>("/admin/users"),
  });
  const statsQuery = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => apiClient.get<AdminStats>("/admin/stats"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiClient.patch(`/admin/users/${id}/${active ? "enable" : "disable"}`),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success(v.active ? "Account enabled" : "Account disabled");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (usersQuery.isPending) return <Loading label="Loading customers…" />;
  if (usersQuery.isError)
    return <ErrorBox message={(usersQuery.error as Error).message} onRetry={() => usersQuery.refetch()} />;

  const customers = usersQuery.data.filter((u) => u.role !== "ADMIN");
  const activeCount = customers.filter((u) => u.isActive !== false).length;
  const rows = customers.filter((u) => matchesSearch(search, u.name, u.email));

  return (
    <section>
      <div className="grid kpi-grid">
        <Kpi label="Total customers" value={bdNumber(customers.length)} sub="Registered accounts" />
        <Kpi
          label="New this month"
          value={bdNumber(statsQuery.data?.newCustomers30d ?? 0)}
          sub="Joined in the last 30 days"
        />
        <Kpi label="Active accounts" value={bdNumber(activeCount)} sub="Can log in" />
        <Kpi
          label="Disabled"
          value={bdNumber(customers.length - activeCount)}
          sub="Login blocked"
          pill={customers.length - activeCount > 0 ? { text: "BLOCKED", tone: "down" } : undefined}
        />
      </div>

      <Card>
        <CardHead title="Customers" />
        {rows.length === 0 ? (
          <div className="empty">{customers.length === 0 ? "No customers yet" : "No customers match"}</div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Access</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const isActive = u.isActive !== false;
                  return (
                    <tr key={u.id} className="clickable" onClick={() => setSelected(u)}>
                      <td>
                        <div className="prod-cell">
                          <div className="rep-avatar" style={{ background: avatarColor(u.name) }}>
                            {initials(u.name)}
                          </div>
                          <div>
                            <div className="pn">{u.name}</div>
                            <div className="ps">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>{isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Disabled</Badge>}</td>
                      <td className="muted">{joined(u.createdAt)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <Switch
                          label={isActive ? `Disable ${u.name}` : `Enable ${u.name}`}
                          checked={isActive}
                          disabled={toggleMutation.isPending}
                          onChange={(next) => toggleMutation.mutate({ id: u.id, active: next })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
          Click a customer to see their orders. The switch blocks or restores login.
        </p>
      </Card>

      {selected && <CustomerOrders user={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}

function CustomerOrders({ user, onClose }: { user: User; onClose: () => void }) {
  const ordersQuery = useQuery({
    queryKey: ["admin", "user-orders", user.id],
    queryFn: () => apiClient.get<{ user: User; orders: Order[] }>(`/admin/users/${user.id}/orders`),
  });
  const orders = ordersQuery.data?.orders ?? [];
  const spent = orders.filter((o) => o.status !== "CANCELLED").reduce((n, o) => n + o.totalAmount, 0);

  return (
    <Modal title={user.name} onClose={onClose}>
      <div className="card soft mb">
        <div className="kv">
          <span className="k">Email</span>
          <span className="v" style={{ fontWeight: 500 }}>
            {user.email}
          </span>
        </div>
        <div className="kv">
          <span className="k">Joined</span>
          <span className="v">{joined(user.createdAt)}</span>
        </div>
        <div className="kv">
          <span className="k">Orders</span>
          <span className="v">{orders.length}</span>
        </div>
        <div className="kv">
          <span className="k">Total spent</span>
          <span className="v" style={{ color: "var(--accent-hi)" }}>
            ৳{bdNumber(spent)}
          </span>
        </div>
      </div>

      <div className="sec-title" style={{ marginBottom: 10 }}>
        Order history
      </div>
      {ordersQuery.isPending ? (
        <Loading />
      ) : ordersQuery.isError ? (
        <div className="empty">{(ordersQuery.error as Error).message}</div>
      ) : orders.length === 0 ? (
        <div className="empty">No orders yet</div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th className="num">Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="mono">#{o.id.slice(-8).toUpperCase()}</td>
                  <td className="muted">{joined(o.createdAt)}</td>
                  <td className="num">৳{bdNumber(o.totalAmount)}</td>
                  <td>
                    <OrderBadge status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
