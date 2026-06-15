/**
 * Route-level loading skeleton for every page in the app shell.
 * Renders instantly on navigation while the server component streams in.
 */
export default function Loading() {
  return (
    <div className="px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto max-w-[1200px] animate-pulse">
        {/* Header */}
        <div className="mb-6">
          <div className="h-7 w-52 rounded-lg bg-slate-200" />
          <div className="mt-3 h-1 w-9 rounded-full bg-slate-200" />
          <div className="mt-3 h-3 w-36 rounded bg-slate-100" />
        </div>

        {/* Stat row */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="h-11 w-11 flex-shrink-0 rounded-xl bg-slate-100" />
              <div className="min-w-0 flex-1">
                <div className="h-2.5 w-12 rounded bg-slate-100" />
                <div className="mt-2 h-5 w-16 rounded bg-slate-200" />
              </div>
            </div>
          ))}
        </div>

        {/* List / table body */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-slate-100 px-4 py-3.5 last:border-b-0">
              <div className="h-9 w-9 flex-shrink-0 rounded-xl bg-slate-100" />
              <div className="min-w-0 flex-1">
                <div className="h-3 w-40 rounded bg-slate-200" />
                <div className="mt-2 h-2.5 w-24 rounded bg-slate-100" />
              </div>
              <div className="h-5 w-16 flex-shrink-0 rounded-md bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
