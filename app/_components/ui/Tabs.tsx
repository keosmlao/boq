"use client";

import { ReactNode } from "react";
import { cn } from "./cn";

export interface TabItem {
  value: string;
  label: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  variant?: "underline" | "pills" | "segmented";
  fullWidth?: boolean;
  className?: string;
}

export function Tabs({
  items,
  value,
  onChange,
  variant = "underline",
  fullWidth = false,
  className,
}: TabsProps) {
  if (variant === "segmented") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-0.5 rounded-lg border border-[var(--theme-border)] bg-white/80 p-1 shadow-sm",
          fullWidth && "w-full",
          className,
        )}
        role="tablist"
      >
        {items.map((t) => {
          const active = t.value === value;
          return (
            <button
              key={t.value}
              role="tab"
              aria-selected={active}
              disabled={t.disabled}
              onClick={() => onChange(t.value)}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition",
                fullWidth && "flex-1",
                active
                  ? "bg-[var(--theme-primary)] text-white shadow-md"
                  : "text-[var(--theme-text-soft)] hover:bg-[var(--theme-primary-tint)] hover:text-[var(--theme-primary)]",
                t.disabled && "opacity-50 cursor-not-allowed",
              )}
            >
              {t.icon}
              {t.label}
              {t.badge}
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === "pills") {
    return (
      <div className={cn("flex flex-wrap items-center gap-1.5", className)} role="tablist">
        {items.map((t) => {
          const active = t.value === value;
          return (
            <button
              key={t.value}
              role="tab"
              aria-selected={active}
              disabled={t.disabled}
              onClick={() => onChange(t.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold transition",
                active
                  ? "border-transparent bg-[var(--theme-primary)] text-white shadow-md"
                  : "border-[var(--theme-border)] bg-white text-[var(--theme-text-soft)] hover:border-[var(--theme-primary-soft)] hover:text-[var(--theme-primary)]",
                t.disabled && "opacity-50 cursor-not-allowed",
              )}
            >
              {t.icon}
              {t.label}
              {t.badge}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 border-b border-[var(--theme-border)]",
        className,
      )}
      role="tablist"
    >
      {items.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            disabled={t.disabled}
            onClick={() => onChange(t.value)}
            className={cn(
              "relative inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold transition -mb-px border-b-2",
              active
                ? "border-[var(--theme-primary)] text-[var(--theme-primary)]"
                : "border-transparent text-[var(--theme-text-soft)] hover:text-[var(--theme-text)]",
              t.disabled && "opacity-50 cursor-not-allowed",
            )}
          >
            {t.icon}
            {t.label}
            {t.badge}
          </button>
        );
      })}
    </div>
  );
}
