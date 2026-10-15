"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import ConditionalHeader from "./ConditionalHeader";
import ConditionalFooter from "./ConditionalFooter";
import CartDrawer from "./CartDrawer";
import MobileNav from "./MobileNav";

function isDashboardRoute(pathname: string) {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/")
  );
}

/**
 * Website chrome: header, footer, cart drawer, mobile nav.
 * Dashboard routes get none of the website chrome — they have
 * their own dedicated shell and take the full screen.
 */
export default function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isDashboard = isDashboardRoute(pathname);

  if (isDashboard) {
    return <>{children}</>;
  }

  return (
    <>
      <ConditionalHeader />
      <main className="mx-auto w-full max-w-[800px] flex-1 px-4 py-6 pb-24 sm:px-6 md:pb-6">
        {children}
      </main>
      <ConditionalFooter />
      <CartDrawer />
      <MobileNav />
    </>
  );
}
