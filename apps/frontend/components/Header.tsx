"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BadgePercent, ChevronDown, Heart, LayoutDashboard, LogOut, Menu, ShoppingCart, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import type { CategoryNode, Product } from "@/lib/types";
import { useCategoryTree } from "@/lib/categories";
import SearchBar from "./SearchBar";
import Topbar from "./Topbar";
import { useCartStore, selectItemCount } from "@/lib/store/cart";
import { useWishlistStore, selectWishlistCount } from "@/lib/store/wishlist";
import { useMobileMenuStore } from "@/lib/store/mobileMenu";

/** Dropdown shown on category hover: top products in that category. */
function CategoryDropdown({ slug }: { slug: string }) {
  const { data } = useQuery({
    queryKey: ["category-preview", slug],
    queryFn: () => apiClient.get<{ items: Product[] }>(`/products?category=${slug}&limit=4`),
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
                  <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
                    <Image src={p.imageUrl} alt={p.name} fill className="object-contain p-0.5" sizes="40px" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-700">{p.name}</span>
                    <span className="text-xs font-bold text-primary-600">{formatPrice(p.price)}</span>
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

/** Dropdown for a category that has subcategories: the subcategory links. */
function SubcategoryDropdown({ category }: { category: CategoryNode }) {
  return (
    <div className="absolute left-0 top-full z-50 w-60 pt-2">
      <div className="overflow-hidden rounded-2xl bg-white py-2 shadow-[0_12px_40px_rgba(0,0,0,0.12)] ring-1 ring-zinc-200/70">
        {category.children.map((sub) => (
          <Link
            key={sub.id}
            href={`/products?category=${sub.slug}`}
            className="block px-5 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-primary-50 hover:text-primary-700"
          >
            {sub.name}
          </Link>
        ))}
        <Link
          href={`/products?category=${category.slug}`}
          className="mt-1 block border-t border-zinc-100 px-5 pb-1 pt-3 text-xs font-bold text-primary-600 transition hover:text-primary-700"
        >
          View all {category.name}
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
  const openMobileMenu = useMobileMenuStore((s) => s.open);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [hoverCat, setHoverCat] = useState<string | null>(null);
  // Category of the page being viewed (/products?category=…), kept underlined
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const { tree } = useCategoryTree();
  const [browseSub, setBrowseSub] = useState<string | null>(null);
  const isActiveTree = (c: CategoryNode) =>
    activeCat !== null && (activeCat === c.slug || c.children.some((sub) => sub.slug === activeCat));

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out");
    router.push("/");
  };

  const dashboardHref = isAdmin ? "/admin" : "/dashboard";

  return (
    <>
      <Topbar />
      <header className="sticky top-0 z-40 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        {/* Main navbar row */}
        <div className="relative mx-auto flex h-14 max-w-[1450px] items-center gap-3 px-4 sm:gap-4 sm:px-6 md:h-[72px]">
          {/* Mobile: opens the left sidebar */}
          <button
            onClick={openMobileMenu}
            className="-ml-2 rounded-full p-2 text-zinc-800 transition hover:bg-zinc-100 md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          {/* Logo: centered on mobile, left-aligned from md up */}
          <Link
            href="/"
            className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2 md:static md:shrink-0 md:translate-x-0"
          >
            <Image
              src="/logo.png"
              alt="GadgetLax"
              width={40}
              height={40}
              // Above the fold, so not lazy; no preload so it doesn't compete with the banner (LCP)
              loading="eager"
              className="h-8 w-8 rounded-lg shadow-sm md:h-10 md:w-10 md:rounded-xl"
            />
            <span className="font-display text-lg font-bold tracking-tight text-zinc-900 md:text-xl">
              Gadget<span className="text-primary-600">Lax</span>
            </span>
          </Link>

          {/* Browse Categories */}
          <div
            className="relative hidden shrink-0 md:block"
            onMouseEnter={() => setBrowseOpen(true)}
            onMouseLeave={() => {
              setBrowseOpen(false);
              setBrowseSub(null);
            }}
          >
            <button className="flex items-center gap-2 rounded-full bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700">
              <Menu className="h-4 w-4" />
              Browse Categories
              <ChevronDown className={`h-4 w-4 transition-transform ${browseOpen ? "rotate-180" : ""}`} />
            </button>
            {browseOpen && (
              <div className="absolute left-0 top-full z-50 w-64 pt-2">
                <div className="rounded-2xl bg-white py-2 shadow-[0_12px_40px_rgba(0,0,0,0.12)] ring-1 ring-zinc-200/70">
                  {tree.map((c) => (
                    <div key={c.id} className="relative" onMouseEnter={() => setBrowseSub(c.id)}>
                      <Link
                        href={`/products?category=${c.slug}`}
                        className={`flex items-center justify-between px-5 py-2.5 text-sm font-medium transition ${
                          browseSub === c.id ? "bg-primary-50 text-primary-700" : "text-zinc-600"
                        }`}
                      >
                        {c.name}
                        {c.children.length > 0 && <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-zinc-400" />}
                      </Link>
                      {/* Subcategory flyout */}
                      {browseSub === c.id && c.children.length > 0 && (
                        <div className="absolute left-full top-0 z-50 w-56 pl-1.5">
                          <div className="rounded-2xl bg-white py-2 shadow-[0_12px_40px_rgba(0,0,0,0.12)] ring-1 ring-zinc-200/70">
                            {c.children.map((sub) => (
                              <Link
                                key={sub.id}
                                href={`/products?category=${sub.slug}`}
                                className="block px-5 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-primary-50 hover:text-primary-700"
                              >
                                {sub.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
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
                // The login page pulls in zod for form validation; load it on click, not on every page view
                prefetch={false}
                className="hidden rounded-full bg-zinc-100 p-2.5 text-zinc-700 transition hover:bg-zinc-200 sm:block"
                aria-label="Login"
              >
                <User className="h-5 w-5" />
              </Link>
            )}
            <button
              onClick={openCartDrawer}
              className="relative -mr-2 rounded-full p-2 text-zinc-800 transition hover:bg-zinc-100 md:mr-0 md:p-2.5 md:text-zinc-600"
              aria-label="Open cart"
            >
              <ShoppingCart className="h-6 w-6 md:h-5 md:w-5" />
              <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-bold text-white ring-2 ring-white md:-right-1 md:-top-1 md:h-5 md:min-w-5 md:text-[11px]">
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
        <div className="border-t border-zinc-100 px-4 py-2 md:hidden">
          <SearchBar className="w-full" />
        </div>

        <Suspense fallback={null}>
          <ActiveCategorySync onChange={setActiveCat} />
        </Suspense>

        {/* Category nav row — desktop only; on mobile the categories live in the left sidebar */}
        <nav className="hidden border-t border-zinc-100 md:block">
          {/* Overflow must stay visible or the hover dropdowns get clipped */}
          <div className="mx-auto flex max-w-[1450px] flex-wrap items-center gap-7 gap-y-0 px-4 sm:px-6">
            <Link href="/products" className="whitespace-nowrap py-3 text-sm font-semibold text-zinc-900">
              Trending Category
            </Link>
            {tree.map((c) => (
              <div
                key={c.id}
                className="relative shrink-0"
                onMouseEnter={() => setHoverCat(c.slug)}
                onMouseLeave={() => setHoverCat(null)}
              >
                <Link
                  href={`/products?category=${c.slug}`}
                  aria-current={isActiveTree(c) ? "page" : undefined}
                  className={`flex items-center gap-1 whitespace-nowrap py-3 text-sm transition ${
                    isActiveTree(c)
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
                      isActiveTree(c) || hoverCat === c.slug ? "origin-left scale-x-100" : "origin-right scale-x-0"
                    }`}
                  />
                </Link>
                {hoverCat === c.slug &&
                  (c.children.length > 0 ? <SubcategoryDropdown category={c} /> : <CategoryDropdown slug={c.slug} />)}
              </div>
            ))}
            <Link
              href="/brands"
              className="whitespace-nowrap py-3 text-sm font-semibold text-primary-600 hover:text-primary-700"
            >
              All Brands
            </Link>
          </div>
        </nav>
      </header>
    </>
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
