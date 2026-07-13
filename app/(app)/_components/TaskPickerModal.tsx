"use client";

/** Multi-select picker for task-master tasks (add 1 or many at once). */
import React, { useMemo, useState } from "react";
import { Search, X, Check, ListPlus } from "lucide-react";
import { Btn } from "./ui";
import { useT } from "@/_lib/i18n";

export default function TaskPickerModal({
  open,
  onClose,
  masters,
  excludeIds,
  onAdd,
  title,
}: {
  open: boolean;
  onClose: () => void;
  masters: any[];
  excludeIds: Set<string>;
  onAdd: (picked: any[]) => void;
  title?: string;
}) {
  const t = useT();
  const titleText = title ?? t("components.taskPicker.title", "ເພີ່ມໜ້າວຽກ");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());

  const list = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return masters.filter((m) => {
      if (excludeIds.has(String(m.id))) return false;
      if (!kw) return true;
      return `${m.task ?? m.name ?? ""} ${m.phase ?? ""}`.toLowerCase().includes(kw);
    });
  }, [masters, excludeIds, q]);

  if (!open) return null;

  const toggle = (idStr: string) =>
    setSel((s) => {
      const n = new Set(s);
      n.has(idStr) ? n.delete(idStr) : n.add(idStr);
      return n;
    });

  const confirm = () => {
    const picked = masters.filter((m) => sel.has(String(m.id)));
    onAdd(picked);
    setSel(new Set());
    setQ("");
  };
  const close = () => {
    setSel(new Set());
    setQ("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 px-4 pt-[8vh] backdrop-blur-[2px]" onClick={close}>
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-3">
          <h3 className="flex items-center gap-2 text-[13px] font-black text-[var(--text)]">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-strong)]">
              <ListPlus size={14} />
            </span>
            {titleText}
          </h3>
          <button
            onClick={close}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-mute)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text)]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="border-b border-[var(--border-soft)] p-2.5">
          <label className="flex h-9 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 focus-within:border-[var(--brand)] focus-within:ring-3 focus-within:ring-[var(--brand-ring)]">
            <Search size={14} className="text-[var(--text-mute)]" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("components.taskPicker.searchPlaceholder", "ຄົ້ນຫາໜ້າວຽກ...")}
              className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-mute)]"
            />
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {list.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-[var(--text-mute)]">{t("components.taskPicker.empty", "ບໍ່ມີໜ້າວຽກໃຫ້ເລືອກ")}</div>
          ) : (
            list.map((m, i) => {
              const idStr = String(m.id);
              const checked = sel.has(idStr);
              return (
                <button
                  key={idStr || i}
                  type="button"
                  onClick={() => toggle(idStr)}
                  className={`flex w-full items-center gap-2.5 border-b border-[var(--border-soft)] px-3 py-2.5 text-left transition-colors last:border-0 ${
                    checked ? "bg-[var(--brand-tint)]" : "hover:bg-[var(--surface-sunken)]"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                      checked ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--border-strong)]"
                    }`}
                  >
                    {checked && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold text-[var(--text)]">{m.task || m.name || t("components.picker.noName", "(ບໍ່ມີຊື່)")}</span>
                    {m.phase && <span className="block truncate text-[10.5px] text-[var(--text-mute)]">{t("components.taskPicker.phase", "ໄລຍະ")}: {m.phase}</span>}
                  </span>
                </button>
              );
            })
          )}
        </div>
        <div className="flex gap-2 border-t border-[var(--border-soft)] bg-[var(--surface-sunken)] p-3">
          <Btn variant="outline" className="flex-1" onClick={close}>
            {t("common.cancel", "ຍົກເລີກ")}
          </Btn>
          <Btn variant="go" className="flex-[2]" onClick={confirm} disabled={sel.size === 0}>
            <ListPlus size={14} /> {t("common.add", "ເພີ່ມ")} {sel.size > 0 ? `(${sel.size})` : ""}
          </Btn>
        </div>
      </div>
    </div>
  );
}
