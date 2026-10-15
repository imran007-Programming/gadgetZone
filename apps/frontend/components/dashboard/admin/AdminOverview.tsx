"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowUpRight, DollarSign, ListOrdered } from "lucide-react";
import { apiClient } from "@/lib/api";
import type { AdminStats, OrderStatus, RevenueTrendMonth, TopProduct } from "@/lib/types";
import {
  BarChart,
  Card,
  CardHead,
  ErrorBox,
  HBars,
  Kpi,
  LineChart,
  Loading,
  bdNumber,
  matchesSearch,
  useAdminSearch,
} from "./kit";

interface OrdersByHour {
  date: string;
  totalOrders: number;
  totalRevenue: number;
  hours: { hour: string; orders: number; revenue: number }[];
}

interface CategoryRevenue {
  category: string;
  revenue: number;
  units: number;
}

const PAID: OrderStatus[] = ["PAID", "SHIPPED", "DELIVERED"];

/** ৳1.2L / ৳45.6K style short amounts for chart labels. */
function shortTaka(n: number) {
  if (n >= 100_000) return `৳${(n / 100_000).toFixed(1)}L`;
  if (n >= 1000) return `৳${(n / 1000).toFixed(1)}K`;
  return `৳${Math.round(n)}`;
}

export default function AdminOverview() {
  const search = useAdminSearch();
  const statsQuery = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => apiClient.get<AdminStats>("/admin/stats"),
  });
  const trendQuery = useQuery({
    queryKey: ["admin", "revenue-trend"],
    queryFn: () => apiClient.get<RevenueTrendMonth[]>("/admin/revenue-trend"),
  });
  const hourQuery = useQuery({
    queryKey: ["admin", "orders-by-hour"],
    queryFn: () => apiClient.get<OrdersByHour>("/admin/orders-by-hour"),
    refetchInterval: 60_000,
  });
  const topQuery = useQuery({
    queryKey: ["admin", "top-products"],
    queryFn: () => apiClient.get<TopProduct[]>("/admin/top-products"),
  });
  const categoryQuery = useQuery({
    queryKey: ["admin", "revenue-by-category"],
    queryFn: () => apiClient.get<CategoryRevenue[]>("/admin/revenue-by-category"),
  });

  if (statsQuery.isPending) return <Loading label="Loading dashboard…" />;
  if (statsQuery.isError)
    return <ErrorBox message={(statsQuery.error as Error).message} onRetry={() => statsQuery.refetch()} />;

  const stats = statsQuery.data;
  const paidOrders = PAID.reduce((n, s) => n + (stats.ordersByStatus[s] ?? 0), 0);
  const aov = paidOrders > 0 ? stats.totalRevenue / paidOrders : 0;

  const today = hourQuery.data;
  const hoursElapsed = new Date().getUTCHours() + 1;
  const ordersPerHour = today ? today.totalOrders / hoursElapsed : 0;
  const todayAov = today && today.totalOrders > 0 ? today.totalRevenue / today.totalOrders : 0;
  const shownHours = (today?.hours ?? []).filter((h) => Number(h.hour) >= 6 && Number(h.hour) <= 22);
  const peak = (today?.hours ?? []).reduce(
    (best, h) => (h.orders > best.orders ? h : best),
    { hour: "--", orders: 0, revenue: 0 },
  );

  const trend = trendQuery.data ?? [];
  const topProducts = (topQuery.data ?? []).filter((p) => matchesSearch(search, p.name)).slice(0, 5);

  return (
    <section>
      <div className="grid kpi-grid">
        <Kpi label="Total revenue" currency value={bdNumber(stats.totalRevenue)} sub="Paid · shipped · delivered" />
        <Kpi label="Total orders" value={bdNumber(stats.totalOrders)} sub={`${bdNumber(paidOrders)} paid or later`} />
        <Kpi label="Average order value" currency value={bdNumber(aov)} sub="Revenue ÷ paid orders" />
        <Kpi label="Total products" value={bdNumber(stats.totalProducts)} sub="Active listings" />
      </div>

      <div className="grid two-col mb">
        {/* Real-time revenue monitor */}
        <Card>
          <CardHead title="Real-time revenue monitor" icon={<DollarSign />} />
          <div className="grid three-col mb" style={{ alignItems: "start" }}>
            <div>
              <div className="stat-sub" style={{ marginBottom: 6 }}>
                Revenue today
              </div>
              <div className="big-stat">
                <span className="cur">৳</span>
                {bdNumber(today?.totalRevenue ?? 0)}
              </div>
            </div>
            <div className="card soft" style={{ padding: "12px 16px" }}>
              <div className="stat-sub">Orders / hr</div>
              <div className="big-stat" style={{ fontSize: 22 }}>
                {ordersPerHour.toFixed(1)}
              </div>
            </div>
            <div className="card soft" style={{ padding: "12px 16px" }}>
              <div className="stat-sub">Avg order today</div>
              <div className="big-stat" style={{ fontSize: 22 }}>
                <span className="cur">৳</span>
                {bdNumber(todayAov)}
              </div>
            </div>
          </div>

          <div className="sec-title" style={{ marginBottom: 6 }}>
            Revenue by month
          </div>
          {trendQuery.isPending ? (
            <Loading />
          ) : (
            <LineChart values={trend.map((t) => t.revenue)} labels={trend.map((t) => t.label)} />
          )}

          <div className="sec-title" style={{ margin: "18px 0 6px" }}>
            Revenue by category
          </div>
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

        <div className="stack">
          {/* Orders per hour */}
          <Card>
            <CardHead
              title="Orders per hour"
              icon={<ArrowUpRight />}
              right={<span className="chip" style={{ padding: "6px 12px" }}>TODAY · UTC</span>}
            />
            {hourQuery.isPending ? (
              <Loading />
            ) : (
              <BarChart values={shownHours.map((h) => h.orders)} labels={shownHours.map((h) => h.hour)} />
            )}
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <div className="card soft" style={{ padding: "12px 14px" }}>
                <div className="stat-sub">Peak hour</div>
                <div className="big-stat" style={{ fontSize: 20 }}>
                  {peak.orders > 0 ? `${peak.hour}:00` : "—"}
                </div>
              </div>
              <div className="card soft" style={{ padding: "12px 14px" }}>
                <div className="stat-sub">Today total</div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                  <div className="big-stat" style={{ fontSize: 20 }}>
                    {today?.totalOrders ?? 0}
                  </div>
                  <span className="stat-sub">Orders</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Top selling gadgets */}
          <Card>
            <CardHead
              title="Top selling gadgets"
              icon={<ListOrdered />}
              right={
                <Link href="/admin/products" className="sec-link">
                  View all
                </Link>
              }
            />
            {topQuery.isPending ? (
              <Loading />
            ) : topProducts.length === 0 ? (
              <div className="empty">{search ? "No products match your search" : "No sales yet"}</div>
            ) : (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Product</th>
                      <th className="num">Revenue</th>
                      <th className="num">Units</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((p, i) => (
                      <tr key={p.productId}>
                        <td className="row-idx">{i + 1}</td>
                        <td className="prod-name">{p.name}</td>
                        <td className="num">৳{bdNumber(p.revenue)}</td>
                        <td className="num">{p.unitsSold}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Low stock alerts */}
          <Card>
            <CardHead
              title="Low stock alerts"
              icon={<AlertTriangle />}
              right={
                <Link href="/admin/inventory" className="sec-link">
                  View all
                </Link>
              }
            />
            {stats.lowStock.length === 0 ? (
              <div className="empty">Every active product has at least 10 units.</div>
            ) : (
              stats.lowStock.slice(0, 3).map((p) => (
                <div className="alert-row" key={p.id}>
                  <div className="alert-ic">
                    <AlertTriangle />
                  </div>
                  <div className="alert-info">
                    <div className="a-name">{p.name}</div>
                    <div className="a-sub mono">
                      {p.slug} · {p.stock === 0 ? "out of stock" : `${p.stock} left`}
                    </div>
                  </div>
                  <Link href={`/admin/products/${p.id}`} className="btn sm ghost">
                    Restock
                  </Link>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>
    </section>
  );
}
