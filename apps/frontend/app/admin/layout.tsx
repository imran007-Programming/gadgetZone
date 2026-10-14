"use client";

import type { ReactNode } from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Tags,
  Users,
} from "lucide-react";
import DashboardLayout, {
  type DashboardNavItem,
} from "@/components/dashboard/DashboardLayout";
import { RequireAuth } from "@/components/ui";

const NAV: DashboardNavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: ShoppingBag },
  { href: "/admin/orders", label: "Orders", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: Tags },
  { href: "/admin/customers", label: "Customers", icon: Users },
];

export default function AdminDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RequireAuth adminOnly>
      <DashboardLayout title="Admin Panel" items={NAV}>
        {children}
      </DashboardLayout>
    </RequireAuth>
  );
}
