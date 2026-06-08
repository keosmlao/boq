"use client";

import { forwardRef, ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "success"
  | "outline";

export type ButtonSize = "xs" | "sm" | "md" | "lg";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--brand)] text-white border border-[var(--brand)] hover:bg-[var(--brand-hover)] hover:border-[var(--brand-hover)]",
  secondary:
    "bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--bg-subtle)] hover:border-[var(--border-strong)]",
  ghost:
    "bg-transparent text-[var(--text-soft)] border border-transparent hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]",
  outline:
    "bg-transparent text-[var(--brand)] border border-[var(--brand)] hover:bg-[var(--brand-soft)]",
  danger:
    "bg-[var(--danger)] text-white border border-[var(--danger)] hover:opacity-90",
  success:
    "bg-[var(--success)] text-white border border-[var(--success)] hover:opacity-90",
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: "h-7 px-2.5 text-[11px] gap-1 rounded-[var(--radius-sm)]",
  sm: "h-8 px-3 text-xs gap-1.5 rounded-[var(--radius-sm)]",
  md: "h-9 px-3.5 text-[13px] gap-2 rounded-[var(--radius-sm)]",
  lg: "h-10 px-5 text-sm gap-2 rounded-[var(--radius-md)]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    leftIcon,
    rightIcon,
    loading = false,
    fullWidth = false,
    disabled,
    className,
    children,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-medium whitespace-nowrap transition-colors select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg)]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        sizeStyles[size],
        variantStyles[variant],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
});

export interface IconButtonProps
  extends Omit<ButtonProps, "leftIcon" | "rightIcon" | "children"> {
  icon: ReactNode;
  label: string;
}

export function IconButton({
  icon,
  label,
  size = "md",
  variant = "ghost",
  className,
  ...rest
}: IconButtonProps) {
  const square: Record<ButtonSize, string> = {
    xs: "h-7 w-7",
    sm: "h-8 w-8",
    md: "h-9 w-9",
    lg: "h-10 w-10",
  };
  return (
    <Button
      aria-label={label}
      variant={variant}
      size={size}
      className={cn("p-0", square[size], className)}
      {...rest}
    >
      {icon}
    </Button>
  );
}
