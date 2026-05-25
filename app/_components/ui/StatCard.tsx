"use client";

import { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "./cn";

export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  trend?: { value: string; direction: "up" | "down" | "flat" };
  tone?: "neutral" | "primary" | "success" | "warning" | "danger";
  onClick?: () => void;
  className?: string;
}

const toneIconStyles = {
  neutral: "bg-[var(--bg-subtle)] text-[var(--text-soft)]",
  primary: "bg-[var(--brand-soft)] text-[var(--brand)]",
  success: "bg-[var(--success-soft)] text-[var(--success)]",
  warning: "bg-[var(--warning-soft)] text-[var(--warning)]",
  danger:  "bg-[var(--danger-soft)] text-[var(--danger)]",
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  trend,
  tone = "primary",
  onClick,
  className,
}: StatCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "group flex w-full flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition-colors",
        onClick && "hover:border-[var(--border-strong)] cursor-pointer",
        !onClick && "cursor-default",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-mute)]">
          {label}
        </span>
        {icon && (
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)]",
              toneIconStyles[tone],
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <div>
        <div className="text-[24px] font-bold tracking-tight text-[var(--text)]">{value}</div>
        {(hint || trend) && (
          <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--text-soft)]">
            {trend && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-semibold",
                  trend.direction === "up" && "text-[var(--success)]",
                  trend.direction === "down" && "text-[var(--danger)]",
                  trend.direction === "flat" && "text-[var(--text-mute)]",
                )}
              >
                {trend.direction === "up" && <ArrowUpRight size={11} />}
                {trend.direction === "down" && <ArrowDownRight size={11} />}
                {trend.value}
              </span>
            )}
            {hint && <span>{hint}</span>}
          </div>
        )}
      </div>
    </button>
  );
}
