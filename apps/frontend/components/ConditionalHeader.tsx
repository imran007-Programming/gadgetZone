"use client";

import { usePathname } from "next/navigation";
import Header from "./Header";

/**
 * Hides the website header on dashboard routes (/admin, /dashboard)
 * — those have their own dedicated navbars.
 */
export default function ConditionalHeader() {
  const pathname = usePathname();
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/"))
    return null;
  return <Header />;
}
