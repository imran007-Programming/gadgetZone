"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCartStore, selectItemCount, selectSubtotal } from "@/lib/store/cart";
import { useToast } from "@/lib/toast";
import { formatPrice } from "@/lib/utils";
import type { Order, ShippingAddress } from "@/lib/types";
import { CheckCircle2, Lock, LogIn, UserPlus } from "lucide-react";
import {
  BackLink,
  EmptyState,
  Field,
  Spinner,
  inputClass,
} from "@/components/ui";

/**
 * Checkout flow (matches the backend contract):
 *  1. Shipping form (Zod) → POST /orders { shippingAddress } → order (PENDING)
 *  2. Payment step → POST /orders/:id/pay (mock payment) → order (PAID)
 *  3. Success screen with link to the order.
 *
 * Guests can fill their cart, but placing the order requires an account —
 * they see a friendly login/register prompt instead of the form.
 */
const addressSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  street: z.string().min(3, "Street address is required"),
  city: z.string().min(2, "City is required"),
  postalCode: z.string().min(2, "Postal code is required"),
  country: z.string().min(2, "Country is required"),
});

type AddressForm = z.infer<typeof addressSchema>;

export default function CheckoutPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const hydrated = useCartStore((s) => s.hydrated);

  if (isLoading || !hydrated) return <Spinner label="Loading checkout…" />;
  if (!isAuthenticated) return <GuestPrompt />;
  return <CheckoutContent />;
}

function GuestPrompt() {
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore(selectSubtotal);
  const itemCount = useCartStore(selectItemCount);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-50">
        Checkout
      </h1>
      <div className="rounded-2xl bg-zinc-900 p-8 text-center ring-1 ring-zinc-800">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-lime-400/15">
          <Lock className="h-6 w-6 text-lime-400" />
        </span>
        <h2 className="mt-4 text-lg font-bold text-zinc-50">
          One quick step before you order
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          {itemCount > 0 ? (
            <>
              Your cart with {itemCount} item{itemCount === 1 ? "" : "s"} (
              {formatPrice(subtotal)}) is saved. Log in or create a free account
              to place your order — it takes less than a minute.
            </>
          ) : (
            "Log in or create a free account to place your order."
          )}
        </p>
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <Link
            href="/login?next=/checkout"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-lime-400 px-6 py-3 text-sm font-semibold text-zinc-950 hover:bg-lime-300"
          >
            <LogIn className="h-4 w-4" />
            Log in
          </Link>
          <Link
            href="/register?next=/checkout"
            className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-zinc-200 ring-1 ring-zinc-700 hover:bg-zinc-800"
          >
            <UserPlus className="h-4 w-4" />
            Create account
          </Link>
        </div>
        {items.length === 0 && (
          <div className="mt-6">
            <BackLink href="/products" label="Back to products" />
          </div>
        )}
      </div>
    </div>
  );
}

function CheckoutContent() {
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [paidOrder, setPaidOrder] = useState<Order | null>(null);

  const items = useCartStore((s) => s.items);
  const itemCount = useCartStore(selectItemCount);
  const subtotal = useCartStore(selectSubtotal);
  const clearCart = useCartStore((s) => s.clear);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AddressForm>({ resolver: zodResolver(addressSchema) });

  const createOrder = useMutation({
    mutationFn: (shippingAddress: ShippingAddress) =>
      apiClient.post<Order>("/orders", { shippingAddress }),
    onSuccess: (order) => {
      setCreatedOrder(order);
      clearCart();
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order created — complete the payment");
      window.scrollTo({ top: 0 });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const payOrder = useMutation({
    mutationFn: (orderId: string) => apiClient.post<Order>(`/orders/${orderId}/pay`),
    onSuccess: (order) => {
      setPaidOrder(order);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Payment successful");
      window.scrollTo({ top: 0 });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---- Step 3: success -------------------------------------------------
  if (paidOrder) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl bg-zinc-900 p-8 text-center ring-1 ring-zinc-800">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/15">
          <CheckCircle2 className="h-7 w-7 text-emerald-400" />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-zinc-50">Payment successful!</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Order <span className="font-mono font-semibold">{paidOrder.id.slice(0, 8)}</span>{" "}
          is confirmed. Total {formatPrice(paidOrder.totalAmount)}.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={() => router.push(`/orders/${paidOrder.id}`)}
            className="rounded-xl bg-lime-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-lime-300"
          >
            View order
          </button>
          <button
            onClick={() => router.push("/products")}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-zinc-400 ring-1 ring-zinc-700 hover:bg-zinc-950"
          >
            Continue shopping
          </button>
        </div>
      </div>
    );
  }

  // ---- Step 2: payment -------------------------------------------------
  if (createdOrder) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-50">Payment</h1>
        <div className="rounded-xl bg-zinc-900 p-6 ring-1 ring-zinc-800">
          <p className="text-sm text-zinc-500">Order total</p>
          <p className="text-3xl font-bold text-zinc-50">
            {formatPrice(createdOrder.totalAmount)}
          </p>
          <div className="mt-4 rounded-lg bg-amber-400/10 p-4 text-sm text-amber-300 ring-1 ring-amber-400/25">
            <p className="font-semibold">Mock payment</p>
            <p className="mt-1">
              This demo uses a mock payment provider — no real card is charged.
              Clicking pay marks the order as PAID.
            </p>
          </div>
          <button
            onClick={() => payOrder.mutate(createdOrder.id)}
            disabled={payOrder.isPending}
            className="mt-5 w-full rounded-xl bg-lime-400 px-4 py-3 text-sm font-semibold text-zinc-950 hover:bg-lime-300 disabled:opacity-40"
          >
            {payOrder.isPending
              ? "Processing…"
              : `Pay ${formatPrice(createdOrder.totalAmount)}`}
          </button>
          {payOrder.isError && (
            <p className="mt-2 text-sm text-rose-400">
              {(payOrder.error as Error).message}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ---- Step 1: shipping form -------------------------------------------
  if (items.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        hint="Add some products before checking out."
        action={<BackLink href="/products" label="Back to products" />}
      />
    );
  }

  const onSubmit = (values: AddressForm) => {
    createOrder.mutate(values);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-50">Checkout</h1>

      <div className="rounded-xl bg-zinc-900 p-6 ring-1 ring-zinc-800">
        <h2 className="mb-4 text-base font-bold text-zinc-50">Shipping address</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Full name" error={errors.name?.message} htmlFor="name">
            <input id="name" className={inputClass} autoComplete="name" {...register("name")} />
          </Field>
          <Field label="Street address" error={errors.street?.message} htmlFor="street">
            <input
              id="street"
              className={inputClass}
              autoComplete="street-address"
              placeholder="House, road, area"
              {...register("street")}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="City" error={errors.city?.message} htmlFor="city">
              <input id="city" className={inputClass} autoComplete="address-level2" {...register("city")} />
            </Field>
            <Field label="Postal code" error={errors.postalCode?.message} htmlFor="postalCode">
              <input
                id="postalCode"
                className={inputClass}
                autoComplete="postal-code"
                {...register("postalCode")}
              />
            </Field>
          </div>
          <Field label="Country" error={errors.country?.message} htmlFor="country">
            <input id="country" className={inputClass} autoComplete="country-name" {...register("country")} />
          </Field>

          {createOrder.isError && (
            <p className="text-sm text-rose-400">
              {(createOrder.error as ApiError).message}
            </p>
          )}

          <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
            <div>
              <p className="text-sm text-zinc-500">
                {itemCount} item{itemCount === 1 ? "" : "s"}
              </p>
              <p className="text-lg font-bold text-zinc-50">{formatPrice(subtotal)}</p>
            </div>
            <button
              type="submit"
              disabled={createOrder.isPending}
              className="rounded-xl bg-lime-400 px-6 py-3 text-sm font-semibold text-zinc-950 hover:bg-lime-300 disabled:opacity-40"
            >
              {createOrder.isPending ? "Placing order…" : "Place order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
