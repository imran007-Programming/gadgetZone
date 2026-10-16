"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Banner } from "@/lib/types";

const AUTOPLAY_MS = 5000;

type SlideContent = Pick<Banner, "title" | "imageUrl" | "href">;

/**
 * One banner slide: the image only, and the whole slide is the link.
 * Also used by the admin banner editor as a live preview.
 */
export function BannerSlide({
  banner,
  priority,
  preview,
}: {
  banner: SlideContent;
  priority?: boolean;
  /** Preview mode: image may be a local blob URL and the slide is not clickable. */
  preview?: boolean;
}) {
  // A little taller on mobile (2:1 trims ~7% off each side of the 21:9 artwork)
  const frame = "relative block aspect-[2/1] w-full shrink-0 sm:aspect-[21/9]";
  const image = banner.imageUrl ? (
    <Image
      src={banner.imageUrl}
      alt={banner.title}
      fill
      priority={priority}
      unoptimized={preview && banner.imageUrl.startsWith("blob:")}
      className="object-cover"
      sizes="(max-width: 640px) 100vw, 1200px"
    />
  ) : (
    <div className="absolute inset-0 bg-zinc-200" />
  );

  if (preview || !banner.href) return <div className={frame}>{image}</div>;
  if (/^https?:\/\//.test(banner.href)) {
    return (
      <a href={banner.href} className={frame} aria-label={banner.title} target="_blank" rel="noopener noreferrer">
        {image}
      </a>
    );
  }
  return (
    <Link href={banner.href} className={frame} aria-label={banner.title}>
      {image}
    </Link>
  );
}

/** Homepage carousel; renders nothing when no banner is live. */
export default function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = banners.length;

  const goTo = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);
  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  useEffect(() => {
    if (paused || count < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [paused, count]);

  if (count === 0) return null;

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
      className="relative overflow-hidden rounded-lg shadow-sm sm:rounded-3xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="flex transition-transform duration-700 ease-in-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {banners.map((b, i) => (
          <BannerSlide key={b.id} banner={b} priority={i === 0} />
        ))}
      </div>

      {/* Dots */}
      {count > 1 && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to banner ${i + 1}`}
              className={`h-2 rounded-full transition-all ${
                i === index ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
