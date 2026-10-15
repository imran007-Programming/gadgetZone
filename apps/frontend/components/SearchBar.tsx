"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import type { Product, ProductsResponse } from "@/lib/types";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

type Status = "idle" | "loading" | "done" | "error";

/**
 * Live search input with a results dropdown (product image + name + price).
 * Debounced API search; works on desktop and mobile. Shows a "searching" and a
 * "no results" state, ignores out-of-order responses, and supports ↑/↓/Enter/Esc.
 */
export default function SearchBar({ className = "" }: { className?: string }) {
  const [query, setQuery] = useState("");
  // Last finished search, keyed by the query it answered
  const [answer, setAnswer] = useState<{ query: string; items: Product[]; failed: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);
  const requestSeq = useRef(0);

  const trimmed = query.trim();
  const searchable = trimmed.length >= MIN_CHARS;
  // Previous results stay visible while the next search is loading
  const results = searchable ? (answer?.items ?? []) : [];
  const status: Status = !searchable
    ? "idle"
    : answer?.query !== trimmed
      ? "loading"
      : answer.failed
        ? "error"
        : "done";

  useEffect(() => {
    const seq = ++requestSeq.current; // drops any response still in flight
    if (!searchable) return;
    const timer = setTimeout(async () => {
      try {
        const res = await apiClient.get<ProductsResponse>(
          `/products?search=${encodeURIComponent(trimmed)}&limit=6`
        );
        if (seq !== requestSeq.current) return; // a newer search started
        setAnswer({ query: trimmed, items: res.items ?? [], failed: false });
        setActive(-1);
      } catch {
        if (seq !== requestSeq.current) return;
        setAnswer({ query: trimmed, items: [], failed: true });
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmed, searchable]);

  // Close on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const goToResults = () => {
    setOpen(false);
    router.push(`/products${trimmed ? `?q=${encodeURIComponent(trimmed)}` : ""}`);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (open && active >= 0 && results[active]) {
      setOpen(false);
      router.push(`/products/${results[active].slug}`);
      return;
    }
    goToResults();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    }
  };

  const showPanel = open && trimmed.length >= MIN_CHARS && status !== "idle";

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <form onSubmit={submit} role="search">
        <div className="relative w-full">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Search for products"
            aria-label="Search for products"
            role="combobox"
            aria-controls="search-results"
            aria-expanded={showPanel}
            aria-autocomplete="list"
            autoComplete="off"
            className="w-full rounded-full border border-zinc-200 bg-white py-3 pl-5 pr-14 text-sm text-zinc-900 placeholder:text-zinc-400 transition focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
          />
          {status === "loading" ? (
            <span className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-primary-600">
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            </span>
          ) : (
            <button
              type="submit"
              aria-label="Search"
              className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-primary-600 text-white shadow-sm transition hover:bg-primary-700"
            >
              <Search className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>

      {showPanel && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
          {status === "loading" && results.length === 0 ? (
            <p className="flex items-center gap-2 px-4 py-4 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </p>
          ) : status === "error" ? (
            <p className="px-4 py-4 text-sm text-zinc-500">Search is unavailable right now. Please try again.</p>
          ) : results.length === 0 ? (
            <div className="px-4 py-5 text-sm text-zinc-500">
              No products found for <span className="font-semibold text-zinc-800">“{trimmed}”</span>.
              <span className="mt-1 block text-xs text-zinc-400">Try a brand (Sony), a product type (watch) or a category (audio).</span>
            </div>
          ) : (
            <>
              <ul id="search-results" role="listbox" className="grid max-h-80 grid-cols-1 overflow-y-auto sm:grid-cols-2 sm:divide-x sm:divide-zinc-100">
                {results.map((p, i) => {
                  const hasDiscount = p.comparePrice != null && p.comparePrice > p.price;
                  return (
                    <li key={p.id} role="option" aria-selected={i === active} className="border-b border-zinc-100">
                      <Link
                        href={`/products/${p.slug}`}
                        onClick={() => setOpen(false)}
                        onMouseEnter={() => setActive(i)}
                        className={`flex items-center gap-3 px-3 py-3 transition ${i === active ? "bg-primary-50" : "hover:bg-zinc-50"}`}
                      >
                        <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-zinc-50">
                          {p.imageUrl && (
                            <Image src={p.imageUrl} alt={p.name} fill sizes="56px" className="object-cover" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          {p.brand && (
                            <span className="block text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                              {p.brand.name}
                            </span>
                          )}
                          <span className="line-clamp-2 block text-[13px] font-medium leading-snug text-zinc-800">
                            {p.name}
                          </span>
                          <span className="mt-0.5 block text-sm">
                            {hasDiscount && (
                              <span className="mr-1.5 text-zinc-400 line-through">{formatPrice(p.comparePrice!)}</span>
                            )}
                            <span className="font-bold text-primary-600">{formatPrice(p.price)}</span>
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                onClick={goToResults}
                className="w-full bg-white px-3 py-3 text-center text-sm font-bold uppercase tracking-wide text-zinc-800 transition hover:bg-zinc-50"
              >
                View all results
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
