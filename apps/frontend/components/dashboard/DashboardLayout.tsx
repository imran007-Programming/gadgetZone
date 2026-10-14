"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, X, type LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";

export interface DashboardNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface DashboardLayoutProps {
  title: string;
  items: DashboardNavItem[];
  children: ReactNode;
}

/**
 * Dashboard shell: fixed sidebar on desktop (lg+), hamburger-triggered
 * slide-over on mobile. Content area offsets for the desktop sidebar.
 */
export default function DashboardLayout({ title, items, children }: DashboardLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const toast = useToast();

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out");
    router.push("/");
  };

  const isActive = (href: string) => {
    if (href === "/dashboard" || href === "/admin") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  const nav = (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
              active
                ? "bg-lime-400/15 text-lime-300 ring-1 ring-lime-400/30"
                : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const userCard = (
    <div className="border-t border-zinc-800 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lime-400/15 font-display text-sm font-bold text-lime-300">
          {user?.name?.charAt(0).toUpperCase() ?? "?"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-100">
            {user?.name ?? "Account"}
          </p>
          <p className="truncate text-xs text-zinc-500">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          aria-label="Log out"
          title="Log out"
          className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-rose-400"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  const brand = (
    <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400 font-display text-lg font-bold text-zinc-950">
        G
      </span>
      <span className="font-display text-lg font-bold tracking-tight text-zinc-50">
        Gadget<span className="text-lime-400">Lax</span>
      </span>
    </Link>
  );

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-zinc-800/80 bg-zinc-950 lg:flex">
        {brand}
        <p className="px-5 pb-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-600">
          {title}
        </p>
        {nav}
        {userCard}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm"
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-zinc-950 shadow-2xl ring-1 ring-zinc-800 animate-slide-in-left">
            <div className="flex items-center justify-between">
              {brand}
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="mr-3 rounded-full p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="px-5 pb-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-600">
              {title}
            </p>
            {nav}
            {userCard}
          </aside>
        </div>
      )}

      {/* Content column */}
      <div className="lg:pl-64">
        {/* Mobile topbar */}
        <div className="sticky top-16 z-20 flex items-center gap-3 border-b border-zinc-800/60 bg-zinc-950/90 px-4 py-3 backdrop-blur lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open dashboard menu"
            className="rounded-lg p-2 text-zinc-300 ring-1 ring-zinc-800 transition hover:bg-zinc-800"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-display text-sm font-bold text-zinc-100">{title}</span>
        </div>
        <div className="p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
