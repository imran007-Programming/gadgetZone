"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Upload } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { CACHE_TAGS, STOREFRONT_REFRESH_FAILED, revalidateCache } from "@/lib/cache-tags";
import type { AdminBrand, Category, Product } from "@/lib/types";
import {
  Card,
  CardHead,
  ErrorBox,
  Field,
  Kpi,
  Loading,
  Modal,
  StockBadge,
  bdNumber,
  matchesSearch,
  useAdminSearch,
} from "./kit";

interface BulkImportResult {
  created: number;
  failed: { row: number; name: string; error: string }[];
}

const BULK_TIMEOUT_MS = 15 * 60 * 1000;

/** All products, including inactive ones; shared with the inventory page. */
export function useAdminProducts() {
  return useQuery({
    queryKey: ["admin", "products", "all"],
    queryFn: () => apiClient.get<Product[]>("/admin/products"),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => apiClient.get<Category[]>("/categories"),
  });
}

export function ProductThumb({ product }: { product: Pick<Product, "name" | "imageUrl"> }) {
  const initials = product.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div className="prod-thumb">
      {product.imageUrl ? (
        <Image src={product.imageUrl} alt="" fill sizes="44px" style={{ objectFit: "cover" }} />
      ) : (
        initials
      )}
    </div>
  );
}

export default function AdminProducts() {
  const router = useRouter();
  const search = useAdminSearch();
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const brandsQuery = useQuery({
    queryKey: ["admin", "brands"],
    queryFn: () => apiClient.get<AdminBrand[]>("/admin/brands"),
  });
  const [showBulk, setShowBulk] = useState(false);

  const productsQuery = useAdminProducts();
  const categoriesQuery = useCategories();

  if (productsQuery.isPending) return <Loading label="Loading products…" />;
  if (productsQuery.isError)
    return <ErrorBox message={(productsQuery.error as Error).message} onRetry={() => productsQuery.refetch()} />;

  const products = productsQuery.data;
  const categories = categoriesQuery.data ?? [];
  const active = products.filter((p) => p.isActive);
  const lowStock = active.filter((p) => p.stock < 10);

  const rows = products.filter(
    (p) =>
      (categoryFilter === "all" || p.categoryId === categoryFilter) &&
      (brandFilter === "all" || (brandFilter === "none" ? !p.brandId : p.brandId === brandFilter)) &&
      matchesSearch(search, p.name, p.slug, p.category?.name, p.brand?.name),
  );

  return (
    <section>
      <div className="grid kpi-grid">
        <Kpi label="Total products" value={bdNumber(products.length)} sub="Including inactive" />
        <Kpi label="Active listings" value={bdNumber(active.length)} sub="Visible in the store" />
        <Kpi
          label="Low stock"
          value={bdNumber(lowStock.length)}
          sub="Below 10 units"
          pill={lowStock.length > 0 ? { text: "REORDER", tone: "warn" } : undefined}
        />
        <Kpi label="Categories" value={bdNumber(categories.length)} sub="Catalog coverage" />
      </div>

      <Card>
        <CardHead
          title="Product catalog"
          right={
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <select
                className="input"
                style={{ width: "auto", padding: "8px 12px", fontSize: 13 }}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter by category"
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                className="input"
                style={{ width: "auto", padding: "8px 12px", fontSize: 13 }}
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                aria-label="Filter by brand"
              >
                <option value="all">All brands</option>
                <option value="none">No brand</option>
                {(brandsQuery.data ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <button className="btn sm ghost" onClick={() => setShowBulk(true)}>
                <Upload />
                Bulk upload
              </button>
              <button className="btn sm" onClick={() => router.push("/admin/products/new")}>
                <Plus />
                Add Product
              </button>
            </div>
          }
        />
        {rows.length === 0 ? (
          <div className="empty">{products.length === 0 ? "No products yet" : "No products match"}</div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Brand</th>
                  <th>Category</th>
                  <th className="num">Price</th>
                  <th className="num">Stock</th>
                  <th className="num">Images</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="clickable" onClick={() => router.push(`/admin/products/${p.id}`)}>
                    <td>
                      <div className="prod-cell">
                        <ProductThumb product={p} />
                        <div>
                          <div className="pn">{p.name}</div>
                          <div className="ps mono">{p.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="muted">{p.brand?.name ?? "—"}</td>
                    <td className="muted">{p.category?.name ?? "—"}</td>
                    <td className="num">৳{bdNumber(p.price)}</td>
                    <td className="num">{p.stock}</td>
                    <td className="num">{p.images?.length ?? 0}</td>
                    <td>
                      <StockBadge stock={p.stock} active={p.isActive} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
          Click a product to edit details, price, stock, visibility and images.
        </p>
      </Card>

      {showBulk && <BulkImportModal categories={categories} onClose={() => setShowBulk(false)} />}
    </section>
  );
}

const CSV_TEMPLATE = [
  "name,slug,description,price,comparePrice,stock,category,brand,isActive,images",
  "Sony WH-1000XM5,,Noise cancelling headphones,38500,42000,25,audio,sony,true,xm5-front.jpg|xm5-side.jpg",
  "Anker PowerCore 10000,,Compact power bank,2800,,80,mobile-accessories,anker,true,https://example.com/anker.jpg",
].join("\n");

function BulkImportModal({ categories, onClose }: { categories: Category[]; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [csv, setCsv] = useState<File | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [result, setResult] = useState<BulkImportResult | null>(null);

  const importMutation = useMutation({
    mutationFn: () => {
      const form = new FormData();
      if (csv) form.append("csv", csv);
      images.forEach((f) => form.append("images", f));
      return apiClient.post<BulkImportResult>("/admin/products/bulk", form, { timeoutMs: BULK_TIMEOUT_MS });
    },
    onSuccess: (r) => {
      setResult(r);
      if (r.created) {
        toast.success(`${r.created} product${r.created === 1 ? "" : "s"} created`);
        queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
        queryClient.invalidateQueries({ queryKey: ["products"] });
        void revalidateCache(CACHE_TAGS.products).then((ok) => ok || toast.error(STOREFRONT_REFRESH_FAILED));
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "products-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal title="Bulk upload products" onClose={onClose}>
      <div className="card soft mb" style={{ fontSize: 12.5 }}>
        <span className="muted">
          One row per product. <b>category</b> is the category slug
          {categories.length ? ` (${categories.map((c) => c.slug).join(", ")})` : ""}. List <b>images</b> separated by
          “|” — file names from the selection below, or full https URLs.
        </span>
      </div>
      <button className="btn sm ghost mb" onClick={downloadTemplate}>
        <Download />
        Download CSV template
      </button>

      <Field label="Products CSV">
        <input type="file" accept=".csv,text/csv" onChange={(e) => setCsv(e.target.files?.[0] ?? null)} />
      </Field>
      <Field label={`Image files (${images.length} selected)`}>
        <input type="file" accept="image/*" multiple onChange={(e) => setImages(Array.from(e.target.files ?? []))} />
      </Field>

      {result && (
        <div className="card soft mb">
          <div style={{ fontWeight: 600 }}>
            Created {result.created} product{result.created === 1 ? "" : "s"}
            {result.failed.length > 0 && `, ${result.failed.length} failed`}
          </div>
          {result.failed.length > 0 && (
            <ul style={{ marginTop: 8, maxHeight: 180, overflowY: "auto", fontSize: 12, color: "var(--red)", paddingLeft: 16 }}>
              {result.failed.map((f) => (
                <li key={`${f.row}-${f.name}`}>
                  Row {f.row}
                  {f.name ? ` (${f.name})` : ""}: {f.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button className="btn block" disabled={!csv || importMutation.isPending} onClick={() => importMutation.mutate()}>
        <Upload />
        {importMutation.isPending ? "Uploading…" : "Import products"}
      </button>
    </Modal>
  );
}
