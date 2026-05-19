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
  neutral: "bg-slate-100 text-slate-600",
  primary: "bg-[var(--theme-primary-tint)] text-[var(--theme-primary)]",
  success: "bg-emerald-50 text-emerald-600",
  warning: "bg-amber-50 text-amber-600",
  danger: "bg-rose-50 text-rose-600",
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
        "theme-stat-card group flex w-full flex-col gap-3 rounded-lg p-4 text-left transition",
        onClick && "theme-card-hover cursor-pointer",
        !onClick && "cursor-default",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="theme-stat-label">{label}</span>
        {icon && (
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md",
              toneIconStyles[tone],
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <div>
        <div className="theme-stat-value">{value}</div>
        {(hint || trend) && (
          <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--theme-text-soft)]">
            {trend && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-semibold",
                  trend.direction === "up" && "text-emerald-600",
                  trend.direction === "down" && "text-rose-500",
                  trend.direction === "flat" && "text-slate-500",
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
