import type { Metadata } from "next";
import { Noto_Sans_Bengali, Poppins } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import SiteChrome from "@/components/SiteChrome";
import { apiClient } from "@/lib/api";
import type { ChromeData } from "@/lib/categories";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { Category, SiteSettings } from "@/lib/types";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

// Poppins has no Taka glyph, so the ৳ in prices falls back to this font.
// Only the 800 weight is loaded, so the symbol renders heavy wherever it appears.
const taka = Noto_Sans_Bengali({
  subsets: ["bengali"],
  weight: ["800"],
  variable: "--font-taka",
  display: "swap",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "GadgetLax — Premium Gadgets",
  description:
    "GadgetLax — premium gadgets, audio, wearables and smart home tech. Full-stack e-commerce built with Next.js, NestJS, Prisma and PostgreSQL.",
};

/**
 * Top bar settings + category nav, rendered on the server; null falls back to the client fetch.
 * Cached by tag: the admin panel drops a tag as soon as it saves (app/api/revalidate), and the
 * 1-hour revalidate only catches changes made outside the admin panel.
 */
async function getChromeData(): Promise<ChromeData> {
  const [settings, categories] = await Promise.all([
    apiClient
      .get<SiteSettings>("/settings", { next: { revalidate: 3600, tags: [CACHE_TAGS.settings] } })
      .catch(() => null),
    apiClient
      .get<Category[]>("/categories", { next: { revalidate: 3600, tags: [CACHE_TAGS.categories] } })
      .catch(() => null),
  ]);
  return { settings, categories, fetchedAt: Date.now() };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const chrome = await getChromeData();

  return (
    <html lang="en" className={`${poppins.variable} ${taka.variable}`}>
      <body
        className={`flex min-h-screen flex-col bg-zinc-50 font-sans text-zinc-900`}
      >
        <Providers chrome={chrome}>
          <SiteChrome>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
