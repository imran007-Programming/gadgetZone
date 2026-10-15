"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
                    <span className="text-xs font-bold text-primary-600">
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
          className="block border-t border-zinc-100 px-4 py-2.5 text-center text-xs font-bold text-primary-600 transition hover:bg-primary-50"
        >
          View all products
        </Link>
      </div>
    </div>
  );
}

export default function Header() {
  const { isAuthenticated, isAdmin, logout } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const openCartDrawer = useCartStore((s) => s.openDrawer);
  const cartCount = useCartStore(selectItemCount);
  const wishlistCount = useWishlistStore(selectWishlistCount);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [hoverCat, setHoverCat] = useState<string | null>(null);
  // Category of the page being viewed (/products?category=…), kept underlined
  const [activeCat, setActiveCat] = useState<string | null>(null);

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
          <Image
            src="/logo.png"
            alt="GadgetLax"
            width={40}
            height={40}
            priority
            className="h-10 w-10 rounded-xl shadow-sm"
          />
          <span className="hidden font-display text-xl font-bold tracking-tight text-zinc-900 sm:block">
            Gadget<span className="text-primary-600">Lax</span>
          </span>
        </Link>

        {/* Browse Categories */}
        <div
          className="relative hidden shrink-0 md:block"
          onMouseEnter={() => setBrowseOpen(true)}
          onMouseLeave={() => setBrowseOpen(false)}
        >
          <button className="flex items-center gap-2 rounded-full bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700">
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
                    className="flex items-center justify-between px-5 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-primary-50 hover:text-primary-700"
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
            className="hidden items-center gap-1.5 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 lg:flex"
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
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1 text-[11px] font-bold text-white">
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
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1 text-[11px] font-bold text-white ring-2 ring-white">
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

      <Suspense fallback={null}>
        <ActiveCategorySync onChange={setActiveCat} />
      </Suspense>

      {/* Category nav row */}
      <nav className="border-t border-zinc-100">
        {/* Scrolls sideways on mobile; on desktop overflow must stay visible or the hover dropdowns get clipped */}
        <div className="mx-auto flex max-w-[1450px] items-center gap-7 overflow-x-auto px-4 sm:px-6 md:flex-wrap md:gap-y-0 md:overflow-visible">
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
                aria-current={activeCat === c.slug ? "page" : undefined}
                className={`flex items-center gap-1 whitespace-nowrap py-3 text-sm transition ${
                  activeCat === c.slug
                    ? "font-semibold text-primary-600"
                    : hoverCat === c.slug
                      ? "font-medium text-primary-600"
                      : "font-medium text-zinc-700 hover:text-primary-600"
                }`}
              >
                {c.name}
                <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                {/* Underline: grows left → right on hover, shrinks away to the right on leave; always on for the active category */}
                <span
                  aria-hidden
                  className={`absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary-600 transition-transform duration-300 ease-out ${
                    activeCat === c.slug || hoverCat === c.slug ? "origin-left scale-x-100" : "origin-right scale-x-0"
                  }`}
                />
              </Link>
              {hoverCat === c.slug && <CategoryDropdown slug={c.slug} />}
            </div>
          ))}
          <Link
            href="/brands"
            className="whitespace-nowrap py-3 text-sm font-semibold text-primary-600 hover:text-primary-700"
          >
            All Brands
          </Link>
          {/* Mobile: simple category links (no hover dropdown) */}
          {(categories ?? []).map((c) => (
            <Link
              key={`m-${c.id}`}
              href={`/products?category=${c.slug}`}
              className={`whitespace-nowrap border-b-2 py-3 text-sm md:hidden ${
                activeCat === c.slug ? "border-primary-600 font-semibold text-primary-600" : "border-transparent font-medium text-zinc-700"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}

/**
 * Reports the category in the URL (only on /products). Kept in its own
 * component so useSearchParams sits inside a Suspense boundary and the header
 * itself can still render statically.
 */
function ActiveCategorySync({ onChange }: { onChange: (slug: string | null) => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const slug = pathname === "/products" ? searchParams.get("category") : null;
  useEffect(() => {
    onChange(slug);
  }, [slug, onChange]);
  return null;
}
