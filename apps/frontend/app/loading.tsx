export default function HomeLoading() {
  return (
    <div className="animate-pulse space-y-12">
      {/* Banner skeleton */}
      <div className="aspect-[4/3] w-full rounded-3xl bg-zinc-200 sm:aspect-[21/9]" />
      {/* Category tiles skeleton */}
      <div>
        <div className="mb-4 h-7 w-48 rounded-lg bg-zinc-200" />
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-zinc-200" />
          ))}
        </div>
      </div>
      {/* Products skeleton */}
      <div>
        <div className="mb-4 h-7 w-48 rounded-lg bg-zinc-200" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl bg-zinc-200">
              <div className="aspect-square bg-zinc-300/50" />
              <div className="space-y-2 p-3">
                <div className="h-4 w-3/4 rounded bg-zinc-300/50" />
                <div className="h-4 w-1/3 rounded bg-zinc-300/50" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
