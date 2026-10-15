import Link from "next/link";
import { Headset, Mail, MapPin } from "lucide-react";

const columns = [
  {
    title: "Explore",
    links: [
      { label: "All products", href: "/products" },
      { label: "New arrivals", href: "/products?sort=newest" },
      { label: "Deals", href: "/products?sort=price-asc" },
      { label: "Wishlist", href: "/wishlist" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help center", href: "/help" },
      { label: "My orders", href: "/dashboard/orders" },
      { label: "My account", href: "/dashboard" },
      { label: "Cart", href: "/cart" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white">
      <div className="mx-auto max-w-[2000px] px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <p className="font-display text-2xl font-bold tracking-tight text-zinc-900">
              Gadget<span className="text-blue-600">Lax</span>
            </p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-zinc-600">
              Premium gadgets, audio, wearables and smart home tech — curated,
              tested and shipped fast.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">
                {col.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-zinc-600 transition hover:text-blue-700"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">
              Get in touch
            </p>
            <ul className="mt-4 space-y-3 text-sm text-zinc-600">
              <li className="flex items-center gap-2.5">
                <Headset className="h-4 w-4 shrink-0 text-blue-600" />
                Customer care, 9am–9pm
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-blue-600" />
                support@gadgetlax.example
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                Lakshmipur, Chittagong, Bangladesh
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-2 border-t border-zinc-200 pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-zinc-500">
            © {new Date().getFullYear()} GadgetLax — demo e-commerce storefront.
          </p>
          <p className="text-xs text-zinc-500">
            Next.js + NestJS + Prisma + PostgreSQL
          </p>
        </div>
      </div>
    </footer>
  );
}
