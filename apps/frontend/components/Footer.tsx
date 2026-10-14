export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-8 sm:flex-row sm:px-6">
        <p className="text-sm text-slate-500">
          <span className="font-semibold text-slate-700">ShopStack</span> — demo
          e-commerce storefront.
        </p>
        <p className="text-xs text-slate-400">
          Next.js + NestJS + Prisma + PostgreSQL
        </p>
      </div>
    </footer>
  );
}
