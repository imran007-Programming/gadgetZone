import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import Header from "@/components/Header";
import ConditionalFooter from "@/components/ConditionalFooter";
import CartDrawer from "@/components/CartDrawer";
import MobileNav from "@/components/MobileNav";

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
          <Header />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-24 sm:px-6 md:pb-6">
            {children}
          </main>
          <ConditionalFooter />
          <CartDrawer />
          <MobileNav />
        </Providers>
      </body>
    </html>
  );
}
