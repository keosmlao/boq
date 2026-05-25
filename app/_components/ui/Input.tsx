"use client";

import {
  forwardRef,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "./cn";

type Size = "sm" | "md" | "lg";

const sizeStyles: Record<Size, string> = {
  sm: "h-8 px-2.5 text-xs rounded-[var(--radius-sm)]",
  md: "h-9 px-3 text-[13px] rounded-[var(--radius-sm)]",
  lg: "h-10 px-3.5 text-sm rounded-[var(--radius-sm)]",
};

const baseField =
  "w-full bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] " +
  "placeholder:text-[var(--text-mute)] transition-colors " +
  "hover:border-[var(--border-strong)] " +
  "focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] " +
  "disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-[var(--bg-subtle)]";

const invalidField =
  "border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[color-mix(in_srgb,var(--danger)_24%,transparent)]";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  inputSize?: Size;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { inputSize = "md", leftIcon, rightIcon, invalid, className, ...rest },
  ref,
) {
  if (leftIcon || rightIcon) {
    return (
      <div className="relative w-full">
        {leftIcon && (
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-mute)]">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          className={cn(
            baseField,
            sizeStyles[inputSize],
            leftIcon && "pl-8",
            rightIcon && "pr-8",
            invalid && invalidField,
            className,
          )}
          {...rest}
        />
        {rightIcon && (
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-mute)]">
            {rightIcon}
          </span>
        )}
      </div>
    );
  }
  return (
    <input
      ref={ref}
      className={cn(
        baseField,
        sizeStyles[inputSize],
        invalid && invalidField,
        className,
      )}
      {...rest}
    />
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, rows = 3, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        baseField,
        "py-2 px-3 text-[13px] rounded-[var(--radius-sm)] resize-y min-h-[64px]",
        invalid && invalidField,
        className,
      )}
      {...rest}
    />
  );
});

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  selectSize?: Size;
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { selectSize = "md", invalid, className, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        baseField,
        sizeStyles[selectSize],
        "pr-8 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23737373%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%226 9 12 15 18 9%22/></svg>')] bg-no-repeat bg-[right_0.65rem_center]",
        invalid && invalidField,
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, hint, error, required, htmlFor, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-[12px] font-medium text-[var(--text)]"
        >
          {label}
          {required && <span className="ml-0.5 text-[var(--danger)]">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <div className="text-[11px] font-medium text-[var(--danger)]">{error}</div>
      ) : hint ? (
        <div className="text-[11px] text-[var(--text-mute)]">{hint}</div>
      ) : null}
    </div>
  );
}
