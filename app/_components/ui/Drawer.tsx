"use client";

import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "./cn";
import { IconButton } from "./Button";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  side?: "right" | "left";
  width?: "sm" | "md" | "lg" | "xl";
  footer?: ReactNode;
  children: ReactNode;
  closeOnBackdrop?: boolean;
}

const widthStyles = {
  sm: "w-full sm:max-w-sm",
  md: "w-full sm:max-w-md",
  lg: "w-full sm:max-w-lg",
  xl: "w-full sm:max-w-2xl",
};

export function Drawer({
  open,
  onClose,
  title,
  description,
  side = "right",
  width = "md",
  footer,
  children,
  closeOnBackdrop = true,
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (typeof window === "undefined") return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[100]",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      <div
        onClick={closeOnBackdrop ? onClose : undefined}
        className={cn(
          "absolute inset-0 bg-[#0f2137]/55 backdrop-blur-sm transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute top-0 bottom-0 flex flex-col bg-white shadow-[var(--theme-shadow-lg)] transition-transform duration-300 ease-out",
          widthStyles[width],
          side === "right" ? "right-0" : "left-0",
          open
            ? "translate-x-0"
            : side === "right"
              ? "translate-x-full"
              : "-translate-x-full",
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-3 border-b border-[var(--theme-border)] px-5 py-3.5">
            <div className="min-w-0">
              {title && (
                <h3 className="text-sm font-bold text-[var(--theme-text)] truncate">{title}</h3>
              )}
              {description && (
                <p className="mt-0.5 text-[11px] text-[var(--theme-text-soft)]">{description}</p>
              )}
            </div>
            <IconButton
              icon={<X size={16} />}
              label="ປິດ"
              variant="ghost"
              size="sm"
              onClick={onClose}
            />
          </div>
        )}
        <div className="theme-scrollbar flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
