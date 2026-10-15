import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import AdminShell from "@/components/dashboard/admin/AdminShell";
import { RequireAuth } from "@/components/ui";
import "./admin.css";

// The admin design uses Inter; the storefront keeps Poppins.
const inter = Inter({ subsets: ["latin"], variable: "--font-admin", display: "swap" });

export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className={inter.variable}>
      <RequireAuth adminOnly>
        <AdminShell>{children}</AdminShell>
      </RequireAuth>
    </div>
  );
}
