import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-zinc-800/80 bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <p className="font-display text-xl font-bold tracking-tight text-zinc-50">
              Gadget<span className="text-lime-400">Lax</span>
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Premium gadgets, audio, wearables & smart home tech.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link href="/products" className="text-zinc-400 transition hover:text-lime-300">
              Products
            </Link>
            <Link href="/cart" className="text-zinc-400 transition hover:text-lime-300">
              Cart
            </Link>
            <Link href="/orders" className="text-zinc-400 transition hover:text-lime-300">
              Orders
            </Link>
            <Link href="/account" className="text-zinc-400 transition hover:text-lime-300">
              Account
            </Link>
          </nav>
        </div>
        <div className="mt-8 flex flex-col items-start justify-between gap-2 border-t border-zinc-800/60 pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-zinc-600">
            © {new Date().getFullYear()} GadgetLax — demo e-commerce storefront.
          </p>
          <p className="text-xs text-zinc-600">
            Next.js + NestJS + Prisma + PostgreSQL
          </p>
        </div>
      </div>
    </footer>
  );
}
