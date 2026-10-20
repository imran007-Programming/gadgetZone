"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * Jumps to the top whenever the path or query string changes (a new page, a category,
 * a filter, the next results page). Next.js alone keeps the scroll position while the new
 * page is still in view, so a click near the bottom could open the next page half-way down.
 * Back/forward is left alone so the browser restores the previous position.
 */
export default function ScrollToTop() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const isHistoryNavigation = useRef(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const onPopState = () => {
      isHistoryNavigation.current = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useLayoutEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (isHistoryNavigation.current) {
      isHistoryNavigation.current = false;
      return;
    }
    // Next's own navigation scroll runs right after this effect and scrolls the new page's
    // first element (below the sticky header) into view, which would cut a smooth scroll short.
    // Starting one frame later makes ours the last word.
    const frame = requestAnimationFrame(() => {
      // Smooth glide up; jump straight there for visitors who ask for reduced motion
      // ("instant", since "auto" would still follow the site's CSS smooth scrolling)
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, left: 0, behavior: reduceMotion ? "instant" : "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, search]);

  return null;
}
