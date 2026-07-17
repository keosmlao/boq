"use client";

/**
 * Floating toolbar on a print page: a Print button (fires the browser print
 * dialog) and a Close/Back action. Hidden on the printed sheet via `.print-hide`.
 * Auto-opens the print dialog once on mount so opening the page in a new tab
 * goes straight to printing; the buttons remain for re-print / navigation.
 */
import { useEffect, useRef } from "react";
import { Printer, X } from "lucide-react";
import { useT } from "@/_lib/i18n";

export default function PrintBar({ autoPrint = true }: { autoPrint?: boolean }) {
  const t = useT();
  const fired = useRef(false);

  useEffect(() => {
    if (!autoPrint || fired.current) return;
    fired.current = true;
    // Let fonts/images settle before the dialog opens.
    const h = setTimeout(() => window.print(), 400);
    return () => clearTimeout(h);
  }, [autoPrint]);

  return (
    <div className="print-hide sticky top-0 z-10 flex items-center justify-end gap-2 border-b border-neutral-300 bg-white/90 px-4 py-2.5 backdrop-blur">
      <button
        type="button"
        onClick={() => window.close()}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-neutral-300 px-4 text-xs font-bold text-neutral-700 transition-colors hover:bg-neutral-100"
      >
        <X size={14} /> {t("print.close", "ປິດ")}
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-neutral-900 px-4 text-xs font-bold text-white transition-colors hover:bg-neutral-700"
      >
        <Printer size={14} /> {t("print.print", "ພິມ")}
      </button>
    </div>
  );
}
