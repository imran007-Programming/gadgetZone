"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiClient, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCartStore, selectItemCount, selectSubtotal } from "@/lib/store/cart";
import { useToast } from "@/lib/toast";
import { formatPrice } from "@/lib/utils";
import type { CouponPreview, Order } from "@/lib/types";
import type { BdDistrict } from "@/lib/bd-locations";
import { Banknote, CheckCircle2, Tag, X } from "lucide-react";
import {
  BackLink,
  EmptyState,
  Field,
  Spinner,
  inputClass,
} from "@/components/ui";

/**
 * Checkout: guest-friendly, COD only.
 * - No login required. Guests fill name / mobile / email (optional) and a
 *   Bangladesh address: district → upazila/thana → union (optional) + street.
 * - Logged-in users: order is created from their server cart via POST /orders.
 * - Guests: order is created via POST /orders/guest with cart items.
 * - Payment method is Cash on Delivery — no online payment step.
 */
/** 01XXXXXXXXX: 11 digits, operator prefix 013–019 (same rule as the backend). */
const BD_MOBILE_REGEX = /^01[3-9]\d{8}$/;

/** Strips spaces/dashes and a +88 / 88 country prefix. */
const normalizePhone = (v: string) => v.replace(/[\s-]/g, "").replace(/^\+?88(?=01)/, "");

const checkoutSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name is too long"),
  phone: z
    .string()
    .trim()
    .refine(
      (v) => BD_MOBILE_REGEX.test(normalizePhone(v)),
      "Enter a valid Bangladeshi mobile number (01XXXXXXXXX)",
    ),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  district: z.string().min(1, "Select your district"),
  upazila: z.string().min(1, "Select your upazila / thana"),
  union: z.string().optional(),
  address: z
    .string()
    .trim()
    .min(5, "Enter house, road, village or area")
    .max(250, "Address is too long"),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Postal code must be 4 digits")
    .optional()
    .or(z.literal("")),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

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

  // Coupon: previewed against the cart subtotal; the server re-checks it when the order is placed
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<CouponPreview | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const discount = coupon?.discount ?? 0;
  const total = Math.max(subtotal - discount, 0);

  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setApplyingCoupon(true);
    setCouponError(null);
    try {
      const preview = await apiClient.post<CouponPreview>("/coupons/validate", { code, subtotal });
      setCoupon(preview);
      toast.success(`Coupon ${preview.code} applied`);
    } catch (e) {
      setCoupon(null);
      setCouponError(e instanceof ApiError ? e.message : "Could not apply coupon");
    } finally {
      setApplyingCoupon(false);
    }
  };

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      name: user?.name ?? "",
      email: "",
      district: "",
      upazila: "",
      union: "",
      postalCode: "",
    },
  });

  // District → upazila/thana → union dropdowns. The dataset is large, so it is
  // loaded only when the checkout page opens.
  const [districts, setDistricts] = useState<BdDistrict[] | null>(null);
  const [locationsError, setLocationsError] = useState(false);
  useEffect(() => {
    let alive = true;
    import("@/lib/bd-locations")
      .then((m) => alive && setDistricts(m.BD_DISTRICTS))
      .catch(() => alive && setLocationsError(true));
    return () => {
      alive = false;
    };
  }, []);

  const [districtName, upazilaName] = useWatch({ control, name: ["district", "upazila"] });
  const selectedDistrict = districts?.find((d) => d.name === districtName);
  const selectedUpazila = selectedDistrict?.upazilas.find((u) => u.name === upazilaName);
  const unions = selectedUpazila?.unions ?? [];

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
              className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
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

  const onSubmit = async (values: CheckoutForm) => {
    setSubmitting(true);
    setSubmitError(null);
    const location = {
      district: values.district,
      upazila: values.upazila,
      union: values.union || undefined,
      postalCode: values.postalCode || undefined,
    };
    const phone = normalizePhone(values.phone);
    try {
      let order: Order;
      if (isAuthenticated) {
        // Logged-in: backend reads the server cart.
        order = await apiClient.post<Order>("/orders", {
          shippingAddress: {
            name: values.name,
            phone,
            street: values.address,
            ...location,
            country: "Bangladesh",
          },
          couponCode: coupon?.code,
        });
      } else {
        // Guest: send cart items + contact info.
        order = await apiClient.post<Order>("/orders/guest", {
          name: values.name,
          phone,
          email: values.email || undefined,
          address: values.address,
          ...location,
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
          couponCode: coupon?.code,
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
      <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl sm:font-bold text-zinc-900">
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

        {/* Coupon */}
        <div className="mt-4 border-t border-zinc-200 pt-4">
          {coupon ? (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-primary-50 px-4 py-3 ring-1 ring-primary-200">
              <span className="flex items-center gap-2 text-sm font-semibold text-primary-700">
                <Tag className="h-4 w-4" />
                {coupon.code} applied · −{formatPrice(coupon.discount)}
              </span>
              <button
                type="button"
                onClick={() => {
                  setCoupon(null);
                  setCouponInput("");
                }}
                className="rounded-full p-1 text-zinc-500 hover:bg-white hover:text-zinc-800"
                aria-label="Remove coupon"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value.toUpperCase());
                    setCouponError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyCoupon();
                    }
                  }}
                  placeholder="Coupon code"
                  aria-label="Coupon code"
                  className={`${inputClass} uppercase`}
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={applyingCoupon || !couponInput.trim()}
                  className="shrink-0 rounded-xl bg-zinc-900 px-5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-40"
                >
                  {applyingCoupon ? "Checking…" : "Apply"}
                </button>
              </div>
              {couponError && <p className="mt-2 text-sm text-rose-600">{couponError}</p>}
            </>
          )}
        </div>
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
          {locationsError && (
            <p className="text-sm text-rose-600">
              Could not load the district list. Please refresh the page.
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="District" error={errors.district?.message} htmlFor="district">
              <select
                id="district"
                className={inputClass}
                disabled={!districts}
                {...register("district", {
                  onChange: () => {
                    setValue("upazila", "");
                    setValue("union", "");
                  },
                })}
              >
                <option value="">{districts ? "Select district" : "Loading…"}</option>
                {districts?.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Upazila / Thana"
              error={errors.upazila?.message}
              htmlFor="upazila"
            >
              <select
                id="upazila"
                className={inputClass}
                disabled={!selectedDistrict}
                {...register("upazila", { onChange: () => setValue("union", "") })}
              >
                <option value="">
                  {selectedDistrict ? "Select upazila / thana" : "Select a district first"}
                </option>
                {selectedDistrict?.upazilas.map((u) => (
                  <option key={u.name} value={u.name}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Union / Area (optional)"
              error={errors.union?.message}
              htmlFor="union"
            >
              <select
                id="union"
                className={inputClass}
                disabled={unions.length === 0}
                {...register("union")}
              >
                <option value="">
                  {!selectedUpazila
                    ? "Select an upazila first"
                    : unions.length
                      ? "Select union / area"
                      : "No unions listed"}
                </option>
                {unions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Postal code (optional)"
              error={errors.postalCode?.message}
              htmlFor="postalCode"
            >
              <input
                id="postalCode"
                className={inputClass}
                autoComplete="postal-code"
                placeholder="e.g. 3700"
                inputMode="numeric"
                maxLength={4}
                {...register("postalCode")}
              />
            </Field>
          </div>
          <Field
            label="House, road, village / area"
            error={errors.address?.message}
            htmlFor="address"
          >
            <textarea
              id="address"
              className={`${inputClass} min-h-20 resize-y`}
              autoComplete="street-address"
              placeholder="House 12, Road 5, Sakaripara, Ward 5"
              {...register("address")}
            />
          </Field>
          <Field label="Country" htmlFor="country">
            <input
              id="country"
              className={`${inputClass} bg-zinc-50 text-zinc-500`}
              value="Bangladesh"
              readOnly
              tabIndex={-1}
            />
          </Field>

          {/* Payment method: COD only */}
          <div>
            <p className="mb-2 text-sm font-medium text-zinc-700">
              Payment method
            </p>
            <div className="flex items-center gap-3 rounded-xl border-2 border-primary-600 bg-primary-50 px-4 py-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600">
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
              {discount > 0 && (
                <p className="text-xs text-zinc-500">
                  <span className="line-through">{formatPrice(subtotal)}</span>{" "}
                  <span className="font-semibold text-primary-700">−{formatPrice(discount)}</span>
                </p>
              )}
              <p className="text-sm text-zinc-500">Total (COD)</p>
              <p className="text-xl font-bold text-zinc-900">
                {formatPrice(total)}
              </p>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-primary-600 px-8 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40"
            >
              {submitting ? "Placing order…" : "Place order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
