"use client";

/**
 * Admin UI kit: small building blocks that render the classes defined in
 * app/admin/admin.css. Charts colour themselves through CSS variables, so a
 * theme switch needs no redraw.
 */
import { createContext, useContext, useEffect, useId, type ReactNode } from "react";
import { X } from "lucide-react";
import type { OrderStatus } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Topbar search, shared with the pages so they can filter their rows. */
/* ------------------------------------------------------------------ */

const SearchContext = createContext("");
export const AdminSearchProvider = SearchContext.Provider;

export function useAdminSearch() {
  return useContext(SearchContext);
}

/** True when the query is empty or any field contains it (case-insensitive). */
export function matchesSearch(query: string, ...fields: (string | number | null | undefined)[]) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => String(f ?? "").toLowerCase().includes(q));
}

/* ------------------------------------------------------------------ */
/* Layout pieces                                                       */
/* ------------------------------------------------------------------ */

export function Card({
  children,
  soft,
  className = "",
}: {
  children: ReactNode;
  soft?: boolean;
  className?: string;
}) {
  return <div className={`card${soft ? " soft" : ""} ${className}`}>{children}</div>;
}

export function CardHead({
  title,
  icon,
  right,
}: {
  title: string;
  icon?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="card-head">
      <div className="sec-title">
        {icon && <span className="sec-ic">{icon}</span>}
        {title}
      </div>
      {right}
    </div>
  );
}

export function Kpi({
  label,
  value,
  currency,
  sub,
  pill,
}: {
  label: string;
  value: string;
  /** Show the coral ৳ prefix before the value. */
  currency?: boolean;
  sub: string;
  pill?: { text: string; tone: "up" | "down" | "warn" };
}) {
  return (
    <div className="card kpi">
      <div className="k-label">{label}</div>
      <div className="k-row">
        <div className="k-value">
          {currency && <span className="cur">৳</span>}
          {value}
        </div>
        {pill && <span className={`pill ${pill.tone}`}>{pill.text}</span>}
      </div>
      <div className="k-sub">{sub}</div>
    </div>
  );
}

export type BadgeTone = "green" | "amber" | "red" | "accent" | "blue" | "purple" | "neutral";

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

const ORDER_TONE: Record<OrderStatus, BadgeTone> = {
  PENDING: "amber",
  PAID: "blue",
  SHIPPED: "purple",
  DELIVERED: "green",
  CANCELLED: "red",
};

export function OrderBadge({ status }: { status: OrderStatus }) {
  const label = status.charAt(0) + status.slice(1).toLowerCase();
  return <Badge tone={ORDER_TONE[status]}>{label}</Badge>;
}

export function StockBadge({ stock, active = true }: { stock: number; active?: boolean }) {
  if (!active) return <Badge tone="neutral">Inactive</Badge>;
  if (stock <= 0) return <Badge tone="red">Out of Stock</Badge>;
  if (stock < 10) return <Badge tone="amber">Low Stock</Badge>;
  return <Badge tone="green">In Stock</Badge>;
}

/** Plain number formatting in the Bangladeshi lakh style, e.g. 12,84,300. */
export function bdNumber(n: number) {
  return Math.round(n).toLocaleString("en-IN");
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <div className="empty">{label}</div>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card" style={{ textAlign: "center" }}>
      <p className="muted" style={{ marginBottom: 12 }}>{message}</p>
      {onRetry && (
        <button className="btn sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form bits                                                           */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {error && <p className="err">{error}</p>}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <label className="switch" aria-label={label}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="track" />
    </label>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** true = 720px; a number sets the max width in px */
  wide?: boolean | number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" style={wide ? { maxWidth: typeof wide === "number" ? wide : 720 } : undefined}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="modal-x" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Charts                                                              */
/* ------------------------------------------------------------------ */

/** Area line chart; the last point gets a live dot. */
export function LineChart({
  values,
  labels,
  height = 215,
}: {
  values: number[];
  labels: string[];
  height?: number;
}) {
  const gid = useId().replace(/:/g, "");
  if (values.length < 2) {
    return <div className="empty">Not enough data yet</div>;
  }
  const W = 640;
  const H = height;
  const P = { l: 8, r: 8, t: 14, b: 26 };
  const iw = W - P.l - P.r;
  const ih = H - P.t - P.b;
  const max = Math.max(...values, 1) * 1.12;
  const X = (i: number) => P.l + (iw * i) / (values.length - 1);
  const Y = (v: number) => P.t + ih * (1 - v / max);
  const pts = values.map((v, i) => [X(i), Y(v)]);
  const line = "M" + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" L");
  const area = `${line} L${X(values.length - 1).toFixed(1)},${(P.t + ih).toFixed(1)} L${X(0).toFixed(1)},${(P.t + ih).toFixed(1)} Z`;
  const last = pts[pts.length - 1];

  return (
    <div className="chart-box">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Line chart">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--accent)", stopOpacity: 0.32 }} />
            <stop offset="1" style={{ stopColor: "var(--accent)", stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={P.l} x2={W - P.r} y1={P.t + ih * f} y2={P.t + ih * f} className="grid-line" />
        ))}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} style={{ fill: "none", stroke: "var(--accent)" }} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last[0]} cy={last[1]} r="4.5" style={{ fill: "var(--accent)", stroke: "var(--card)" }} strokeWidth="2" />
        {labels.map((l, i) => (
          <text
            key={`${l}-${i}`}
            x={(P.l + (iw * i) / Math.max(labels.length - 1, 1)).toFixed(1)}
            y={H - 8}
            textAnchor="middle"
            className="axis-lbl"
          >
            {l}
          </text>
        ))}
      </svg>
    </div>
  );
}

/** Vertical bars shading from soft coral (left) to full accent (right); the peak is highlighted. */
export function BarChart({
  values,
  labels,
  height = 185,
}: {
  values: number[];
  labels: string[];
  height?: number;
}) {
  const W = 420;
  const H = height;
  const P = { l: 6, r: 6, t: 12, b: 24 };
  const iw = W - P.l - P.r;
  const ih = H - P.t - P.b;
  const max = Math.max(...values, 1) * 1.15;
  const n = values.length;
  const slot = iw / Math.max(n, 1);
  const bw = Math.min(26, slot * 0.58);
  const c1 = [232, 180, 166];
  const c2 = [255, 92, 56];

  return (
    <div className="chart-box">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Bar chart">
        {values.map((v, i) => {
          const h = Math.max((ih * v) / max, v > 0 ? 3 : 1.5);
          const x = P.l + slot * i + (slot - bw) / 2;
          const y = P.t + ih - h;
          const t = n > 1 ? i / (n - 1) : 1;
          const c = c1.map((a, k) => Math.round(a + (c2[k] - a) * t));
          return (
            <g key={`${labels[i]}-${i}`}>
              <rect x={x.toFixed(1)} y={y.toFixed(1)} width={bw.toFixed(1)} height={h.toFixed(1)} rx="5" fill={`rgb(${c.join(",")})`} opacity={(0.75 + 0.25 * t).toFixed(2)}>
                <title>{`${labels[i]}: ${v}`}</title>
              </rect>
              <text x={(x + bw / 2).toFixed(1)} y={H - 7} textAnchor="middle" className="axis-lbl">
                {labels[i]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function HBars({ items }: { items: { label: string; value: number; display: string }[] }) {
  if (items.length === 0) return <div className="empty">No data yet</div>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div>
      {items.map((i) => (
        <div className="hbar-row" key={i.label}>
          <span className="hb-label">{i.label}</span>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: `${((i.value / max) * 100).toFixed(1)}%` }} />
          </div>
          <span className="hb-val">{i.display}</span>
        </div>
      ))}
    </div>
  );
}

export const PALETTE = ["#ff5c38", "#ff8a5c", "#f5b14c", "#22c55e", "#38bdf8", "#a78bfa", "#f472b6"];

export function Donut({
  segments,
  center,
  centerSub,
}: {
  segments: { label: string; value: number }[];
  center: string;
  centerSub: string;
}) {
  const size = 190;
  const r = 70;
  const cx = size / 2;
  const cy = size / 2;
  const total = segments.reduce((a, s) => a + s.value, 0);
  let acc = 0;

  return (
    <div className="chart-box" style={{ maxWidth: 190 }}>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Donut chart">
        {total === 0 ? (
          <circle cx={cx} cy={cy} r={r} style={{ fill: "none", stroke: "var(--track)" }} strokeWidth="26" />
        ) : (
          segments.map((s, i) => {
            const frac = s.value / total;
            // A full circle cannot be drawn as one arc, so draw a circle instead
            if (frac >= 0.9999) {
              return <circle key={s.label} cx={cx} cy={cy} r={r} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth="26" />;
            }
            const a0 = acc * 360 - 90;
            const a1 = (acc + frac) * 360 - 90;
            acc += frac;
            const large = a1 - a0 > 180 ? 1 : 0;
            const p0 = [cx + r * Math.cos((a0 * Math.PI) / 180), cy + r * Math.sin((a0 * Math.PI) / 180)];
            const p1 = [cx + r * Math.cos((a1 * Math.PI) / 180), cy + r * Math.sin((a1 * Math.PI) / 180)];
            return (
              <path
                key={s.label}
                d={`M${p0[0].toFixed(1)},${p0[1].toFixed(1)} A${r},${r} 0 ${large} 1 ${p1[0].toFixed(1)},${p1[1].toFixed(1)}`}
                fill="none"
                stroke={PALETTE[i % PALETTE.length]}
                strokeWidth="26"
              />
            );
          })
        )}
        <text x={cx} y={cy - 2} textAnchor="middle" style={{ fontSize: 20, fontWeight: 700, fill: "var(--text)" }}>
          {center}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" style={{ fontSize: 10, fill: "var(--faint)", letterSpacing: 1 }}>
          {centerSub}
        </text>
      </svg>
    </div>
  );
}

export function DonutLegend({
  segments,
  format,
}: {
  segments: { label: string; value: number }[];
  format: (v: number) => string;
}) {
  return (
    <div className="donut-legend">
      {segments.map((s, i) => (
        <div className="dl-row" key={s.label}>
          <span className="lg-dot" style={{ background: PALETTE[i % PALETTE.length] }} />
          <span>{s.label}</span>
          <span className="dl-val">{format(s.value)}</span>
        </div>
      ))}
    </div>
  );
}
