"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Heart, LayoutDashboard, LogOut, ShoppingCart, User } from "lucide-react";
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

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out");
    router.push("/");
  };

  const linkCls = (href: string) =>
    `rounded-full px-3.5 py-2 text-sm font-medium transition ${
      pathname === href || pathname.startsWith(href + "/")
        ? "bg-lime-400/15 text-lime-300"
        : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100"
    }`;

  const dashboardHref = isAdmin ? "/admin" : "/dashboard";

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
            <Link href="/dashboard/orders" className={linkCls("/dashboard/orders")}>Orders</Link>
          )}
          {isAuthenticated && (
            <Link href={dashboardHref} className={linkCls(dashboardHref)}>Dashboard</Link>
          )}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          {!isAdmin && (
            <>
              <Link
                href={isAuthenticated ? "/dashboard/wishlist" : "/wishlist"}
                className="relative rounded-full p-2.5 text-zinc-400 transition hover:bg-zinc-800/70 hover:text-zinc-100"
                aria-label="Wishlist"
              >
                <Heart className="h-5 w-5" />
                {wishlistCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-lime-400 px-1 text-[11px] font-bold text-zinc-950">
                    {wishlistCount}
                  </span>
                )}
              </Link>
              <button
                onClick={openCartDrawer}
                className="relative rounded-full p-2.5 text-zinc-400 transition hover:bg-zinc-800/70 hover:text-zinc-100"
                aria-label="Open cart"
              >
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-lime-400 px-1 text-[11px] font-bold text-zinc-950">
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
                className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-zinc-400 transition hover:bg-zinc-800/70 hover:text-zinc-100 sm:flex"
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
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-zinc-400 transition hover:bg-zinc-800/70 hover:text-zinc-100"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
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
          <Link href="/dashboard/wishlist" className={linkCls("/dashboard/wishlist")}>Wishlist</Link>
        )}
        {isAuthenticated && !isAdmin && (
          <Link href="/dashboard/orders" className={linkCls("/dashboard/orders")}>Orders</Link>
        )}
        {isAuthenticated && (
          <Link href={dashboardHref} className={linkCls(dashboardHref)}>Dashboard</Link>
        )}
      </nav>
    </header>
  );
}
