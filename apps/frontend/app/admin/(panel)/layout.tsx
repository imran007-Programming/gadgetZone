import type { ReactNode } from "react";
import AdminShell from "@/components/dashboard/admin/AdminShell";
import { RequireAuth } from "@/components/ui";

/** Every admin page except /admin/login: admin session required. */
export default function AdminPanelLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth adminOnly>
      <AdminShell>{children}</AdminShell>
    </RequireAuth>
  );
}
