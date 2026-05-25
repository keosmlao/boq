"use client";

import { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type CardVariant = "default" | "soft" | "strong" | "hero";

const variantStyles: Record<CardVariant, string> = {
  default: "bg-[var(--surface)] border border-[var(--border)]",
  soft:    "bg-[var(--surface-soft)] border border-[var(--border-soft)]",
  strong:  "bg-[var(--surface)] border border-[var(--border-strong)]",
  hero:    "bg-[var(--surface)] border border-[var(--border)]",
};

const padStyles = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
  xl: "p-6",
};

const roundedMap = {
  md: "rounded-[var(--radius-md)]",
  lg: "rounded-[var(--radius-lg)]",
  xl: "rounded-[var(--radius-lg)]",
  "2xl": "rounded-[var(--radius-xl)]",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  pad?: keyof typeof padStyles;
  hover?: boolean;
  rounded?: keyof typeof roundedMap;
}

export function Card({
  variant = "default",
  pad = "md",
  hover = false,
  rounded = "md",
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        variantStyles[variant],
        roundedMap[rounded],
        padStyles[pad],
        "transition-colors",
        hover && "hover:border-[var(--border-strong)] cursor-pointer",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, icon, action, className }: CardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--brand-soft)] text-[var(--brand)]">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          {title && (
            <div className="text-[14px] font-semibold text-[var(--text)] truncate">{title}</div>
          )}
          {subtitle && (
            <div className="text-[12px] text-[var(--text-soft)] mt-0.5 truncate">{subtitle}</div>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mt-3", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mt-4 flex items-center justify-end gap-2 border-t border-[var(--border-soft)] pt-3",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
