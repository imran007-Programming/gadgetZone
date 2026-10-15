"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useObjectUrl } from "@/lib/use-object-urls";
import type { AdminBrand } from "@/lib/types";
import { Card, CardHead, ErrorBox, Field, Kpi, Loading, Modal, Switch, bdNumber, matchesSearch, useAdminSearch } from "./kit";
import { useAdminProducts } from "./AdminProducts";

const UPLOAD_TIMEOUT_MS = 2 * 60 * 1000;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Logo image, or the brand initials when there is no logo. */
export function BrandMark({ brand, size = 44 }: { brand: { name: string; logoUrl: string | null }; size?: number }) {
  const initials = brand.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div className="brand-mark" style={{ width: size, height: size }}>
      {brand.logoUrl ? (
        <Image src={brand.logoUrl} alt="" fill sizes={`${size}px`} style={{ objectFit: "contain" }} />
      ) : (
        initials
      )}
    </div>
  );
}

export function useAdminBrands() {
  return useQuery({
    queryKey: ["admin", "brands"],
    queryFn: () => apiClient.get<AdminBrand[]>("/admin/brands"),
  });
}

export default function AdminBrands() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const search = useAdminSearch();
  const [editing, setEditing] = useState<AdminBrand | "new" | null>(null);

  const brandsQuery = useAdminBrands();
  const productsQuery = useAdminProducts();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "brands"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    queryClient.invalidateQueries({ queryKey: ["brands"] });
  };

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch<AdminBrand>(`/admin/brands/${id}`, { isActive }),
    onSuccess: (b) => {
      invalidate();
      toast.success(b.isActive ? `${b.name} is visible in the store` : `${b.name} hidden from the store`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.del(`/admin/brands/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success("Brand deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (brandsQuery.isPending) return <Loading label="Loading brands…" />;
  if (brandsQuery.isError)
    return <ErrorBox message={(brandsQuery.error as Error).message} onRetry={() => brandsQuery.refetch()} />;

  const brands = brandsQuery.data;
  const unbranded = (productsQuery.data ?? []).filter((p) => !p.brandId).length;
  const rows = brands.filter((b) => matchesSearch(search, b.name, b.slug, b.description));

  return (
    <section>
      <div className="grid kpi-grid">
        <Kpi label="Brands" value={bdNumber(brands.length)} sub={`${brands.filter((b) => b.isActive).length} active`} />
        <Kpi
          label="Branded products"
          value={bdNumber(brands.reduce((n, b) => n + b.productCount, 0))}
          sub="Products with a brand"
        />
        <Kpi label="With logo" value={bdNumber(brands.filter((b) => b.logoUrl).length)} sub="Others show initials" />
        <Kpi
          label="No brand"
          value={bdNumber(unbranded)}
          sub="Products without a brand"
          pill={unbranded > 0 ? { text: "ASSIGN", tone: "warn" } : undefined}
        />
      </div>

      <Card>
        <CardHead
          title="All brands"
          right={
            <button className="btn sm" onClick={() => setEditing("new")}>
              <Plus />
              New Brand
            </button>
          }
        />
        {rows.length === 0 ? (
          <div className="empty">{brands.length === 0 ? "No brands yet" : "No brands match"}</div>
        ) : (
          <div className="brand-grid">
            {rows.map((b) => (
              <div className={`card soft brand-card${b.isActive ? "" : " off"}`} key={b.id}>
                {b.bannerUrl && (
                  <div className="brand-card-cover">
                    <Image src={b.bannerUrl} alt="" fill sizes="360px" style={{ objectFit: "cover" }} />
                  </div>
                )}
                <div className="brand-card-top">
                  <BrandMark brand={b} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="b-name">{b.name}</div>
                    <div className="faint mono" style={{ fontSize: 11.5 }}>
                      {b.slug}
                    </div>
                  </div>
                  <Switch
                    label={b.isActive ? `Hide ${b.name}` : `Show ${b.name}`}
                    checked={b.isActive}
                    disabled={toggleMutation.isPending}
                    onChange={(next) => toggleMutation.mutate({ id: b.id, isActive: next })}
                  />
                </div>
                {b.description && <p className="muted" style={{ fontSize: 12.5 }}>{b.description}</p>}
                <div className="brand-card-foot">
                  <Link href={`/brands/${b.slug}`} target="_blank" className="sec-link" style={{ letterSpacing: 0, textTransform: "none", fontWeight: 600 }}>
                    {b.productCount} product{b.productCount === 1 ? "" : "s"} →
                  </Link>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn sm ghost" onClick={() => setEditing(b)}>
                      <Pencil />
                      Edit
                    </button>
                    <button
                      className="btn sm danger"
                      aria-label={`Delete ${b.name}`}
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        const msg = b.productCount
                          ? `Delete ${b.name}? Its ${b.productCount} product(s) stay in the store without a brand.`
                          : `Delete ${b.name}?`;
                        if (window.confirm(msg)) deleteMutation.mutate(b.id);
                      }}
                    >
                      <Trash2 />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
          Hidden brands disappear from the store filters; their products stay on sale. Assign brands to products in
          the product editor.
        </p>
      </Card>

      {editing && <BrandEditor brand={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function BrandEditor({ brand, onClose }: { brand: AdminBrand | null; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState(brand?.name ?? "");
  const [slug, setSlug] = useState(brand?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(brand));
  const [description, setDescription] = useState(brand?.description ?? "");
  const [isActive, setIsActive] = useState(brand?.isActive ?? true);
  const [file, setFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useObjectUrl(file);
  const coverPreview = useObjectUrl(coverFile);

  const logoUrl = preview ?? (removeLogo ? null : brand?.logoUrl ?? null);
  const coverUrl = coverPreview ?? (removeCover ? null : brand?.bannerUrl ?? null);

  const upload = (picked: File) => {
    const body = new FormData();
    body.append("image", picked);
    return apiClient.post<{ url: string; publicId: string }>("/admin/brands/upload", body, {
      timeoutMs: UPLOAD_TIMEOUT_MS,
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const logo = file ? await upload(file) : null;
      const cover = coverFile ? await upload(coverFile) : null;
      const payload = {
        name: name.trim(),
        slug,
        description: description.trim() || null,
        isActive,
        ...(logo
          ? { logoUrl: logo.url, logoPublicId: logo.publicId }
          : removeLogo
            ? { logoUrl: null, logoPublicId: null }
            : {}),
        ...(cover
          ? { bannerUrl: cover.url, bannerPublicId: cover.publicId }
          : removeCover
            ? { bannerUrl: null, bannerPublicId: null }
            : {}),
      };
      return brand
        ? apiClient.patch<AdminBrand>(`/admin/brands/${brand.id}`, payload)
        : apiClient.post<AdminBrand>("/admin/brands", payload);
    },
    onSuccess: (b) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "brands"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      toast.success(brand ? `${b.name} saved` : `${b.name} added`);
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const submit = () => {
    setError(null);
    if (!name.trim()) return setError("Brand name is required");
    if (!/^[a-z0-9-]+$/.test(slug)) return setError("Slug: lowercase letters, numbers and hyphens only");
    saveMutation.mutate();
  };

  return (
    <Modal title={brand ? `Edit brand — ${brand.name}` : "New Brand"} onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }} className="mb">
        <BrandMark brand={{ name: name || "?", logoUrl }} size={64} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label className="btn sm ghost" style={{ cursor: "pointer" }}>
            <ImagePlus />
            {logoUrl ? "Change logo" : "Upload logo"}
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const picked = e.target.files?.[0];
                if (picked && picked.type.startsWith("image/")) {
                  setFile(picked);
                  setRemoveLogo(false);
                }
                e.target.value = "";
              }}
            />
          </label>
          {logoUrl && (
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => {
                setFile(null);
                setRemoveLogo(true);
              }}
            >
              <X />
              Remove
            </button>
          )}
        </div>
      </div>

      <div className="field">
        <label>Cover image (brand page header)</label>
        <div className="brand-cover-preview">
          {coverUrl ? (
            <Image src={coverUrl} alt="" fill unoptimized={coverUrl.startsWith("blob:")} sizes="520px" style={{ objectFit: "cover" }} />
          ) : (
            <span className="faint" style={{ fontSize: 12 }}>No cover — a dark gradient is shown</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <label className="btn sm ghost" style={{ cursor: "pointer" }}>
            <ImagePlus />
            {coverUrl ? "Change cover" : "Upload cover"}
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const picked = e.target.files?.[0];
                if (picked && picked.type.startsWith("image/")) {
                  setCoverFile(picked);
                  setRemoveCover(false);
                }
                e.target.value = "";
              }}
            />
          </label>
          {coverUrl && (
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => {
                setCoverFile(null);
                setRemoveCover(true);
              }}
            >
              <X />
              Remove cover
            </button>
          )}
        </div>
        <p className="faint" style={{ fontSize: 11.5, marginTop: 6 }}>Wide image works best (about 1800 × 360 px).</p>
      </div>

      <div className="form-2col">
        <Field label="Brand name">
          <input
            value={name}
            maxLength={60}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            placeholder="Sony"
          />
        </Field>
        <Field label="Slug (URL)">
          <input
            className="mono"
            value={slug}
            maxLength={60}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            placeholder="sony"
          />
        </Field>
      </div>
      <Field label="Description (optional)">
        <textarea value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} style={{ minHeight: 70 }} />
      </Field>
      <div className="toggle-row mb">
        <div>
          <div className="t-title">Visible in store</div>
          <div className="t-desc">Shown in the brand filter and on the homepage</div>
        </div>
        <Switch label="Visible in store" checked={isActive} onChange={setIsActive} />
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: 12.5, marginBottom: 12 }}>{error}</p>}
      <button className="btn block" disabled={saveMutation.isPending} onClick={submit}>
        {saveMutation.isPending ? (file || coverFile ? "Uploading…" : "Saving…") : brand ? "Save brand" : "Add brand"}
      </button>
    </Modal>
  );
}
