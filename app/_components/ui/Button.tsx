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
    "bg-[linear-gradient(135deg,var(--theme-primary)_0%,var(--theme-primary-strong)_100%)] text-white border border-[rgba(15,118,110,0.22)] shadow-[0_16px_28px_-22px_rgba(15,94,89,0.7)] hover:brightness-95 active:brightness-90",
  secondary:
    "bg-white text-[var(--theme-text)] border border-[var(--theme-border)] hover:bg-[var(--theme-primary-tint)] hover:border-[var(--theme-primary-soft)]",
  ghost:
    "bg-transparent text-[var(--theme-text)] hover:bg-[var(--theme-primary-tint)]",
  outline:
    "bg-transparent text-[var(--theme-primary)] border border-[var(--theme-primary-soft)] hover:bg-[var(--theme-primary-tint)]",
  danger:
    "bg-rose-500 text-white border border-rose-600/20 shadow-[0_18px_30px_-22px_rgba(190,18,60,0.55)] hover:bg-rose-600",
  success:
    "bg-emerald-500 text-white border border-emerald-600/20 shadow-[0_18px_30px_-22px_rgba(5,150,105,0.55)] hover:bg-emerald-600",
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: "h-7 px-2.5 text-[11px] gap-1 rounded",
  sm: "h-8 px-3 text-xs gap-1.5 rounded-md",
  md: "h-9 px-3.5 text-[13px] gap-2 rounded-md",
  lg: "h-10 px-5 text-sm gap-2 rounded-lg",
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
        "inline-flex items-center justify-center font-semibold whitespace-nowrap transition-all select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary-soft)] focus-visible:ring-offset-1 focus-visible:ring-offset-white",
        "disabled:opacity-55 disabled:cursor-not-allowed disabled:shadow-none",
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
    xs: "h-7 w-7 rounded",
    sm: "h-8 w-8 rounded-md",
    md: "h-9 w-9 rounded-md",
    lg: "h-10 w-10 rounded-lg",
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
