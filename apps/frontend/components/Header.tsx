"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  BadgePercent,
  ChevronDown,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  ShoppingCart,
  User,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import type { Category, Product } from "@/lib/types";
import SearchBar from "./SearchBar";
import { useCartStore, selectItemCount } from "@/lib/store/cart";
import { useWishlistStore, selectWishlistCount } from "@/lib/store/wishlist";

/** Dropdown shown on category hover: top products in that category. */
function CategoryDropdown({ slug }: { slug: string }) {
  const { data } = useQuery({
    queryKey: ["category-preview", slug],
    queryFn: () =>
      apiClient.get<{ items: Product[] }>(`/products?category=${slug}&limit=4`),
    staleTime: 5 * 60 * 1000,
  });
  const items = data?.items ?? [];
  return (
    <div className="absolute left-0 top-full z-50 w-72 pt-2">
      <div className="overflow-hidden rounded-2xl bg-white shadow-[0_12px_40px_rgba(0,0,0,0.12)] ring-1 ring-zinc-200/70">
        {items.length === 0 ? (
          <p className="px-4 py-5 text-sm text-zinc-400">No products yet.</p>
        ) : (
          <ul className="py-2">
            {items.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/products/${p.slug}`}
                  className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-zinc-50"
                >
                  <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                    <Image src={p.imageUrl} alt={p.name} fill className="object-cover" sizes="40px" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-700">
                      {p.name}
                    </span>
                    <span className="text-xs font-bold text-blue-600">
                      {formatPrice(p.price)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/products?category=${slug}`}
          className="block border-t border-zinc-100 px-4 py-2.5 text-center text-xs font-bold text-blue-600 transition hover:bg-blue-50"
        >
          View all products
        </Link>
      </div>
    </div>
  );
}

export default function Header() {
  const { isAuthenticated, isAdmin, user, logout } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const openCartDrawer = useCartStore((s) => s.openDrawer);
  const cartCount = useCartStore(selectItemCount);
  const wishlistCount = useWishlistStore(selectWishlistCount);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [hoverCat, setHoverCat] = useState<string | null>(null);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiClient.get<Category[]>("/categories"),
    staleTime: 10 * 60 * 1000,
  });

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out");
    router.push("/");
  };

  const dashboardHref = isAdmin ? "/admin" : "/dashboard";

  return (
    <header className="sticky top-0 z-40 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      {/* Main navbar row */}
      <div className="mx-auto flex h-[72px] max-w-[1450px] items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 font-display text-xl font-bold text-white shadow-sm">
            G
          </span>
          <span className="hidden font-display text-xl font-bold tracking-tight text-zinc-900 sm:block">
            Gadget<span className="text-blue-600">Lax</span>
          </span>
        </Link>

        {/* Browse Categories */}
        <div
          className="relative hidden shrink-0 md:block"
          onMouseEnter={() => setBrowseOpen(true)}
          onMouseLeave={() => setBrowseOpen(false)}
        >
          <button className="flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
            <Menu className="h-4 w-4" />
            Browse Categories
            <ChevronDown className={`h-4 w-4 transition-transform ${browseOpen ? "rotate-180" : ""}`} />
          </button>
          {browseOpen && (
            <div className="absolute left-0 top-full z-50 w-64 pt-2">
              <div className="overflow-hidden rounded-2xl bg-white py-2 shadow-[0_12px_40px_rgba(0,0,0,0.12)] ring-1 ring-zinc-200/70">
                {(categories ?? []).map((c) => (
                  <Link
                    key={c.id}
                    href={`/products?category=${c.slug}`}
                    className="flex items-center justify-between px-5 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-blue-50 hover:text-blue-700"
                  >
                    {c.name}
                    <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-zinc-300" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Search */}
        <SearchBar className="hidden min-w-0 flex-1 md:block" />

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/products"
            className="hidden items-center gap-1.5 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 lg:flex"
          >
            <BadgePercent className="h-4 w-4" />
            Discounts
          </Link>
          <Link
            href={isAuthenticated ? "/dashboard/wishlist" : "/wishlist"}
            className="relative hidden rounded-full p-2.5 text-zinc-600 transition hover:bg-zinc-100 sm:block"
            aria-label="Wishlist"
          >
            <Heart className="h-5 w-5" />
            {wishlistCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-bold text-white">
                {wishlistCount}
              </span>
            )}
          </Link>
          {isAuthenticated ? (
            <div className="relative hidden sm:block">
              <Link
                href={dashboardHref}
                className="flex items-center gap-1.5 rounded-full bg-zinc-100 p-2.5 text-zinc-700 transition hover:bg-zinc-200"
                aria-label="Account"
              >
                {isAdmin ? <LayoutDashboard className="h-5 w-5" /> : <User className="h-5 w-5" />}
              </Link>
            </div>
          ) : (
            <Link
              href="/login"
              className="hidden rounded-full bg-zinc-100 p-2.5 text-zinc-700 transition hover:bg-zinc-200 sm:block"
              aria-label="Login"
            >
              <User className="h-5 w-5" />
            </Link>
          )}
          <button
            onClick={openCartDrawer}
            className="relative rounded-full bg-zinc-900 p-2.5 text-white shadow-sm transition hover:bg-zinc-700"
            aria-label="Open cart"
          >
            <ShoppingCart className="h-5 w-5" />
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-bold text-white ring-2 ring-white">
              {cartCount}
            </span>
          </button>
          {isAuthenticated && (
            <button
              onClick={handleLogout}
              className="hidden rounded-full p-2.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-rose-600 xl:block"
              aria-label="Logout"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile search row */}
      <div className="border-t border-zinc-100 px-4 py-2.5 md:hidden">
        <SearchBar className="w-full" />
      </div>

      {/* Category nav row */}
      <nav className="border-t border-zinc-100">
        <div className="mx-auto flex max-w-[1450px] items-center gap-7 overflow-x-auto px-4 sm:px-6">
          <Link
            href="/products"
            className="whitespace-nowrap py-3 text-sm font-semibold text-zinc-900"
          >
            Trending Category
          </Link>
          {(categories ?? []).map((c) => (
            <div
              key={c.id}
              className="relative hidden shrink-0 md:block"
              onMouseEnter={() => setHoverCat(c.slug)}
              onMouseLeave={() => setHoverCat(null)}
            >
              <Link
                href={`/products?category=${c.slug}`}
                className={`flex items-center gap-1 whitespace-nowrap py-3 text-sm font-medium transition ${
                  hoverCat === c.slug ? "text-blue-600" : "text-zinc-700 hover:text-blue-600"
                }`}
              >
                {c.name}
                <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                {/* Underline on hover */}
                <span
                  className={`absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-blue-600 transition-all ${
                    hoverCat === c.slug ? "opacity-100" : "opacity-0"
                  }`}
                />
              </Link>
              {hoverCat === c.slug && <CategoryDropdown slug={c.slug} />}
            </div>
          ))}
          {/* Mobile: simple category links (no hover dropdown) */}
          {(categories ?? []).map((c) => (
            <Link
              key={`m-${c.id}`}
              href={`/products?category=${c.slug}`}
              className="whitespace-nowrap py-3 text-sm font-medium text-zinc-700 md:hidden"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
