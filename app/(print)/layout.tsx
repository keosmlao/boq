/**
 * Print route group — chrome-free document pages (no Shell / sidebar), per the
 * README convention that print routes live in their own group. The root layout
 * (app/layout.tsx) still supplies the Lao font + providers; this layer only
 * forces a clean white page and print-friendly margins.
 */
import type { ReactNode } from "react";

export default function PrintLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-100 text-black print:bg-white">
      {/* @page controls the printed sheet; the screen keeps a light backdrop so
          the "paper" reads as a document before printing. */}
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          html, body { background: #fff !important; }
          .print-hide { display: none !important; }
        }
      `}</style>
      {children}
    </div>
  );
}
