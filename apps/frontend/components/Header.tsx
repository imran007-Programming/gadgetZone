"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { apiClient } from "@/lib/api";
import type { Cart } from "@/lib/types";

export default function Header() {
  const { isAuthenticated, isAdmin, user, logout } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();

  const { data: cart } = useQuery({
    queryKey: ["cart", "count"],
    queryFn: () => apiClient.get<Cart>("/cart"),
    enabled: isAuthenticated && !isAdmin,
    staleTime: 30_000,
  });

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out");
    router.push("/");
  };

  const linkCls = (href: string) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition ${
      pathname === href
        ? "bg-indigo-50 text-indigo-700"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-lg font-bold text-white">
            S
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900">
            ShopStack
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link href="/" className={linkCls("/")}>Home</Link>
          <Link href="/products" className={linkCls("/products")}>Products</Link>
          {isAuthenticated && !isAdmin && (
            <Link href="/orders" className={linkCls("/orders")}>Orders</Link>
          )}
          {isAdmin && (
            <Link href="/admin" className={linkCls("/admin")}>Admin</Link>
          )}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          {isAuthenticated && !isAdmin && (
            <Link
              href="/cart"
              className="relative rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              aria-label="Cart"
            >
              🛒
              {(cart?.itemCount ?? 0) > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1 text-[11px] font-bold text-white">
                  {cart!.itemCount}
                </span>
              )}
            </Link>
          )}
          {isAuthenticated ? (
            <div className="flex items-center gap-1">
              <Link
                href="/account"
                className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 sm:block"
              >
                {user?.name?.split(" ")[0] ?? "Account"}
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Logout
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 px-4 py-1.5 md:hidden">
        <Link href="/" className={linkCls("/")}>Home</Link>
        <Link href="/products" className={linkCls("/products")}>Products</Link>
        {isAuthenticated && !isAdmin && (
          <Link href="/orders" className={linkCls("/orders")}>Orders</Link>
        )}
        {isAuthenticated && (
          <Link href="/account" className={linkCls("/account")}>Account</Link>
        )}
        {isAdmin && (
          <Link href="/admin" className={linkCls("/admin")}>Admin</Link>
        )}
      </nav>
    </header>
  );
}
