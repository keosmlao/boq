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
  sm: "h-8 px-2.5 text-xs rounded",
  md: "h-9 px-3 text-[13px] rounded-md",
  lg: "h-10 px-3.5 text-sm rounded-lg",
};

const baseField =
  "theme-input w-full transition-all placeholder:text-[#8ea0b9] disabled:opacity-60 disabled:cursor-not-allowed";

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
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8ea0b9]">
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
            invalid && "border-rose-400 focus:border-rose-400 focus:ring-rose-200",
            className,
          )}
          {...rest}
        />
        {rightIcon && (
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8ea0b9]">
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
        invalid && "border-rose-400 focus:border-rose-400",
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
        "py-2 px-3 text-[13px] rounded-md resize-y min-h-[64px]",
        invalid && "border-rose-400 focus:border-rose-400",
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
        "pr-8 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%235e728e%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%226 9 12 15 18 9%22/></svg>')] bg-no-repeat bg-[right_0.65rem_center]",
        invalid && "border-rose-400 focus:border-rose-400",
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
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-[11px] font-semibold text-[var(--theme-text)]"
        >
          {label}
          {required && <span className="ml-1 text-rose-500">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <div className="text-[11px] font-medium text-rose-500">{error}</div>
      ) : hint ? (
        <div className="text-[11px] text-[var(--theme-text-soft)]">{hint}</div>
      ) : null}
    </div>
  );
}
