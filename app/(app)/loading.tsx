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
          <div className="h-7 w-52 rounded-lg bg-[var(--surface-sunken)]" />
          <div className="mt-3 h-1 w-9 rounded-full bg-[var(--brand-soft)]" />
          <div className="mt-3 h-3 w-36 rounded bg-[var(--border-soft)]" />
        </div>

        {/* Stat row */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="h-11 w-11 flex-shrink-0 rounded-xl bg-[var(--surface-sunken)]" />
              <div className="min-w-0 flex-1">
                <div className="h-2.5 w-12 rounded bg-[var(--border-soft)]" />
                <div className="mt-2 h-5 w-16 rounded bg-[var(--surface-sunken)]" />
              </div>
            </div>
          ))}
        </div>

        {/* List / table body */}
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-[var(--border-soft)] px-4 py-3.5 last:border-b-0">
              <div className="h-9 w-9 flex-shrink-0 rounded-xl bg-[var(--surface-sunken)]" />
              <div className="min-w-0 flex-1">
                <div className="h-3 w-40 rounded bg-[var(--surface-sunken)]" />
                <div className="mt-2 h-2.5 w-24 rounded bg-[var(--border-soft)]" />
              </div>
              <div className="h-5 w-16 flex-shrink-0 rounded-md bg-[var(--surface-sunken)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
