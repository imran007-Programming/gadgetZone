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
  const next = searchParams.get("next") ?? "/";

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace(next);
  }, [isLoading, isAuthenticated, router, next]);

  const onSubmit = async (values: LoginForm) => {
    try {
      await login(values.email, values.password);
      toast.success("Welcome back!");
      router.push(next);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Login failed";
      setError("root", { message });
      toast.error(message);
    }
  };

  if (isLoading) return <Spinner label="Checking session…" />;

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl bg-white p-8 ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Log in</h1>
        <p className="mt-1 text-sm text-slate-500">
          New here?{" "}
          <Link href="/register" className="font-medium text-indigo-600 hover:underline">
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
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            {isSubmitting ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          Demo accounts — admin: <span className="font-mono">admin@example.com</span> /
          customer: <span className="font-mono">priya.patel@example.com</span> (see
          README for passwords).
        </p>
      </div>
    </div>
  );
}
