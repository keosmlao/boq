"use client";

/** Modal to pick a project (for actions that need a project context). */
import React, { useEffect, useMemo, useState } from "react";
import { Search, X, FolderKanban } from "lucide-react";
import { getProjects } from "@/_actions/projects";
import { useT } from "@/_lib/i18n";

export default function ProjectPickerModal({
  open,
  onClose,
  onPick,
  title,
  requireBoq = false,
  requireApprovedContract = false,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (project: any) => void;
  title?: string;
  requireBoq?: boolean;
  requireApprovedContract?: boolean;
}) {
  const t = useT();
  const titleText = title ?? t("components.projectPicker.title", "ເລືອກໂຄງການ");
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
        const projects = res?.success ? res.data || [] : Array.isArray(res) ? res : [];
        const filteredProjects = requireApprovedContract
          ? projects.filter((project: any) => Number(project.approved_contract_count) > 0)
          : requireBoq
            ? projects.filter((project: any) => Number(project.boq_count) > 0)
            : projects;
        if (alive) setRows(filteredProjects);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [open, requireBoq, requireApprovedContract]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter((r) =>
      [r.project_name, r.customer_name, r.sml_code].map((x) => (x ?? "").toString().toLowerCase()).some((x) => x.includes(kw)),
    );
  }, [rows, q]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 px-4 pt-[10vh] backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-3">
          <h3 className="flex items-center gap-2 text-[13px] font-black text-[var(--text)]">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-strong)]">
              <FolderKanban size={14} />
            </span>
            {titleText}
          </h3>
          <button
            onClick={onClose}
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
              placeholder={t("components.projectPicker.searchPlaceholder", "ຄົ້ນຫາໂຄງການ, ລູກຄ້າ...")}
              className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-mute)]"
            />
          </label>
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {loading ? (
            <div className="py-10 text-center text-[12px] text-[var(--text-mute)]">{t("common.loading", "ກຳລັງໂຫຼດ...")}</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-[var(--text-mute)]">
              {requireApprovedContract ? t("components.projectPicker.noneApprovedContract", "ບໍ່ພົບໂຄງການທີ່ມີສັນຍາອະນຸມັດແລ້ວ") : requireBoq ? t("components.projectPicker.noneWithBoq", "ບໍ່ພົບໂຄງການທີ່ມີ BOQ") : t("components.projectPicker.none", "ບໍ່ພົບໂຄງການ")}
            </div>
          ) : (
            filtered.map((p, i) => (
              <button
                key={p.id ?? i}
                onClick={() => onPick(p)}
                className="flex w-full items-center gap-2.5 border-b border-[var(--border-soft)] px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-[var(--brand-tint)]"
              >
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--surface-sunken)] text-[var(--text-mute)]">
                  <FolderKanban size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-[var(--text)]">{p.project_name || t("components.picker.noName", "(ບໍ່ມີຊື່)")}</span>
                  <span className="block truncate text-[10.5px] text-[var(--text-mute)]">{p.customer_name || p.sml_code || "-"}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
