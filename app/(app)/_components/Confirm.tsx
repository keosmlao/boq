"use client";

/**
 * App-wide confirm dialog. Mount <ConfirmProvider> once (in Shell); call
 * `const confirm = useConfirm()` anywhere and `if (await confirm({...})) {...}`.
 */
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Btn } from "./ui";
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
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 backdrop-blur-[2px] px-4 pt-[20vh]" onClick={() => close(false)}>
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pb-5 pt-6 text-center">
              <div
                className={`mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full ${
                  danger
                    ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                    : "bg-[var(--success-soft)] text-[var(--success)]"
                }`}
              >
                {danger ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
              </div>
              <div className="text-[14px] font-bold text-[var(--text)]">{opts.title || t("common.confirm", "ຢືນຢັນ")}</div>
              {opts.message && <p className="mt-1.5 text-[12.5px] text-[var(--text-mute)]">{opts.message}</p>}
            </div>
            <div className="flex gap-2 border-t border-[var(--border-soft)] bg-[var(--surface-sunken)] p-3">
              <Btn variant="outline" className="flex-1" onClick={() => close(false)}>
                {opts.cancelLabel || t("common.cancel", "ຍົກເລີກ")}
              </Btn>
              <Btn variant={danger ? "danger" : "go"} className="flex-1" onClick={() => close(true)}>
                {opts.confirmLabel || t("common.confirm", "ຢືນຢັນ")}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}
