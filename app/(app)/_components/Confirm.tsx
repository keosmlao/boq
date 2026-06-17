"use client";

/**
 * App-wide confirm dialog. Mount <ConfirmProvider> once (in Shell); call
 * `const confirm = useConfirm()` anywhere and `if (await confirm({...})) {...}`.
 */
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { useT } from "@/_lib/i18n";

type ConfirmOpts = {
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
};

const ConfirmCtx = createContext<(o?: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export default function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const t = useT();
  const [opts, setOpts] = useState<ConfirmOpts | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((o?: ConfirmOpts) => {
    setOpts(o || {});
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  };

  const danger = opts?.tone === "danger";

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {opts && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 pt-[20vh]" onClick={() => close(false)}>
          <div className="w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-[var(--theme-shadow-lg)]" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 text-center">
              <div className={`mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full ring-1 ${danger ? "bg-rose-50 text-rose-600 ring-rose-100" : "bg-emerald-50 text-emerald-600 ring-emerald-100"}`}>
                {danger ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
              </div>
              <div className="text-[14px] font-semibold text-[var(--theme-text)]">{opts.title || t("common.confirm", "ຢືນຢັນ")}</div>
              {opts.message && <p className="mt-1 text-[12.5px] text-[var(--theme-text-mute)]">{opts.message}</p>}
            </div>
            <div className="flex gap-2 border-t border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] p-3">
              <button onClick={() => close(false)} className="flex-1 rounded-md border border-[var(--theme-border-subtle)] bg-white py-2 text-[12px] font-semibold text-[var(--theme-text-soft)] hover:bg-[var(--theme-bg-muted)]">
                {opts.cancelLabel || t("common.cancel", "ຍົກເລີກ")}
              </button>
              <button onClick={() => close(true)} className={`flex-1 rounded-md py-2 text-[12px] font-semibold text-white ${danger ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>
                {opts.confirmLabel || t("common.confirm", "ຢືນຢັນ")}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}
