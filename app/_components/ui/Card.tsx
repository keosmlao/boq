"use client";

import { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type CardVariant = "default" | "soft" | "strong" | "hero";

const variantStyles: Record<CardVariant, string> = {
  default: "theme-card",
  soft: "theme-card-soft",
  strong: "theme-page-surface-strong",
  hero: "theme-hero-panel",
};

const padStyles = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
  xl: "p-6",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  pad?: keyof typeof padStyles;
  hover?: boolean;
  rounded?: "md" | "lg" | "xl" | "2xl";
}

export function Card({
  variant = "default",
  pad = "md",
  hover = false,
  rounded = "lg",
  className,
  children,
  ...rest
}: CardProps) {
  const roundedMap = {
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-md",
    "2xl": "rounded-lg",
  };
  return (
    <div
      className={cn(
        variantStyles[variant],
        roundedMap[rounded],
        padStyles[pad],
        hover && "theme-card-hover",
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
          <div className="theme-icon-badge flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          {title && <div className="theme-section-title truncate">{title}</div>}
          {subtitle && <div className="theme-section-copy mt-0.5 truncate">{subtitle}</div>}
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
      className={cn("mt-3 flex items-center justify-end gap-2 border-t border-[var(--theme-border)] pt-3", className)}
      {...rest}
    >
      {children}
    </div>
  );
}
