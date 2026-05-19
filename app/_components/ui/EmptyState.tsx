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
        "theme-empty-state flex flex-col items-center justify-center rounded-md text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--theme-primary-tint)] text-[var(--theme-primary)]">
        {icon || <Inbox size={22} />}
      </div>
      <div className="mt-3 text-sm font-semibold text-[var(--theme-text)]">{title}</div>
      {description && (
        <div className="mt-1 max-w-xs text-[12px] text-[var(--theme-text-soft)]">
          {description}
        </div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
