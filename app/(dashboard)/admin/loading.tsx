// Shown instantly while a console page loads (inside the console's own dark
// layout and tabs), so a click never looks like it did nothing.
export default function MasterLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-8" aria-busy aria-label="Loading">
      <div className="flex items-center gap-4">
        <span className="size-12 shrink-0 rounded-2xl bg-amber-400/15 sm:size-16" />
        <div className="flex flex-col gap-2">
          <span className="h-7 w-64 max-w-[60vw] rounded-lg bg-amber-200/10 sm:h-9" />
          <span className="h-4 w-48 max-w-[50vw] rounded bg-rose-100/10" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-24 rounded-2xl border border-amber-500/15 bg-white/[0.03]" />
        ))}
      </div>
      <div className="h-72 rounded-2xl border border-amber-500/15 bg-white/[0.03]" />
    </div>
  );
}
