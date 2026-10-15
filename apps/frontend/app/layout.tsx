import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import SiteChrome from "@/components/SiteChrome";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
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
    <html lang="en">
      <body
        className={`${poppins.variable} flex min-h-screen flex-col bg-zinc-50 font-sans text-zinc-900`}
      >
        <Providers>
          <SiteChrome>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
