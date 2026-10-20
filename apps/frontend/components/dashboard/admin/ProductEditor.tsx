"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Trash2, Upload, X } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { CACHE_TAGS, STOREFRONT_REFRESH_FAILED, revalidateCache } from "@/lib/cache-tags";
import { useObjectUrls } from "@/lib/use-object-urls";
import { toNumber } from "@/lib/utils";
import { buildCategoryTree } from "@/lib/categories";
import type { AdminBrand, Category, Product, ProductImage } from "@/lib/types";
import { Card, CardHead, Field, Switch } from "./kit";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens"),
  description: z.string().min(1, "Description is required"),
  price: z.number().positive("Price must be positive"),
  comparePrice: z.string().optional(),
  stock: z.number().int().min(0, "Stock can't be negative"),
  categoryId: z.string().min(1, "Category is required"),
  brandId: z.string().optional(),
  isActive: z.boolean(),
});

type ProductForm = z.infer<typeof productSchema>;

const UPLOAD_TIMEOUT_MS = 2 * 60 * 1000;


/**
 * Full-page product form for both create and edit.
 * Left column: details and pricing. Right column: visibility and images.
 */
export default function ProductEditor({ product, categories }: { product?: Product; categories: Category[] }) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isEdit = Boolean(product);

  const brandsQuery = useQuery({
    queryKey: ["admin", "brands"],
    queryFn: () => apiClient.get<AdminBrand[]>("/admin/brands"),
  });

  const [gallery, setGallery] = useState<ProductImage[]>(product?.images ?? []);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const previews = useObjectUrls(files);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          name: product.name,
          slug: product.slug,
          description: product.description,
          price: toNumber(product.price),
          comparePrice: product.comparePrice != null ? String(toNumber(product.comparePrice)) : "",
          stock: product.stock,
          categoryId: product.categoryId,
          brandId: product.brandId ?? "",
          isActive: product.isActive,
        }
      : { isActive: true, stock: 0, categoryId: "", brandId: "", comparePrice: "" },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "product"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
    queryClient.invalidateQueries({ queryKey: ["product"] });
    void revalidateCache(CACHE_TAGS.products).then((ok) => ok || toast.error(STOREFRONT_REFRESH_FAILED));
  };

  const deleteImageMutation = useMutation({
    mutationFn: (imageId: string) =>
      apiClient.del<Product>(`/admin/products/${product!.id}/images/${imageId}`, { timeoutMs: UPLOAD_TIMEOUT_MS }),
    onSuccess: (updated) => {
      setGallery(updated.images ?? []);
      toast.success("Image removed");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMutation = useMutation({
    mutationFn: async (values: ProductForm) => {
      const compare = values.comparePrice?.trim();
      const body = {
        ...values,
        brandId: values.brandId || null,
        price: Number(values.price),
        stock: Number(values.stock),
        comparePrice: compare ? parseFloat(compare) : undefined,
      };
      const saved = isEdit
        ? await apiClient.patch<Product>(`/admin/products/${product!.id}`, body)
        : await apiClient.post<Product>("/admin/products", body);

      if (files.length) {
        const form = new FormData();
        files.forEach((f) => form.append("files", f));
        await apiClient.post<Product>(`/admin/products/${saved.id}/images`, form, { timeoutMs: UPLOAD_TIMEOUT_MS });
      }
      return saved;
    },
    onSuccess: () => {
      toast.success(isEdit ? "Product saved" : "Product created");
      invalidate();
      router.push("/admin/products");
    },
    onError: (e: Error) => {
      // The product may already exist if only the image upload failed
      toast.error(e.message);
      invalidate();
    },
  });

  const onSubmit = handleSubmit((values) => {
    if (!isEdit && files.length === 0) {
      setFileError("Add at least one image");
      return;
    }
    setFileError(null);
    saveMutation.mutate(values);
  });

  const addFiles = (list: FileList | null) => {
    const picked = Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
    if (picked.length) setFiles((prev) => [...prev, ...picked]);
    setFileError(null);
  };

  const busy = isSubmitting || saveMutation.isPending;

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="sticky-bar">
        <div style={{ minWidth: 0 }}>
          <Link href="/admin/products" className="sec-link" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ArrowLeft size={14} />
            Back to products
          </Link>
          <h1 style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>{isEdit ? product!.name : "New product"}</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isEdit && isDirty && <span className="pill warn">UNSAVED CHANGES</span>}
          <Link href="/admin/products" className="btn ghost">
            Cancel
          </Link>
          <button type="submit" className="btn" disabled={busy}>
            <Check />
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create product"}
          </button>
        </div>
      </div>

      <div className="grid two-col">
        {/* Left column */}
        <div className="stack">
          <Card>
            <CardHead title="Details" />
            <Field label="Product name" error={errors.name?.message}>
              <input {...register("name")} placeholder="e.g. Sony WH-1000XM5" />
            </Field>
            <Field label="Slug (URL)" error={errors.slug?.message}>
              <input className="mono" {...register("slug")} placeholder="sony-wh-1000xm5" />
            </Field>
            <Field label="Description" error={errors.description?.message}>
              <textarea rows={6} {...register("description")} />
            </Field>
            <div className="form-2col">
              <Field label="Category" error={errors.categoryId?.message}>
                <select {...register("categoryId")}>
                  <option value="">Select…</option>
                  {buildCategoryTree(categories).map((c) => [
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>,
                    ...c.children.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {"   ↳ "}
                        {sub.name}
                      </option>
                    )),
                  ])}
                </select>
              </Field>
              <Field label="Brand" error={errors.brandId?.message}>
                <select {...register("brandId")}>
                  <option value="">No brand</option>
                  {(brandsQuery.data ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.isActive ? "" : " (hidden)"}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Card>

          <Card>
            <CardHead title="Pricing & inventory" />
            <div className="form-3col">
              <Field label="Price (৳)" error={errors.price?.message}>
                <input type="number" step="0.01" min={0} {...register("price", { valueAsNumber: true })} />
              </Field>
              <Field label="Compare-at price (৳)" error={errors.comparePrice?.message}>
                <input type="number" step="0.01" min={0} placeholder="Optional" {...register("comparePrice")} />
              </Field>
              <Field label="Stock qty" error={errors.stock?.message}>
                <input type="number" min={0} {...register("stock", { valueAsNumber: true })} />
              </Field>
            </div>
            <p className="muted" style={{ fontSize: 12 }}>
              The compare-at price is shown struck through and must be higher than the price.
            </p>
          </Card>
        </div>

        {/* Right column */}
        <div className="stack">
          <Card>
            <CardHead title="Visibility" />
            <div className="toggle-row">
              <div>
                <div className="t-title">Active</div>
                <div className="t-desc">Shown in the storefront and searchable</div>
              </div>
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <Switch label="Active" checked={field.value} onChange={field.onChange} />
                )}
              />
            </div>
          </Card>

          <Card>
            <CardHead title="Images" right={<span className="faint" style={{ fontSize: 12 }}>First image is the cover</span>} />
            {gallery.length === 0 && files.length === 0 ? (
              <div className="empty" style={{ padding: "18px 10px" }}>
                No images yet
              </div>
            ) : (
              <div className="gallery mb">
                {gallery.map((img, i) => (
                  <div className="gallery-item" key={img.id}>
                    <Image src={img.url} alt="" fill sizes="140px" style={{ objectFit: "cover" }} />
                    {i === 0 && <span className="tag">COVER</span>}
                    <button
                      type="button"
                      className="x"
                      disabled={deleteImageMutation.isPending}
                      aria-label="Delete image"
                      onClick={() => {
                        if (window.confirm("Delete this image from the product and Cloudinary?"))
                          deleteImageMutation.mutate(img.id);
                      }}
                    >
                      <Trash2 />
                    </button>
                  </div>
                ))}
                {previews.map((url, i) => (
                  <div className="gallery-item pending" key={url}>
                    <Image src={url} alt="" fill unoptimized sizes="140px" style={{ objectFit: "cover" }} />
                    <span className="tag">NEW</span>
                    <button
                      type="button"
                      className="x"
                      aria-label="Remove selected image"
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <X />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <label className="dropzone">
              <Upload size={16} />
              Add images (JPG, PNG, WebP · up to 8 MB)
              <input
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            {fileError && (
              <p style={{ marginTop: 8, fontSize: 12, color: "var(--red)" }}>{fileError}</p>
            )}
          </Card>
        </div>
      </div>
    </form>
  );
}
