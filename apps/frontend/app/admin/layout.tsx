"use client";

import type { ReactNode } from "react";
import AdminShell from "@/components/dashboard/admin/AdminShell";
import { RequireAuth } from "@/components/ui";

export default function AdminDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RequireAuth adminOnly>
      <AdminShell>{children}</AdminShell>
    </RequireAuth>
  );
}
