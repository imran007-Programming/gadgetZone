"use client";

import { useCallback, useSyncExternalStore } from "react";

export type AdminTheme = "light" | "dark";

const STORAGE_KEY = "gadgetlax-admin-theme";
const DEFAULT_THEME: AdminTheme = "dark";

// Keeps the choice for this tab even when storage is blocked
let memoryTheme: AdminTheme | null = null;
const listeners = new Set<() => void>();

function readStoredTheme(): AdminTheme | null {
  if (memoryTheme) return memoryTheme;
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    // Private mode or blocked storage: fall back to the default
    return null;
  }
}

function storeTheme(theme: AdminTheme) {
  memoryTheme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

/**
 * Admin-only light/dark preference, remembered per browser. Defaults to dark.
 * The storefront does not use this; it only affects the admin area.
 */
export function useAdminTheme() {
  const theme = useSyncExternalStore(
    subscribe,
    () => readStoredTheme() ?? DEFAULT_THEME,
    () => DEFAULT_THEME,
  );

  const setTheme = useCallback((next: AdminTheme) => storeTheme(next), []);

  return { theme, setTheme };
}
