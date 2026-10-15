"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/lib/toast";
import type { Coupon } from "@/lib/types";
import {
  Card,
  CardHead,
  ErrorBox,
  Field,
  Kpi,
  Loading,
  Modal,
  Switch,
  bdNumber,
  matchesSearch,
  useAdminSearch,
} from "./kit";

const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{3,30}$/, "3–30 letters, numbers, - or _"),
    type: z.enum(["PERCENT", "FLAT"]),
    value: z.number().positive("Must be more than 0"),
    minOrder: z.string().optional(),
    maxUses: z.string().optional(),
    expiresAt: z.string().optional(),
  })
  .refine((v) => v.type !== "PERCENT" || v.value <= 100, {
    message: "A percent discount cannot exceed 100",
    path: ["value"],
  });

type CouponForm = z.infer<typeof couponSchema>;

function expiryLabel(c: Coupon) {
  if (!c.expiresAt) return "No expiry";
  const d = new Date(c.expiresAt);
  const text = d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  return d < new Date() ? `Expired ${text}` : `Expires ${text}`;
}

function isExpired(c: Coupon) {
  return Boolean(c.expiresAt && new Date(c.expiresAt) < new Date());
}

export default function AdminDiscounts() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const search = useAdminSearch();
  const [editing, setEditing] = useState<Coupon | "new" | null>(null);
  // Reference time for "expiring soon", fixed for this visit
  const [now] = useState(() => Date.now());

  const couponsQuery = useQuery({
    queryKey: ["admin", "coupons"],
    queryFn: () => apiClient.get<Coupon[]>("/admin/coupons"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch<Coupon>(`/admin/coupons/${id}`, { isActive }),
    onSuccess: (c) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "coupons"] });
      toast.success(`Coupon ${c.code} ${c.isActive ? "activated" : "paused"}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.del<{ deleted: boolean }>(`/admin/coupons/${id}`),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "coupons"] });
      toast.success(r.deleted ? "Coupon deleted" : "Coupon has been used, so it was deactivated instead");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (couponsQuery.isPending) return <Loading label="Loading coupons…" />;
  if (couponsQuery.isError)
    return <ErrorBox message={(couponsQuery.error as Error).message} onRetry={() => couponsQuery.refetch()} />;

  const coupons = couponsQuery.data;
  const live = coupons.filter((c) => c.isActive && !isExpired(c));
  const redemptions = coupons.reduce((n, c) => n + c.usedCount, 0);
  const discountGiven = coupons.reduce((n, c) => n + (c.totalDiscount ?? 0), 0);
  const soon = live.filter(
    (c) => c.expiresAt && new Date(c.expiresAt).getTime() - now < 7 * 24 * 60 * 60 * 1000,
  );
  const rows = coupons.filter((c) => matchesSearch(search, c.code));

  return (
    <section>
      <div className="grid kpi-grid">
        <Kpi
          label="Active coupons"
          value={bdNumber(live.length)}
          sub={`${live.filter((c) => c.type === "PERCENT").length} percent · ${live.filter((c) => c.type === "FLAT").length} flat`}
        />
        <Kpi label="Total redemptions" value={bdNumber(redemptions)} sub="Orders that used a coupon" />
        <Kpi label="Discount given" currency value={bdNumber(discountGiven)} sub="On non-cancelled orders" />
        <Kpi
          label="Expiring soon"
          value={bdNumber(soon.length)}
          sub="Within 7 days"
          pill={soon.length > 0 ? { text: "REVIEW", tone: "warn" } : undefined}
        />
      </div>

      <Card>
        <CardHead
          title="Coupons & promotions"
          right={
            <button className="btn sm" onClick={() => setEditing("new")}>
              <Plus />
              Create Coupon
            </button>
          }
        />
        {rows.length === 0 ? (
          <div className="empty">
            {coupons.length === 0 ? "No coupons yet. Create one and customers can apply it at checkout." : "No coupons match"}
          </div>
        ) : (
          <div className="coupon-grid">
            {rows.map((c) => {
              const pct = c.maxUses ? Math.min(100, (c.usedCount / c.maxUses) * 100) : 0;
              const expired = isExpired(c);
              return (
                <div className={`card soft coupon-card${!c.isActive || expired ? " off" : ""}`} key={c.id}>
                  <div className="coupon-top">
                    <div>
                      <div className="coupon-code">{c.code}</div>
                      <div className="muted" style={{ fontSize: 11.5 }}>
                        {c.type === "PERCENT" ? "Percent discount" : "Flat discount"} · {expiryLabel(c)}
                      </div>
                    </div>
                    <Switch
                      label={c.isActive ? `Pause ${c.code}` : `Activate ${c.code}`}
                      checked={c.isActive}
                      disabled={toggleMutation.isPending}
                      onChange={(next) => toggleMutation.mutate({ id: c.id, isActive: next })}
                    />
                  </div>
                  <div className="coupon-val">
                    {c.type === "PERCENT" ? `${c.value}%` : `৳${bdNumber(c.value)}`}{" "}
                    <span>
                      off{c.minOrder ? ` · min order ৳${bdNumber(c.minOrder)}` : " entire order"}
                    </span>
                  </div>
                  <div>
                    <div className="usage-row">
                      <span>Usage</span>
                      <span style={{ marginLeft: "auto", fontWeight: 700 }}>
                        {bdNumber(c.usedCount)} / {c.maxUses ? bdNumber(c.maxUses) : "∞"}
                      </span>
                    </div>
                    <div className="hbar-track" style={{ marginTop: 6 }}>
                      <div className="hbar-fill" style={{ width: `${c.maxUses ? pct : c.usedCount > 0 ? 100 : 0}%` }} />
                    </div>
                  </div>
                  <div className="coupon-actions">
                    <button className="btn sm ghost" onClick={() => setEditing(c)}>
                      <Pencil />
                      Edit
                    </button>
                    <button
                      className="btn sm danger"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        const msg =
                          c.usedCount > 0
                            ? `"${c.code}" has been used, so it will be deactivated instead of deleted. Continue?`
                            : `Delete coupon "${c.code}"?`;
                        if (window.confirm(msg)) deleteMutation.mutate(c.id);
                      }}
                    >
                      <Trash2 />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {editing && <CouponModal coupon={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function CouponModal({ coupon, onClose }: { coupon: Coupon | null; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CouponForm>({
    resolver: zodResolver(couponSchema),
    defaultValues: coupon
      ? {
          code: coupon.code,
          type: coupon.type,
          value: coupon.value,
          minOrder: coupon.minOrder != null ? String(coupon.minOrder) : "",
          maxUses: coupon.maxUses != null ? String(coupon.maxUses) : "",
          expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 10) : "",
        }
      : { code: "", type: "PERCENT", minOrder: "", maxUses: "", expiresAt: "" },
  });

  const saveMutation = useMutation({
    mutationFn: (v: CouponForm) => {
      const body = {
        code: v.code.toUpperCase(),
        type: v.type,
        value: v.value,
        // When editing, an emptied field means "no limit", so send null to clear it
        minOrder: v.minOrder?.trim() ? Number(v.minOrder) : coupon ? null : undefined,
        maxUses: v.maxUses?.trim() ? parseInt(v.maxUses, 10) : coupon ? null : undefined,
        expiresAt: v.expiresAt?.trim() || (coupon ? null : undefined),
      };
      return coupon
        ? apiClient.patch<Coupon>(`/admin/coupons/${coupon.id}`, body)
        : apiClient.post<Coupon>("/admin/coupons", body);
    },
    onSuccess: (c) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "coupons"] });
      toast.success(coupon ? `Coupon ${c.code} saved` : `Coupon ${c.code} created`);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal title={coupon ? `Edit coupon — ${coupon.code}` : "Create Coupon"} onClose={onClose}>
      <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))} noValidate>
        <div className="form-2col">
          <Field label="Coupon code" error={errors.code?.message}>
            <input {...register("code")} placeholder="EID15" style={{ textTransform: "uppercase" }} />
          </Field>
          <Field label="Type" error={errors.type?.message}>
            <select {...register("type")}>
              <option value="PERCENT">Percent (%)</option>
              <option value="FLAT">Flat (৳)</option>
            </select>
          </Field>
        </div>
        <div className="form-2col">
          <Field label="Value" error={errors.value?.message}>
            <input type="number" min={1} step="0.01" {...register("value", { valueAsNumber: true })} placeholder="15" />
          </Field>
          <Field label="Minimum order (৳)" error={errors.minOrder?.message}>
            <input type="number" min={0} {...register("minOrder")} placeholder="Optional" />
          </Field>
        </div>
        <div className="form-2col">
          <Field label="Usage limit" error={errors.maxUses?.message}>
            <input type="number" min={1} {...register("maxUses")} placeholder="Unlimited" />
          </Field>
          <Field label="Expiry date" error={errors.expiresAt?.message}>
            <input type="date" {...register("expiresAt")} />
          </Field>
        </div>
        <button type="submit" className="btn block" disabled={isSubmitting || saveMutation.isPending}>
          {saveMutation.isPending ? "Saving…" : coupon ? "Save Coupon" : "Create Coupon"}
        </button>
      </form>
    </Modal>
  );
}
