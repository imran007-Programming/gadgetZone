"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";

/** Small building blocks: spinner, empty/error states, pagination, auth guard, form field. */

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-zinc-500">
      <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-lime-400" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 px-6 py-14 text-center">
      <p className="font-display text-base font-semibold text-zinc-200">{title}</p>
      {hint && <p className="mt-1 text-sm text-zinc-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-rose-400/25 bg-rose-400/5 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-rose-300">Something went wrong</p>
      <p className="mt-1 text-sm text-rose-400/80">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-full bg-rose-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-400"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2
  );
  return (
    <nav className="flex items-center justify-center gap-1.5" aria-label="Pagination">
      <PageBtn disabled={page <= 1} onClick={() => onPage(page - 1)} label="‹ Prev" />
      {pages.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && pages[i - 1] !== p - 1 && (
            <span className="px-1 text-zinc-600">…</span>
          )}
          <PageBtn active={p === page} onClick={() => onPage(p)} label={String(p)} />
        </span>
      ))}
      <PageBtn
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        label="Next ›"
      />
    </nav>
  );
}

function PageBtn({
  label,
  onClick,
  active,
  disabled,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? "page" : undefined}
      className={`min-w-9 rounded-full px-2.5 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-lime-400 text-zinc-950 shadow-[0_0_16px_-4px_rgba(163,230,53,0.6)]"
          : "bg-zinc-900 text-zinc-400 ring-1 ring-zinc-800 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
      }`}
    >
      {label}
    </button>
  );
}

import { useEffect } from "react";

/** Client-side route guard. Redirects to /login when unauthenticated. */
export function RequireAuth({
  children,
  adminOnly = false,
}: {
  children: ReactNode;
  adminOnly?: boolean;
}) {
  const { isLoading, isAuthenticated, isAdmin } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const denied = !isLoading && !isAuthenticated;
  const forbidden = !isLoading && isAuthenticated && adminOnly && !isAdmin;

  useEffect(() => {
    if (denied) router.replace("/login");
  }, [denied, router]);

  useEffect(() => {
    if (forbidden) {
      toast.error("Admin access required");
      router.replace("/");
    }
  }, [forbidden, router, toast]);

  if (isLoading) return <Spinner label="Checking session…" />;
  if (denied) return <Spinner label="Redirecting to login…" />;
  if (forbidden) return <Spinner label="Redirecting…" />;
  return <>{children}</>;
}

export const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/25",
  PAID: "bg-blue-400/15 text-blue-300 ring-1 ring-blue-400/25",
  SHIPPED: "bg-violet-400/15 text-violet-300 ring-1 ring-violet-400/25",
  DELIVERED: "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/25",
  CANCELLED: "bg-zinc-700/60 text-zinc-400 ring-1 ring-zinc-700",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        STATUS_STYLES[status] ?? "bg-zinc-800 text-zinc-400 ring-1 ring-zinc-700"
      }`}
    >
      {status}
    </span>
  );
}

/** Labeled form field with inline Zod/RHF error. */
export function Field({
  label,
  error,
  children,
  htmlFor,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-sm font-medium text-zinc-300"
      >
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 transition focus:border-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-400/20";

export const primaryBtnClass =
  "btn-glow rounded-full bg-lime-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-lime-300 disabled:opacity-40 disabled:hover:bg-lime-400";

export const secondaryBtnClass =
  "rounded-full px-5 py-2.5 text-sm font-semibold text-zinc-300 ring-1 ring-zinc-700 transition hover:bg-zinc-800 hover:text-zinc-100";

export function BackLink({ href = "/", label = "Back" }: { href?: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition hover:text-lime-300"
    >
      <span aria-hidden>←</span> {label}
    </Link>
  );
}
