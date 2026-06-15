"use client";

/** Multi-select picker for task-master tasks (add 1 or many at once). */
import React, { useMemo, useState } from "react";
import { Search, X, Check, ListPlus } from "lucide-react";

export default function TaskPickerModal({
  open,
  onClose,
  masters,
  excludeIds,
  onAdd,
  title = "ເພີ່ມໜ້າວຽກ",
}: {
  open: boolean;
  onClose: () => void;
  masters: any[];
  excludeIds: Set<string>;
  onAdd: (picked: any[]) => void;
  title?: string;
}) {
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
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 pt-[8vh]" onClick={close}>
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-[var(--theme-shadow-lg)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-3 text-white">
          <h3 className="flex items-center gap-2 text-[14px] font-bold"><ListPlus size={16} /> {title}</h3>
          <button onClick={close} className="text-white/80 hover:text-white"><X size={18} /></button>
        </div>
        <div className="border-b border-[var(--theme-border-subtle)] p-2">
          <div className="flex h-9 items-center gap-2 rounded-md border border-[var(--theme-border-subtle)] px-2.5">
            <Search size={14} className="text-[var(--theme-text-mute)]" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="ຄົ້ນຫາໜ້າວຽກ..." className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {list.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-[var(--theme-text-mute)]">ບໍ່ມີໜ້າວຽກໃຫ້ເລືອກ</div>
          ) : (
            list.map((m, i) => {
              const idStr = String(m.id);
              const checked = sel.has(idStr);
              return (
                <button
                  key={idStr || i}
                  type="button"
                  onClick={() => toggle(idStr)}
                  className="flex w-full items-center gap-2.5 border-b border-[var(--theme-border-subtle)] px-3 py-2 text-left last:border-0 hover:bg-[var(--theme-bg-muted)]"
                >
                  <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${checked ? "border-emerald-500 bg-emerald-500 text-white" : "border-[var(--theme-border-subtle)]"}`}>
                    {checked && <Check size={12} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-[var(--theme-text)]">{m.task || m.name || "(ບໍ່ມີຊື່)"}</span>
                    {m.phase && <span className="block truncate text-[10.5px] text-[var(--theme-text-mute)]">ໄລຍະ: {m.phase}</span>}
                  </span>
                </button>
              );
            })
          )}
        </div>
        <div className="flex gap-2 border-t border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] p-3">
          <button onClick={close} className="flex-1 rounded-md border border-[var(--theme-border-subtle)] bg-white py-2 text-[12px] font-semibold text-[var(--theme-text-soft)] hover:bg-[var(--theme-bg-muted)]">ຍົກເລີກ</button>
          <button onClick={confirm} disabled={sel.size === 0} className="flex flex-[2] items-center justify-center gap-1.5 rounded-md bg-[var(--theme-primary)] py-2 text-[12px] font-semibold text-white hover:bg-[var(--theme-primary-strong)] disabled:opacity-50">
            <ListPlus size={14} /> ເພີ່ມ {sel.size > 0 ? `(${sel.size})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
