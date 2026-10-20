"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";

/** Small building blocks: spinner, empty/error states, pagination, auth guard, form field. */

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-zinc-500">
      <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-200 border-t-primary-600" />
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
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-14 text-center shadow-sm">
      <p className="font-display text-base font-semibold text-zinc-800">{title}</p>
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
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-rose-700">Something went wrong</p>
      <p className="mt-1 text-sm text-rose-600/80">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-full bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-500"
        >
          Try again
        </button>
      )}
    </div>
  );
}

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
    // Admin pages have their own sign-in on the admin portal
    if (denied) router.replace(adminOnly ? "/admin/login" : "/login");
  }, [denied, adminOnly, router]);

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
  PENDING: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
  PAID: "bg-primary-100 text-primary-800 ring-1 ring-primary-200",
  SHIPPED: "bg-violet-100 text-violet-800 ring-1 ring-violet-200",
  DELIVERED: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
  CANCELLED: "bg-zinc-200 text-zinc-600 ring-1 ring-zinc-300",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        STATUS_STYLES[status] ?? "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200"
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
        className="mb-1.5 block text-sm font-medium text-zinc-700"
      >
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 transition focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20";

export const primaryBtnClass =
  "btn-glow rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-600 disabled:opacity-40 disabled:hover:bg-primary-600";

export const secondaryBtnClass =
  "rounded-full px-5 py-2.5 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-300 transition hover:bg-zinc-100 hover:text-zinc-900";

export function BackLink({ href = "/", label = "Back" }: { href?: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition hover:text-primary-700"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden /> {label}
    </Link>
  );
}
