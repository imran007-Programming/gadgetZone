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
    `rounded-full px-3.5 py-2 text-sm font-medium transition ${
      pathname === href
        ? "bg-lime-400/15 text-lime-300"
        : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400 font-display text-lg font-bold text-zinc-950 shadow-[0_0_20px_-4px_rgba(163,230,53,0.6)] transition group-hover:shadow-[0_0_28px_-2px_rgba(163,230,53,0.8)]">
            G
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-zinc-50">
            Gadget<span className="text-lime-400">Lax</span>
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
              className="relative rounded-full px-3 py-2 text-sm font-medium text-zinc-400 transition hover:bg-zinc-800/70 hover:text-zinc-100"
              aria-label="Cart"
            >
              <span className="text-base">🛒</span>
              {(cart?.itemCount ?? 0) > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-lime-400 px-1 text-[11px] font-bold text-zinc-950">
                  {cart!.itemCount}
                </span>
              )}
            </Link>
          )}
          {isAuthenticated ? (
            <div className="flex items-center gap-1">
              <Link
                href="/account"
                className="hidden rounded-full px-3 py-2 text-sm font-medium text-zinc-400 transition hover:bg-zinc-800/70 hover:text-zinc-100 sm:block"
              >
                {user?.name?.split(" ")[0] ?? "Account"}
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-full px-3 py-2 text-sm font-medium text-zinc-400 transition hover:bg-zinc-800/70 hover:text-zinc-100"
              >
                Logout
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full px-3.5 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800/70 hover:text-white"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="btn-glow rounded-full bg-lime-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-lime-300"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-zinc-800/60 px-4 py-2 md:hidden">
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
