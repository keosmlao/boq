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
  neutral: "bg-[var(--bg-subtle)] text-[var(--text-soft)] border border-[var(--border)]",
  primary: "bg-[var(--brand-soft)] text-[var(--brand)] border border-transparent",
  success: "bg-[var(--success-soft)] text-[var(--success)] border border-transparent",
  warning: "bg-[var(--warning-soft)] text-[var(--warning)] border border-transparent",
  danger:  "bg-[var(--danger-soft)] text-[var(--danger)] border border-transparent",
  info:    "bg-[var(--info-soft)] text-[var(--info)] border border-transparent",
  violet:  "bg-[color-mix(in_srgb,#8b5cf6_14%,transparent)] text-[#7c3aed] border border-transparent",
};

const sizeStyles = {
  xs: "h-5 px-1.5 text-[10px] gap-1 rounded",
  sm: "h-6 px-2 text-[11px] gap-1 rounded-[var(--radius-sm)]",
  md: "h-7 px-2.5 text-xs gap-1.5 rounded-[var(--radius-sm)]",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
  icon?: ReactNode;
  size?: "xs" | "sm" | "md";
}

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
        "inline-flex items-center font-medium whitespace-nowrap",
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
