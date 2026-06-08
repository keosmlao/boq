"use client";

import { Check } from "lucide-react";

export type Stage = {
  id: string;
  label: string;
  /** Optional badge variant for the active stage. Default "info" = brand purple. */
  variant?: "info" | "success" | "warning" | "danger";
};

type Props = {
  stages: Stage[];
  /** Index of the currently active stage. */
  activeIndex: number;
  /** Optional click handler — receives the stage id. */
  onStageClick?: (id: string) => void;
  className?: string;
};

/**
 * Odoo-style pipeline status bar — used at the top of record/detail pages
 * (project, quotation, contract, BOQ, work order) to show progress through a
 * stage workflow. Past stages are filled, current stage is highlighted,
 * future stages are muted.
 */
export default function StatusBar({ stages, activeIndex, onStageClick, className = "" }: Props) {
  return (
    <div
      className={`flex w-full items-stretch overflow-x-auto theme-scrollbar border-b border-[var(--theme-border)] bg-white ${className}`}
      role="tablist"
      aria-label="Pipeline"
    >
      {stages.map((stage, i) => {
        const past = i < activeIndex;
        const active = i === activeIndex;
        const interactive = !!onStageClick;
        const Tag = interactive ? "button" : "div";

        return (
          <Tag
            key={stage.id}
            type={interactive ? ("button" as const) : undefined}
            onClick={interactive ? () => onStageClick?.(stage.id) : undefined}
            role="tab"
            aria-selected={active}
            className={[
              "relative flex min-w-fit items-center gap-1.5 px-4 py-2 text-[12px] font-medium whitespace-nowrap transition-colors",
              "after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-[var(--theme-border-subtle)] last:after:hidden",
              active
                ? "text-[var(--theme-primary)]"
                : past
                ? "text-[var(--theme-text-soft)]"
                : "text-[var(--theme-text-mute)]",
              interactive ? "hover:bg-[var(--theme-primary-tint)]" : "",
            ].join(" ")}
          >
            {past ? (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--theme-accent)] text-white">
                <Check size={10} strokeWidth={3} />
              </span>
            ) : (
              <span
                className={[
                  "flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold",
                  active
                    ? "bg-[var(--theme-primary)] text-white"
                    : "bg-[var(--theme-bg-muted)] text-[var(--theme-text-mute)] ring-1 ring-[var(--theme-border)]",
                ].join(" ")}
              >
                {i + 1}
              </span>
            )}
            <span>{stage.label}</span>
            {active && (
              <span className="absolute inset-x-3 -bottom-px h-[2px] bg-[var(--theme-primary)]" />
            )}
          </Tag>
        );
      })}
    </div>
  );
}
