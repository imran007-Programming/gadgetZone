"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiClient, getAccessToken } from "@/lib/api";
import type { Cart, Product } from "@/lib/types";

/** Local cart line — enough to render cart UI without a server round-trip. */
export interface LocalCartItem {
  productId: string;
  slug: string;
  name: string;
  price: number;
  imageUrl: string;
  quantity: number;
}

interface CartState {
  items: LocalCartItem[];
  isOpen: boolean;
  loading: boolean;
  /** True once rehydrated from localStorage (persist middleware). */
  hydrated: boolean;

  addItem: (product: Pick<Product, "id" | "slug" | "name" | "price" | "imageUrl">, qty?: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  setQty: (productId: string, qty: number) => Promise<void>;
  clear: () => Promise<void>;
  openDrawer: () => void;
  closeDrawer: () => void;
  setHydrated: () => void;

  /** Called right after login: push guest items to the server, then load server cart. */
  onLogin: () => Promise<void>;
  /** Called on logout: drop server-linked state, start a fresh local cart. */
  onLogout: () => void;
  /** Pull the server cart into the store (logged-in users). */
  syncFromServer: () => Promise<void>;
}

function toLocal(items: Cart["items"]): LocalCartItem[] {
  return items.map((i) => ({
    productId: i.productId,
    slug: i.product.slug,
    name: i.product.name,
    price: Number(i.product.price),
    imageUrl: i.product.imageUrl,
    quantity: i.quantity,
  }));
}

const isAuthed = () => !!getAccessToken();

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      loading: false,
      hydrated: false,

      setHydrated: () => set({ hydrated: true }),
      openDrawer: () => set({ isOpen: true }),
      closeDrawer: () => set({ isOpen: false }),

      addItem: async (product, qty = 1) => {
        // Optimistic local update — works for guests too.
        const items = get().items;
        const existing = items.find((i) => i.productId === product.id);
        const next = existing
          ? items.map((i) =>
              i.productId === product.id ? { ...i, quantity: i.quantity + qty } : i
            )
          : [
              ...items,
              {
                productId: product.id,
                slug: product.slug,
                name: product.name,
                price: Number(product.price),
                imageUrl: product.imageUrl,
                quantity: qty,
              },
            ];
        set({ items: next });

        if (isAuthed()) {
          try {
            await apiClient.post("/cart/items", {
              productId: product.id,
              quantity: qty,
            });
            await get().syncFromServer();
          } catch {
            /* keep optimistic state; server will reconcile on next sync */
          }
        }
      },

      removeItem: async (productId) => {
        set({ items: get().items.filter((i) => i.productId !== productId) });
        if (isAuthed()) {
          try {
            await apiClient.del(`/cart/items/${productId}`);
          } catch {
            /* keep optimistic state */
          }
        }
      },

      setQty: async (productId, qty) => {
        if (qty <= 0) {
          await get().removeItem(productId);
          return;
        }
        set({
          items: get().items.map((i) =>
            i.productId === productId ? { ...i, quantity: qty } : i
          ),
        });
        if (isAuthed()) {
          try {
            await apiClient.patch(`/cart/items/${productId}`, { quantity: qty });
          } catch {
            /* keep optimistic state */
          }
        }
      },

      clear: async () => {
        set({ items: [] });
        if (isAuthed()) {
          try {
            await apiClient.del("/cart");
          } catch {
            /* ignore */
          }
        }
      },

      syncFromServer: async () => {
        if (!isAuthed()) return;
        set({ loading: true });
        try {
          const cart = await apiClient.get<Cart>("/cart");
          set({ items: toLocal(cart.items) });
        } catch {
          /* keep local state on failure */
        } finally {
          set({ loading: false });
        }
      },

      onLogin: async () => {
        const guestItems = get().items;
        // Push every guest line to the server (upsert semantics).
        for (const item of guestItems) {
          try {
            await apiClient.post("/cart/items", {
              productId: item.productId,
              quantity: item.quantity,
            });
          } catch {
            /* skip items that fail (e.g. deactivated) */
          }
        }
        // Server cart is now the source of truth.
        await get().syncFromServer();
      },

      onLogout: () => {
        set({ items: [], isOpen: false });
      },
    }),
    {
      name: "gadgetlax-cart",
      partialize: (s) => ({ items: s.items }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);

/** Derived selectors — subscribe to these to avoid re-rendering on drawer toggles. */
export const selectItemCount = (s: CartState) =>
  s.items.reduce((n, i) => n + i.quantity, 0);

export const selectSubtotal = (s: CartState) =>
  s.items.reduce((n, i) => n + i.quantity * i.price, 0);
