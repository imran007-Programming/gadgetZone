"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  DollarSign,
  Package,
  ShoppingBag,
  Users,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import type {
  AdminStats,
  Order,
  RevenueTrendMonth,
  TopProduct,
} from "@/lib/types";
import { EmptyState, ErrorState, Spinner, StatusBadge } from "@/components/ui";

/** Simple SVG area chart for monthly revenue. */
function RevenueChart({ data }: { data: RevenueTrendMonth[] }) {
  const W = 600;
  const H = 220;
  const PAD = 32;
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const stepX = (W - PAD * 2) / Math.max(data.length - 1, 1);
  const pts = data.map((d, i) => ({
    x: PAD + i * stepX,
    y: H - PAD - (d.revenue / max) * (H - PAD * 2),
    ...d,
  }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = `${line} L${pts[pts.length - 1].x},${H - PAD} L${pts[0].x},${H - PAD} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Monthly revenue chart">
      <defs>
        <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={PAD}
          x2={W - PAD}
          y1={H - PAD - f * (H - PAD * 2)}
          y2={H - PAD - f * (H - PAD * 2)}
          stroke="#e4e4e7"
          strokeDasharray="4 4"
        />
      ))}
      <path d={area} fill="url(#revFill)" />
      <path d={line} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) =>
        i % 2 === 0 ? (
          <text key={p.label} x={p.x} y={H - 10} textAnchor="middle" className="fill-zinc-400" fontSize="11">
            {p.label}
          </text>
        ) : null
      )}
    </svg>
  );
}

/** SVG donut for orders by status. */
function OrdersDonut({ byStatus }: { byStatus: Record<string, number> }) {
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0) || 1;
  const colors: Record<string, string> = {
    DELIVERED: "#2563eb",
    SHIPPED: "#60a5fa",
    PAID: "#34d399",
    PENDING: "#fbbf24",
    CANCELLED: "#f87171",
  };
  const R = 70;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const segs = Object.entries(byStatus)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => {
      const frac = v / total;
      const seg = { k, v, dash: frac * C, offset: -offset * C };
      offset += frac;
      return seg;
    });

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 180 180" className="h-40 w-40 shrink-0">
        <circle cx="90" cy="90" r={R} fill="none" stroke="#f4f4f5" strokeWidth="22" />
        {segs.map((s) => (
          <circle
            key={s.k}
            cx="90"
            cy="90"
            r={R}
            fill="none"
            stroke={colors[s.k] ?? "#a1a1aa"}
            strokeWidth="22"
            strokeDasharray={`${s.dash} ${C - s.dash}`}
            strokeDashoffset={s.offset}
            strokeLinecap="butt"
            transform="rotate(-90 90 90)"
          />
        ))}
        <text x="90" y="86" textAnchor="middle" className="fill-zinc-900" fontSize="26" fontWeight="800">
          {total}
        </text>
        <text x="90" y="106" textAnchor="middle" className="fill-zinc-400" fontSize="11">
          Orders
        </text>
      </svg>
      <ul className="space-y-2 text-sm">
        {Object.entries(byStatus).map(([k, v]) => (
          <li key={k} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[k] ?? "#a1a1aa" }} />
            <span className="capitalize text-zinc-600">{k.toLowerCase()}</span>
            <span className="ml-auto pl-4 font-bold text-zinc-900">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AdminOverview() {
  const statsQuery = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => apiClient.get<AdminStats>("/admin/stats"),
  });
  const trendQuery = useQuery({
    queryKey: ["admin", "revenue-trend"],
    queryFn: () => apiClient.get<RevenueTrendMonth[]>("/admin/revenue-trend"),
  });
  const ordersQuery = useQuery({
    queryKey: ["admin", "orders", "recent"],
    queryFn: () => apiClient.get<Order[]>("/admin/orders"),
  });
  const topQuery = useQuery({
    queryKey: ["admin", "top-products"],
    queryFn: () => apiClient.get<TopProduct[]>("/admin/top-products"),
  });

  if (statsQuery.isPending) return <Spinner label="Loading dashboard…" />;
  if (statsQuery.isError)
    return (
      <ErrorState
        message={(statsQuery.error as Error).message}
        onRetry={() => statsQuery.refetch()}
      />
    );

  const s = statsQuery.data;
  const totalRevenue = s.totalRevenue;
  const cards = [
    {
      label: "Total Revenue",
      value: formatPrice(totalRevenue),
      sub: `${s.totalOrders} orders`,
      icon: DollarSign,
      tint: "bg-blue-100 text-blue-600",
    },
    {
      label: "Total Orders",
      value: String(s.totalOrders),
      sub: `${s.newCustomers30d} new customers (30d)`,
      icon: ShoppingBag,
      tint: "bg-violet-100 text-violet-600",
    },
    {
      label: "Total Products",
      value: String(s.totalProducts),
      sub: `${s.lowStock.length} low stock`,
      icon: Package,
      tint: "bg-amber-100 text-amber-600",
    },
    {
      label: "Total Customers",
      value: String(s.totalCustomers),
      sub: "registered accounts",
      icon: Users,
      tint: "bg-emerald-100 text-emerald-600",
    },
  ];

  const recentOrders: Order[] = (ordersQuery.data ?? []).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900">
            Dashboard
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Store performance at a glance.
          </p>
        </div>
        <Link
          href="/admin/orders"
          className="flex items-center gap-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          View orders <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70">
              <div className="flex items-center justify-between">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${c.tint}`}>
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-4 font-display text-2xl font-bold tracking-tight text-zinc-900">
                {c.value}
              </p>
              <p className="mt-1 text-sm font-medium text-zinc-500">{c.label}</p>
              <p className="mt-0.5 text-xs text-zinc-400">{c.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-zinc-900">
                Revenue Statistics
              </h2>
              <p className="text-xs text-zinc-400">Last 12 months</p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              {formatPrice(totalRevenue)} total
            </span>
          </div>
          {trendQuery.isPending ? (
            <Spinner label="Loading chart…" />
          ) : trendQuery.isError || !trendQuery.data?.length ? (
            <EmptyState title="No revenue data yet." />
          ) : (
            <RevenueChart data={trendQuery.data} />
          )}
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70">
          <h2 className="font-display text-base font-bold text-zinc-900">
            Orders by Status
          </h2>
          <p className="mb-4 text-xs text-zinc-400">All time distribution</p>
          <OrdersDonut byStatus={s.ordersByStatus as Record<string, number>} />
        </div>
      </div>

      {/* Tables */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-zinc-900">
                Recent Orders
              </h2>
              <p className="text-xs text-zinc-400">Latest customer orders</p>
            </div>
            <Link href="/admin/orders" className="text-xs font-semibold text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          {ordersQuery.isPending ? (
            <Spinner label="Loading orders…" />
          ) : recentOrders.length === 0 ? (
            <EmptyState title="No orders yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-400">
                    <th className="pb-2 pr-3 font-semibold">Order</th>
                    <th className="pb-2 pr-3 font-semibold">Customer</th>
                    <th className="pb-2 pr-3 font-semibold">Date</th>
                    <th className="pb-2 pr-3 text-right font-semibold">Amount</th>
                    <th className="pb-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o) => (
                    <tr key={o.id} className="border-b border-zinc-50 last:border-0">
                      <td className="py-3 pr-3 font-mono text-xs font-semibold text-zinc-700">
                        #{o.id.slice(-6).toUpperCase()}
                      </td>
                      <td className="py-3 pr-3 text-zinc-700">
                        {o.user?.name ?? o.guestName ?? "Guest"}
                      </td>
                      <td className="py-3 pr-3 text-zinc-500">
                        {new Date(o.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3 pr-3 text-right font-bold text-zinc-900">
                        {formatPrice(Number(o.totalAmount))}
                      </td>
                      <td className="py-3">
                        <StatusBadge status={o.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-zinc-900">
                Top Products
              </h2>
              <p className="text-xs text-zinc-400">Best sellers by units</p>
            </div>
            <Link href="/admin/products" className="text-xs font-semibold text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          {topQuery.isPending ? (
            <Spinner label="Loading…" />
          ) : !topQuery.data?.length ? (
            <EmptyState title="No sales yet." />
          ) : (
            <ul className="space-y-3">
              {topQuery.data.map((p) => (
                <li key={p.productId} className="flex items-center gap-3">
                  <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                    {p.imageUrl ? (
                      <Image src={p.imageUrl} alt={p.name} fill className="object-cover" sizes="44px" />
                    ) : (
                      <Package className="m-auto h-5 w-5 text-zinc-300" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-900">{p.name}</p>
                    <p className="text-xs text-zinc-400">{p.unitsSold} sold</p>
                  </div>
                  <span className="text-sm font-bold text-zinc-900">
                    {formatPrice(p.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
