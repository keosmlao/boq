/**
 * Dashboard route loading state.
 *
 * Next.js renders this INSTANTLY on navigation — before any server action
 * fires — so users see a structured placeholder instead of a frozen previous
 * page. Layout mirrors the typical list/grid pages (header strip + table rows).
 */
export default function Loading() {
  return (
    <div className="w-full animate-fade-in">
      {/* Header row: title + actions */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-5 w-44 animate-pulse rounded bg-[var(--bg-subtle)]" />
          <div className="h-3 w-28 animate-pulse rounded bg-[var(--bg-subtle)]" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-20 animate-pulse rounded-[var(--radius-sm)] bg-[var(--bg-subtle)]" />
          <div className="h-8 w-28 animate-pulse rounded-[var(--radius-sm)] bg-[var(--bg-subtle)]" />
        </div>
      </div>

      {/* Filter chips */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {[68, 84, 76, 90, 64].map((w, i) => (
          <div
            key={i}
            className="h-7 animate-pulse rounded-full bg-[var(--bg-subtle)]"
            style={{ width: `${w}px` }}
          />
        ))}
      </div>

      {/* Stat cards row (shown on most dashboards) */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 animate-pulse rounded bg-[var(--bg-subtle)]" />
              <div className="h-9 w-9 animate-pulse rounded-[var(--radius-sm)] bg-[var(--bg-subtle)]" />
            </div>
            <div className="mt-3 h-7 w-16 animate-pulse rounded bg-[var(--bg-subtle)]" />
          </div>
        ))}
      </div>

      {/* Table shell */}
      <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center gap-4 border-b border-[var(--border-soft)] bg-[var(--surface-sunken)] px-4 py-2.5">
          {[110, 90, 80, 80, 70, 60].map((w, i) => (
            <div
              key={i}
              className="h-3 animate-pulse rounded bg-[var(--bg-subtle)]"
              style={{ width: `${w}px` }}
            />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-[var(--border-soft)] px-4 py-3 last:border-0"
          >
            {[140, 100, 80, 90, 70, 50].map((w, j) => (
              <div
                key={j}
                className="h-3 animate-pulse rounded bg-[var(--bg-subtle)]"
                style={{
                  width: `${w}px`,
                  // Vary opacity so the rows feel alive, not a perfect grid.
                  opacity: 1 - (i % 3) * 0.06,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
