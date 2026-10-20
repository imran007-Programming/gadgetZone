/** Shown right after a brand link is clicked, while the brand page renders on the server. */
export default function BrandLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Breadcrumb */}
      <div className="h-5 w-48 rounded bg-zinc-200" />
      {/* Brand header: cover, logo, name */}
      <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-200/80">
        <div className="aspect-[3/1] bg-zinc-200 sm:aspect-[5/1]" />
        <div className="flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end">
          <div className="relative -mt-10 h-20 w-20 shrink-0 rounded-2xl bg-zinc-300 ring-4 ring-white" />
          <div className="flex-1 space-y-2">
            <div className="h-7 w-40 rounded-lg bg-zinc-200" />
            <div className="h-4 w-64 max-w-full rounded bg-zinc-200" />
          </div>
        </div>
      </section>
      {/* Sort pills */}
      <div className="flex justify-end gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-20 rounded-full bg-zinc-200" />
        ))}
      </div>
      {/* Product grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200/80">
            <div className="aspect-square bg-zinc-200" />
            <div className="space-y-2 p-3">
              <div className="h-3 w-1/3 rounded bg-zinc-200" />
              <div className="h-4 w-3/4 rounded bg-zinc-200" />
              <div className="h-4 w-1/3 rounded bg-zinc-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
