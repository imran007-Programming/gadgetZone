"use client";

import { create } from "zustand";

/** Open state of the mobile left sidebar (header hamburger + bottom-nav Menu). */
interface MobileMenuState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useMobileMenuStore = create<MobileMenuState>()((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
