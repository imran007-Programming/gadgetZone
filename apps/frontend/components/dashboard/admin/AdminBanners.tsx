"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ImagePlus, Link2, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { CACHE_TAGS, STOREFRONT_REFRESH_FAILED, revalidateCache } from "@/lib/cache-tags";
import { useObjectUrl } from "@/lib/use-object-urls";
import { buildCategoryTree } from "@/lib/categories";
import type { AdminBanner, Category } from "@/lib/types";
import { BannerSlide } from "@/components/BannerCarousel";
import {
  Badge,
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
import { ProductThumb, useAdminProducts } from "./AdminProducts";

const UPLOAD_TIMEOUT_MS = 2 * 60 * 1000;

type BannerState = "live" | "scheduled" | "ended" | "hidden";

function bannerState(b: AdminBanner, now = new Date()): BannerState {
  if (!b.isActive) return "hidden";
  if (b.endsAt && new Date(b.endsAt) < now) return "ended";
  if (b.startsAt && new Date(b.startsAt) > now) return "scheduled";
  return "live";
}

function StateBadge({ banner }: { banner: AdminBanner }) {
  const state = bannerState(banner);
  if (state === "live") return <Badge tone="green">Live</Badge>;
  if (state === "scheduled") return <Badge tone="blue">Scheduled</Badge>;
  if (state === "ended") return <Badge tone="red">Ended</Badge>;
  return <Badge tone="neutral">Hidden</Badge>;
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

function scheduleText(b: AdminBanner) {
  if (b.startsAt && b.endsAt) return `${fmtDate(b.startsAt)} → ${fmtDate(b.endsAt)}`;
  if (b.startsAt) return `From ${fmtDate(b.startsAt)}`;
  if (b.endsAt) return `Until ${fmtDate(b.endsAt)}`;
  return "Always on";
}

/** Where a click on this banner goes, for the list. */
function linkText(b: AdminBanner) {
  if (b.product) return b.product.isActive ? `→ ${b.product.name}` : `→ ${b.product.name} (inactive product)`;
  if (b.ctaHref) return `→ ${b.ctaHref}`;
  return "Not clickable";
}

export default function AdminBanners() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const search = useAdminSearch();
  const [editing, setEditing] = useState<AdminBanner | "new" | null>(null);

  const bannersQuery = useQuery({
    queryKey: ["admin", "banners"],
    queryFn: () => apiClient.get<AdminBanner[]>("/admin/banners"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "banners"] });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch<AdminBanner>(`/admin/banners/${id}`, { isActive }),
    onSuccess: async (b) => {
      invalidate();
      toast.success(b.isActive ? `"${b.title}" is visible` : `"${b.title}" hidden`);
      if (!(await revalidateCache(CACHE_TAGS.banners))) toast.error(STOREFRONT_REFRESH_FAILED);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => apiClient.patch<AdminBanner[]>("/admin/banners/reorder", { ids }),
    onSuccess: async (list) => {
      queryClient.setQueryData(["admin", "banners"], list);
      if (!(await revalidateCache(CACHE_TAGS.banners))) toast.error(STOREFRONT_REFRESH_FAILED);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.del(`/admin/banners/${id}`),
    onSuccess: async () => {
      invalidate();
      toast.success("Banner deleted");
      if (!(await revalidateCache(CACHE_TAGS.banners))) toast.error(STOREFRONT_REFRESH_FAILED);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (bannersQuery.isPending) return <Loading label="Loading banners…" />;
  if (bannersQuery.isError)
    return <ErrorBox message={(bannersQuery.error as Error).message} onRetry={() => bannersQuery.refetch()} />;

  const banners = bannersQuery.data;
  const counts = banners.reduce(
    (acc, b) => ({ ...acc, [bannerState(b)]: acc[bannerState(b)] + 1 }),
    { live: 0, scheduled: 0, ended: 0, hidden: 0 } as Record<BannerState, number>,
  );
  const rows = banners.filter((b) => matchesSearch(search, b.title, b.product?.name, b.ctaHref));

  const move = (id: string, dir: -1 | 1) => {
    const ids = banners.map((b) => b.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorderMutation.mutate(ids);
  };

  return (
    <section>
      <div className="grid kpi-grid">
        <Kpi label="Total banners" value={bdNumber(banners.length)} sub="In the carousel list" />
        <Kpi label="Live now" value={bdNumber(counts.live)} sub="Showing on the homepage" />
        <Kpi
          label="Linked to products"
          value={bdNumber(banners.filter((b) => b.product).length)}
          sub="Click opens a product page"
        />
        <Kpi
          label="Hidden / ended"
          value={bdNumber(counts.hidden + counts.ended)}
          sub="Not shown to customers"
          pill={counts.live === 0 ? { text: "NO LIVE BANNER", tone: "warn" } : undefined}
        />
      </div>

      <Card>
        <CardHead
          title="Homepage banners"
          right={
            <button className="btn sm" onClick={() => setEditing("new")}>
              <Plus />
              Add Banner
            </button>
          }
        />
        {rows.length === 0 ? (
          <div className="empty">
            {banners.length === 0 ? "No banners yet. Add one to fill the homepage carousel." : "No banners match"}
          </div>
        ) : (
          rows.map((b) => {
            const index = banners.findIndex((x) => x.id === b.id);
            return (
              <div className="banner-row" key={b.id}>
                <div className="banner-thumb">
                  <Image src={b.imageUrl} alt="" fill sizes="140px" style={{ objectFit: "cover" }} />
                </div>
                <div className="b-info">
                  <div className="b-title">
                    {b.title} <StateBadge banner={b} />
                  </div>
                  <div className="b-sub">
                    {linkText(b)} · {scheduleText(b)}
                  </div>
                </div>
                <div className="b-actions">
                  <button
                    className="btn sm ghost"
                    aria-label="Move up"
                    disabled={index === 0 || reorderMutation.isPending || Boolean(search)}
                    onClick={() => move(b.id, -1)}
                  >
                    <ArrowUp />
                  </button>
                  <button
                    className="btn sm ghost"
                    aria-label="Move down"
                    disabled={index === banners.length - 1 || reorderMutation.isPending || Boolean(search)}
                    onClick={() => move(b.id, 1)}
                  >
                    <ArrowDown />
                  </button>
                  <Switch
                    label={b.isActive ? `Hide ${b.title}` : `Show ${b.title}`}
                    checked={b.isActive}
                    disabled={toggleMutation.isPending}
                    onChange={(next) => toggleMutation.mutate({ id: b.id, isActive: next })}
                  />
                  <button className="btn sm ghost" onClick={() => setEditing(b)}>
                    <Pencil />
                    Edit
                  </button>
                  <button
                    className="btn sm danger"
                    aria-label="Delete banner"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (window.confirm(`Delete banner "${b.title}"? Its image will be removed from Cloudinary.`))
                        deleteMutation.mutate(b.id);
                    }}
                  >
                    <Trash2 />
                  </button>
                </div>
              </div>
            );
          })
        )}
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
          Banners show only the image; clicking one opens its linked product. Use the arrows to reorder and the switch to
          hide a banner without deleting it.
        </p>
      </Card>

      {editing && <BannerEditor banner={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Create / edit modal                                                 */
/* ------------------------------------------------------------------ */

type LinkMode = "product" | "custom";

function BannerEditor({ banner, onClose }: { banner: AdminBanner | null; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(banner?.title ?? "");
  const [mode, setMode] = useState<LinkMode>(banner && !banner.productId && banner.ctaHref ? "custom" : "product");
  const [productId, setProductId] = useState(banner?.productId ?? "");
  const [productSearch, setProductSearch] = useState("");
  const [customHref, setCustomHref] = useState(banner?.ctaHref ?? "");
  const [startsAt, setStartsAt] = useState(banner?.startsAt?.slice(0, 10) ?? "");
  const [endsAt, setEndsAt] = useState(banner?.endsAt?.slice(0, 10) ?? "");
  const [isActive, setIsActive] = useState(banner?.isActive ?? true);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const productsQuery = useAdminProducts();
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiClient.get<Category[]>("/categories"),
  });

  // Local preview of a newly picked image
  const preview = useObjectUrl(file);

  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const selected = products.find((p) => p.id === productId) ?? null;
  const matches = useMemo(
    () => products.filter((p) => matchesSearch(productSearch, p.name, p.slug, p.category?.name)).slice(0, 8),
    [products, productSearch],
  );
  const imageUrl = preview ?? banner?.imageUrl ?? "";

  const saveMutation = useMutation({
    mutationFn: async () => {
      let image: { url: string; publicId: string } | null = null;
      if (file) {
        const body = new FormData();
        body.append("image", file);
        image = await apiClient.post<{ url: string; publicId: string }>("/admin/banners/upload", body, {
          timeoutMs: UPLOAD_TIMEOUT_MS,
        });
      }
      const payload = {
        title: title.trim(),
        productId: mode === "product" ? productId || null : null,
        ctaHref: mode === "custom" ? customHref.trim() || null : null,
        isActive,
        startsAt: startsAt || null,
        endsAt: endsAt || null,
        ...(image && { imageUrl: image.url, publicId: image.publicId }),
      };
      return banner
        ? apiClient.patch<AdminBanner>(`/admin/banners/${banner.id}`, payload)
        : apiClient.post<AdminBanner>("/admin/banners", payload);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "banners"] });
      toast.success(banner ? "Banner saved" : "Banner added to the carousel");
      onClose();
      if (!(await revalidateCache(CACHE_TAGS.banners))) toast.error(STOREFRONT_REFRESH_FAILED);
    },
    onError: (e: Error) => setError(e.message),
  });

  const submit = () => {
    setError(null);
    if (!banner && !file) return setError("Choose an image for the banner");
    if (!title.trim()) return setError("Give the banner a name");
    if (mode === "product" && !productId) return setError("Choose the product this banner opens");
    if (mode === "custom" && customHref.trim() && !/^(\/|https?:\/\/)/.test(customHref.trim()))
      return setError('Link must start with "/" or http(s)://');
    if (startsAt && endsAt && endsAt < startsAt) return setError("End date must be on or after the start date");
    saveMutation.mutate();
  };

  return (
    <Modal title={banner ? `Edit banner — ${banner.title}` : "Add Banner"} onClose={onClose} wide>
      <div className="banner-preview mb">
        <BannerSlide preview banner={{ imageUrl, title: title || "Banner", href: null }} />
      </div>
      <p className="faint mb" style={{ fontSize: 11.5 }}>
        Preview — the homepage shows only this image. Use a wide image (about 2100 × 900 px) with any text designed into it.
      </p>

      <label className="dropzone mb">
        <ImagePlus size={16} />
        {file ? `Selected: ${file.name}` : banner ? "Replace image" : "Choose banner image (JPG, PNG, WebP · up to 8 MB)"}
        <input
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const picked = e.target.files?.[0];
            if (picked && picked.type.startsWith("image/")) {
              setFile(picked);
              // Default the name from the file so the form is quick to fill
              if (!title.trim()) setTitle(picked.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
            }
            e.target.value = "";
          }}
        />
      </label>

      <Field label="Banner name (internal, also the image alt text)">
        <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Sony XM5 launch" />
      </Field>

      <div className="field">
        <label>Clicking the banner opens</label>
        <div className="chips">
          <button type="button" className={`chip${mode === "product" ? " active" : ""}`} onClick={() => setMode("product")}>
            <Package size={13} style={{ display: "inline", marginRight: 6, verticalAlign: -2 }} />
            A product
          </button>
          <button type="button" className={`chip${mode === "custom" ? " active" : ""}`} onClick={() => setMode("custom")}>
            <Link2 size={13} style={{ display: "inline", marginRight: 6, verticalAlign: -2 }} />
            Custom link
          </button>
        </div>
      </div>

      {mode === "product" ? (
        <div className="field">
          {selected ? (
            <div className="card soft" style={{ display: "flex", alignItems: "center", gap: 12, padding: 12 }}>
              <ProductThumb product={selected} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{selected.name}</div>
                <div className="faint mono" style={{ fontSize: 11.5 }}>
                  /products/{selected.slug}
                  {!selected.isActive && " · inactive — banner will not be clickable"}
                </div>
              </div>
              <button type="button" className="btn sm ghost" onClick={() => setProductId("")}>
                Change
              </button>
            </div>
          ) : (
            <>
              <input
                className="input"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products by name or category…"
                autoFocus
              />
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                {productsQuery.isPending ? (
                  <div className="faint" style={{ fontSize: 12.5 }}>
                    Loading products…
                  </div>
                ) : matches.length === 0 ? (
                  <div className="faint" style={{ fontSize: 12.5 }}>
                    No products match
                  </div>
                ) : (
                  matches.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      className="nav-item"
                      style={{ padding: "8px 10px" }}
                      onClick={() => {
                        setProductId(p.id);
                        if (!title.trim()) setTitle(p.name);
                      }}
                    >
                      <ProductThumb product={p} />
                      <span style={{ flex: 1 }}>
                        {p.name}
                        <span className="faint" style={{ display: "block", fontSize: 11 }}>
                          {p.category?.name}
                          {!p.isActive && " · inactive"}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <Field label="Link">
          <input
            value={customHref}
            onChange={(e) => setCustomHref(e.target.value)}
            placeholder="/products?category=audio"
            list="banner-links"
          />
          <datalist id="banner-links">
            <option value="/products">All products</option>
            {buildCategoryTree(categoriesQuery.data ?? []).flatMap((c) => [
              <option key={c.id} value={`/products?category=${c.slug}`}>
                {c.name}
              </option>,
              ...c.children.map((sub) => (
                <option key={sub.id} value={`/products?category=${sub.slug}`}>
                  {`${c.name} › ${sub.name}`}
                </option>
              )),
            ])}
          </datalist>
        </Field>
      )}

      <div className="form-2col">
        <Field label="Show from (optional)">
          <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </Field>
        <Field label="Show until (optional)">
          <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </Field>
      </div>
      <div className="toggle-row mb">
        <div>
          <div className="t-title">Visible</div>
          <div className="t-desc">Off keeps the banner saved but hidden from the homepage</div>
        </div>
        <Switch label="Visible" checked={isActive} onChange={setIsActive} />
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: 12.5, marginBottom: 12 }}>{error}</p>}
      <button className="btn block" disabled={saveMutation.isPending} onClick={submit}>
        {saveMutation.isPending ? (file ? "Uploading…" : "Saving…") : banner ? "Save banner" : "Add banner"}
      </button>
    </Modal>
  );
}
