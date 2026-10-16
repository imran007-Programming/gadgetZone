"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BadgePercent,
  Bell,
  Award,
  Clock,
  ExternalLink,
  FileText,
  GalleryHorizontal,
  Layers,
  LayoutGrid,
  LogOut,
  Menu,
  Moon,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  PanelTop,
  RotateCcw,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Sun,
  Tags,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAdminTheme } from "@/lib/admin-theme";
import { useToast } from "@/lib/toast";
import type { AdminStats } from "@/lib/types";
import { AdminSearchProvider } from "./kit";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "GENERAL",
    items: [
      { href: "/admin", label: "Overview", icon: LayoutGrid },
      { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
      { href: "/admin/sales", label: "Sales", icon: TrendingUp },
    ],
  },
  {
    title: "CATALOG",
    items: [
      { href: "/admin/products", label: "Products", icon: Layers },
      { href: "/admin/inventory", label: "Inventory", icon: Package },
      { href: "/admin/categories", label: "Categories", icon: Tags },
      { href: "/admin/brands", label: "Brands", icon: Award },
      { href: "/admin/discounts", label: "Discounts", icon: BadgePercent },
    ],
  },
  {
    title: "CUSTOMERS",
    items: [
      { href: "/admin/customers", label: "Customers", icon: Users },
      { href: "/admin/reviews", label: "Reviews", icon: Star },
    ],
  },
  {
    title: "FULFILLMENT",
    items: [{ href: "/admin/returns", label: "Returns", icon: RotateCcw }],
  },
  {
    title: "STOREFRONT",
    items: [
      { href: "/admin/banners", label: "Banners", icon: GalleryHorizontal },
      { href: "/admin/settings", label: "Site settings", icon: PanelTop },
    ],
  },
  {
    title: "SYSTEM",
    items: [{ href: "/admin/reports", label: "Reports", icon: FileText }],
  },
];

/** Title and accent subline per page; pages not listed (e.g. the product editor) draw their own header. */
const ROUTE_META: Record<string, { title: string; sub: string }> = {
  "/admin": { title: "Overview Dashboard", sub: "" },
  "/admin/orders": { title: "Orders", sub: "Orders · Fulfillment · Payments" },
  "/admin/products": { title: "Products", sub: "Catalog · Pricing · Stock" },
  "/admin/inventory": { title: "Inventory", sub: "Stock levels · Value · Alerts" },
  "/admin/categories": { title: "Categories", sub: "Catalog structure" },
  "/admin/customers": { title: "Customers", sub: "Accounts · Orders · Access" },
  "/admin/sales": { title: "Sales", sub: "Revenue · Buyers · Transactions" },
  "/admin/discounts": { title: "Discounts", sub: "Coupons · Promotions · Usage" },
  "/admin/reviews": { title: "Reviews", sub: "Ratings · Moderation · Replies" },
  "/admin/returns": { title: "Returns & Refunds", sub: "Requests · Approvals · Refunds" },
  "/admin/reports": { title: "Reports", sub: "Exports · Snapshots · Date ranges" },
  "/admin/brands": { title: "Brands", sub: "Logos · Visibility · Products" },
  "/admin/banners": { title: "Homepage Banners", sub: "Carousel · Schedule · Order" },
  "/admin/settings": { title: "Site settings", sub: "Top bar · Announcement · Support phone" },
};

const SIDEBAR_KEY = "gadgetlax-admin-sidebar";

/**
 * Collapsed (icon-only) or expanded sidebar, remembered per browser.
 * Without a saved choice it starts collapsed on narrower screens.
 */
const sidebarListeners = new Set<() => void>();
let sidebarMemory: string | null = null; // keeps the choice when storage is blocked

function readSidebarChoice(): string | null {
  if (sidebarMemory) return sidebarMemory;
  try {
    return localStorage.getItem(SIDEBAR_KEY);
  } catch {
    return null; // storage blocked: fall back to the screen-size default
  }
}

function subscribeSidebar(notify: () => void) {
  sidebarListeners.add(notify);
  window.addEventListener("resize", notify);
  return () => {
    sidebarListeners.delete(notify);
    window.removeEventListener("resize", notify);
  };
}

function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(
    subscribeSidebar,
    () => {
      const saved = readSidebarChoice();
      return saved ? saved === "collapsed" : window.innerWidth <= 1100;
    },
    () => false,
  );
  const toggle = () => {
    const next = collapsed ? "expanded" : "collapsed";
    sidebarMemory = next;
    try {
      localStorage.setItem(SIDEBAR_KEY, next);
    } catch {
      /* ignore */
    }
    sidebarListeners.forEach((notify) => notify());
  };
  return { collapsed, toggle };
}

/** "WED 15 OCT 2026 · LIVE · 10:36 AM UTC", refreshed every minute. */
function subscribeClock(notify: () => void) {
  const t = setInterval(notify, 10_000);
  return () => clearInterval(t);
}

function useLiveSubline() {
  // Current minute on the client, null while server rendering
  const minute = useSyncExternalStore(
    subscribeClock,
    () => Math.floor(Date.now() / 60_000),
    () => null,
  );
  if (minute === null) return "Live";
  const now = new Date(minute * 60_000);
  const date = now
    .toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    .replace(/,/g, "");
  const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `${date} · Live · ${time} UTC`;
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const toast = useToast();
  const { theme, setTheme } = useAdminTheme();
  const { collapsed, toggle: toggleSidebar } = useSidebarCollapsed();
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifRead, setNotifRead] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const liveSubline = useLiveSubline();

  // Shared with the overview page through the query cache
  const statsQuery = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => apiClient.get<AdminStats>("/admin/stats"),
  });
  const stats = statsQuery.data;
  const lowStock = stats?.lowStock ?? [];
  const pending = stats?.ordersByStatus.PENDING ?? 0;

  // Reset the page filter and close overlays when navigating
  const [shellPath, setShellPath] = useState(pathname);
  if (shellPath !== pathname) {
    setShellPath(pathname);
    setQuery("");
    setDrawerOpen(false);
    setNotifOpen(false);
  }

  useEffect(() => {
    if (!notifOpen) return;
    const onClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [notifOpen]);

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out");
    router.push("/");
  };

  const isActive = (href: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href));
  const meta = ROUTE_META[pathname];
  const initials =
    user?.name
      ?.split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() ?? "A";
  const notifCount = (pending > 0 ? 1 : 0) + Math.min(lowStock.length, 3);

  return (
    <div className="adm" data-theme={theme}>
      <div className="app">
        <div className={`drawer-overlay${drawerOpen ? " open" : ""}`} onClick={() => setDrawerOpen(false)} />

        {/* ================= SIDEBAR ================= */}
        <aside className={`sidebar${drawerOpen ? " open" : ""}${collapsed ? " collapsed" : ""}`}>
          <Link href="/admin" className="brand">
            <Image src="/logo.png" alt="GadgetLax" width={40} height={40} className="brand-logo" priority />
            <span className="brand-name">
              GADGET
              <br />
              LAX
            </span>
          </Link>

          <nav className="nav">
            {NAV_GROUPS.map((group) => (
              <div key={group.title} style={{ display: "contents" }}>
                <div className="nav-group">{group.title}</div>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`nav-item${isActive(item.href) ? " active" : ""}`}
                      title={item.label}
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="sidebar-spacer" />

          <div className="ai-card">
            <div className="ai-head">
              <Sparkles size={14} />
              LOW STOCK: <span style={{ fontWeight: 700 }}>{lowStock.length}</span>
            </div>
            <h4>Stock Insight</h4>
            <p>
              {lowStock.length > 0
                ? `${lowStock.length} active product${lowStock.length === 1 ? " is" : "s are"} below 10 units.`
                : "Every active product has at least 10 units in stock."}
            </p>
            <Link href="/admin/inventory" className="btn-forecast">
              VIEW INVENTORY
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="profile-row">
            <div className="avatar">{initials}</div>
            <div className="p-meta">
              <div className="p-name">{user?.name ?? "Admin"}</div>
              <div className="p-role">Administrator</div>
            </div>
            <button className="logout" onClick={handleLogout} title="Sign out" aria-label="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        </aside>

        {/* ================= MAIN ================= */}
        <div className="main">
          <header className="topbar">
            <button
              className="icon-btn collapse-btn"
              onClick={toggleSidebar}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
            >
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </button>
            <button className="icon-btn menu-btn" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
              <Menu />
            </button>
            <label className="search-wrap">
              <Search />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search this page"
                aria-label="Search this page"
              />
            </label>
            <div className="topbar-spacer" />
            <a href="/" target="_blank" rel="noopener noreferrer" className="btn ghost store-link" title="Open the website in a new tab">
              <ExternalLink />
              <span>View store</span>
            </a>
            <div className="theme-toggle" role="group" aria-label="Theme">
              <button
                className={theme === "dark" ? "active" : ""}
                onClick={() => setTheme("dark")}
                title="Dark mode"
                aria-pressed={theme === "dark"}
              >
                <Sun />
              </button>
              <button
                className={theme === "light" ? "active" : ""}
                onClick={() => setTheme("light")}
                title="Light mode"
                aria-pressed={theme === "light"}
              >
                <Moon />
              </button>
            </div>
            <div ref={notifRef}>
              <button
                className="icon-btn"
                onClick={() => setNotifOpen((o) => !o)}
                title="Notifications"
                aria-label="Notifications"
                aria-expanded={notifOpen}
              >
                <Bell />
                {!notifRead && notifCount > 0 && <span className="dot" />}
              </button>
              {notifOpen && (
                <div className="notif-panel">
                  <div className="notif-head">
                    Notifications
                    <button
                      onClick={() => {
                        setNotifRead(true);
                        setNotifOpen(false);
                      }}
                    >
                      Mark all read
                    </button>
                  </div>
                  {notifCount === 0 && <div className="notif-empty">You&apos;re all caught up.</div>}
                  {pending > 0 && (
                    <Link href="/admin/orders" className="notif-item">
                      <div className="notif-ic" style={{ background: "var(--blue-soft)", color: "var(--blue)" }}>
                        <Clock />
                      </div>
                      <div>
                        <div className="n-title">Pending orders</div>
                        <div className="n-desc">
                          {pending} order{pending === 1 ? "" : "s"} waiting for payment or processing.
                        </div>
                      </div>
                    </Link>
                  )}
                  {lowStock.slice(0, 3).map((p) => (
                    <Link key={p.id} href={`/admin/products/${p.id}`} className="notif-item">
                      <div className="notif-ic" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>
                        <AlertTriangle />
                      </div>
                      <div>
                        <div className="n-title">{p.stock === 0 ? "Out of stock" : "Low stock alert"}</div>
                        <div className="n-desc">
                          {p.name} {p.stock === 0 ? "is out of stock" : `is down to ${p.stock} units`}.
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </header>

          {meta && (
            <div className="page-head">
              <h1>{meta.title}</h1>
              <div className="subline">{pathname === "/admin" ? liveSubline : meta.sub}</div>
            </div>
          )}

          <AdminSearchProvider value={query}>{children}</AdminSearchProvider>
        </div>
      </div>
    </div>
  );
}
