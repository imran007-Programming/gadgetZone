"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Phone, TicketPercent } from "lucide-react";
import { useSiteSettings } from "@/lib/categories";

/** Site paths use client-side navigation; anything else opens in a new tab. */
function SmartLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

/**
 * Thin bar above the navbar: wholesale link (left), coupon / announcement
 * (center), support phone (right). Everything comes from Admin → Site settings.
 * On mobile only the announcement shows (or the phone when there is none).
 */
export default function Topbar() {
  const { data: s } = useSiteSettings();
  if (!s || !s.topbarEnabled) return null;

  const phone = s.supportPhone.trim();
  const announcement = s.announcement.trim() ? (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <TicketPercent className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{s.announcement}</span>
    </span>
  ) : null;

  return (
    <div className="bg-primary-600 text-[12px] text-white sm:text-[13px]">
      <div className="mx-auto grid h-8 max-w-[1450px] grid-cols-1 items-center px-4 sm:h-9 sm:px-6 md:grid-cols-[1fr_auto_1fr] md:gap-6">
        {/* Left: wholesale / corporate link */}
        <div className="hidden min-w-0 md:block">
          {s.topbarLeftTitle && (
            <SmartLink
              href={s.topbarLeftLink || "/help"}
              className="group inline-flex max-w-full items-center gap-2 whitespace-nowrap"
            >
              <span className="font-semibold">{s.topbarLeftTitle}</span>
              {s.topbarLeftText && (
                <>
                  <span aria-hidden className="opacity-70">—</span>
                  <span className="truncate group-hover:underline">{s.topbarLeftText}</span>
                </>
              )}
              <ArrowRight className="h-3.5 w-3.5 shrink-0 transition group-hover:translate-x-0.5" />
            </SmartLink>
          )}
        </div>

        {/* Center: coupon / announcement */}
        <div className="flex min-w-0 justify-center font-medium">
          {announcement ? (
            s.announcementLink ? (
              <SmartLink href={s.announcementLink} className="min-w-0 hover:underline">
                {announcement}
              </SmartLink>
            ) : (
              announcement
            )
          ) : (
            phone && (
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 md:hidden">
                <Phone className="h-3.5 w-3.5" />
                {phone}
              </a>
            )
          )}
        </div>

        {/* Right: support phone */}
        <div className="hidden justify-end whitespace-nowrap md:flex">
          {phone && (
            <span>
              <span>Customer Support:</span>{" "}
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="font-semibold hover:underline">
                {phone}
              </a>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
