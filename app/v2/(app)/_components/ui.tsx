"use client";

/** Shared v2 UI primitives — ODG "Tangerine on Ink": bold, flat, confident. */
import React from "react";

export const cardCls =
  "rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:border-slate-300 hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)]";

export function Page({
  children,
  max = "max-w-[1200px]",
}: {
  children: React.ReactNode;
  max?: string;
}) {
  return (
    <div className="px-4 py-4 md:px-6 md:py-6 animate-fade-in">
      <div className={`mx-auto ${max}`}>{children}</div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="truncate text-xl md:text-[1.7rem] font-black tracking-tight text-slate-900 leading-none">
          {title}
        </h1>
        <span className="accent-rule mt-2.5" />
        {subtitle && (
          <p className="mt-2 text-xs font-semibold text-slate-500">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-shrink-0 items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`${cardCls} ${className}`}>{children}</div>;
}

const PILL_TONES = {
  neutral: "bg-slate-100 text-slate-600 border border-slate-200",
  brand: "bg-blue-50 text-blue-700 border border-blue-200",
  orange: "bg-blue-50 text-blue-700 border border-blue-200",
  blue: "bg-blue-50 text-blue-700 border border-blue-200",
  green: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  amber: "bg-amber-50 text-amber-800 border border-amber-200",
  red: "bg-rose-50 text-rose-700 border border-rose-200",
  cyan: "bg-cyan-50 text-cyan-700 border border-cyan-200",
  indigo: "bg-blue-50 text-blue-700 border border-blue-200",
};

export type PillTone = keyof typeof PILL_TONES;

export function Pill({ tone = "neutral", children }: { tone?: PillTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-md px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide ${
        PILL_TONES[tone] || PILL_TONES.neutral
      }`}
    >
      {children}
    </span>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "danger";
};

export function Btn({ variant = "primary", className = "", ...props }: BtnProps) {
  const base =
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-bold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30";

  const v =
    variant === "primary"
      ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/25"
      : variant === "danger"
        ? "bg-rose-600 text-white hover:bg-rose-700 shadow-sm shadow-rose-600/25"
        : variant === "ghost"
          ? "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900";

  return <button className={`${base} ${v} ${className}`} {...props} />;
}

/* Dense table class atoms */
export const tblCls = "min-w-full border-separate border-spacing-0 text-[12.5px]";
export const thCls =
  "sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-500";
export const tdCls =
  "border-b border-slate-100 px-4 py-3 align-middle text-slate-700 transition-colors";
export const trHover = "transition-colors duration-150 hover:bg-blue-50/40";

/* Compact labelled form field */
export const inputCls =
  "h-9.5 w-full rounded-xl border border-slate-200 px-3 text-[13px] outline-none shadow-[0_1px_1px_rgba(15,23,42,0.03)] transition-all duration-150 focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 bg-white hover:border-slate-300";

/** Coloured section header (icon chip + title) — for forms & cards. */
const TONE_CHIP: Record<string, string> = {
  neutral: "bg-slate-100 text-slate-500 border border-slate-200",
  slate: "bg-slate-100 text-slate-500 border border-slate-200",
  brand: "bg-blue-50 text-blue-600 border border-blue-200",
  blue: "bg-blue-50 text-blue-600 border border-blue-100",
  indigo: "bg-blue-50 text-blue-600 border border-blue-200",
  violet: "bg-violet-50 text-violet-600 border border-violet-100",
  emerald: "bg-emerald-50 text-emerald-600 border border-emerald-100",
  teal: "bg-teal-50 text-teal-600 border border-teal-100",
  cyan: "bg-cyan-50 text-cyan-600 border border-cyan-100",
  amber: "bg-amber-50 text-amber-600 border border-amber-100",
  orange: "bg-blue-50 text-blue-600 border border-blue-200",
  rose: "bg-rose-50 text-rose-600 border border-rose-100",
  pink: "bg-pink-50 text-pink-600 border border-pink-100",
};

export function SectionHeader({
  icon,
  title,
  tone = "brand",
  className = "",
}: {
  icon: React.ReactNode;
  title: string;
  tone?: keyof typeof TONE_CHIP;
  className?: string;
}) {
  return (
    <div className={`mb-4 flex items-center gap-2.5 ${className}`}>
      <span className={`flex h-7.5 w-7.5 flex-shrink-0 items-center justify-center rounded-xl border ${TONE_CHIP[tone] || TONE_CHIP.brand}`}>
        {icon}
      </span>
      <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">{title}</h3>
    </div>
  );
}

/** Minimal section divider — "LABEL ─────". Shared by the list/summary pages. */
export function SectionTitle({ label }: { label: string }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">{label}</h2>
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

/** Icon + label + value stat card; becomes a clickable filter chip when `onClick` is set. */
export function Stat({
  icon,
  label,
  value,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  const Tag2: any = onClick ? "button" : "div";
  return (
    <Tag2
      onClick={onClick}
      className={`flex items-center gap-3.5 rounded-2xl border bg-white p-4 text-left transition-all ${
        onClick ? "hover:border-slate-300 active:scale-[0.99]" : ""
      } ${active ? "border-slate-400 bg-slate-50 ring-2 ring-slate-200" : "border-slate-200"}`}
    >
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">{icon}</div>
      <div className="min-w-0">
        <span className="block truncate text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        <h3 className="mt-0.5 truncate text-xl font-black leading-tight text-slate-900">{value}</h3>
      </div>
    </Tag2>
  );
}

export function Field({
  label,
  required,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {label} {required && <span className="text-blue-600 font-extrabold">*</span>}
      </label>
      {children}
    </div>
  );
}
