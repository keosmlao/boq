"use client";

import { cn } from "./cn";

export interface AvatarProps {
  name: string;
  src?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  status?: "online" | "offline" | "away" | null;
  className?: string;
}

const sizeStyles = {
  xs: "h-6 w-6 text-[9px]",
  sm: "h-8 w-8 text-[10px]",
  md: "h-9 w-9 text-[11px]",
  lg: "h-11 w-11 text-[13px]",
  xl: "h-14 w-14 text-base",
};

const statusColor = {
  online: "bg-[var(--success)]",
  offline: "bg-[var(--text-mute)]",
  away: "bg-[var(--warning)]",
};

export function Avatar({ name, src, size = "md", status, className }: AvatarProps) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s.charAt(0).toUpperCase())
      .join("") || "U";

  return (
    <div className={cn("relative inline-flex flex-shrink-0", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-[var(--radius-sm)] font-semibold",
          "bg-[var(--bg-subtle)] text-[var(--text-soft)] border border-[var(--border)]",
          sizeStyles[size],
        )}
      >
        {src ? (
          <img
            src={src}
            alt={name}
            className="h-full w-full rounded-[var(--radius-sm)] object-cover"
          />
        ) : (
          initials
        )}
      </div>
      {status && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--surface)]",
            statusColor[status],
          )}
        />
      )}
    </div>
  );
}
