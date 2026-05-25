"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "./cn";

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
  onPageSizeChange?: (s: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className,
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  const pages: (number | "...")[] = [];
  if (pageCount <= 7) {
    for (let i = 1; i <= pageCount; i++) pages.push(i);
  } else {
    pages.push(1);
    if (safePage > 3) pages.push("...");
    const from = Math.max(2, safePage - 1);
    const to = Math.min(pageCount - 1, safePage + 1);
    for (let i = from; i <= to; i++) pages.push(i);
    if (safePage < pageCount - 2) pages.push("...");
    pages.push(pageCount);
  }

  const btnBase =
    "flex h-7 min-w-7 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-soft)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors";

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <div className="text-[11px] text-[var(--text-soft)]">
        ສະແດງ <span className="font-semibold text-[var(--text)]">{start}–{end}</span> /{" "}
        <span className="font-semibold text-[var(--text)]">{total}</span>
      </div>

      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-7 px-2 text-[11px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
          >
            {pageSizeOptions.map((s) => (
              <option key={s} value={s}>
                {s} / ໜ້າ
              </option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            className={cn(btnBase, "w-7")}
          >
            <ChevronLeft size={13} />
          </button>
          {pages.map((p, i) =>
            p === "..." ? (
              <span key={`e${i}`} className="px-1 text-[11px] text-[var(--text-mute)]">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={cn(
                  "h-7 min-w-7 px-2 rounded-[var(--radius-sm)] text-[11px] font-medium transition-colors",
                  p === safePage
                    ? "bg-[var(--text)] text-[var(--text-inverse)]"
                    : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--bg-subtle)]",
                )}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            disabled={safePage >= pageCount}
            onClick={() => onPageChange(safePage + 1)}
            className={cn(btnBase, "w-7")}
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
