"use client";

import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "./cn";
import { IconButton } from "./Button";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  closeOnBackdrop?: boolean;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

const sizeStyles = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-[min(96vw,1400px)]",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  closeOnBackdrop = true,
  footer,
  children,
  className,
}: ModalProps) {
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

  if (!open) return null;
  if (typeof window === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-[#0f2137]/55 backdrop-blur-sm"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 flex w-full flex-col overflow-hidden bg-white shadow-[var(--theme-shadow-lg)]",
          "rounded-t-lg sm:rounded-lg",
          "max-h-[92vh] sm:max-h-[85vh]",
          sizeStyles[size],
          className,
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

export interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  loading?: boolean;
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "ຢືນຢັນ",
  cancelLabel = "ຍົກເລີກ",
  tone = "primary",
  loading = false,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
              className="theme-btn-secondary rounded-md px-3.5 py-1.5 text-[12px] font-semibold"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "rounded-md px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-md disabled:opacity-60",
              tone === "danger"
                ? "bg-rose-500 hover:bg-rose-600"
                : "bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-strong)]",
            )}
          >
            {loading ? "ກຳລັງດຳເນີນ..." : confirmLabel}
          </button>
        </>
      }
    >
      <div />
    </Modal>
  );
}
