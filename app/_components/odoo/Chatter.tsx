"use client";

import { useState, type ReactNode } from "react";
import { MessageSquare, Activity, FileText, Send } from "lucide-react";

export type ChatterEntry = {
  id: string | number;
  author: string;
  timestamp: string;
  kind?: "note" | "message" | "log";
  body: ReactNode;
};

type Tab = "log" | "messages" | "activities";

type Props = {
  entries?: ChatterEntry[];
  onSend?: (body: string, kind: "note" | "message") => void;
  className?: string;
};

/**
 * Odoo-style "Chatter" — collapsible activity panel attached to the bottom of
 * a record form. Three tabs (Activities / Messages / Log notes) and an inline
 * composer. Pages can pass `entries` (already sorted newest-first) and an
 * `onSend` handler; if omitted the composer is hidden.
 */
export default function Chatter({ entries = [], onSend, className = "" }: Props) {
  const [tab, setTab] = useState<Tab>("messages");
  const [draft, setDraft] = useState("");
  const [composeMode, setComposeMode] = useState<"note" | "message">("message");

  const submit = () => {
    if (!draft.trim() || !onSend) return;
    onSend(draft.trim(), composeMode);
    setDraft("");
  };

  const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: "activities", label: "ກິດຈະກຳ", icon: <Activity size={13} /> },
    { id: "messages", label: "ຂໍ້ຄວາມ", icon: <MessageSquare size={13} /> },
    { id: "log", label: "ບັນທຶກ", icon: <FileText size={13} /> },
  ];

  return (
    <section
      className={`mt-4 border-t border-[var(--theme-border)] bg-white ${className}`}
      aria-label="Activity log"
    >
      <div className="flex items-center gap-1 px-4 pt-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[12px] font-semibold transition-colors",
              tab === t.id
                ? "border-[var(--theme-primary)] text-[var(--theme-primary)]"
                : "border-transparent text-[var(--theme-text-soft)] hover:text-[var(--theme-text)]",
            ].join(" ")}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {onSend && (
        <div className="border-t border-[var(--theme-border-subtle)] px-4 py-3">
          <div className="mb-2 flex items-center gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => setComposeMode("message")}
              className={[
                "rounded px-2 py-0.5 font-semibold",
                composeMode === "message"
                  ? "bg-[var(--theme-primary-tint)] text-[var(--theme-primary)]"
                  : "text-[var(--theme-text-mute)] hover:text-[var(--theme-text)]",
              ].join(" ")}
            >
              ສົ່ງຂໍ້ຄວາມ
            </button>
            <button
              type="button"
              onClick={() => setComposeMode("note")}
              className={[
                "rounded px-2 py-0.5 font-semibold",
                composeMode === "note"
                  ? "bg-amber-100 text-amber-700"
                  : "text-[var(--theme-text-mute)] hover:text-[var(--theme-text)]",
              ].join(" ")}
            >
              ບັນທຶກພາຍໃນ
            </button>
          </div>
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder={composeMode === "note" ? "ບັນທຶກພາຍໃນ (ບໍ່ສົ່ງໃຫ້ລູກຄ້າ)..." : "ພິມຂໍ້ຄວາມ..."}
              className="theme-input flex-1 resize-none px-3 py-2 text-[12px]"
            />
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim()}
              className="odoo-action odoo-action-primary inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={12} />
              ສົ່ງ
            </button>
          </div>
        </div>
      )}

      <ul className="divide-y divide-[var(--theme-border-subtle)]">
        {entries.length === 0 ? (
          <li className="px-4 py-6 text-center text-[12px] text-[var(--theme-text-mute)]">
            ຍັງບໍ່ມີຂໍ້ຄວາມ
          </li>
        ) : (
          entries.map((entry) => (
            <li key={entry.id} className="flex gap-3 px-4 py-3">
              <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--theme-primary-tint)] text-[11px] font-semibold text-[var(--theme-primary)]">
                {String(entry.author).trim().charAt(0).toUpperCase() || "U"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 text-[11px]">
                  <span className="font-semibold text-[var(--theme-text)]">{entry.author}</span>
                  <span className="text-[var(--theme-text-mute)]">{entry.timestamp}</span>
                  {entry.kind === "note" && (
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700">
                      Internal
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[12px] text-[var(--theme-text)]">{entry.body}</div>
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
