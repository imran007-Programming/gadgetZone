"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { formatPrice } from "@/lib/utils";
import type { Cart, Order, ShippingAddress } from "@/lib/types";
import {
  BackLink,
  EmptyState,
  Field,
  RequireAuth,
  Spinner,
  inputClass,
} from "@/components/ui";

/**
 * Checkout flow (matches the backend contract):
 *  1. Shipping form (Zod) → POST /orders { shippingAddress } → order (PENDING)
 *  2. Payment step → POST /orders/:id/pay (mock payment) → order (PAID)
 *  3. Success screen with link to the order.
 *
 * NOTE: the backend ShippingAddressDto is { name, street, city, postalCode,
 * country } — there is no phone/address-line-2 field.
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
  return (
    <RequireAuth>
      <CheckoutContent />
    </RequireAuth>
  );
}

function CheckoutContent() {
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [paidOrder, setPaidOrder] = useState<Order | null>(null);

  const cartQuery = useQuery({
    queryKey: ["cart"],
    queryFn: () => apiClient.get<Cart>("/cart"),
  });

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
      queryClient.invalidateQueries({ queryKey: ["cart"] });
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

  if (cartQuery.isPending) return <Spinner label="Loading checkout…" />;
  if (cartQuery.isError) {
    const err = cartQuery.error;
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        Failed to load cart: {err instanceof Error ? err.message : "unknown error"}
      </div>
    );
  }

  // ---- Step 3: success -------------------------------------------------
  if (paidOrder) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center ring-1 ring-slate-200">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">
          ✓
        </div>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Payment successful!</h1>
        <p className="mt-2 text-sm text-slate-600">
          Order <span className="font-mono font-semibold">{paidOrder.id.slice(0, 8)}</span>{" "}
          is confirmed. Total {formatPrice(paidOrder.totalAmount)}.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={() => router.push(`/orders/${paidOrder.id}`)}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            View order
          </button>
          <button
            onClick={() => router.push("/products")}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50"
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
        <h1 className="text-2xl font-bold text-slate-900">Payment</h1>
        <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">Order total</p>
          <p className="text-3xl font-bold text-slate-900">
            {formatPrice(createdOrder.totalAmount)}
          </p>
          <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
            <p className="font-semibold">Mock payment</p>
            <p className="mt-1">
              This demo uses a mock payment provider — no real card is charged.
              Clicking pay marks the order as PAID.
            </p>
          </div>
          <button
            onClick={() => payOrder.mutate(createdOrder.id)}
            disabled={payOrder.isPending}
            className="mt-5 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            {payOrder.isPending
              ? "Processing…"
              : `Pay ${formatPrice(createdOrder.totalAmount)}`}
          </button>
          {payOrder.isError && (
            <p className="mt-2 text-sm text-rose-600">
              {(payOrder.error as Error).message}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ---- Step 1: shipping form -------------------------------------------
  const cart = cartQuery.data;
  if (cart.items.length === 0) {
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
      <h1 className="text-2xl font-bold text-slate-900">Checkout</h1>

      <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="mb-4 text-base font-bold text-slate-900">Shipping address</h2>
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
            <p className="text-sm text-rose-600">
              {(createOrder.error as ApiError).message}
            </p>
          )}

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <div>
              <p className="text-sm text-slate-500">
                {cart.itemCount} item{cart.itemCount === 1 ? "" : "s"}
              </p>
              <p className="text-lg font-bold text-slate-900">{formatPrice(cart.subtotal)}</p>
            </div>
            <button
              type="submit"
              disabled={createOrder.isPending}
              className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
            >
              {createOrder.isPending ? "Placing order…" : "Place order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
