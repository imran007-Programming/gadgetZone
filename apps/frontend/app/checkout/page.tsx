"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiClient, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCartStore, selectItemCount, selectSubtotal } from "@/lib/store/cart";
import { useToast } from "@/lib/toast";
import { formatPrice } from "@/lib/utils";
import type { Order, ShippingAddress } from "@/lib/types";
import { Banknote, CheckCircle2 } from "lucide-react";
import {
  BackLink,
  EmptyState,
  Field,
  Spinner,
  inputClass,
} from "@/components/ui";

/**
 * Checkout: guest-friendly, COD only.
 * - No login required. Guests fill name / mobile / address / email (optional).
 * - Logged-in users: order is created from their server cart via POST /orders.
 * - Guests: order is created via POST /orders/guest with cart items.
 * - Payment method is Cash on Delivery — no online payment step.
 */
const guestSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z
    .string()
    .min(6, "Enter a valid mobile number")
    .regex(/^[0-9+\-\s]+$/, "Enter a valid mobile number"),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  address: z.string().min(5, "Full address is required"),
});

type GuestForm = z.infer<typeof guestSchema>;

export default function CheckoutPage() {
  const { isLoading } = useAuth();
  const hydrated = useCartStore((s) => s.hydrated);

  if (isLoading || !hydrated) return <Spinner label="Loading checkout…" />;
  return <CheckoutContent />;
}

function CheckoutContent() {
  const toast = useToast();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const items = useCartStore((s) => s.items);
  const itemCount = useCartStore(selectItemCount);
  const subtotal = useCartStore(selectSubtotal);
  const clearCart = useCartStore((s) => s.clear);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GuestForm>({
    resolver: zodResolver(guestSchema),
    defaultValues: { name: user?.name ?? "", email: "" },
  });

  // ---- Success screen --------------------------------------------------
  if (placedOrder) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center ring-1 ring-zinc-200">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-zinc-900">Order placed!</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Order{" "}
          <span className="font-mono font-semibold text-zinc-700">
            #{placedOrder.id.slice(0, 8).toUpperCase()}
          </span>{" "}
          is confirmed. Pay {formatPrice(placedOrder.totalAmount)} in cash on
          delivery.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          {isAuthenticated ? (
            <button
              onClick={() => router.push(`/dashboard/orders`)}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              View my orders
            </button>
          ) : null}
          <button
            onClick={() => router.push("/products")}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-zinc-600 ring-1 ring-zinc-300 hover:bg-zinc-50"
          >
            Continue shopping
          </button>
        </div>
      </div>
    );
  }

  // ---- Empty cart ------------------------------------------------------
  if (items.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        hint="Add some products before checking out."
        action={<BackLink href="/products" label="Back to products" />}
      />
    );
  }

  const onSubmit = async (values: GuestForm) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      let order: Order;
      if (isAuthenticated) {
        // Logged-in: backend reads the server cart.
        const shippingAddress: ShippingAddress = {
          name: values.name,
          street: values.address,
          city: "",
          postalCode: "",
          country: "Bangladesh",
        };
        order = await apiClient.post<Order>("/orders", { shippingAddress });
      } else {
        // Guest: send cart items + contact info.
        order = await apiClient.post<Order>("/orders/guest", {
          name: values.name,
          phone: values.phone,
          email: values.email || undefined,
          address: values.address,
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
        });
      }
      clearCart();
      setPlacedOrder(order);
      toast.success("Order placed successfully");
      window.scrollTo({ top: 0 });
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900">
        Checkout
      </h1>

      {/* Order summary */}
      <div className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
        <h2 className="text-sm font-bold text-zinc-900">
          {itemCount} item{itemCount === 1 ? "" : "s"} · {formatPrice(subtotal)}
        </h2>
        <ul className="mt-3 space-y-2">
          {items.slice(0, 4).map((i) => (
            <li key={i.productId} className="flex justify-between text-sm">
              <span className="truncate text-zinc-600">
                {i.name} × {i.quantity}
              </span>
              <span className="ml-3 font-medium text-zinc-900">
                {formatPrice(i.price * i.quantity)}
              </span>
            </li>
          ))}
          {items.length > 4 && (
            <li className="text-sm text-zinc-400">
              + {items.length - 4} more item{items.length - 4 === 1 ? "" : "s"}
            </li>
          )}
        </ul>
      </div>

      {/* Details form */}
      <div className="rounded-2xl bg-white p-6 ring-1 ring-zinc-200">
        <h2 className="mb-4 text-base font-bold text-zinc-900">
          Delivery details
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Full name" error={errors.name?.message} htmlFor="name">
            <input
              id="name"
              className={inputClass}
              autoComplete="name"
              placeholder="Your name"
              {...register("name")}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Mobile number" error={errors.phone?.message} htmlFor="phone">
              <input
                id="phone"
                className={inputClass}
                autoComplete="tel"
                placeholder="01XXXXXXXXX"
                inputMode="tel"
                {...register("phone")}
              />
            </Field>
            <Field
              label="Email (optional)"
              error={errors.email?.message}
              htmlFor="email"
            >
              <input
                id="email"
                className={inputClass}
                autoComplete="email"
                placeholder="you@example.com"
                inputMode="email"
                {...register("email")}
              />
            </Field>
          </div>
          <Field label="Full address" error={errors.address?.message} htmlFor="address">
            <textarea
              id="address"
              className={`${inputClass} min-h-20 resize-y`}
              autoComplete="street-address"
              placeholder="House, road, area, city"
              {...register("address")}
            />
          </Field>

          {/* Payment method: COD only */}
          <div>
            <p className="mb-2 text-sm font-medium text-zinc-700">
              Payment method
            </p>
            <div className="flex items-center gap-3 rounded-xl border-2 border-blue-600 bg-blue-50 px-4 py-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600">
                <Banknote className="h-5 w-5 text-white" />
              </span>
              <div>
                <p className="text-sm font-bold text-zinc-900">
                  Cash on Delivery
                </p>
                <p className="text-xs text-zinc-500">
                  Pay in cash when your order arrives
                </p>
              </div>
            </div>
          </div>

          {submitError && (
            <p className="text-sm text-rose-600">{submitError}</p>
          )}

          <div className="flex items-center justify-between border-t border-zinc-200 pt-4">
            <div>
              <p className="text-sm text-zinc-500">Total (COD)</p>
              <p className="text-xl font-bold text-zinc-900">
                {formatPrice(subtotal)}
              </p>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-blue-600 px-8 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {submitting ? "Placing order…" : "Place order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
