"use client";

import type { ReactNode } from "react";
import {
  Heart,
  LayoutDashboard,
  Package,
  Settings,
} from "lucide-react";
import DashboardLayout, {
  type DashboardNavItem,
} from "@/components/dashboard/DashboardLayout";
import { RequireAuth } from "@/components/ui";

const NAV: DashboardNavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/orders", label: "My Orders", icon: Package },
  { href: "/dashboard/wishlist", label: "Wishlist", icon: Heart },
  { href: "/dashboard/profile", label: "Profile", icon: Settings },
];

export default function CustomerDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RequireAuth>
      <DashboardLayout title="My Dashboard" items={NAV}>
        {children}
      </DashboardLayout>
    </RequireAuth>
  );
}
