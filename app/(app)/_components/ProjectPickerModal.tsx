"use client";

/** Modal to pick a project (for actions that need a project context). */
import React, { useEffect, useMemo, useState } from "react";
import { Search, X, FolderKanban } from "lucide-react";
import { getProjects } from "@/_actions/projects";

export default function ProjectPickerModal({
  open,
  onClose,
  onPick,
  title = "ເລືອກໂຄງການ",
}: {
  open: boolean;
  onClose: () => void;
  onPick: (project: any) => void;
  title?: string;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const res: any = await getProjects({ summary: true });
        if (alive) setRows(res?.success ? res.data || [] : Array.isArray(res) ? res : []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [open]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter((r) =>
      [r.project_name, r.customer_name, r.sml_code].map((x) => (x ?? "").toString().toLowerCase()).some((x) => x.includes(kw)),
    );
  }, [rows, q]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 pt-[10vh]" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-[var(--theme-shadow-lg)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between bg-gradient-to-r from-[var(--theme-primary)] to-blue-500 px-4 py-3 text-white">
          <h3 className="text-[14px] font-bold">{title}</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X size={18} /></button>
        </div>
        <div className="border-b border-[var(--theme-border-subtle)] p-2">
          <div className="flex h-9 items-center gap-2 rounded-md border border-[var(--theme-border-subtle)] px-2.5">
            <Search size={14} className="text-[var(--theme-text-mute)]" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="ຄົ້ນຫາໂຄງການ, ລູກຄ້າ..." className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
          </div>
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {loading ? (
            <div className="py-10 text-center text-[12px] text-[var(--theme-text-mute)]">ກຳລັງໂຫຼດ...</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-[var(--theme-text-mute)]">ບໍ່ພົບໂຄງການ</div>
          ) : (
            filtered.map((p, i) => (
              <button
                key={p.id ?? i}
                onClick={() => onPick(p)}
                className="flex w-full items-center gap-2 border-b border-[var(--theme-border-subtle)] px-3 py-2 text-left last:border-0 hover:bg-[var(--theme-bg-muted)]"
              >
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-[var(--theme-primary-tint)] text-[var(--theme-primary)]"><FolderKanban size={14} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-[var(--theme-text)]">{p.project_name || "(ບໍ່ມີຊື່)"}</span>
                  <span className="block truncate text-[10.5px] text-[var(--theme-text-mute)]">{p.customer_name || p.sml_code || "-"}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
