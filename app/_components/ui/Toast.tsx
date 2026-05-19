"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertTriangle, Info, X, XCircle } from "lucide-react";
import { cn } from "./cn";

export type ToastTone = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  tone: ToastTone;
  title?: ReactNode;
  message: ReactNode;
  duration?: number;
}

interface ToastContextValue {
  show: (t: Omit<ToastItem, "id">) => string;
  success: (message: ReactNode, title?: ReactNode) => string;
  error: (message: ReactNode, title?: ReactNode) => string;
  warning: (message: ReactNode, title?: ReactNode) => string;
  info: (message: ReactNode, title?: ReactNode) => string;
  dismiss: (id: string) => void;
}

const ToastCtx = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const toneStyles: Record<ToastTone, { bg: string; icon: ReactNode }> = {
  success: {
    bg: "border-emerald-200 bg-emerald-50",
    icon: <CheckCircle2 size={16} className="text-emerald-600" />,
  },
  error: {
    bg: "border-rose-200 bg-rose-50",
    icon: <XCircle size={16} className="text-rose-600" />,
  },
  warning: {
    bg: "border-amber-200 bg-amber-50",
    icon: <AlertTriangle size={16} className="text-amber-600" />,
  },
  info: {
    bg: "border-sky-200 bg-sky-50",
    icon: <Info size={16} className="text-sky-600" />,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setItems((s) => s.filter((t) => t.id !== id));
    const tm = timers.current.get(id);
    if (tm) {
      clearTimeout(tm);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (t: Omit<ToastItem, "id">) => {
      const id = Math.random().toString(36).slice(2);
      const duration = t.duration ?? 4000;
      setItems((s) => [...s, { ...t, id }]);
      if (duration > 0) {
        const tm = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, tm);
      }
      return id;
    },
    [dismiss],
  );

  const api = useMemo<ToastContextValue>(
    () => ({
      show,
      dismiss,
      success: (m, t) => show({ tone: "success", message: m, title: t }),
      error: (m, t) => show({ tone: "error", message: m, title: t, duration: 6000 }),
      warning: (m, t) => show({ tone: "warning", message: m, title: t }),
      info: (m, t) => show({ tone: "info", message: m, title: t }),
    }),
    [show, dismiss],
  );

  useEffect(
    () => () => {
      timers.current.forEach((t) => clearTimeout(t));
      timers.current.clear();
    },
    [],
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      {typeof window !== "undefined" &&
        createPortal(
          <div className="pointer-events-none fixed top-3 right-3 z-[200] flex w-full max-w-sm flex-col gap-2 sm:top-4 sm:right-4">
            {items.map((t) => {
              const s = toneStyles[t.tone];
              return (
                <div
                  key={t.id}
                  role="status"
                  className={cn(
                    "pointer-events-auto flex items-start gap-2.5 rounded-md border bg-white px-3.5 py-3 shadow-[var(--theme-shadow)] backdrop-blur",
                    s.bg,
                  )}
                >
                  <div className="mt-0.5">{s.icon}</div>
                  <div className="min-w-0 flex-1">
                    {t.title && (
                      <div className="text-[12.5px] font-bold text-[var(--theme-text)]">
                        {t.title}
                      </div>
                    )}
                    <div className="text-[12px] text-[var(--theme-text)]">{t.message}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(t.id)}
                    className="flex h-5 w-5 items-center justify-center rounded text-[var(--theme-text-soft)] hover:bg-black/5"
                    aria-label="ປິດ"
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </ToastCtx.Provider>
  );
}
