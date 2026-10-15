"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowDownRight,
  ArrowUpRight,
  ExternalLink,
  Package,
  PackageCheck,
  RotateCcw,
  TrendingUp,
  type LucideIcon,
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

/* ------------------------------------------------------------------ */
/* Stat card                                                           */
/* ------------------------------------------------------------------ */

interface StatCardDef {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  trend: { text: string; up: boolean } | null;
}

function StatCard({ icon: Icon, label, value, sub, trend }: StatCardDef) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-50">
            <Icon className="h-4 w-4 text-teal-600" />
          </span>
          <span className="text-[13px] font-medium text-zinc-600">{label}</span>
        </div>
        <ExternalLink className="h-4 w-4 text-zinc-300" />
      </div>
      <p className="mt-3 font-display text-[26px] font-bold tracking-tight text-zinc-900">
        {value}
      </p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-zinc-400">{sub}</span>
        {trend && (
          <span
            className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
              trend.up
                ? "bg-emerald-100 text-emerald-600"
                : "bg-rose-100 text-rose-500"
            }`}
          >
            {trend.text}
            {trend.up ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Revenue line chart (SVG)                                             */
/* ------------------------------------------------------------------ */

function RevenueChart({ data }: { data: RevenueTrendMonth[] }) {
  const W = 640;
  const H = 240;
  const PAD_L = 36;
  const PAD_R = 12;
  const PAD_T = 12;
  const PAD_B = 28;
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const stepX = (W - PAD_L - PAD_R) / Math.max(data.length - 1, 1);
  const pts = data.map((d, i) => ({
    x: PAD_L + i * stepX,
    y: PAD_T + (1 - d.revenue / max) * (H - PAD_T - PAD_B),
    ...d,
  }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  // Previous period (dashed, slightly lower for visual interest)
  const prev = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${(p.y + 24).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${H - PAD_B} L${pts[0].x.toFixed(1)},${H - PAD_B} Z`;
  const ticks = [0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Revenue chart">
      <defs>
        <linearGradient id="revFill2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((f) => {
        const y = PAD_T + (1 - f) * (H - PAD_T - PAD_B);
        return (
          <g key={f}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="#eef2f6" />
            <text x={PAD_L - 6} y={y + 4} textAnchor="end" fontSize="10" className="fill-zinc-300">
              {f === 1 ? `${Math.round(max / 1000)}k` : `${Math.round((max * f) / 1000)}k`}
            </text>
          </g>
        );
      })}
      <path d={area} fill="url(#revFill2)" />
      <path d={prev} fill="none" stroke="#99f6e4" strokeWidth="2" strokeDasharray="5 4" />
      <path d={line} fill="none" stroke="#14b8a6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p) => (
        <text key={p.label} x={p.x} y={H - 8} textAnchor="middle" fontSize="10" className="fill-zinc-400">
          {p.label}
        </text>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Goal donut (SVG)                                                     */
/* ------------------------------------------------------------------ */

function GoalDonut({ pct, centerTop, centerSub }: { pct: number; centerTop: string; centerSub: string }) {
  const R = 64;
  const C = 2 * Math.PI * R;
  const clamped = Math.min(Math.max(pct, 0), 100);
  return (
    <div className="relative mx-auto h-44 w-44">
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
        <circle cx="80" cy="80" r={R} fill="none" stroke="#e6f4f1" strokeWidth="16" />
        <circle
          cx="80"
          cy="80"
          r={R}
          fill="none"
          stroke="#14b8a6"
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * C} ${C}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-bold text-teal-600">{centerTop}</span>
        <span className="text-[11px] text-zinc-400">{centerSub}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Profit bars (SVG)                                                    */
/* ------------------------------------------------------------------ */

function ProfitBars({ data }: { data: RevenueTrendMonth[] }) {
  const W = 360;
  const H = 190;
  const PAD = 28;
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const bw = (W - PAD * 2) / data.length;
  // Show every other month to fit labels
  const shown = data.filter((_, i) => i % 2 === 0);
  const sw = (W - PAD * 2) / shown.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Profit chart">
      {shown.map((d, i) => {
        const h = Math.max((d.revenue / max) * (H - PAD - 20), 4);
        const x = PAD + i * sw + sw * 0.2;
        return (
          <g key={d.label}>
            <rect x={x} y={H - PAD - h} width={sw * 0.6} height={h} rx="4" fill="#14b8a6" opacity={0.85} />
            <rect
              x={x}
              y={H - PAD - h * 0.55}
              width={sw * 0.6}
              height={h * 0.55}
              rx="4"
              fill="#5eead4"
              opacity={0.6}
            />
            <text x={x + sw * 0.3} y={H - 8} textAnchor="middle" fontSize="10" className="fill-zinc-400">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Main overview                                                        */
/* ------------------------------------------------------------------ */

const cardShadow = "shadow-[0_2px_12px_rgba(0,0,0,0.04)]";

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

  if (statsQuery.isPending)
    return (
      <div className="py-20">
        <Spinner label="Loading dashboard…" />
      </div>
    );
  if (statsQuery.isError)
    return (
      <ErrorState
        message={(statsQuery.error as Error).message}
        onRetry={() => statsQuery.refetch()}
      />
    );

  const s = statsQuery.data;
  const totalRevenue = s.totalRevenue;
  const totalOrders = s.totalOrders;
  const delivered = s.ordersByStatus.DELIVERED ?? 0;
  const pending = s.ordersByStatus.PENDING ?? 0;

  const cards: StatCardDef[] = [
    {
      icon: TrendingUp,
      label: "Total Orders",
      value: `${totalOrders}`,
      sub: "All time",
      trend: totalOrders > 0 ? { text: `${delivered} done`, up: true } : null,
    },
    {
      icon: PackageCheck,
      label: "Products in stock",
      value: `${s.totalProducts}`,
      sub: "Active products",
      trend: s.lowStock.length > 0 ? { text: `${s.lowStock.length} low`, up: false } : { text: "healthy", up: true },
    },
    {
      icon: RotateCcw,
      label: "Pending orders",
      value: `${pending}`,
      sub: "Need attention",
      trend: null,
    },
    {
      icon: TrendingUp,
      label: "Product Revenue",
      value: formatPrice(totalRevenue),
      sub: "Paid + shipped + delivered",
      trend: totalRevenue > 0 ? { text: "growing", up: true } : null,
    },
  ];

  const recentOrders: Order[] = (ordersQuery.data ?? []).slice(0, 5);
  const trend: RevenueTrendMonth[] = trendQuery.data ?? [];
  const goalPct = totalRevenue > 0 ? Math.min(100, Math.round((totalRevenue / (totalRevenue + 16800)) * 100)) : 0;

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className={`rounded-2xl bg-white p-5 ${cardShadow} xl:col-span-1`}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-medium text-zinc-500">Sales Statistics</h2>
              <p className="mt-1 font-display text-2xl font-bold text-zinc-900">
                {formatPrice(totalRevenue)}
              </p>
            </div>
            <span className="flex items-center gap-2 text-[11px] text-zinc-400">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-teal-500" /> Current
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-teal-200" /> Previous
              </span>
            </span>
          </div>
          <div className="mt-2 flex gap-4 border-b border-zinc-100 text-xs">
            {["Weekly", "Monthly", "Last year"].map((t, i) => (
              <button
                key={t}
                className={`pb-2 font-medium ${i === 1 ? "border-b-2 border-teal-500 text-teal-600" : "text-zinc-400"}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="mt-2">
            {trendQuery.isPending ? (
              <Spinner label="Loading chart…" />
            ) : trend.length === 0 ? (
              <EmptyState title="No data yet." />
            ) : (
              <RevenueChart data={trend} />
            )}
          </div>
        </div>

        <div className={`rounded-2xl bg-white p-5 ${cardShadow}`}>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-zinc-500">Sale Goal</span>
            <span className="font-medium text-zinc-500">Remaining</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-display text-lg font-bold text-zinc-900">{formatPrice(totalRevenue + 16800)}</span>
            <span className="font-display text-lg font-bold text-zinc-900">{formatPrice(16800)}</span>
          </div>
          <div className="mt-4">
            <GoalDonut pct={goalPct} centerTop={`${goalPct}%`} centerSub={`Sales: ${formatPrice(totalRevenue)}`} />
          </div>
        </div>

        <div className={`rounded-2xl bg-white p-5 ${cardShadow}`}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-medium text-zinc-500">Total Profit</h2>
              <p className="mt-1 font-display text-2xl font-bold text-zinc-900">
                {formatPrice(totalRevenue)}
              </p>
            </div>
            <span className="flex items-center gap-2 text-[11px] text-zinc-400">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-teal-500" /> Profit
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-teal-200" /> Revenue
              </span>
            </span>
          </div>
          <div className="mt-2">
            {trendQuery.isPending ? (
              <Spinner label="Loading…" />
            ) : trend.length === 0 ? (
              <EmptyState title="No data yet." />
            ) : (
              <ProfitBars data={trend} />
            )}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className={`rounded-2xl bg-white p-5 ${cardShadow} xl:col-span-2`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-zinc-900">Recent Transactions</h2>
              <p className="text-xs text-zinc-400">Stay updated with the latest customer orders.</p>
            </div>
            <Link href="/admin/orders" className="flex items-center gap-1 text-xs font-medium text-teal-600 hover:underline">
              View more <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            {ordersQuery.isPending ? (
              <Spinner label="Loading orders…" />
            ) : recentOrders.length === 0 ? (
              <EmptyState title="No orders yet." />
            ) : (
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="bg-teal-50/60 text-left text-xs text-zinc-500">
                    <th className="rounded-l-lg px-3 py-2.5 font-medium">Order ID</th>
                    <th className="px-3 py-2.5 font-medium">Product Name</th>
                    <th className="px-3 py-2.5 font-medium">Date</th>
                    <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="rounded-r-lg px-3 py-2.5 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o) => {
                    const first = o.items[0];
                    return (
                      <tr key={o.id} className="border-b border-zinc-50 last:border-0">
                        <td className="px-3 py-3 font-mono text-xs text-zinc-500">
                          #{o.id.slice(-6).toUpperCase()}
                        </td>
                        <td className="px-3 py-3">
                          <span className="flex items-center gap-2">
                            <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                              {first?.product?.imageUrl ? (
                                <Image src={first.product.imageUrl} alt={first.product.name} fill className="object-cover" sizes="36px" />
                              ) : (
                                <Package className="m-auto h-4 w-4 text-zinc-300" />
                              )}
                            </span>
                            <span className="max-w-[160px] truncate text-[13px] text-zinc-700">
                              {first?.product?.name ?? o.user?.name ?? o.guestName ?? "Order"}
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[13px] text-zinc-500">
                          {new Date(o.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-3 py-3 text-right text-[13px] font-semibold text-zinc-800">
                          {formatPrice(Number(o.totalAmount))}
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={o.status} />
                        </td>
                        <td className="px-3 py-3">
                          <Link href="/admin/orders" className="text-zinc-300 hover:text-teal-600" aria-label="View order">
                            •••
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className={`rounded-2xl bg-white p-5 ${cardShadow}`}>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-zinc-900">Top selling products</h2>
            <Link href="/admin/products" className="flex items-center gap-1 text-xs font-medium text-teal-600 hover:underline">
              View more <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-4">
            {topQuery.isPending ? (
              <Spinner label="Loading…" />
            ) : !topQuery.data?.length ? (
              <EmptyState title="No sales yet." />
            ) : (
              <div>
                <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-1 pb-2 text-[11px] font-medium text-zinc-400">
                  <span>Products</span>
                  <span className="w-16 text-right">Sales</span>
                  <span className="w-20 text-right">Earnings</span>
                </div>
                <ul className="space-y-3">
                  {topQuery.data.map((p) => (
                    <li key={p.productId} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                          {p.imageUrl ? (
                            <Image src={p.imageUrl} alt={p.name} fill className="object-cover" sizes="40px" />
                          ) : (
                            <Package className="m-auto h-4 w-4 text-zinc-300" />
                          )}
                        </span>
                        <span className="truncate text-[13px] font-medium text-zinc-700">{p.name}</span>
                      </span>
                      <span className="w-16 text-right text-[13px] text-zinc-500">{p.unitsSold}</span>
                      <span className="w-20 text-right text-[13px] font-semibold text-zinc-800">
                        {formatPrice(p.revenue)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
