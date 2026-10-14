"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Banner {
  src: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
}

const BANNERS: Banner[] = [
  {
    src: "/banners/banner-1.jpg",
    eyebrow: "Premium Audio",
    title: "Hear every detail",
    subtitle: "Headphones, earbuds & speakers — top-rated sound gear.",
    cta: "Shop Audio",
    href: "/products?category=audio",
  },
  {
    src: "/banners/banner-2.jpg",
    eyebrow: "Smartwatches",
    title: "Time, upgraded",
    subtitle: "Smartwatches & fitness trackers for every lifestyle.",
    cta: "Shop Wearables",
    href: "/products?category=wearables",
  },
  {
    src: "/banners/banner-3.jpg",
    eyebrow: "Smart Home",
    title: "Your home, smarter",
    subtitle: "Cameras, bulbs & plugs to automate everyday living.",
    cta: "Shop Smart Home",
    href: "/products?category=smart-home",
  },
  {
    src: "/banners/banner-4.jpg",
    eyebrow: "Power & Charging",
    title: "Stay charged",
    subtitle: "Power banks, fast chargers & cables that keep up.",
    cta: "Shop Accessories",
    href: "/products?category=mobile-accessories",
  },
];

const AUTOPLAY_MS = 5000;

export default function BannerCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  const goTo = useCallback((i: number) => {
    setIndex(((i % BANNERS.length) + BANNERS.length) % BANNERS.length);
  }, []);

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % BANNERS.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [paused]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) {
      if (dx < 0) next();
      else prev();
    }
    touchX.current = null;
  };

  return (
    <section
      aria-label="Featured banners"
      className="relative overflow-hidden rounded-3xl shadow-sm"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="flex transition-transform duration-700 ease-in-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {BANNERS.map((b) => (
          <div
            key={b.src}
            className="relative w-full shrink-0 aspect-[4/3] sm:aspect-[21/9]"
          >
            <Image
              src={b.src}
              alt={b.title}
              fill
              priority={b.src === BANNERS[0].src}
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 1200px"
            />
            <div
              className="absolute inset-0 bg-gradient-to-r from-zinc-950/70 via-zinc-950/30 to-transparent"
              aria-hidden
            />
            <div className="absolute inset-0 flex flex-col justify-center p-6 sm:p-12">
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
                {b.eyebrow}
              </p>
              <h2 className="mt-2 max-w-md text-3xl font-bold tracking-tight text-white sm:text-5xl">
                {b.title}
              </h2>
              <p className="mt-2 max-w-sm text-sm text-white/85 sm:text-base">
                {b.subtitle}
              </p>
              <Link
                href={b.href}
                className="mt-5 inline-flex w-fit items-center rounded-full bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-blue-700"
              >
                {b.cta}
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Arrows */}
      <button
        type="button"
        onClick={prev}
        aria-label="Previous banner"
        className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 p-2 text-zinc-800 shadow-md transition hover:bg-white sm:block"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={next}
        aria-label="Next banner"
        className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 p-2 text-zinc-800 shadow-md transition hover:bg-white sm:block"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
        {BANNERS.map((b, i) => (
          <button
            key={b.src}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Go to banner ${i + 1}`}
            className={`h-2 rounded-full transition-all ${
              i === index ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
