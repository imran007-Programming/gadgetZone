"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";

/**
 * Hides the site footer on dashboard routes (/admin, /dashboard)
 * where the sidebar layout already provides its own chrome.
 */
export default function ConditionalFooter() {
  const pathname = usePathname();
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/"))
    return null;
  return <Footer />;
}
