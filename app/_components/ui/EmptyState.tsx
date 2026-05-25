"use client";

import { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "./cn";

export interface EmptyStateProps {
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon,
  title = "ບໍ່ມີຂໍ້ມູນສະແດງ",
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
        className,
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--text-soft)]">
        {icon || <Inbox size={20} />}
      </div>
      <div className="mt-3 text-[14px] font-semibold text-[var(--text)]">{title}</div>
      {description && (
        <div className="mt-1 max-w-xs text-[12px] text-[var(--text-soft)]">
          {description}
        </div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
