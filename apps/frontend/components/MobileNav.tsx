"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LifeBuoy,
  Menu,
  ShoppingCart,
  User,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCartStore, selectItemCount } from "@/lib/store/cart";
import { useMobileMenuStore } from "@/lib/store/mobileMenu";

/**
 * Bottom mobile navigation bar (visible only on mobile).
 * My Account · Menu · Cart · Help
 */
export default function MobileNav() {
  const pathname = usePathname();
  const { isAuthenticated, isAdmin } = useAuth();
  const openCartDrawer = useCartStore((s) => s.openDrawer);
  const cartCount = useCartStore(selectItemCount);
  const openMenu = useMobileMenuStore((s) => s.open);

  const accountHref = isAdmin ? "/admin" : isAuthenticated ? "/dashboard" : "/login";

  const itemCls = (active: boolean) =>
    `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition ${
      active ? "text-primary-700" : "text-zinc-500 hover:text-zinc-800"
    }`;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)] backdrop-blur-xl md:hidden"
    >
      <div className="flex items-stretch px-2">
        <Link href={accountHref} className={itemCls(isActive("/dashboard") || isActive("/admin") || isActive("/login"))}>
          <User className="h-6 w-6" strokeWidth={1.8} />
          My account
        </Link>
        <button onClick={openMenu} className={itemCls(false)} aria-label="Open menu">
          <Menu className="h-6 w-6" strokeWidth={1.8} />
          Menu
        </button>
        <button
          onClick={openCartDrawer}
          className={itemCls(false)}
          aria-label="Open cart"
        >
          <span className="relative">
            <ShoppingCart className="h-6 w-6" strokeWidth={1.8} />
            {cartCount > 0 && (
              <span className="absolute -right-2 -top-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-bold text-white">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </span>
          Cart
        </button>
        <Link href="/help" className={itemCls(isActive("/help"))}>
          <LifeBuoy className="h-6 w-6" strokeWidth={1.8} />
          Help
        </Link>
      </div>
    </nav>
  );
}
