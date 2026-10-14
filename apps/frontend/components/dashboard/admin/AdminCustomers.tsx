"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, UserCheck, UserX } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { formatPrice } from "@/lib/utils";
import type { Order, User } from "@/lib/types";
import { EmptyState, ErrorState, Spinner, StatusBadge } from "@/components/ui";

export default function AdminCustomers() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => apiClient.get<User[]>("/admin/users"),
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

  if (usersQuery.isPending) return <Spinner label="Loading customers…" />;
  if (usersQuery.isError)
    return (
      <ErrorState
        message={(usersQuery.error as Error).message}
        onRetry={() => usersQuery.refetch()}
      />
    );

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-50">
        Customers
      </h1>
      <p className="text-sm text-zinc-500">{usersQuery.data.length} accounts</p>
      {usersQuery.data.length === 0 ? (
        <EmptyState title="No customers found" />
      ) : (
        <div className="space-y-3">
          {usersQuery.data.map((u) => (
            <div key={u.id} className="rounded-xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 font-display text-sm font-bold text-zinc-300">
                    {u.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-50">
                      {u.name}{" "}
                      <span className="ml-1 rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
                        {u.role}
                      </span>
                      {!u.isActive && (
                        <span className="ml-1 rounded-full bg-rose-400/15 px-2 py-0.5 text-[11px] font-medium text-rose-300">
                          disabled
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-zinc-500">{u.email}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setExpanded(expanded === u.id ? null : u.id)}
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 ring-1 ring-zinc-800 hover:bg-zinc-950"
                  >
                    {expanded === u.id ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                    {expanded === u.id ? "Hide orders" : "View orders"}
                  </button>
                  {u.role !== "ADMIN" && (
                    <button
                      onClick={() =>
                        toggleMutation.mutate({ id: u.id, active: !u.isActive })
                      }
                      disabled={toggleMutation.isPending}
                      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
                        u.isActive
                          ? "text-rose-400 ring-1 ring-rose-400/30 hover:bg-rose-400/10"
                          : "text-emerald-400 ring-1 ring-emerald-400/25 hover:bg-emerald-400/10"
                      }`}
                    >
                      {u.isActive ? (
                        <UserX className="h-3.5 w-3.5" />
                      ) : (
                        <UserCheck className="h-3.5 w-3.5" />
                      )}
                      {u.isActive ? "Disable" : "Enable"}
                    </button>
                  )}
                </div>
              </div>
              {expanded === u.id && <UserOrders userId={u.id} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UserOrders({ userId }: { userId: string }) {
  const ordersQuery = useQuery({
    queryKey: ["admin", "user-orders", userId],
    queryFn: () => apiClient.get<Order[]>(`/admin/users/${userId}/orders`),
  });

  if (ordersQuery.isPending) return <Spinner label="Loading orders…" />;
  if (ordersQuery.isError)
    return (
      <p className="mt-3 text-xs text-rose-400">
        {(ordersQuery.error as Error).message}
      </p>
    );
  if (ordersQuery.data.length === 0)
    return <p className="mt-3 text-xs text-zinc-500">No orders.</p>;

  return (
    <ul className="mt-3 space-y-1.5 border-t border-zinc-800 pt-3">
      {ordersQuery.data.map((o) => (
        <li key={o.id} className="flex items-center justify-between gap-2 text-xs">
          <span className="font-mono text-zinc-500">#{o.id.slice(0, 8)}</span>
          <span className="text-zinc-500">
            {new Date(o.createdAt).toLocaleDateString()}
          </span>
          <span className="font-medium text-zinc-50">{formatPrice(o.totalAmount)}</span>
          <StatusBadge status={o.status} />
        </li>
      ))}
    </ul>
  );
}
