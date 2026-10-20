"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, CheckCircle2, Minus, Plus, Tag, X } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useSiteSettings } from "@/lib/categories";
import { useCartStore, selectSubtotal } from "@/lib/store/cart";
import { useToast } from "@/lib/toast";
import { formatPrice, newIdempotencyKey } from "@/lib/utils";
import type { CouponPreview, Order } from "@/lib/types";
import type { BdDistrict } from "@/lib/bd-locations";
import { BackLink, EmptyState, Spinner } from "@/components/ui";

/**
 * Checkout: guest-friendly, cash on delivery.
 * - Billing details, optional account creation, optional separate delivery address.
 * - Delivery charge from Admin → Site settings: Dhaka district = inside Dhaka.
 *   Outside Dhaka the charge can be required in advance by bKash / Nagad, with the
 *   Transaction ID entered here; the rest is paid on delivery.
 * - Logged-in users order from their server cart (POST /orders), guests send the
 *   cart items (POST /orders/guest). The server recomputes every amount.
 */
const BD_MOBILE_REGEX = /^01[3-9]\d{8}$/;
const normalizePhone = (v: string) => v.replace(/[\s-]/g, "").replace(/^\+?88(?=01)/, "");
const isBdPhone = (v: string) => BD_MOBILE_REGEX.test(normalizePhone(v));

const checkoutSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name is too long"),
    phone: z.string().trim().refine(isBdPhone, "Enter a valid Bangladeshi mobile number (01XXXXXXXXX)"),
    address: z.string().trim().min(5, "Enter house, road, village or area").max(250, "Address is too long"),
    district: z.string().min(1, "Select your district"),
    upazila: z.string().min(1, "Select your upazila / thana"),
    email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
    createAccount: z.boolean(),
    password: z.string().optional(),
    shipDifferent: z.boolean(),
    shipName: z.string().trim().optional(),
    shipPhone: z.string().trim().optional(),
    shipAddress: z.string().trim().optional(),
    shipDistrict: z.string().optional(),
    shipUpazila: z.string().optional(),
    notes: z.string().trim().max(500, "Notes are too long").optional(),
    transactionId: z.string().trim().optional(),
    agree: z.boolean().refine((v) => v, "Please accept the terms to place your order"),
  })
  .superRefine((v, ctx) => {
    const need = (ok: boolean, path: string, message: string) => {
      if (!ok) ctx.addIssue({ code: "custom", path: [path], message });
    };
    if (v.createAccount) {
      need(!!v.email, "email", "Email is required to create an account");
      need(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(v.password ?? ""),
        "password",
        "At least 8 characters with upper- and lowercase letters and a number",
      );
    }
    if (v.shipDifferent) {
      need((v.shipName ?? "").length >= 2, "shipName", "Enter the recipient's name");
      need(isBdPhone(v.shipPhone ?? ""), "shipPhone", "Enter a valid Bangladeshi mobile number (01XXXXXXXXX)");
      need((v.shipAddress ?? "").length >= 5, "shipAddress", "Enter house, road, village or area");
      need(!!v.shipDistrict, "shipDistrict", "Select the district");
      need(!!v.shipUpazila, "shipUpazila", "Select the upazila / thana");
    }
  });

type CheckoutForm = z.infer<typeof checkoutSchema>;

const inputCls =
  "w-full rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 transition focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20 disabled:bg-zinc-50 disabled:text-zinc-400";
const cardCls = "rounded-3xl bg-zinc-100/80 p-5 sm:p-8";

/** ৯৯ instead of 99 for the Bangla payment note. */
const toBanglaDigits = (n: number) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);

function FormField({
  label,
  htmlFor,
  required,
  optional,
  error,
  className = "",
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm text-zinc-800">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
        {optional && <sup className="ml-1 text-[10px] text-zinc-400">(optional)</sup>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export default function CheckoutPage() {
  const { isLoading } = useAuth();
  const hydrated = useCartStore((s) => s.hydrated);

  if (isLoading || !hydrated) return <Spinner label="Loading checkout…" />;
  return (
    <Suspense fallback={<Spinner label="Loading checkout…" />}>
      <CheckoutContent />
    </Suspense>
  );
}

function CheckoutContent() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const addedName = searchParams.get("added");
  const { isAuthenticated, user, register: registerAccount } = useAuth();
  const settings = useSiteSettings().data;
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore(selectSubtotal);
  const setQty = useCartStore((s) => s.setQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clear);

  // One key per checkout attempt: a retry (say, after a timeout) resends it, so the server
  // returns the order it already placed instead of a duplicate. A changed cart is a new
  // attempt and gets a new key (as does the next order, once this cart is cleared).
  const idempotencyKey = useRef("");
  const cartSignature = items.map((i) => `${i.productId}:${i.quantity}`).join(",");
  useEffect(() => {
    idempotencyKey.current = newIdempotencyKey();
  }, [cartSignature]);
  // Stops a second submit that fires before the disabled button has re-rendered
  const submittingRef = useRef(false);

  // Coupon: previewed against the subtotal; the server re-checks it when the order is placed
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<CouponPreview | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const discount = coupon?.discount ?? 0;

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
    setError,
    control,
    formState: { errors },
  } = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      name: user?.name ?? "",
      phone: user?.phone ?? "",
      address: "",
      district: "",
      upazila: "",
      email: "",
      createAccount: false,
      password: "",
      shipDifferent: false,
      shipName: "",
      shipPhone: "",
      shipAddress: "",
      shipDistrict: "",
      shipUpazila: "",
      notes: "",
      transactionId: "",
      agree: false,
    },
  });

  // District → upazila lists; the dataset is large, so it loads with the page
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

  const [district, createAccount, shipDifferent, shipDistrict] = useWatch({
    control,
    name: ["district", "createAccount", "shipDifferent", "shipDistrict"],
  });
  const upazilasOf = (name?: string) => districts?.find((d) => d.name === name)?.upazilas ?? [];

  // Delivery: the district the parcel goes to decides the zone
  const deliveryDistrict = shipDifferent ? shipDistrict : district;
  const inside = deliveryDistrict === "Dhaka";
  const fee = deliveryDistrict
    ? inside
      ? (settings?.deliveryFeeInsideDhaka ?? 60)
      : (settings?.deliveryFeeOutsideDhaka ?? 99)
    : 0;
  const advanceNumbers = [
    settings?.bkashNumber && { label: "বিকাশ", number: settings.bkashNumber },
    settings?.nagadNumber && { label: "নগদ", number: settings.nagadNumber },
  ].filter(Boolean) as { label: string; number: string }[];
  const advance = !!deliveryDistrict && !inside && !!settings?.advanceOutsideDhaka && advanceNumbers.length > 0;
  const total = Math.max(subtotal - discount, 0) + fee;

  // ---- Success screen --------------------------------------------------
  if (placedOrder) {
    const paidAhead = placedOrder.transactionId ? (placedOrder.shippingFee ?? 0) : 0;
    return (
      <div className="mx-auto max-w-lg rounded-3xl bg-white p-8 text-center ring-1 ring-zinc-200">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-zinc-900">Order placed!</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Order <span className="font-mono font-semibold text-zinc-700">#{placedOrder.id.slice(0, 8).toUpperCase()}</span>{" "}
          is received.{" "}
          {paidAhead > 0
            ? `We'll confirm your ${formatPrice(paidAhead)} advance, then you pay ${formatPrice(placedOrder.totalAmount - paidAhead)} on delivery.`
            : `Pay ${formatPrice(placedOrder.totalAmount)} in cash on delivery.`}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          {isAuthenticated && (
            <button
              onClick={() => router.push(`/dashboard/orders`)}
              className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
            >
              View my orders
            </button>
          )}
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
    if (advance && !/^[A-Za-z0-9]{6,20}$/.test(values.transactionId ?? "")) {
      setError("transactionId", { message: "Enter the bKash / Nagad Transaction ID (6–20 letters or digits)" });
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    const phone = normalizePhone(values.phone);
    const delivery = values.shipDifferent
      ? {
          name: values.shipName!,
          phone: normalizePhone(values.shipPhone!),
          street: values.shipAddress!,
          district: values.shipDistrict!,
          upazila: values.shipUpazila!,
        }
      : { name: values.name, phone, street: values.address, district: values.district, upazila: values.upazila };
    const extras = {
      couponCode: coupon?.code,
      notes: values.notes || undefined,
      transactionId: advance ? values.transactionId : undefined,
      billingAddress: values.shipDifferent
        ? { name: values.name, phone, street: values.address, district: values.district }
        : undefined,
    };
    try {
      let asUser = isAuthenticated;
      if (!asUser && values.createAccount) {
        // Signs in and moves the cart to the new account; the order then comes from that cart
        await registerAccount(values.name, values.email!, values.password!);
        asUser = true;
      }
      const once = { headers: { "Idempotency-Key": idempotencyKey.current } };
      const order = asUser
        ? await apiClient.post<Order>(
            "/orders",
            { shippingAddress: { ...delivery, country: "Bangladesh" }, ...extras },
            once,
          )
        : await apiClient.post<Order>("/orders/guest", {
            name: delivery.name,
            phone: delivery.phone,
            email: values.email || undefined,
            address: delivery.street,
            district: delivery.district,
            upazila: delivery.upazila,
            items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
            ...extras,
          }, once);
      clearCart();
      setPlacedOrder(order);
      toast.success("Order placed successfully");
      window.scrollTo({ top: 0 });
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : "Failed to place order");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const districtSelect = (field: "district" | "shipDistrict", upazilaField: "upazila" | "shipUpazila") => (
    <select
      id={field}
      className={inputCls}
      disabled={!districts}
      {...register(field, { onChange: () => setValue(upazilaField, "") })}
    >
      <option value="">{districts ? "Select district" : "Loading…"}</option>
      {districts?.map((d) => (
        <option key={d.name} value={d.name}>
          {d.name}
        </option>
      ))}
    </select>
  );
  const upazilaSelect = (field: "upazila" | "shipUpazila", districtName?: string) => {
    const list = upazilasOf(districtName);
    return (
      <select id={field} className={inputCls} disabled={list.length === 0} {...register(field)}>
        <option value="">{districtName ? "Select upazila / thana" : "Select a district first"}</option>
        {list.map((u) => (
          <option key={u.name} value={u.name}>
            {u.name}
          </option>
        ))}
      </select>
    );
  };

  return (
    <div className="space-y-5">
      {addedName && (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-600 px-5 py-4 text-sm text-white shadow-sm">
          <Check className="h-5 w-5 shrink-0" />
          <p>
            <Link href="/products" className="mr-2 font-semibold underline underline-offset-2">
              Continue Shopping
            </Link>
            “{addedName}” has been added to your cart.
          </p>
        </div>
      )}

      <div className="space-y-2 text-sm text-zinc-800">
        <p>
          Have a coupon?{" "}
          <button type="button" onClick={() => setCouponOpen((o) => !o)} className="text-primary-600 underline underline-offset-2">
            Click here to enter your code
          </button>
        </p>
        {couponOpen && !coupon && (
          <div className="max-w-md">
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
                className={`${inputCls} uppercase`}
              />
              <button
                type="button"
                onClick={applyCoupon}
                disabled={applyingCoupon || !couponInput.trim()}
                className="shrink-0 rounded-full bg-zinc-900 px-5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-40"
              >
                {applyingCoupon ? "Checking…" : "Apply"}
              </button>
            </div>
            {couponError && <p className="mt-1.5 text-xs text-rose-600">{couponError}</p>}
          </div>
        )}
        {!isAuthenticated && (
          <p>
            Returning customer?{" "}
            <Link href="/login?next=/checkout" className="text-primary-600 underline underline-offset-2">
              Click here to login
            </Link>
          </p>
        )}
      </div>

      <form
        // handleSubmit runs in the event, not during render: onSubmit reads refs
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        noValidate
        className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)] lg:gap-7"
      >
        {/* Billing details */}
        <section className={`${cardCls} lg:col-start-1 lg:row-start-1`}>
          <h2 className="mb-5 text-xl font-semibold text-zinc-900 sm:text-2xl">Billing Details</h2>
          <div className="space-y-4">
            <FormField label="Full Name" htmlFor="name" required error={errors.name?.message} className="sm:w-1/2">
              <input id="name" autoComplete="name" className={inputCls} {...register("name")} />
            </FormField>
            <FormField label="Phone" htmlFor="phone" required error={errors.phone?.message}>
              <input id="phone" autoComplete="tel" inputMode="tel" placeholder="01XXXXXXXXX" className={inputCls} {...register("phone")} />
            </FormField>
            <FormField label="Full Address" htmlFor="address" required error={errors.address?.message}>
              <input
                id="address"
                autoComplete="street-address"
                placeholder="House, road, village / area, ward"
                className={inputCls}
                {...register("address")}
              />
            </FormField>
            {locationsError && <p className="text-sm text-rose-600">Could not load the district list. Please refresh the page.</p>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="District" htmlFor="district" required error={errors.district?.message}>
                {districtSelect("district", "upazila")}
              </FormField>
              <FormField label="Upazila / Thana" htmlFor="upazila" required error={errors.upazila?.message}>
                {upazilaSelect("upazila", district)}
              </FormField>
            </div>
            <FormField label="Country / Region" htmlFor="country" required>
              <select id="country" className={inputCls} defaultValue="Bangladesh" disabled>
                <option>Bangladesh</option>
              </select>
            </FormField>
            {!isAuthenticated && (
              <FormField label="Email address" htmlFor="email" optional={!createAccount} required={createAccount} error={errors.email?.message}>
                <input id="email" type="email" autoComplete="email" inputMode="email" className={inputCls} {...register("email")} />
              </FormField>
            )}

            {!isAuthenticated && (
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                  <input type="checkbox" className="h-4 w-4 accent-primary-600" {...register("createAccount")} />
                  Create an account?
                </label>
                {createAccount && (
                  <FormField label="Create account password" htmlFor="password" required error={errors.password?.message} className="mt-3">
                    <input id="password" type="password" autoComplete="new-password" className={inputCls} {...register("password")} />
                  </FormField>
                )}
              </div>
            )}

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <input type="checkbox" className="h-4 w-4 accent-primary-600" {...register("shipDifferent")} />
                Ship to a different address?
              </label>
              {shipDifferent && (
                <div className="mt-4 space-y-4 rounded-2xl bg-white/70 p-4 ring-1 ring-zinc-200">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField label="Recipient name" htmlFor="shipName" required error={errors.shipName?.message}>
                      <input id="shipName" className={inputCls} {...register("shipName")} />
                    </FormField>
                    <FormField label="Recipient phone" htmlFor="shipPhone" required error={errors.shipPhone?.message}>
                      <input id="shipPhone" inputMode="tel" placeholder="01XXXXXXXXX" className={inputCls} {...register("shipPhone")} />
                    </FormField>
                  </div>
                  <FormField label="Delivery address" htmlFor="shipAddress" required error={errors.shipAddress?.message}>
                    <input id="shipAddress" className={inputCls} {...register("shipAddress")} />
                  </FormField>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField label="District" htmlFor="shipDistrict" required error={errors.shipDistrict?.message}>
                      {districtSelect("shipDistrict", "shipUpazila")}
                    </FormField>
                    <FormField label="Upazila / Thana" htmlFor="shipUpazila" required error={errors.shipUpazila?.message}>
                      {upazilaSelect("shipUpazila", shipDistrict)}
                    </FormField>
                  </div>
                </div>
              )}
            </div>

            <FormField label="Order notes" htmlFor="notes" optional error={errors.notes?.message}>
              <textarea
                id="notes"
                rows={5}
                placeholder="Notes about your order, e.g. special notes for delivery."
                className={`${inputCls.replace("rounded-full", "rounded-none")} resize-y`}
                {...register("notes")}
              />
            </FormField>
          </div>
        </section>

        {/* Your order */}
        <section className={`${cardCls} lg:sticky lg:top-40 lg:col-start-2 lg:row-span-2 lg:row-start-1`}>
          <h2 className="mb-5 text-xl font-semibold text-zinc-900 sm:text-2xl">Your Order</h2>
          <div className="flex justify-between border-b border-zinc-300 pb-3 text-sm font-semibold text-zinc-900">
            <span>Product</span>
            <span>Subtotal</span>
          </div>
          <ul className="divide-y divide-zinc-200">
            {items.map((i) => (
              <li key={i.productId} className="flex items-center gap-3 py-4">
                <button
                  type="button"
                  onClick={() => removeItem(i.productId)}
                  aria-label={`Remove ${i.name}`}
                  className="shrink-0 rounded-full p-1 text-zinc-400 transition hover:bg-white hover:text-rose-600"
                >
                  <X className="h-4 w-4" />
                </button>
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
                  {i.imageUrl && <Image src={i.imageUrl} alt="" fill sizes="56px" className="object-contain p-1" />}
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/products/${i.slug}`} className="line-clamp-2 text-sm text-zinc-800 hover:text-primary-600">
                    {i.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-zinc-400">{formatPrice(i.price)} each</p>
                  <div className="mt-1.5 inline-flex items-center rounded-full bg-white ring-1 ring-zinc-200">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => setQty(i.productId, Math.max(1, i.quantity - 1))}
                      className="px-2 py-1 text-zinc-500 hover:text-primary-600"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-7 border-x border-zinc-200 text-center text-xs font-semibold">{i.quantity}</span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => setQty(i.productId, i.quantity + 1)}
                      className="px-2 py-1 text-zinc-500 hover:text-primary-600"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <span className="shrink-0 text-sm text-zinc-700">{formatPrice(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="divide-y divide-zinc-200 border-t border-zinc-300 text-sm">
            <div className="flex justify-between py-3.5">
              <span className="font-semibold text-zinc-900">Subtotal</span>
              <span className="font-semibold text-primary-600">{formatPrice(subtotal)}</span>
            </div>
            {coupon && (
              <div className="flex items-center justify-between gap-3 py-3.5">
                <span className="flex items-center gap-1.5 font-semibold text-zinc-900">
                  <Tag className="h-4 w-4 text-primary-600" />
                  Coupon <span className="font-mono">{coupon.code}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCoupon(null);
                      setCouponInput("");
                    }}
                    aria-label="Remove coupon"
                    className="rounded-full p-0.5 text-zinc-400 hover:text-rose-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
                <span className="font-semibold text-emerald-600">−{formatPrice(discount)}</span>
              </div>
            )}
            <div className="flex items-start justify-between gap-3 py-3.5">
              <span className="font-semibold text-zinc-900">Shipment</span>
              <span className="text-right text-zinc-700">
                {deliveryDistrict ? (
                  <>
                    {inside ? "Inside Dhaka" : "Outside Dhaka"} (Cash On Delivery):{" "}
                    <span className="font-semibold text-primary-600">{formatPrice(fee)}</span>
                  </>
                ) : (
                  <span className="text-zinc-400">Select your district</span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between py-4">
              <span className="font-semibold text-zinc-900">Total</span>
              <span className="text-xl font-bold text-primary-600">{formatPrice(total)}</span>
            </div>
          </div>
        </section>

        {/* Payment */}
        <section className={`${cardCls} lg:col-start-1 lg:row-start-2`}>
          <h2 className="mb-4 text-xl font-semibold text-zinc-900 sm:text-2xl">Payment Information</h2>
          <p className="mb-3 text-sm text-zinc-800">
            Cash On Delivery{deliveryDistrict ? ` (${inside ? "Inside Dhaka" : "Outside Dhaka"})` : ""}
          </p>
          {advance ? (
            <div className="space-y-3 rounded-2xl bg-white/70 p-4 text-sm leading-relaxed text-zinc-600 ring-1 ring-zinc-200 sm:p-5">
              <p>
                → ঢাকা শহরের বাইরে অর্ডার কনফার্ম করতে {toBanglaDigits(fee)} টাকা ডেলিভারি চার্জ অগ্রিম প্রদান করতে হবে।
              </p>
              <p>
                {advanceNumbers.map((n) => (
                  <span key={n.label} className="block">
                    {n.label} (Personal): <span className="font-semibold text-zinc-800">{n.number}</span>
                  </span>
                ))}
              </p>
              <p>
                অনুগ্রহ করে {toBanglaDigits(fee)} টাকা Send Money সম্পন্ন করে {advanceNumbers.map((n) => n.label).join(" / ")}{" "}
                Transaction ID নিচের বক্সে প্রদান করুন।
              </p>
              <p>→ Transaction ID ছাড়া অর্ডার কনফার্ম করা হবে না।</p>
              <p>→ বাকি টাকার পেমেন্ট পণ্য হাতে পাওয়ার সময় Cash on Delivery (COD) মাধ্যমে পরিশোধ করতে পারবেন।</p>
              <FormField label="Bkash / Nagad Transaction ID" htmlFor="transactionId" required error={errors.transactionId?.message}>
                <input id="transactionId" autoComplete="off" className={`${inputCls} uppercase`} {...register("transactionId")} />
              </FormField>
            </div>
          ) : (
            <p className="rounded-2xl bg-white/70 p-4 text-sm text-zinc-600 ring-1 ring-zinc-200">
              Pay the full amount in cash when your order arrives.
            </p>
          )}

          <p className="mt-5 border-t border-zinc-300 pt-5 text-sm leading-relaxed text-zinc-500">
            Your personal data will be used to process your order, support your experience throughout this website, and for
            other purposes described in our <span className="font-semibold text-zinc-800">privacy policy</span>.
          </p>

          <div className="mt-5 border-t border-zinc-300 pt-5">
            <label className="flex items-start gap-2 text-sm text-zinc-800">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary-600" {...register("agree")} />
              <span>
                Yes I have read and agree to the website{" "}
                <span className="font-semibold">terms and conditions, privacy policy, returns &amp; refunds</span>
                <span className="ml-0.5 text-rose-500">*</span>
              </span>
            </label>
            {errors.agree && <p className="mt-1 text-xs text-rose-600">{errors.agree.message}</p>}
          </div>

          {submitError && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{submitError}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 w-full rounded-xl bg-primary-600 px-6 py-3.5 text-sm font-semibold text-white shadow transition hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting ? "Placing order…" : "Place Order"}
          </button>
        </section>
      </form>
    </div>
  );
}
