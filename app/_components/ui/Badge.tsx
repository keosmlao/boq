"use client";

import { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type BadgeTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "violet";

const toneStyles: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700 border-[var(--theme-border-subtle)]",
  primary: "bg-[var(--theme-primary-tint)] text-[var(--theme-primary)] border-[rgba(15,118,110,0.18)]",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-rose-50 text-rose-700 border-rose-200",
  info: "bg-sky-50 text-sky-700 border-sky-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
  icon?: ReactNode;
  size?: "xs" | "sm" | "md";
}

const sizeStyles = {
  xs: "h-5 px-1.5 text-[10px] gap-1 rounded",
  sm: "h-6 px-2 text-[11px] gap-1 rounded-md",
  md: "h-7 px-2.5 text-xs gap-1.5 rounded-md",
};

export function Badge({
  tone = "neutral",
  dot = false,
  icon,
  size = "sm",
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold border whitespace-nowrap",
        toneStyles[tone],
        sizeStyles[size],
        className,
      )}
      {...rest}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {icon}
      {children}
    </span>
  );
}
