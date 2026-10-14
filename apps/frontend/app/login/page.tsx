"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/lib/auth";
import { apiClient } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { Field, Spinner, inputClass } from "@/components/ui";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const { login, isAuthenticated, isLoading, user, isAdmin } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  // Role-aware redirect: admins → /admin, customers → next or /
  const getRedirect = () => {
    if (isAdmin) return "/admin";
    return next ?? "/";
  };

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace(getRedirect());
  }, [isLoading, isAuthenticated, isAdmin, router, next]);

  const onSubmit = async (values: LoginForm) => {
    try {
      await login(values.email, values.password);
      toast.success("Welcome back!");
      // Fetch the fresh session to get the role, then redirect accordingly.
      // (The useEffect above is a fallback for session restores.)
      try {
        const me = await apiClient.get<{ role: string }>("/auth/me");
        router.push(me.role === "ADMIN" ? "/admin" : (next ?? "/"));
      } catch {
        router.push(next ?? "/");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Login failed";
      setError("root", { message });
      toast.error(message);
    }
  };

  if (isLoading) return <Spinner label="Checking session…" />;

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl bg-zinc-50 p-8 ring-1 ring-zinc-200">
        <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900">Log in</h1>
        <p className="mt-1 text-sm text-zinc-500">
          New here?{" "}
          <Link href="/register" className="font-medium text-blue-600 hover:underline">
            Create an account
          </Link>
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
          <Field label="Email" error={errors.email?.message} htmlFor="email">
            <input
              id="email"
              type="email"
              className={inputClass}
              autoComplete="email"
              placeholder="you@example.com"
              {...register("email")}
            />
          </Field>
          <Field label="Password" error={errors.password?.message} htmlFor="password">
            <input
              id="password"
              type="password"
              className={inputClass}
              autoComplete="current-password"
              placeholder="••••••••"
              {...register("password")}
            />
          </Field>

          {errors.root && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {errors.root.message}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-40"
          >
            {isSubmitting ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="mt-4 rounded-lg bg-white p-3 text-xs text-zinc-500">
          Demo accounts — admin: <span className="font-mono">admin@example.com</span> /
          customer: <span className="font-mono">priya.patel@example.com</span> (see
          README for passwords).
        </p>
      </div>
    </div>
  );
}
