"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, DollarSign, ShoppingBag, UserPlus } from "lucide-react";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import type { AdminStats, OrderStatus } from "@/lib/types";
import { EmptyState, ErrorState, Spinner, StatusBadge } from "@/components/ui";

export default function AdminOverview() {
  const statsQuery = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => apiClient.get<AdminStats>("/admin/stats"),
  });

  if (statsQuery.isPending) return <Spinner label="Loading stats…" />;
  if (statsQuery.isError)
    return (
      <ErrorState
        message={(statsQuery.error as Error).message}
        onRetry={() => statsQuery.refetch()}
      />
    );

  const s = statsQuery.data;
  const cards = [
    { label: "Total revenue", value: formatPrice(s.totalRevenue), icon: DollarSign },
    { label: "New customers (30d)", value: String(s.newCustomers30d), icon: UserPlus },
    {
      label: "Total orders",
      value: String(Object.values(s.ordersByStatus).reduce((a, b) => a + b, 0)),
      icon: ShoppingBag,
    },
    { label: "Low-stock products", value: String(s.lowStock.length), icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900">
        Overview
      </h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl bg-zinc-50 p-5 ring-1 ring-zinc-200">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                <Icon className="h-5 w-5 text-blue-600" />
              </span>
              <p className="mt-3 text-2xl font-bold text-zinc-900">{c.value}</p>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {c.label}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-zinc-50 p-5 ring-1 ring-zinc-200">
          <h2 className="mb-3 text-sm font-bold text-zinc-900">Orders by status</h2>
          <ul className="space-y-2">
            {(Object.keys(s.ordersByStatus) as OrderStatus[]).map((st) => (
              <li key={st} className="flex items-center justify-between text-sm">
                <StatusBadge status={st} />
                <span className="font-semibold text-zinc-900">{s.ordersByStatus[st]}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl bg-zinc-50 p-5 ring-1 ring-zinc-200">
          <h2 className="mb-3 text-sm font-bold text-zinc-900">
            Low stock (under 10 units)
          </h2>
          {s.lowStock.length === 0 ? (
            <EmptyState title="All stocked up." />
          ) : (
            <ul className="space-y-2">
              {s.lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span className="truncate font-medium text-zinc-700">{p.name}</span>
                  <span
                    className={`font-bold ${p.stock === 0 ? "text-rose-400" : "text-amber-400"}`}
                  >
                    {p.stock} left
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
