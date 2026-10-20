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

/**
 * Address lines below the recipient's name, e.g.
 * ["House 12, Road 5", "Dhanmondi, Dhaka South City Corporation", "Dhaka 1205, Bangladesh"].
 * Falls back to `city` for orders placed before district/upazila existed.
 */
export function shippingAddressLines(addr: {
  street?: string;
  union?: string | null;
  upazila?: string;
  district?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}): string[] {
  const join = (parts: (string | null | undefined)[], sep: string) =>
    parts.filter(Boolean).join(sep);
  return [
    addr.street,
    join([addr.union, addr.upazila], ", "),
    join([join([addr.district || addr.city, addr.postalCode], " "), addr.country], ", "),
  ].filter((line): line is string => Boolean(line));
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

/**
 * Random key for one checkout attempt, sent as the Idempotency-Key header.
 * randomUUID only exists on HTTPS or localhost, so a phone on the LAN (plain
 * http://192.168…) falls back to getRandomValues.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}
