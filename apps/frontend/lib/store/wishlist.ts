"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiClient, getAccessToken } from "@/lib/api";
import type { Product, WishlistItem } from "@/lib/types";

/** Minimal product info kept for guest wishlist rendering. */
export interface LocalWishlistItem {
  productId: string;
  slug: string;
  name: string;
  price: number;
  comparePrice?: number | null;
  imageUrl: string;
  stock: number;
}

interface WishlistState {
  items: LocalWishlistItem[];
  loading: boolean;
  hydrated: boolean;

  toggle: (product: Pick<Product, "id" | "slug" | "name" | "price" | "imageUrl" | "stock"> & { comparePrice?: number | null }) => Promise<void>;
  remove: (productId: string) => Promise<void>;
  isWishlisted: (productId: string) => boolean;
  clear: () => void;
  setHydrated: () => void;

  /** Called after login: merge guest wishlist into the server one, then load it. */
  onLogin: () => Promise<void>;
  /** Called on logout: drop server-linked state. */
  onLogout: () => void;
  /** Pull the server wishlist into the store (logged-in users). */
  syncFromServer: () => Promise<void>;
}

function toLocal(items: WishlistItem[]): LocalWishlistItem[] {
  return items.map((i) => ({
    productId: i.productId,
    slug: i.product.slug,
    name: i.product.name,
    price: Number(i.product.price),
    comparePrice: i.product.comparePrice != null ? Number(i.product.comparePrice) : null,
    imageUrl: i.product.imageUrl,
    stock: i.product.stock,
  }));
}

const isAuthed = () => !!getAccessToken();

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      loading: false,
      hydrated: false,

      setHydrated: () => set({ hydrated: true }),

      isWishlisted: (productId) =>
        get().items.some((i) => i.productId === productId),

      toggle: async (product) => {
        const exists = get().isWishlisted(product.id);
        if (exists) {
          await get().remove(product.id);
          return;
        }
        const next: LocalWishlistItem = {
          productId: product.id,
          slug: product.slug,
          name: product.name,
          price: Number(product.price),
          comparePrice: product.comparePrice ?? null,
          imageUrl: product.imageUrl,
          stock: product.stock,
        };
        set({ items: [next, ...get().items] });
        if (isAuthed()) {
          try {
            // POST is a toggle on the server; we just added locally so a
            // toggle adds server-side too (we removed first if it existed).
            await apiClient.post(`/wishlist/${product.id}`);
          } catch {
            /* keep optimistic state */
          }
        }
      },

      remove: async (productId) => {
        set({ items: get().items.filter((i) => i.productId !== productId) });
        if (isAuthed()) {
          try {
            await apiClient.del(`/wishlist/${productId}`);
          } catch {
            /* keep optimistic state */
          }
        }
      },

      clear: () => set({ items: [] }),

      syncFromServer: async () => {
        if (!isAuthed()) return;
        set({ loading: true });
        try {
          const items = await apiClient.get<WishlistItem[]>("/wishlist");
          set({ items: toLocal(items) });
        } catch {
          /* keep local state on failure */
        } finally {
          set({ loading: false });
        }
      },

      onLogin: async () => {
        const guestItems = get().items;
        try {
          const serverItems = await apiClient.get<WishlistItem[]>("/wishlist");
          const serverIds = new Set(serverItems.map((i) => i.productId));
          // Only toggle-add guest items missing on the server (toggle would
          // REMOVE ones already there).
          for (const item of guestItems) {
            if (!serverIds.has(item.productId)) {
              try {
                await apiClient.post(`/wishlist/${item.productId}`);
              } catch {
                /* skip failures */
              }
            }
          }
        } catch {
          /* fall through to sync */
        }
        await get().syncFromServer();
      },

      onLogout: () => {
        set({ items: [] });
      },
    }),
    {
      name: "gadgetlax-wishlist",
      partialize: (s) => ({ items: s.items }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);

export const selectWishlistCount = (s: WishlistState) => s.items.length;
