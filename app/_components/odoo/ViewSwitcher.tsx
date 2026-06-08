"use client";

import { Calendar, KanbanSquare, List, BarChart3 } from "lucide-react";

export type ViewMode = "list" | "kanban" | "calendar" | "graph";

const ICONS = {
  list: List,
  kanban: KanbanSquare,
  calendar: Calendar,
  graph: BarChart3,
} as const;

const LABELS = {
  list: "List",
  kanban: "Kanban",
  calendar: "Calendar",
  graph: "Graph",
} as const;

type Props = {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
  /** Subset of views to allow. Default = list + kanban. */
  available?: ViewMode[];
  className?: string;
};

/**
 * Odoo-style view switcher — segmented icon group rendered in the control
 * panel right side. Pages opt in by managing a `viewMode` state and rendering
 * different content based on it.
 */
export default function ViewSwitcher({
  value,
  onChange,
  available = ["list", "kanban"],
  className = "",
}: Props) {
  return (
    <div
      role="tablist"
      className={`inline-flex items-center rounded border border-[var(--theme-border)] bg-white p-0.5 ${className}`}
    >
      {available.map((mode) => {
        const Icon = ICONS[mode];
        const active = mode === value;
        return (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={active}
            title={LABELS[mode]}
            onClick={() => onChange(mode)}
            className={[
              "flex h-7 w-7 items-center justify-center rounded-sm transition-colors",
              active
                ? "bg-[var(--theme-primary)] text-white"
                : "text-[var(--theme-text-soft)] hover:bg-[var(--theme-bg-muted)] hover:text-[var(--theme-text)]",
            ].join(" ")}
          >
            <Icon size={13} />
          </button>
        );
      })}
    </div>
  );
}
