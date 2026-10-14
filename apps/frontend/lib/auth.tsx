"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  apiClient,
  refreshAccessToken,
  setAccessToken,
  setStoredRefreshToken,
  getAccessToken,
} from "./api";
import type { User } from "./types";
import { useCartStore } from "./store/cart";
import { useWishlistStore } from "./store/wishlist";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_KEY = ["session"];

/** Bootstrap: rotate the refresh cookie, then fetch the current user. */
async function fetchSession(): Promise<User | null> {
  // If we already hold an access token (e.g. just logged in), use it directly.
  if (!getAccessToken()) {
    const token = await refreshAccessToken();
    if (!token) return null;
  }
  try {
    return await apiClient.get<User>("/auth/me");
  } catch {
    setAccessToken(null);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [bootstrapped, setBootstrapped] = useState(false);

  const sessionQuery = useQuery({
    queryKey: SESSION_KEY,
    queryFn: fetchSession,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (!sessionQuery.isPending) setBootstrapped(true);
  }, [sessionQuery.isPending]);

  // When a session is restored (e.g. via refresh cookie on page load),
  // pull the server cart/wishlist into the stores.
  const sessionUser = sessionQuery.data ?? null;
  useEffect(() => {
    if (sessionUser) {
      useCartStore.getState().syncFromServer();
      useWishlistStore.getState().syncFromServer();
    }
  }, [sessionUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiClient.post<{
        accessToken: string;
        refreshToken?: string;
      }>("/auth/login", {
        email,
        password,
      });
      setAccessToken(data.accessToken);
      if (data.refreshToken) setStoredRefreshToken(data.refreshToken);
      await queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      // Merge guest cart/wishlist into the server, then load server state.
      await Promise.all([
        useCartStore.getState().onLogin(),
        useWishlistStore.getState().onLogin(),
      ]);
    },
    [queryClient]
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      await apiClient.post("/auth/register", { name, email, password });
      // Auto-login right after registration for a smooth UX.
      await login(email, password);
    },
    [login]
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      /* ignore — still clear local state */
    }
    setAccessToken(null);
    setStoredRefreshToken(null);
    // Drop server-linked cart/wishlist, start fresh local state.
    useCartStore.getState().onLogout();
    useWishlistStore.getState().onLogout();
    queryClient.setQueryData(SESSION_KEY, null);
    await queryClient.invalidateQueries({ queryKey: SESSION_KEY });
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(() => {
    const user = sessionQuery.data ?? null;
    return {
      user,
      isLoading: !bootstrapped,
      isAuthenticated: !!user,
      isAdmin: user?.role === "ADMIN",
      login,
      register,
      logout,
    };
  }, [sessionQuery.data, bootstrapped, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
