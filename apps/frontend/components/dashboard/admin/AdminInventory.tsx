"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Download } from "lucide-react";
import type { Product } from "@/lib/types";
import {
  Badge,
  Card,
  CardHead,
  Donut,
  DonutLegend,
  ErrorBox,
  HBars,
  Kpi,
  Loading,
  StockBadge,
  bdNumber,
  matchesSearch,
  useAdminSearch,
} from "./kit";
import { ProductThumb, useAdminProducts } from "./AdminProducts";

function shortTaka(n: number) {
  if (n >= 100_000) return `৳${(n / 100_000).toFixed(1)}L`;
  if (n >= 1000) return `৳${(n / 1000).toFixed(1)}K`;
  return `৳${Math.round(n)}`;
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Sum a numeric field per category name, largest first. */
function byCategory(products: Product[], value: (p: Product) => number) {
  const totals = new Map<string, number>();
  for (const p of products) {
    const name = p.category?.name ?? "Uncategorised";
    totals.set(name, (totals.get(name) ?? 0) + value(p));
  }
  return [...totals.entries()].map(([label, v]) => ({ label, value: v })).sort((a, b) => b.value - a.value);
}

export default function AdminInventory() {
  const router = useRouter();
  const search = useAdminSearch();
  const productsQuery = useAdminProducts();

  if (productsQuery.isPending) return <Loading label="Loading inventory…" />;
  if (productsQuery.isError)
    return <ErrorBox message={(productsQuery.error as Error).message} onRetry={() => productsQuery.refetch()} />;

  const products = productsQuery.data;
  const active = products.filter((p) => p.isActive);
  const stockValue = active.reduce((n, p) => n + p.price * p.stock, 0);
  const low = active.filter((p) => p.stock > 0 && p.stock < 10);
  const out = active.filter((p) => p.stock <= 0);
  const alerts = [...out, ...low].sort((a, b) => a.stock - b.stock);

  const rows = products
    .filter((p) => matchesSearch(search, p.name, p.slug, p.category?.name))
    .sort((a, b) => a.stock - b.stock);

  const unitsByCategory = byCategory(active, (p) => p.stock);
  const valueByCategory = byCategory(active, (p) => p.price * p.stock);

  const exportLedger = () => {
    downloadCsv("inventory-ledger.csv", [
      ["Product", "Slug", "Category", "Price (BDT)", "Stock", "Stock value (BDT)", "Active"],
      ...rows.map((p) => [p.name, p.slug, p.category?.name ?? "", p.price, p.stock, p.price * p.stock, p.isActive ? "yes" : "no"]),
    ]);
  };

  return (
    <section>
      <div className="grid kpi-grid">
        <Kpi label="Total SKUs" value={bdNumber(products.length)} sub={`${active.length} active`} />
        <Kpi label="Stock value" currency value={bdNumber(stockValue)} sub="Price × units, active products" />
        <Kpi
          label="Low stock"
          value={bdNumber(low.length)}
          sub="1–9 units left"
          pill={low.length > 0 ? { text: "REORDER", tone: "warn" } : undefined}
        />
        <Kpi
          label="Out of stock"
          value={bdNumber(out.length)}
          sub="SKUs at zero"
          pill={out.length > 0 ? { text: "ACTION", tone: "down" } : undefined}
        />
      </div>

      <div className="grid two-col mb">
        <Card>
          <CardHead
            title="Inventory ledger"
            right={
              <button className="btn sm ghost" onClick={exportLedger}>
                <Download />
                Export CSV
              </button>
            }
          />
          {rows.length === 0 ? (
            <div className="empty">No products match</div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th className="num">Price</th>
                    <th className="num">Stock</th>
                    <th className="num">Value</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className="clickable" onClick={() => router.push(`/admin/products/${p.id}`)}>
                      <td>
                        <div className="prod-cell">
                          <ProductThumb product={p} />
                          <div className="pn">{p.name}</div>
                        </div>
                      </td>
                      <td className="muted">{p.category?.name ?? "—"}</td>
                      <td className="num">৳{bdNumber(p.price)}</td>
                      <td className="num">{p.stock}</td>
                      <td className="num">৳{bdNumber(p.price * p.stock)}</td>
                      <td>
                        <StockBadge stock={p.stock} active={p.isActive} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="stack">
          <Card>
            <CardHead
              title="Low stock alerts"
              right={<Badge tone={alerts.length ? "amber" : "green"}>{alerts.length} active</Badge>}
            />
            {alerts.length === 0 ? (
              <div className="empty">Every active product has at least 10 units.</div>
            ) : (
              alerts.slice(0, 8).map((p) => (
                <div className="alert-row" key={p.id}>
                  <div className="alert-ic">
                    <AlertTriangle />
                  </div>
                  <div className="alert-info">
                    <div className="a-name">{p.name}</div>
                    <div className="a-sub mono">
                      {p.stock === 0 ? "Out of stock" : `${p.stock} left`} · {p.category?.name ?? "—"}
                    </div>
                  </div>
                  <Link href={`/admin/products/${p.id}`} className="btn sm ghost">
                    Restock
                  </Link>
                </div>
              ))
            )}
          </Card>

          <Card>
            <CardHead title="Units by category" />
            <HBars items={unitsByCategory.map((c) => ({ ...c, display: `${bdNumber(c.value)} units` }))} />
          </Card>
        </div>
      </div>

      <Card>
        <CardHead title="Stock value by category" />
        <div className="donut-flex">
          <Donut segments={valueByCategory} center={shortTaka(stockValue)} centerSub="STOCK VALUE" />
          <DonutLegend segments={valueByCategory} format={shortTaka} />
        </div>
      </Card>
    </section>
  );
}
