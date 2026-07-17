/**
 * Small presentational primitives shared by the printed bills (quotation,
 * material request). Server-safe, explicit print colors.
 */
import type { ReactNode } from "react";

export const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "0";
};
export const d10 = (v: unknown) => (v ? String(v).slice(0, 10) : "-");

export function Info({ label, value, full }: { label: string; value?: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <span className="text-neutral-500">{label}: </span>
      <span className="font-semibold text-neutral-900">{value || "-"}</span>
    </div>
  );
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <th className={`border border-neutral-300 px-2 py-1.5 text-left font-bold ${className}`}>{children}</th>;
}

export function Td({ children, className = "", colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={`border border-neutral-300 px-2 py-1.5 align-top ${className}`}>{children}</td>;
}

export function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-neutral-500">{label}</span>
      <span className="tabular-nums text-neutral-900">{value}</span>
    </div>
  );
}

export function Sign({ label }: { label: string }) {
  return (
    <div>
      <div className="mb-1 h-12" />
      <div className="border-t border-neutral-400 pt-1.5 text-neutral-600">{label}</div>
      <div className="mt-0.5 text-[10px] text-neutral-400">ວັນທີ ......../......../........</div>
    </div>
  );
}
