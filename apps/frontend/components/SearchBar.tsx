"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import type { Product, ProductsResponse } from "@/lib/types";

/**
 * Live search input with a results dropdown (product image + name + price).
 * Debounced API search; works on desktop and mobile.
 */
export default function SearchBar({ className = "" }: { className?: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await apiClient.get<ProductsResponse>(
          `/products?search=${encodeURIComponent(q)}&limit=6`
        );
        setResults(res.items ?? []);
        setOpen(true);
      } catch {
        setResults([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  // Close on outside click / Escape
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setOpen(false);
    router.push(`/products${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`);
  };

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <form onSubmit={submit} role="search">
        <div className="relative w-full">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Search for products"
            className="w-full rounded-full border border-zinc-200 bg-white py-3 pl-5 pr-14 text-sm text-zinc-900 placeholder:text-zinc-400 transition focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
          {loading ? (
            <span className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-blue-600">
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            </span>
          ) : (
            <button
              type="submit"
              aria-label="Search"
              className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition hover:bg-blue-700"
            >
              <Search className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>

      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
          <ul className="grid max-h-80 grid-cols-2 divide-x divide-zinc-100 overflow-y-auto">
            {results.map((p) => {
              const hasDiscount =
                p.comparePrice != null && p.comparePrice > p.price;
              return (
                <li key={p.id} className="border-b border-zinc-100">
                  <Link
                    href={`/products/${p.slug}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 transition hover:bg-zinc-50"
                  >
                    <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-zinc-50">
                      {p.imageUrl && (
                        <Image
                          src={p.imageUrl}
                          alt={p.name}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 block text-[13px] font-medium leading-snug text-zinc-800">
                        {p.name}
                      </span>
                      <span className="mt-0.5 block text-sm">
                        {hasDiscount && (
                          <span className="mr-1.5 text-zinc-400 line-through">
                            {formatPrice(p.comparePrice!)}
                          </span>
                        )}
                        <span className="font-bold text-blue-600">
                          {formatPrice(p.price)}
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <button
            onClick={submit}
            className="w-full bg-white px-3 py-3 text-center text-sm font-bold uppercase tracking-wide text-zinc-800 transition hover:bg-zinc-50"
          >
            View all results
          </button>
        </div>
      )}
    </div>
  );
}
