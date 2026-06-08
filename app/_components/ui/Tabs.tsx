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
          "inline-flex items-center gap-0.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-soft)] p-1",
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
                "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 text-[12px] font-medium transition-colors",
                fullWidth && "flex-1",
                active
                  ? "bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-xs)]"
                  : "text-[var(--text-soft)] hover:text-[var(--text)]",
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
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors",
                active
                  ? "border-transparent bg-[var(--brand)] text-white"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-soft)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]",
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
        "flex items-center gap-1 border-b border-[var(--border)]",
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
              "relative inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium transition-colors -mb-px border-b-2",
              active
                ? "border-[var(--text)] text-[var(--text)]"
                : "border-transparent text-[var(--text-soft)] hover:text-[var(--text)]",
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
