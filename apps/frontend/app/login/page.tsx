"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { Field, Spinner, inputClass } from "@/components/ui";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

// Local development only: set NEXT_PUBLIC_DEMO_LOGIN=true at build time to show one-click demo logins.
const SHOW_DEMO_LOGIN = process.env.NEXT_PUBLIC_DEMO_LOGIN === "true";
const DEMO_CUSTOMER = { email: "priya.patel@example.com", password: "Customer@123" } as const;

export default function LoginPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const demoLogin = () => {
    setValue("email", DEMO_CUSTOMER.email);
    setValue("password", DEMO_CUSTOMER.password);
    handleSubmit(onSubmit)();
  };

  // Customer accounts only; admin accounts are refused here and sign in on the admin portal
  const redirectTo = next ?? "/dashboard";

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace(redirectTo);
  }, [isLoading, isAuthenticated, router, redirectTo]);

  const onSubmit = async (values: LoginForm) => {
    try {
      await login(values.email, values.password);
      toast.success("Welcome back!");
      router.push(redirectTo);
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
        <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl sm:font-bold text-zinc-900">Log in</h1>
        <p className="mt-1 text-sm text-zinc-500">
          New here?{" "}
          <Link href="/register" className="font-medium text-primary-600 hover:underline">
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
            className="w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-40"
          >
            {isSubmitting ? "Logging in…" : "Log in"}
          </button>
        </form>

        {SHOW_DEMO_LOGIN && (
          <>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={demoLogin}
              className="mt-4 w-full rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-40"
            >
              Demo: Customer
            </button>
            <p className="mt-4 rounded-lg bg-white p-3 text-xs text-zinc-500">
              Demo customer: <span className="font-mono">{DEMO_CUSTOMER.email}</span> (see README for the password).
            </p>
          </>
        )}
      </div>
    </div>
  );
}
