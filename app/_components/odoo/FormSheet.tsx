"use client";

import { useState, type ReactNode } from "react";

export type NotebookTab = {
  id: string;
  label: string;
  content: ReactNode;
  badge?: string | number;
};

type Props = {
  /** Optional header content rendered above the sheet (e.g. title, ID, tags). */
  header?: ReactNode;
  /** Main sheet body. */
  children?: ReactNode;
  /** Optional notebook tabs rendered at the bottom of the sheet, Odoo-style. */
  notebook?: NotebookTab[];
  className?: string;
};

/**
 * Odoo-style form sheet — a centered white panel with subtle shadow that
 * holds record fields. Optionally renders a notebook (tabbed sub-sections)
 * at the bottom of the sheet.
 */
export default function FormSheet({ header, children, notebook, className = "" }: Props) {
  const [activeTab, setActiveTab] = useState(notebook?.[0]?.id);

  return (
    <article
      className={[
        "mx-auto w-full max-w-[1080px] rounded border border-[var(--theme-border)] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        className,
      ].join(" ")}
    >
      {header && (
        <header className="border-b border-[var(--theme-border-subtle)] px-6 py-4">{header}</header>
      )}

      <div className="px-6 py-5">{children}</div>

      {notebook && notebook.length > 0 && (
        <div className="border-t border-[var(--theme-border)]">
          <div className="flex items-center gap-0 overflow-x-auto theme-scrollbar border-b border-[var(--theme-border)] px-3">
            {notebook.map((tab) => {
              const active = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    "relative inline-flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold whitespace-nowrap transition-colors",
                    active
                      ? "text-[var(--theme-primary)]"
                      : "text-[var(--theme-text-soft)] hover:text-[var(--theme-text)]",
                  ].join(" ")}
                >
                  {tab.label}
                  {tab.badge !== undefined && (
                    <span className="rounded-full bg-[var(--theme-bg-muted)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--theme-text-soft)]">
                      {tab.badge}
                    </span>
                  )}
                  {active && (
                    <span className="absolute inset-x-3 bottom-0 h-[2px] bg-[var(--theme-primary)]" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="px-6 py-5">
            {notebook.find((t) => t.id === activeTab)?.content}
          </div>
        </div>
      )}
    </article>
  );
}

/** Two-column field grid commonly used inside FormSheet (Odoo "group" pattern). */
export function FieldGroup({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2 ${className}`}>{children}</div>
  );
}

/** Single labelled row inside FieldGroup. */
export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 md:flex-row md:items-baseline md:gap-3">
      <span className="text-[12px] font-medium text-[var(--theme-text-soft)] md:w-32 md:flex-shrink-0 md:text-right">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </span>
      <span className="min-w-0 flex-1">
        {children}
        {hint && <span className="mt-0.5 block text-[10px] text-[var(--theme-text-mute)]">{hint}</span>}
      </span>
    </label>
  );
}
