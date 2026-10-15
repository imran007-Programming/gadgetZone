"use client";

import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Boxes,
  Download,
  Eye,
  Layers,
  Receipt,
  RotateCcw,
  Star,
  Tag,
  Users,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/lib/toast";
import type { AdminReturn, AdminReview, Coupon, Order, User } from "@/lib/types";
import { Card, CardHead, Loading, Modal, bdNumber, matchesSearch, useAdminSearch } from "./kit";
import { useAdminProducts } from "./AdminProducts";
import { customerName } from "./AdminOrders";

type Cell = string | number;
type Rows = Cell[][]; // first row is the header

const RANGES = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "All time", days: 0 },
] as const;

function downloadCsv(filename: string, rows: Rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const day = (d: string) => new Date(d).toISOString().slice(0, 10);

interface ReportDef {
  id: string;
  name: string;
  desc: string;
  icon: ReactNode;
  /** Order-based reports respect the date range; the rest are snapshots. */
  ranged: boolean;
  build: () => Rows;
}

export default function AdminReports() {
  const toast = useToast();
  const search = useAdminSearch();
  const [range, setRange] = useState<number>(30);
  // Reference time for the date ranges, fixed for this visit
  const [now] = useState(() => Date.now());
  const [preview, setPreview] = useState<ReportDef | null>(null);

  const ordersQuery = useQuery({ queryKey: ["admin", "orders"], queryFn: () => apiClient.get<Order[]>("/admin/orders") });
  const usersQuery = useQuery({ queryKey: ["admin", "users"], queryFn: () => apiClient.get<User[]>("/admin/users") });
  const couponsQuery = useQuery({ queryKey: ["admin", "coupons"], queryFn: () => apiClient.get<Coupon[]>("/admin/coupons") });
  const reviewsQuery = useQuery({ queryKey: ["admin", "reviews"], queryFn: () => apiClient.get<AdminReview[]>("/admin/reviews") });
  const returnsQuery = useQuery({ queryKey: ["admin", "returns"], queryFn: () => apiClient.get<AdminReturn[]>("/admin/returns") });
  const productsQuery = useAdminProducts();

  const loading = [ordersQuery, usersQuery, couponsQuery, reviewsQuery, returnsQuery, productsQuery].some((q) => q.isPending);
  if (loading) return <Loading label="Preparing reports…" />;

  const allOrders = ordersQuery.data ?? [];
  const since = range ? now - range * 24 * 60 * 60 * 1000 : 0;
  const orders = allOrders.filter((o) => new Date(o.createdAt).getTime() >= since);
  const counted = orders.filter((o) => o.status !== "CANCELLED");
  const products = productsQuery.data ?? [];
  const categoryOf = new Map(products.map((p) => [p.id, p.category?.name ?? "Uncategorised"]));
  const rangeLabel = RANGES.find((r) => r.days === range)?.label ?? "";

  const reports: ReportDef[] = [
    {
      id: "orders",
      name: "Orders Report",
      desc: "Every order with customer, items, coupon discount, total, payment and status.",
      icon: <Receipt />,
      ranged: true,
      build: () => [
        ["Order", "Date", "Customer", "Items", "Coupon", "Discount (BDT)", "Total (BDT)", "Payment", "Status"],
        ...orders.map((o) => [
          o.id,
          day(o.createdAt),
          customerName(o),
          o.items.reduce((n, i) => n + i.quantity, 0),
          o.couponCode ?? "",
          o.discountAmount ?? 0,
          o.totalAmount,
          o.paymentMethod ?? "",
          o.status,
        ]),
      ],
    },
    {
      id: "category",
      name: "Sales by Category",
      desc: "Units and revenue per category from non-cancelled orders.",
      icon: <BarChart3 />,
      ranged: true,
      build: () => {
        const totals = new Map<string, { units: number; revenue: number }>();
        for (const o of counted)
          for (const i of o.items) {
            const cat = categoryOf.get(i.productId) ?? "Removed products";
            const t = totals.get(cat) ?? { units: 0, revenue: 0 };
            t.units += i.quantity;
            t.revenue += i.unitPrice * i.quantity;
            totals.set(cat, t);
          }
        return [
          ["Category", "Units", "Revenue (BDT)"],
          ...[...totals.entries()].sort((a, b) => b[1].revenue - a[1].revenue).map(([c, t]) => [c, t.units, t.revenue]),
        ];
      },
    },
    {
      id: "products",
      name: "Product Performance",
      desc: "Units sold and revenue per product, best sellers first.",
      icon: <Layers />,
      ranged: true,
      build: () => {
        const totals = new Map<string, { name: string; units: number; revenue: number }>();
        for (const o of counted)
          for (const i of o.items) {
            const t = totals.get(i.productId) ?? { name: i.product?.name ?? i.productId, units: 0, revenue: 0 };
            t.units += i.quantity;
            t.revenue += i.unitPrice * i.quantity;
            totals.set(i.productId, t);
          }
        return [
          ["Product", "Category", "Units", "Revenue (BDT)"],
          ...[...totals.entries()]
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .map(([id, t]) => [t.name, categoryOf.get(id) ?? "", t.units, t.revenue]),
        ];
      },
    },
    {
      id: "customers",
      name: "Customer Activity",
      desc: "Every customer with join date, status, order count and lifetime spend.",
      icon: <Users />,
      ranged: false,
      build: () => {
        const spend = new Map<string, { orders: number; spent: number }>();
        for (const o of allOrders) {
          if (!o.user || o.status === "CANCELLED") continue;
          const s = spend.get(o.user.id) ?? { orders: 0, spent: 0 };
          s.orders += 1;
          s.spent += o.totalAmount;
          spend.set(o.user.id, s);
        }
        return [
          ["Name", "Email", "Joined", "Active", "Orders", "Lifetime spend (BDT)"],
          ...(usersQuery.data ?? [])
            .filter((u) => u.role !== "ADMIN")
            .map((u) => [
              u.name,
              u.email,
              day(u.createdAt),
              u.isActive === false ? "no" : "yes",
              spend.get(u.id)?.orders ?? 0,
              spend.get(u.id)?.spent ?? 0,
            ]),
        ];
      },
    },
    {
      id: "inventory",
      name: "Inventory Audit",
      desc: "Current stock, price and stock value for every product.",
      icon: <Boxes />,
      ranged: false,
      build: () => [
        ["Product", "Slug", "Category", "Price (BDT)", "Stock", "Stock value (BDT)", "Active"],
        ...products.map((p) => [p.name, p.slug, p.category?.name ?? "", p.price, p.stock, p.price * p.stock, p.isActive ? "yes" : "no"]),
      ],
    },
    {
      id: "coupons",
      name: "Coupon Usage",
      desc: "Each coupon with its terms, redemptions and total discount given.",
      icon: <Tag />,
      ranged: false,
      build: () => [
        ["Code", "Type", "Value", "Min order (BDT)", "Used", "Limit", "Discount given (BDT)", "Expires", "Active"],
        ...(couponsQuery.data ?? []).map((c) => [
          c.code,
          c.type,
          c.value,
          c.minOrder ?? "",
          c.usedCount,
          c.maxUses ?? "",
          c.totalDiscount ?? 0,
          c.expiresAt ? day(c.expiresAt) : "",
          c.isActive ? "yes" : "no",
        ]),
      ],
    },
    {
      id: "reviews",
      name: "Product Reviews",
      desc: "All reviews with rating, status, reply and the customer who wrote them.",
      icon: <Star />,
      ranged: false,
      build: () => [
        ["Date", "Product", "Customer", "Rating", "Status", "Comment", "Reply"],
        ...(reviewsQuery.data ?? []).map((r) => [
          day(r.createdAt),
          r.product.name,
          r.user.name,
          r.rating,
          r.status,
          r.comment,
          r.reply ?? "",
        ]),
      ],
    },
    {
      id: "returns",
      name: "Returns & Refunds",
      desc: "Return requests with reason, decision and refunded amount.",
      icon: <RotateCcw />,
      ranged: false,
      build: () => [
        ["Return", "Date", "Order", "Customer", "Reason", "Status", "Order total (BDT)", "Refund (BDT)"],
        ...(returnsQuery.data ?? []).map((r) => [
          r.id,
          day(r.createdAt),
          r.order.id,
          r.user.name,
          r.reason,
          r.status,
          r.order.totalAmount,
          r.refundAmount ?? "",
        ]),
      ],
    },
  ];

  const visible = reports.filter((r) => matchesSearch(search, r.name, r.desc));
  const fileName = (r: ReportDef) =>
    `${r.id}-${r.ranged ? rangeLabel.toLowerCase().replace(/\s+/g, "-") : "snapshot"}-${day(new Date().toISOString())}.csv`;

  return (
    <section>
      <div className="chips mb">
        {RANGES.map((r) => (
          <button key={r.days} className={`chip${range === r.days ? " active" : ""}`} onClick={() => setRange(r.days)}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="report-grid mb">
        {visible.map((r) => {
          const rows = r.build().length - 1;
          return (
            <div className="card report-card" key={r.id}>
              <div className="r-ic">{r.icon}</div>
              <h3>{r.name}</h3>
              <p>{r.desc}</p>
              <div className="faint" style={{ fontSize: 11.5 }}>
                {r.ranged ? rangeLabel : "Current snapshot"} · {bdNumber(rows)} row{rows === 1 ? "" : "s"}
              </div>
              <div className="r-actions">
                <button
                  className="btn sm"
                  onClick={() => {
                    downloadCsv(fileName(r), r.build());
                    toast.success(`${r.name} downloaded`);
                  }}
                >
                  <Download />
                  CSV
                </button>
                <button className="btn sm ghost" onClick={() => setPreview(r)}>
                  <Eye />
                  Preview
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Card>
        <CardHead title="About these reports" />
        <p className="muted" style={{ fontSize: 13 }}>
          Orders, Sales by Category and Product Performance follow the date range above; the other reports are a
          snapshot of today. Amounts are in BDT. CSV files open directly in Excel or Google Sheets.
        </p>
      </Card>

      {preview && <ReportPreview report={preview} onClose={() => setPreview(null)} />}
    </section>
  );
}

function ReportPreview({ report, onClose }: { report: ReportDef; onClose: () => void }) {
  const [header, ...rows] = report.build();
  return (
    <Modal title={report.name} onClose={onClose} wide>
      {rows.length === 0 ? (
        <div className="empty">No rows for this period</div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                {header.map((h) => (
                  <th key={String(h)}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((row, i) => (
                <tr key={i}>
                  {row.map((c, j) => (
                    <td key={j} className={typeof c === "number" ? "num" : ""}>
                      {typeof c === "number" ? bdNumber(c) : c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > 20 && (
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          Showing 20 of {rows.length} rows — download the CSV for everything.
        </p>
      )}
    </Modal>
  );
}
