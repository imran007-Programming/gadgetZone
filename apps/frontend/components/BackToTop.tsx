"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

const SHOW_AFTER_PX = 400;

/**
 * Floating "back to top" button, bottom-right. Appears once the page is
 * scrolled down; sits above the mobile bottom nav on small screens.
 */
export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollUp = () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      onClick={scrollUp}
      aria-label="Back to top"
      title="Back to top"
      tabIndex={visible ? 0 : -1}
      className={`fixed bottom-24 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-white shadow-[0_8px_24px_rgba(255,92,56,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-200 md:bottom-6 md:right-6 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
    </button>
  );
}
