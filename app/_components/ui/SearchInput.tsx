"use client";

import { Search, X } from "lucide-react";
import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "./cn";

export interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "onChange" | "value"> {
  value: string;
  onChange: (v: string) => void;
  size?: "sm" | "md" | "lg";
  onClear?: () => void;
  placeholder?: string;
}

const sizeStyles = {
  sm: "h-8 text-xs rounded-md pl-7 pr-7",
  md: "h-9 text-[13px] rounded-lg pl-8 pr-8",
  lg: "h-11 text-sm rounded-md pl-9 pr-9",
};

const iconSize = { sm: 13, md: 14, lg: 16 };

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, onChange, size = "md", onClear, placeholder = "ຄົ້ນຫາ...", className, ...rest },
  ref,
) {
  return (
    <div className={cn("relative w-full", className)}>
      <Search
        size={iconSize[size]}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8ea0b9]"
      />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "theme-input w-full transition-all",
          sizeStyles[size],
        )}
        {...rest}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            onClear?.();
          }}
          aria-label="ລ້າງ"
          className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#8ea0b9] hover:bg-black/5"
        >
          <X size={iconSize[size]} />
        </button>
      )}
    </div>
  );
});
