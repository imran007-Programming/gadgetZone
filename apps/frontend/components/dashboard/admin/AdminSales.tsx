"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { AdminStats, Order, OrderStatus, RevenueTrendMonth } from "@/lib/types";
import {
  Card,
  CardHead,
  ErrorBox,
  HBars,
  Kpi,
  LineChart,
  Loading,
  OrderBadge,
  PALETTE,
  bdNumber,
  matchesSearch,
  useAdminSearch,
} from "./kit";
import { customerName } from "./AdminOrders";

const COUNTED: OrderStatus[] = ["PAID", "SHIPPED", "DELIVERED"];

function shortTaka(n: number) {
  if (n >= 100_000) return `৳${(n / 100_000).toFixed(1)}L`;
  if (n >= 1000) return `৳${(n / 1000).toFixed(1)}K`;
  return `৳${Math.round(n)}`;
}

/** One key per buyer: account id, else guest phone/email/name. */
function buyerKey(o: Order) {
  return o.user?.id ?? o.guestPhone ?? o.guestEmail ?? customerName(o);
}

export default function AdminSales() {
  const search = useAdminSearch();
  const ordersQuery = useQuery({
    queryKey: ["admin", "orders"],
    queryFn: () => apiClient.get<Order[]>("/admin/orders"),
  });
  const trendQuery = useQuery({
    queryKey: ["admin", "revenue-trend"],
    queryFn: () => apiClient.get<RevenueTrendMonth[]>("/admin/revenue-trend"),
  });
  const categoryQuery = useQuery({
    queryKey: ["admin", "revenue-by-category"],
    queryFn: () =>
      apiClient.get<{ category: string; revenue: number; units: number }[]>("/admin/revenue-by-category"),
  });
  const statsQuery = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => apiClient.get<AdminStats>("/admin/stats"),
  });

  if (ordersQuery.isPending) return <Loading label="Loading sales…" />;
  if (ordersQuery.isError)
    return <ErrorBox message={(ordersQuery.error as Error).message} onRetry={() => ordersQuery.refetch()} />;

  const orders = ordersQuery.data;
  const sold = orders.filter((o) => COUNTED.includes(o.status));
  const totalSales = sold.reduce((n, o) => n + o.totalAmount, 0);
  const aov = sold.length ? totalSales / sold.length : 0;
  const discounts = sold.reduce((n, o) => n + (o.discountAmount ?? 0), 0);

  // Group paid orders per buyer for repeat rate and top customers
  const buyers = new Map<string, { name: string; orders: number; spent: number }>();
  for (const o of sold) {
    const key = buyerKey(o);
    const row = buyers.get(key) ?? { name: customerName(o), orders: 0, spent: 0 };
    row.orders += 1;
    row.spent += o.totalAmount;
    buyers.set(key, row);
  }
  const buyerList = [...buyers.values()];
  const repeat = buyerList.filter((b) => b.orders > 1).length;
  const repeatRate = buyerList.length ? (repeat / buyerList.length) * 100 : 0;
  const topBuyers = buyerList
    .filter((b) => matchesSearch(search, b.name))
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 6);
  const maxSpent = Math.max(...topBuyers.map((b) => b.spent), 1);

  const recent = orders
    .filter((o) => matchesSearch(search, o.id, customerName(o), o.status))
    .slice(0, 8);
  const trend = trendQuery.data ?? [];

  return (
    <section>
      <div className="grid kpi-grid">
        <Kpi label="Total sales" currency value={bdNumber(totalSales)} sub="Paid · shipped · delivered" />
        <Kpi
          label="New customers"
          value={bdNumber(statsQuery.data?.newCustomers30d ?? 0)}
          sub="Signed up in the last 30 days"
        />
        <Kpi
          label="Repeat rate"
          value={`${repeatRate.toFixed(1)}%`}
          sub={`${repeat} of ${buyerList.length} buyers ordered again`}
        />
        <Kpi label="Avg order value" currency value={bdNumber(aov)} sub={`After ৳${bdNumber(discounts)} in coupons`} />
      </div>

      <div className="grid two-col mb">
        <Card>
          <CardHead title="Sales by month" />
          {trendQuery.isPending ? (
            <Loading />
          ) : (
            <LineChart values={trend.map((t) => t.revenue)} labels={trend.map((t) => t.label)} height={245} />
          )}
        </Card>
        <Card>
          <CardHead title="Sales by category" />
          {categoryQuery.isPending ? (
            <Loading />
          ) : (
            <HBars
              items={(categoryQuery.data ?? []).map((c) => ({
                label: c.category,
                value: c.revenue,
                display: shortTaka(c.revenue),
              }))}
            />
          )}
        </Card>
      </div>

      <div className="grid two-col">
        <Card>
          <CardHead title="Recent transactions" />
          {recent.length === 0 ? (
            <div className="empty">No orders yet</div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th className="num">Items</th>
                    <th>Status</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((o) => (
                    <tr key={o.id}>
                      <td className="mono">#{o.id.slice(-8).toUpperCase()}</td>
                      <td className="prod-name">{customerName(o)}</td>
                      <td className="num">{o.items.reduce((n, i) => n + i.quantity, 0)}</td>
                      <td>
                        <OrderBadge status={o.status} />
                      </td>
                      <td className="num">৳{bdNumber(o.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card>
          <CardHead title="Top customers" right={<span className="muted" style={{ fontSize: 12 }}>By amount spent</span>} />
          {topBuyers.length === 0 ? (
            <div className="empty">No paid orders yet</div>
          ) : (
            topBuyers.map((b, i) => (
              <div className="rep-row" key={`${b.name}-${i}`}>
                <div className="rep-avatar" style={{ background: PALETTE[i % PALETTE.length] }}>
                  {b.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase()}
                </div>
                <div className="rep-info">
                  <div className="r-name">{b.name}</div>
                  <div className="r-sub">
                    {b.orders} order{b.orders === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="rep-bar">
                  <div className="rep-fill" style={{ width: `${(b.spent / maxSpent) * 100}%` }} />
                </div>
                <div className="rep-pct">{shortTaka(b.spent)}</div>
              </div>
            ))
          )}
        </Card>
      </div>
    </section>
  );
}
