"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { Field, Spinner, inputClass } from "@/components/ui";

/** Mirrors the backend RegisterDto password policy. */
const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
        "Password must include an uppercase letter, a lowercase letter and a digit"
      ),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { register: doRegister, isAuthenticated, isLoading } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  const onSubmit = async (values: RegisterForm) => {
    try {
      await doRegister(values.name, values.email, values.password);
      toast.success("Account created — welcome!");
      router.push("/");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Registration failed";
      setError("root", { message });
      toast.error(message);
    }
  };

  if (isLoading) return <Spinner label="Checking session…" />;

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl bg-zinc-50 p-8 ring-1 ring-zinc-200">
        <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900">Create an account</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Already have one?{" "}
          <Link href="/login" className="font-medium text-lime-600 hover:underline">
            Log in
          </Link>
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
          <Field label="Full name" error={errors.name?.message} htmlFor="name">
            <input
              id="name"
              className={inputClass}
              autoComplete="name"
              placeholder="Jane Doe"
              {...register("name")}
            />
          </Field>
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
              autoComplete="new-password"
              placeholder="Min. 8 chars, upper + lower + digit"
              {...register("password")}
            />
          </Field>
          <Field
            label="Confirm password"
            error={errors.confirmPassword?.message}
            htmlFor="confirmPassword"
          >
            <input
              id="confirmPassword"
              type="password"
              className={inputClass}
              autoComplete="new-password"
              {...register("confirmPassword")}
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
            className="w-full rounded-xl bg-lime-500 px-4 py-3 text-sm font-semibold text-white hover:bg-lime-600 disabled:opacity-40"
          >
            {isSubmitting ? "Creating account…" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
