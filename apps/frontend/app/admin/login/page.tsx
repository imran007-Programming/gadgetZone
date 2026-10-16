"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { LockKeyhole } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { Spinner } from "@/components/ui";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

// Local development only (NEXT_PUBLIC_DEMO_LOGIN=true): one-click demo admin login.
const SHOW_DEMO_LOGIN = process.env.NEXT_PUBLIC_DEMO_LOGIN === "true";
const DEMO_ADMIN = { email: "admin@example.com", password: "Admin@123" } as const;

const inputCls =
  "w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white placeholder:text-zinc-500 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30";

/**
 * Admin portal sign-in (admin.<domain>/admin/login). Uses /auth/admin/login,
 * which only accepts admin accounts; customers sign in at /login on the store.
 */
export default function AdminLoginPage() {
  const { login, isAuthenticated, isLoading, isAdmin } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (!isLoading && isAuthenticated && isAdmin) router.replace("/admin");
  }, [isLoading, isAuthenticated, isAdmin, router]);

  const onSubmit = async (values: LoginForm) => {
    try {
      await login(values.email, values.password);
      toast.success("Signed in to the admin portal");
      router.replace("/admin");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Login failed";
      setError("root", { message });
      toast.error(message);
    }
  };

  if (isLoading) return <Spinner label="Checking session…" />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10 font-[family-name:var(--font-admin)]">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image src="/logo.png" alt="GadgetLax" width={56} height={56} priority className="h-14 w-14 rounded-2xl" />
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-white">Admin portal</h1>
          <p className="mt-1 text-sm text-zinc-400">Sign in with your admin account</p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-4 rounded-2xl bg-zinc-900/60 p-6 ring-1 ring-zinc-800"
        >
          <div>
            <label htmlFor="admin-email" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-400">
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              placeholder="admin@yourstore.com"
              className={inputCls}
              {...register("email")}
            />
            {errors.email && <p className="mt-1 text-xs text-rose-400">{errors.email.message}</p>}
          </div>
          <div>
            <label htmlFor="admin-password" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-400">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className={inputCls}
              {...register("password")}
            />
            {errors.password && <p className="mt-1 text-xs text-rose-400">{errors.password.message}</p>}
          </div>

          {errors.root && (
            <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300 ring-1 ring-rose-500/20">
              {errors.root.message}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
          >
            <LockKeyhole className="h-4 w-4" />
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>

          {SHOW_DEMO_LOGIN && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setValue("email", DEMO_ADMIN.email);
                setValue("password", DEMO_ADMIN.password);
                handleSubmit(onSubmit)();
              }}
              className="w-full rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-300 ring-1 ring-zinc-700 transition hover:bg-zinc-800 disabled:opacity-50"
            >
              Demo: Admin
            </button>
          )}
        </form>

        <p className="mt-6 text-center text-xs text-zinc-500">Customers sign in on the store, not here.</p>
      </div>
    </div>
  );
}
