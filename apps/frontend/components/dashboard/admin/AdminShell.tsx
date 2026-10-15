"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  HelpCircle,
  LayoutGrid,
  LogOut,
  Megaphone,
  Package,
  Search,
  Settings,
  ShoppingBag,
  Users,
  X,
  Menu,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutGrid },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/categories", label: "Marketing", icon: Megaphone },
];

const ANALYTICS_ICON = BarChart3;

export default function AdminShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const toast = useToast();

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out");
    router.push("/");
  };

  const isActive = (href: string) =>
    href === "/admin" ? pathname === href : pathname.startsWith(href);

  const sidebar = (
    <div className="flex h-full flex-col bg-white">
      <Link href="/" className="flex items-center gap-2 px-6 pb-2 pt-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-500 font-display text-lg font-bold text-white">
          G
        </span>
        <span className="font-display text-lg font-bold tracking-tight text-zinc-900">
          GadgetLax
        </span>
      </Link>

      <div className="px-5 pb-3 pt-3">
        <div className="flex items-center gap-2 rounded-full bg-teal-50 px-4 py-2.5 ring-1 ring-teal-100">
          <Search className="h-4 w-4 shrink-0 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-400"
          />
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-teal-50 text-teal-600"
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
        <div
          className="flex cursor-pointer items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-900"
        >
          <ANALYTICS_ICON className="h-5 w-5 shrink-0" />
          Analytics
        </div>
      </nav>

      <div className="space-y-1 border-t border-zinc-100 px-4 py-4">
        <div className="flex cursor-pointer items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-900">
          <Settings className="h-5 w-5 shrink-0" />
          Settings
        </div>
        <div className="flex cursor-pointer items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-900">
          <HelpCircle className="h-5 w-5 shrink-0" />
          Help
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-rose-500 transition hover:bg-rose-50"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#eef3f7]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-zinc-900/40"
          />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] shadow-2xl">
            <div className="flex h-full flex-col bg-white">
              <div className="flex items-center justify-end px-4 pt-4">
                <button
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                  className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="-mt-6 flex-1">{sidebar}</div>
            </div>
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-[#eef3f7]/90 px-4 py-4 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="rounded-xl bg-white p-2.5 text-zinc-600 shadow-sm ring-1 ring-zinc-200/60 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button className="flex items-center gap-2 rounded-xl bg-white py-2 pl-2 pr-3 shadow-sm ring-1 ring-zinc-200/60">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-700">
                {user?.name?.charAt(0).toUpperCase() ?? "A"}
              </span>
              <span className="text-left leading-tight">
                <span className="block text-xs font-bold text-teal-600">
                  {user?.name ?? "Admin"}
                </span>
                <span className="block text-[11px] text-zinc-400">Admin</span>
              </span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              aria-label="Notifications"
              className="rounded-xl bg-white p-2.5 text-zinc-500 shadow-sm ring-1 ring-zinc-200/60 transition hover:text-teal-600"
            >
              <Bell className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="px-4 pb-10 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
