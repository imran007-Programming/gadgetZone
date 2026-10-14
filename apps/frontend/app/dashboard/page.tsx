"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Heart,
  Package,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCartStore, selectItemCount, selectSubtotal } from "@/lib/store/cart";
import { useWishlistStore, selectWishlistCount } from "@/lib/store/wishlist";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import type { Order } from "@/lib/types";
import { Spinner } from "@/components/ui";
import OrdersList from "@/components/dashboard/OrdersList";

export default function DashboardOverview() {
  const { user } = useAuth();
  const cartCount = useCartStore(selectItemCount);
  const cartSubtotal = useCartStore(selectSubtotal);
  const wishlistCount = useWishlistStore(selectWishlistCount);

  const ordersQuery = useQuery({
    queryKey: ["orders"],
    queryFn: () => apiClient.get<Order[]>("/orders"),
  });

  const orders = ordersQuery.data ?? [];
  const totalSpent = orders
    .filter((o) => o.status !== "CANCELLED")
    .reduce((n, o) => n + Number(o.totalAmount), 0);

  const stats = [
    {
      label: "Orders placed",
      value: String(orders.length),
      icon: Package,
      href: "/dashboard/orders",
    },
    {
      label: "Wishlist items",
      value: String(wishlistCount),
      icon: Heart,
      href: "/dashboard/wishlist",
    },
    {
      label: "Cart items",
      value: String(cartCount),
      icon: ShoppingCart,
      href: "/cart",
    },
    {
      label: "Total spent",
      value: ordersQuery.isPending ? "…" : formatPrice(totalSpent),
      icon: Sparkles,
      href: "/dashboard/orders",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-lime-400/20 via-zinc-900 to-zinc-900 p-6 ring-1 ring-lime-500/20 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-lime-600">
          Welcome back
        </p>
        <h1 className="font-display mt-1 text-2xl font-bold text-zinc-900 sm:text-3xl">
          Hey, {user?.name?.split(" ")[0] ?? "there"}!
        </h1>
        <p className="mt-2 max-w-md text-sm text-zinc-500">
          Here&apos;s what&apos;s happening with your GadgetLax account.
          {cartCount > 0 && (
            <>
              {" "}You have {cartCount} item{cartCount === 1 ? "" : "s"} in your
              cart ({formatPrice(cartSubtotal)}) waiting for checkout.
            </>
          )}
        </p>
        {cartCount > 0 && (
          <Link
            href="/cart"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-lime-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-lime-600"
          >
            <ShoppingCart className="h-4 w-4" />
            Review cart
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              href={s.href}
              className="rounded-xl bg-zinc-50 p-5 ring-1 ring-zinc-200 transition hover:ring-lime-500/40"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-100">
                <Icon className="h-5 w-5 text-lime-600" />
              </span>
              <p className="mt-3 text-2xl font-bold text-zinc-900">{s.value}</p>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {s.label}
              </p>
            </Link>
          );
        })}
      </div>

      {/* Recent orders */}
      <div className="rounded-xl bg-zinc-50/50 p-5 ring-1 ring-zinc-200">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-zinc-900">
            Recent orders
          </h2>
          {orders.length > 0 && (
            <Link
              href="/dashboard/orders"
              className="inline-flex items-center gap-1 text-sm font-medium text-lime-600 hover:underline"
            >
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
        {ordersQuery.isPending ? (
          <Spinner label="Loading orders…" />
        ) : (
          <OrdersList compact />
        )}
      </div>
    </div>
  );
}
