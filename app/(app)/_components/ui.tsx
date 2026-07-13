"use client";

/**
 * Shared UI primitives — ODIEN SERVICE look: white cards on a quiet canvas,
 * ink (navy) for commit controls, green for document actions, teal for brand.
 * Everything is token-driven (--surface/--text/--brand/--ink/--go) so the same
 * markup renders correctly in light and dark.
 */
import React from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

export const cardCls =
  "rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)] transition-colors duration-150 hover:border-[var(--border-strong)]";

export function Page({
  children,
  max = "max-w-[1200px]",
}: {
  children: React.ReactNode;
  max?: string;
}) {
  return (
    <div className="px-4 py-5 md:px-7 md:py-7 animate-fade-in">
      <div className={`mx-auto ${max}`}>{children}</div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
}: {
  title: string;
  subtitle?: string;
  /** Optional status chip rendered beside the title (detail pages). */
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <h1 className="truncate text-[15px] leading-none font-black tracking-tight text-[var(--text)] md:text-[19px]">
            {title}
          </h1>
          {badge}
        </div>
        <span className="accent-rule mt-2.5" />
        {subtitle && <p className="mt-2 text-xs font-semibold text-[var(--text-mute)]">{subtitle}</p>}
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
  neutral: "bg-[var(--surface-sunken)] text-[var(--text-soft)] border border-[var(--border)]",
  brand: "bg-[var(--brand-soft)] text-[var(--brand-strong)] border border-[var(--brand-soft)]",
  orange: "bg-[var(--warning-soft)] text-[var(--warning)] border border-[var(--warning-soft)]",
  blue: "bg-[var(--info-soft)] text-[var(--info)] border border-[var(--info-soft)]",
  green: "bg-[var(--success-soft)] text-[var(--success)] border border-[var(--success-soft)]",
  amber: "bg-[var(--warning-soft)] text-[var(--warning)] border border-[var(--warning-soft)]",
  red: "bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger-soft)]",
  cyan: "bg-[var(--info-soft)] text-[var(--info)] border border-[var(--info-soft)]",
  indigo: "bg-[var(--brand-soft)] text-[var(--brand-strong)] border border-[var(--brand-soft)]",
};

export type PillTone = keyof typeof PILL_TONES;

export function Pill({ tone = "neutral", children }: { tone?: PillTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-md px-2.5 py-0.5 text-[10.5px] font-extrabold tracking-wide ${
        PILL_TONES[tone] || PILL_TONES.neutral
      }`}
    >
      {children}
    </span>
  );
}

type BtnVariant = "primary" | "go" | "ink" | "outline" | "ghost" | "danger" | "danger-outline";

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant };

const BTN_VARIANTS: Record<BtnVariant, string> = {
  primary: "bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] shadow-[var(--shadow-xs)]",
  go: "bg-[var(--go)] text-white hover:bg-[var(--go-hover)] shadow-[var(--shadow-xs)]",
  ink: "bg-[var(--ink)] text-[var(--ink-text)] hover:bg-[var(--ink-hover)] shadow-[var(--shadow-xs)]",
  danger: "bg-[var(--danger)] text-white hover:opacity-90 shadow-[var(--shadow-xs)]",
  "danger-outline": "border border-[var(--danger)] bg-[var(--surface)] text-[var(--danger)] hover:bg-[var(--danger-soft)]",
  ghost: "text-[var(--text-soft)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text)]",
  outline:
    "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-soft)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text)]",
};

export function Btn({ variant = "primary", className = "", ...props }: BtnProps) {
  const base =
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-bold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]";
  return <button className={`${base} ${BTN_VARIANTS[variant] || BTN_VARIANTS.primary} ${className}`} {...props} />;
}

/** Count chip that rides inside a Btn (e.g. the alert button in the toolbar). */
export function BtnCount({ value, tone = "danger" }: { value: React.ReactNode; tone?: "danger" | "neutral" }) {
  return (
    <span
      className={`ml-0.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[10px] font-black ${
        tone === "danger" ? "bg-[var(--danger)] text-white" : "bg-[var(--surface-sunken)] text-[var(--text-soft)]"
      }`}
    >
      {value}
    </span>
  );
}

/* ── Toolbar: search + filters + segmented views, in one card ───────────── */

export function Toolbar({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <Card className={`mb-4 flex flex-wrap items-center gap-2 p-2.5 ${className}`}>{children}</Card>
  );
}

/** Segmented control — active segment is solid ink, like the reference. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className = "",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; icon?: React.ReactNode }[];
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[11.5px] font-bold transition-all ${
              on
                ? "bg-[var(--ink)] text-[var(--ink-text)]"
                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-soft)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text)]"
            }`}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Table atoms ────────────────────────────────────────────────────────── */

export const tblCls = "min-w-full border-separate border-spacing-0 text-[12.5px]";
export const thCls =
  "sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface-sunken)] px-4 py-2.5 text-left text-[10.5px] font-extrabold tracking-wider text-[var(--text-mute)]";
export const tdCls =
  "border-b border-[var(--border-soft)] px-4 py-3 align-middle text-[var(--text-soft)] transition-colors";
export const trHover = "transition-colors duration-150 hover:bg-[var(--brand-tint)]";

/** Sortable header cell — click to cycle asc/desc, with the reference's arrow glyph. */
export function SortTh({
  label,
  active,
  dir = "asc",
  onClick,
  className = "",
}: {
  label: React.ReactNode;
  active?: boolean;
  dir?: "asc" | "desc";
  onClick?: () => void;
  className?: string;
}) {
  return (
    <th className={`${thCls} ${className}`}>
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={`inline-flex items-center gap-1 ${onClick ? "hover:text-[var(--text)]" : "cursor-default"} ${
          active ? "text-[var(--text)]" : ""
        }`}
      >
        {label}
        {onClick &&
          (!active ? (
            <ChevronsUpDown size={11} className="opacity-50" />
          ) : dir === "asc" ? (
            <ChevronUp size={11} />
          ) : (
            <ChevronDown size={11} />
          ))}
      </button>
    </th>
  );
}

/** Header cell that reserves the 4px status-bar gutter (pairs with RowBar). */
export function RowBarTh() {
  return <th className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface-sunken)] p-0" style={{ width: 4 }} />;
}

/** First cell of a row — paints the status bar down the left edge. */
export function RowBar({ tone = "neutral" }: { tone?: "neutral" | "danger" | "warning" | "success" | "info" | "brand" }) {
  const color = {
    neutral: "var(--border-strong)",
    danger: "var(--danger)",
    warning: "var(--warning)",
    success: "var(--success)",
    info: "var(--info)",
    brand: "var(--brand)",
  }[tone];
  return <td className="border-b border-[var(--border-soft)] p-0" style={{ width: 4, background: color }} />;
}

/** Two-line cell — bold primary over a muted secondary (name over SN, etc.). */
export function TwoLine({ primary, secondary }: { primary: React.ReactNode; secondary?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="truncate font-semibold text-[var(--text)]">{primary}</div>
      {secondary ? <div className="truncate text-[11px] text-[var(--text-mute)]">{secondary}</div> : null}
    </div>
  );
}

/* ── Form atoms ─────────────────────────────────────────────────────────── */

export const inputCls =
  "h-9.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] text-[var(--text)] outline-none transition-all duration-150 placeholder:text-[var(--text-mute)] hover:border-[var(--border-strong)] focus:border-[var(--brand)] focus:ring-3 focus:ring-[var(--brand-ring)]";

/** Coloured section header (icon chip + title) — for forms & cards. */
const TONE_CHIP: Record<string, string> = {
  neutral: "bg-[var(--surface-sunken)] text-[var(--text-mute)] border border-[var(--border)]",
  slate: "bg-[var(--surface-sunken)] text-[var(--text-mute)] border border-[var(--border)]",
  brand: "bg-[var(--brand-soft)] text-[var(--brand-strong)] border border-[var(--brand-soft)]",
  blue: "bg-[var(--info-soft)] text-[var(--info)] border border-[var(--info-soft)]",
  indigo: "bg-[var(--brand-soft)] text-[var(--brand-strong)] border border-[var(--brand-soft)]",
  violet: "bg-[var(--brand-soft)] text-[var(--brand-strong)] border border-[var(--brand-soft)]",
  emerald: "bg-[var(--success-soft)] text-[var(--success)] border border-[var(--success-soft)]",
  teal: "bg-[var(--brand-soft)] text-[var(--brand-strong)] border border-[var(--brand-soft)]",
  cyan: "bg-[var(--info-soft)] text-[var(--info)] border border-[var(--info-soft)]",
  amber: "bg-[var(--warning-soft)] text-[var(--warning)] border border-[var(--warning-soft)]",
  orange: "bg-[var(--warning-soft)] text-[var(--warning)] border border-[var(--warning-soft)]",
  rose: "bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger-soft)]",
  pink: "bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger-soft)]",
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
      <span className={`flex h-7.5 w-7.5 flex-shrink-0 items-center justify-center rounded-xl ${TONE_CHIP[tone] || TONE_CHIP.brand}`}>
        {icon}
      </span>
      <h3 className="text-xs font-black tracking-wider text-[var(--text)]">{title}</h3>
    </div>
  );
}

/** Minimal section divider — "LABEL ─────". Shared by the list/summary pages. */
export function SectionTitle({ label }: { label: string }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <h2 className="text-[11px] font-extrabold tracking-wider text-[var(--text-mute)]">{label}</h2>
      <span className="h-px flex-1 bg-[var(--border)]" />
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
      className={`flex items-center gap-3.5 rounded-2xl border bg-[var(--surface)] p-4 text-left transition-all ${
        onClick ? "hover:border-[var(--border-strong)] active:scale-[0.99]" : ""
      } ${active ? "border-[var(--brand)] ring-2 ring-[var(--brand-ring)]" : "border-[var(--border)]"}`}
    >
      <div
        className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${
          active ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "bg-[var(--surface-sunken)] text-[var(--text-mute)]"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <span className="block truncate text-[11px] font-semibold tracking-wider text-[var(--text-mute)]">{label}</span>
        <h3 className="mt-0.5 truncate text-xl font-black leading-tight text-[var(--text)]">{value}</h3>
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
      <label className="mb-1.5 block text-[11px] font-bold tracking-wider text-[var(--text-mute)]">
        {label} {required && <span className="font-extrabold text-[var(--danger)]">*</span>}
      </label>
      {children}
    </div>
  );
}
