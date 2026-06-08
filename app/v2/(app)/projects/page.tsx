"use client";

/** v2 projects list — real data via getProjects(); links into the pipeline. */
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, FolderOpen, ChevronRight } from "lucide-react";
import { getProjects } from "@/_actions/projects";
import { StatusBadge } from "@/_components/pipeline";

export default function V2ProjectsList() {
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res: any = await getProjects();
        if (!alive) return;
        setRows(res?.success ? res.data || [] : Array.isArray(res) ? res : []);
      } catch {
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter((r) =>
      [r.project_name, r.coordinator, r.sml_code, r.province_name, r.project_status]
        .map((x) => (x ?? "").toString().toLowerCase())
        .some((x) => x.includes(kw)),
    );
  }, [rows, q]);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-5">
      <div className="theme-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[var(--theme-border-subtle)] px-3 py-2.5">
          <h1 className="text-[15px] font-bold text-[var(--theme-text)]">ໂຄງການ</h1>
          <span className="text-[11px] text-[var(--theme-text-mute)]">
            {filtered.length} / {rows.length}
          </span>
          <div className="ml-auto flex h-8 w-[260px] max-w-full items-center gap-2 rounded-md border border-[var(--theme-border-subtle)] px-2">
            <Search className="h-3.5 w-3.5 text-[var(--theme-text-mute)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ຄົ້ນຫາໂຄງການ, ລູກຄ້າ, ແຂວງ..."
              className="min-w-0 flex-1 bg-transparent text-[12px] outline-none"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex h-52 items-center justify-center gap-3 text-[var(--theme-text-mute)]">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--theme-border-subtle)] border-t-[var(--theme-primary)]" />
            <span className="text-sm">ກຳລັງໂຫຼດ...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-52 flex-col items-center justify-center gap-2 text-[var(--theme-text-mute)]">
            <FolderOpen className="h-8 w-8 opacity-40" />
            <span className="text-sm">ບໍ່ພົບໂຄງການ</span>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--theme-border-subtle)]">
            {filtered.map((r, i) => (
              <li key={r.id ?? i}>
                <button
                  onClick={() => router.push(`/v2/projects/${encodeURIComponent(String(r.id))}`)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-[var(--theme-bg-muted)]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-[var(--theme-text)]">
                      {r.project_name || "(ບໍ່ມີຊື່)"}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-[var(--theme-text-mute)]">
                      {r.sml_code && <span>ລູກຄ້າ {r.sml_code}</span>}
                      {r.coordinator && <span>{r.coordinator}</span>}
                      {r.province_name && <span>{r.province_name}</span>}
                    </div>
                  </div>
                  <StatusBadge status={r.project_status} />
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-[var(--theme-text-mute)]" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
