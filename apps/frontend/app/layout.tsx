import type { Metadata } from "next";
import { Noto_Sans_Bengali, Poppins } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import SiteChrome from "@/components/SiteChrome";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${poppins.variable} ${taka.variable}`}>
      <body
        className={`flex min-h-screen flex-col bg-zinc-50 font-sans text-zinc-900`}
      >
        <Providers>
          <SiteChrome>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
