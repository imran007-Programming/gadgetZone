"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Heart,
  LayoutDashboard,
  LogOut,
  Search,
  ShoppingCart,
  User,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { useCartStore, selectItemCount } from "@/lib/store/cart";
import { useWishlistStore, selectWishlistCount } from "@/lib/store/wishlist";

export default function Header() {
  const { isAuthenticated, isAdmin, user, logout } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const openCartDrawer = useCartStore((s) => s.openDrawer);
  const cartCount = useCartStore(selectItemCount);
  const wishlistCount = useWishlistStore(selectWishlistCount);
  const [query, setQuery] = useState("");

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out");
    router.push("/");
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/products${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`);
  };

  const linkCls = (href: string) =>
    `rounded-full px-3.5 py-2 text-sm font-medium transition ${
      pathname === href || pathname.startsWith(href + "/")
        ? "bg-blue-100 text-blue-800"
        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
    }`;

  const dashboardHref = isAdmin ? "/admin" : "/dashboard";

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 font-display text-lg font-bold text-white shadow-sm">
            G
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-zinc-900">
            Gadget<span className="text-blue-600">Lax</span>
          </span>
        </Link>

        {/* Prominent search */}
        <form
          onSubmit={submitSearch}
          className="hidden min-w-0 flex-1 items-center md:flex"
          role="search"
        >
          <div className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for products"
              className="w-full rounded-full border border-zinc-200 bg-zinc-100 py-2.5 pl-11 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 transition focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>
        </form>

        <nav className="hidden items-center gap-1 lg:flex">
          <Link href="/" className={linkCls("/")}>Home</Link>
          <Link href="/products" className={linkCls("/products")}>Products</Link>
          {isAuthenticated && !isAdmin && (
            <Link href="/dashboard/orders" className={linkCls("/dashboard/orders")}>Orders</Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {!isAdmin && (
            <>
              <Link
                href={isAuthenticated ? "/dashboard/wishlist" : "/wishlist"}
                className="relative hidden rounded-full p-2.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 sm:block"
                aria-label="Wishlist"
              >
                <Heart className="h-5 w-5" />
                {wishlistCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-bold text-white">
                    {wishlistCount}
                  </span>
                )}
              </Link>
              <button
                onClick={openCartDrawer}
                className="relative hidden rounded-full p-2.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 sm:block"
                aria-label="Open cart"
              >
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-bold text-white">
                    {cartCount}
                  </span>
                )}
              </button>
            </>
          )}
          {isAuthenticated ? (
            <div className="flex items-center gap-1">
              <Link
                href={dashboardHref}
                className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 sm:flex"
              >
                {isAdmin ? (
                  <LayoutDashboard className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4" />
                )}
                {user?.name?.split(" ")[0] ?? "Dashboard"}
              </Link>
              <button
                onClick={handleLogout}
                className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 sm:flex"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-full px-3.5 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 sm:block"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="btn-glow hidden rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 sm:block"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile search row */}
      <div className="border-t border-zinc-100 px-4 py-2.5 md:hidden">
        <form onSubmit={submitSearch} role="search">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for products"
              className="w-full rounded-full border border-zinc-200 bg-zinc-100 py-2.5 pl-11 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 transition focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>
        </form>
      </div>
    </header>
  );
}
