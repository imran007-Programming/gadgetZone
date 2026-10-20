"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, LogOut, Search, User, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/lib/types";
import { useCategoryTree } from "@/lib/categories";
import { useMobileMenuStore } from "@/lib/store/mobileMenu";

type Tab = "categories" | "menu";

const rowCls = "flex min-h-11 items-center border-b border-zinc-200 px-5 text-[13px]";

/** Top products of a category, shown when its row is expanded. */
function CategoryProducts({ slug, onNavigate }: { slug: string; onNavigate: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["category-preview", slug],
    queryFn: () =>
      apiClient.get<{ items: Product[] }>(`/products?category=${slug}&limit=4`),
    staleTime: 5 * 60 * 1000,
  });
  const items = data?.items ?? [];

  return (
    <div className="bg-zinc-50/60">
      {isLoading ? (
        <p className={`${rowCls} text-zinc-400`}>Loading…</p>
      ) : (
        items.map((p) => (
          <Link
            key={p.id}
            href={`/products/${p.slug}`}
            onClick={onNavigate}
            className={`${rowCls} gap-3 py-2 text-zinc-500 transition active:bg-zinc-100`}
          >
            <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-zinc-200">
              {p.imageUrl && <Image src={p.imageUrl} alt="" fill className="object-contain p-0.5" sizes="36px" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{p.name}</span>
              <span className="text-xs font-semibold text-primary-600">{formatPrice(p.price)}</span>
            </span>
          </Link>
        ))
      )}
      <Link
        href={`/products?category=${slug}`}
        onClick={onNavigate}
        className={`${rowCls} text-zinc-500 transition active:bg-zinc-100`}
      >
        View all products
      </Link>
    </div>
  );
}

/**
 * Left slide-in sidebar for mobile: search, then Categories / Menu tabs.
 * Opened from the header hamburger and the bottom-nav "Menu" button.
 */
export default function MobileSidebar() {
  const isOpen = useMobileMenuStore((s) => s.isOpen);
  const close = useMobileMenuStore((s) => s.close);
  const { isAuthenticated, isAdmin, logout } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>("categories");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const { tree } = useCategoryTree();

  // Lock body scroll + close on Escape while open.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, close]);

  if (!isOpen) return null;

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    close();
    router.push(`/products${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  };

  const handleLogout = async () => {
    close();
    await logout();
    toast.success("Logged out");
    router.push("/");
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  const menuLinks = [
    { href: "/", label: "Home" },
    { href: "/products", label: "All Products" },
    { href: "/brands", label: "All Brands" },
    { href: isAuthenticated ? "/dashboard/wishlist" : "/wishlist", label: "Wishlist" },
    { href: "/help", label: "Contact Us" },
  ];

  const tabCls = (active: boolean) =>
    `flex-1 border-b-[3px] py-3.5 text-xs font-normal uppercase tracking-wide transition ${
      active ? "border-primary-600 bg-zinc-100 text-zinc-900" : "border-transparent bg-zinc-50 text-zinc-400"
    }`;

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <button
        aria-label="Close menu"
        onClick={close}
        className="absolute inset-0 bg-zinc-900/40 backdrop-blur-[2px]"
      />
      <aside className="absolute left-0 top-0 flex h-full w-[80%] max-w-sm flex-col bg-white shadow-2xl animate-slide-in-left">
        {/* Search */}
        <form onSubmit={submitSearch} role="search" className="flex items-center border-b border-zinc-200">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for products"
            aria-label="Search for products"
            className="min-w-0 flex-1 bg-transparent py-3.5 pl-5 pr-1 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
          <button type="submit" aria-label="Search" className="px-3 py-4 text-zinc-500">
            <Search className="h-5 w-5" />
          </button>
          <button type="button" onClick={close} aria-label="Close menu" className="border-l border-zinc-200 px-3.5 py-4 text-zinc-500">
            <X className="h-5 w-5" />
          </button>
        </form>

        {/* Tabs */}
        <div className="flex border-b border-zinc-200" role="tablist">
          <button role="tab" aria-selected={tab === "categories"} onClick={() => setTab("categories")} className={tabCls(tab === "categories")}>
            Categories
          </button>
          <button role="tab" aria-selected={tab === "menu"} onClick={() => setTab("menu")} className={tabCls(tab === "menu")}>
            Menu
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {tab === "categories" ? (
            <ul>
              <li>
                <Link href="/products" onClick={close} className={`${rowCls} font-normal text-zinc-900`}>
                  Trending Category
                </Link>
              </li>
              {tree.map((c) => {
                const open = expanded === c.slug;
                return (
                  <li key={c.id}>
                    <div className="flex items-stretch">
                      <Link
                        href={`/products?category=${c.slug}`}
                        onClick={close}
                        className={`${rowCls} min-w-0 flex-1 font-normal text-zinc-900`}
                      >
                        <span className="truncate">{c.name}</span>
                      </Link>
                      <button
                        onClick={() => setExpanded(open ? null : c.slug)}
                        aria-label={`${open ? "Collapse" : "Expand"} ${c.name}`}
                        aria-expanded={open}
                        className={`flex w-11 shrink-0 items-center justify-center border-b border-l transition ${
                          open ? "border-primary-600 bg-primary-600 text-white" : "border-zinc-200 text-zinc-700"
                        }`}
                      >
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </div>
                    {open &&
                      (c.children.length > 0 ? (
                        <ul className="bg-zinc-50/60">
                          {c.children.map((sub) => (
                            <li key={sub.id}>
                              <Link
                                href={`/products?category=${sub.slug}`}
                                onClick={close}
                                className={`${rowCls} pl-8 text-zinc-500 transition active:bg-zinc-100`}
                              >
                                {sub.name}
                              </Link>
                            </li>
                          ))}
                          <li>
                            <Link
                              href={`/products?category=${c.slug}`}
                              onClick={close}
                              className={`${rowCls} pl-8 text-primary-600 transition active:bg-zinc-100`}
                            >
                              View all {c.name}
                            </Link>
                          </li>
                        </ul>
                      ) : (
                        <CategoryProducts slug={c.slug} onNavigate={close} />
                      ))}
                  </li>
                );
              })}
              <li>
                <Link href="/brands" onClick={close} className={`${rowCls} font-normal text-primary-600`}>
                  All Brands
                </Link>
              </li>
            </ul>
          ) : (
            <ul>
              {menuLinks.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    onClick={close}
                    className={`${rowCls} font-normal ${isActive(l.href) ? "text-primary-600" : "text-zinc-900"}`}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              {isAuthenticated ? (
                <>
                  <li>
                    <Link href={isAdmin ? "/admin" : "/dashboard"} onClick={close} className={`${rowCls} gap-2.5 font-normal text-zinc-900`}>
                      <User className="h-4 w-4 text-zinc-600" strokeWidth={1.6} />
                      {isAdmin ? "Admin Dashboard" : "My Account"}
                    </Link>
                  </li>
                  <li>
                    <button onClick={handleLogout} className={`${rowCls} w-full gap-2.5 font-normal text-rose-600`}>
                      <LogOut className="h-4 w-4" strokeWidth={1.6} />
                      Logout
                    </button>
                  </li>
                </>
              ) : (
                <li>
                  <Link href="/login" prefetch={false} onClick={close} className={`${rowCls} gap-2.5 font-normal text-zinc-900`}>
                    <User className="h-4 w-4 text-zinc-600" strokeWidth={1.6} />
                    Login / Register
                  </Link>
                </li>
              )}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
