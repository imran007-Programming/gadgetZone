import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./admin.css";

// The admin design uses Inter; the storefront keeps Poppins.
const inter = Inter({ subsets: ["latin"], variable: "--font-admin", display: "swap" });

/** Shared by the admin login and the admin panel (which adds the guard and shell). */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className={inter.variable}>{children}</div>;
}
