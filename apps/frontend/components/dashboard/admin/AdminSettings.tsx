"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, PanelTop, TicketPercent, Truck } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useSiteSettings } from "@/lib/categories";
import type { SiteSettings } from "@/lib/types";
import { Card, CardHead, ErrorBox, Field, Loading, Switch } from "./kit";

export default function AdminSettings() {
  const settingsQuery = useSiteSettings();

  if (settingsQuery.isPending) return <Loading label="Loading settings…" />;
  if (settingsQuery.isError)
    return <ErrorBox message={(settingsQuery.error as Error).message} onRetry={() => settingsQuery.refetch()} />;

  // Keyed on the saved version so the forms reset after a save
  const key = JSON.stringify(settingsQuery.data);
  return (
    <>
      <TopbarForm key={`top-${key}`} initial={settingsQuery.data} />
      <DeliveryForm key={`del-${key}`} initial={settingsQuery.data} />
    </>
  );
}

const BD_MOBILE = /^01[3-9]\d{8}$/;

/** Checkout delivery charges and the bKash / Nagad numbers for advance payment. */
function DeliveryForm({ initial }: { initial: SiteSettings }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [inside, setInside] = useState(String(initial.deliveryFeeInsideDhaka));
  const [outside, setOutside] = useState(String(initial.deliveryFeeOutsideDhaka));
  const [advance, setAdvance] = useState(initial.advanceOutsideDhaka);
  const [bkash, setBkash] = useState(initial.bkashNumber);
  const [nagad, setNagad] = useState(initial.nagadNumber);

  const feeError = (v: string) => (/^\d{1,4}$/.test(v) && Number(v) <= 5000 ? undefined : "Whole taka, 0–5000");
  const numberError = (v: string) => (v === "" || BD_MOBILE.test(v) ? undefined : "Use 01XXXXXXXXX");
  const canSave = !feeError(inside) && !feeError(outside) && !numberError(bkash) && !numberError(nagad);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiClient.patch<SiteSettings>("/admin/settings", {
        deliveryFeeInsideDhaka: Number(inside),
        deliveryFeeOutsideDhaka: Number(outside),
        advanceOutsideDhaka: advance,
        bkashNumber: bkash.trim(),
        nagadNumber: nagad.trim(),
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(["site-settings"], saved);
      toast.success("Delivery & payment saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section style={{ marginTop: 18 }}>
      <Card>
        <CardHead title="Delivery & payment" icon={<Truck />} />
        <div className="form-2col">
          <Field label="Delivery charge — inside Dhaka (৳)" error={feeError(inside)}>
            <input type="number" min={0} value={inside} onChange={(e) => setInside(e.target.value)} />
          </Field>
          <Field label="Delivery charge — outside Dhaka (৳)" error={feeError(outside)}>
            <input type="number" min={0} value={outside} onChange={(e) => setOutside(e.target.value)} />
          </Field>
        </div>

        <div className="toggle-row mb">
          <div>
            <div className="t-title">Advance delivery charge outside Dhaka</div>
            <div className="t-desc">
              Customers outside Dhaka send the delivery charge by bKash / Nagad and enter the Transaction ID; the rest is
              cash on delivery. Needs at least one number below.
            </div>
          </div>
          <Switch label="Advance delivery charge outside Dhaka" checked={advance} onChange={setAdvance} />
        </div>

        <div className="form-2col">
          <Field label="bKash number (Personal)" error={numberError(bkash)}>
            <input className="mono" value={bkash} maxLength={11} onChange={(e) => setBkash(e.target.value.trim())} placeholder="01XXXXXXXXX" />
          </Field>
          <Field label="Nagad number (Personal)" error={numberError(nagad)}>
            <input className="mono" value={nagad} maxLength={11} onChange={(e) => setNagad(e.target.value.trim())} placeholder="01XXXXXXXXX" />
          </Field>
        </div>

        <button className="btn block" disabled={!canSave || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          {saveMutation.isPending ? "Saving…" : "Save delivery & payment"}
        </button>
      </Card>
    </section>
  );
}

function TopbarForm({ initial }: { initial: SiteSettings }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SiteSettings>(initial);
  const set = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const saveMutation = useMutation({
    mutationFn: (values: SiteSettings) =>
      apiClient.patch<SiteSettings>("/admin/settings", {
        topbarEnabled: values.topbarEnabled,
        topbarLeftTitle: values.topbarLeftTitle,
        topbarLeftText: values.topbarLeftText,
        topbarLeftLink: values.topbarLeftLink,
        announcement: values.announcement,
        announcementLink: values.announcementLink,
        supportPhone: values.supportPhone,
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(["site-settings"], saved);
      toast.success("Top bar saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const linkOk = (v: string) => v === "" || v.startsWith("/") || /^https?:\/\//.test(v);
  const linkError = (v: string) => (linkOk(v) ? undefined : "Start with / (site page) or https://");
  const canSave = linkOk(form.topbarLeftLink) && linkOk(form.announcementLink);

  return (
    <section>
      <Card>
        <CardHead title="Top bar" icon={<PanelTop />} />

        {/* Live preview */}
        <div
          style={{
            background: "#ff5c38",
            color: "#fff",
            borderRadius: 10,
            padding: "9px 16px",
            fontSize: 13,
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            gap: 16,
            alignItems: "center",
            opacity: form.topbarEnabled ? 1 : 0.4,
            marginBottom: 18,
          }}
          aria-label="Top bar preview"
        >
          <span style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", minWidth: 0 }}>
            <b>{form.topbarLeftTitle}</b>
            {form.topbarLeftText && (
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>— {form.topbarLeftText}</span>
            )}
            {form.topbarLeftTitle && <ArrowRight size={13} style={{ flexShrink: 0 }} />}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 500, whiteSpace: "nowrap" }}>
            {form.announcement && (
              <>
                <TicketPercent size={13} /> {form.announcement}
              </>
            )}
          </span>
          <span style={{ textAlign: "right", whiteSpace: "nowrap" }}>
            {form.supportPhone && (
              <>
                Customer Support: <b>{form.supportPhone}</b>
              </>
            )}
          </span>
        </div>

        <div className="toggle-row mb">
          <div>
            <div className="t-title">Show top bar</div>
            <div className="t-desc">Off hides the whole bar above the navbar</div>
          </div>
          <Switch label="Show top bar" checked={form.topbarEnabled} onChange={(v) => set("topbarEnabled", v)} />
        </div>

        <Field label="Coupon / announcement (center — leave empty to hide)">
          <input
            value={form.announcement}
            maxLength={120}
            onChange={(e) => set("announcement", e.target.value)}
            placeholder="Use code EID10 for 10% off all audio"
          />
        </Field>
        <Field label="Announcement link (optional)" error={linkError(form.announcementLink)}>
          <input
            className="mono"
            value={form.announcementLink}
            maxLength={300}
            onChange={(e) => set("announcementLink", e.target.value)}
            placeholder="/products?category=audio"
          />
        </Field>

        <div className="form-2col">
          <Field label="Left title">
            <input
              value={form.topbarLeftTitle}
              maxLength={60}
              onChange={(e) => set("topbarLeftTitle", e.target.value)}
              placeholder="Corporate & Wholesale"
            />
          </Field>
          <Field label="Left text">
            <input
              value={form.topbarLeftText}
              maxLength={80}
              onChange={(e) => set("topbarLeftText", e.target.value)}
              placeholder="Get Special Business Pricing"
            />
          </Field>
        </div>
        <div className="form-2col">
          <Field label="Left link" error={linkError(form.topbarLeftLink)}>
            <input
              className="mono"
              value={form.topbarLeftLink}
              maxLength={300}
              onChange={(e) => set("topbarLeftLink", e.target.value)}
              placeholder="/help"
            />
          </Field>
          <Field label="Support phone (right)">
            <input
              value={form.supportPhone}
              maxLength={30}
              onChange={(e) => set("supportPhone", e.target.value)}
              placeholder="+880 1521-334138"
            />
          </Field>
        </div>

        <button
          className="btn block"
          disabled={!canSave || saveMutation.isPending}
          onClick={() => saveMutation.mutate(form)}
        >
          {saveMutation.isPending ? "Saving…" : "Save top bar"}
        </button>
      </Card>
    </section>
  );
}
