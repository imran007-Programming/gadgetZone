/**
 * Format a price in Taka with the ৳ symbol, e.g. ৳14,500.
 * Accepts numbers or numeric strings (Prisma Decimal).
 */
export function formatPrice(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  if (!Number.isFinite(n)) return "৳0";
  // The browser's BDT currency style prints "BDT 14,500", so add the symbol ourselves
  const amount = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.abs(n));
  return `${n < 0 ? "-" : ""}৳${amount}`;
}

/** Normalize a Prisma Decimal (string) or number to a number. */
export function toNumber(value: number | string | null | undefined): number {
  const n = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Build a query string from a params object, skipping empty values. */
export function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
