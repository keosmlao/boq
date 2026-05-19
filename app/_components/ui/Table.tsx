"use client";

import { ReactNode } from "react";
import { cn } from "./cn";

export interface TableColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  align?: "left" | "center" | "right";
  width?: string;
  className?: string;
  headerClassName?: string;
  hideOnMobile?: boolean;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T, i: number) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  loading?: boolean;
  loadingRows?: number;
  dense?: boolean;
  mobileCard?: (row: T, i: number) => ReactNode;
  className?: string;
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  loading,
  loadingRows = 6,
  dense = false,
  mobileCard,
  className,
}: TableProps<T>) {
  const alignClass = (a?: "left" | "center" | "right") =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

  if (loading) {
    return (
      <div className={cn("theme-table-shell rounded-lg", className)}>
        <div className="divide-y divide-[var(--theme-border)]">
          {Array.from({ length: loadingRows }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="h-3 w-1/4 animate-pulse rounded bg-slate-200/80" />
              <div className="h-3 w-1/5 animate-pulse rounded bg-slate-200/80" />
              <div className="h-3 w-1/6 animate-pulse rounded bg-slate-200/80" />
              <div className="h-3 w-1/6 animate-pulse rounded bg-slate-200/80" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className={cn("theme-empty-state flex flex-col items-center justify-center rounded-lg px-6 py-12 text-center", className)}>
        {empty || (
          <div className="text-sm text-[var(--theme-text-soft)]">ບໍ່ມີຂໍ້ມູນສະແດງ</div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Desktop / tablet: real table */}
      <div className="theme-table-shell hidden rounded-lg md:block">
        <div className="theme-scrollbar overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="theme-table-head">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    style={c.width ? { width: c.width } : undefined}
                    className={cn(
                      "px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.06em]",
                      alignClass(c.align),
                      dense ? "py-2" : "py-2.5",
                      c.headerClassName,
                    )}
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={rowKey(row, i)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "theme-table-row border-b border-[var(--theme-border)] last:border-0",
                    onRowClick && "cursor-pointer",
                  )}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "px-3 text-[12.5px] text-[var(--theme-text)]",
                        dense ? "py-2" : "py-2.5",
                        alignClass(c.align),
                        c.className,
                      )}
                    >
                      {c.cell(row, i)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: card stack */}
      <div className="space-y-2 md:hidden">
        {rows.map((row, i) =>
          mobileCard ? (
            <div
              key={rowKey(row, i)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "theme-card rounded-lg p-3",
                onRowClick && "cursor-pointer active:scale-[0.99]",
              )}
            >
              {mobileCard(row, i)}
            </div>
          ) : (
            <div
              key={rowKey(row, i)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "theme-card rounded-lg p-3 space-y-1.5",
                onRowClick && "cursor-pointer active:scale-[0.99]",
              )}
            >
              {columns
                .filter((c) => !c.hideOnMobile)
                .map((c) => (
                  <div key={c.key} className="flex items-start justify-between gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--theme-text-soft)]">
                      {c.header}
                    </span>
                    <span className="text-[12.5px] text-[var(--theme-text)] text-right">
                      {c.cell(row, i)}
                    </span>
                  </div>
                ))}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
