"use client";

/** v2 — Schedule (ກຳນົດໜ້າວຽກ) grouped BY PROJECT: each project's tasks, the
 *  technician and the days, reconciled with work orders.
 *
 *  Data is fetched on the SERVER in page.tsx and passed in via `initialRows`,
 *  so navigation no longer triggers a client mount→fetch("/api/schedule")
 *  waterfall: the groups are present in the first render. The refresh button
 *  still re-pulls via /api/schedule on demand. */
import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, RefreshCw, Wrench, CalendarRange, FolderKanban } from "lucide-react";
import { Page, PageHeader, Card, Btn, Pill } from "../_components/ui";

const d10 = (v: unknown) => (v ? String(v).slice(0, 10) : "?");

export default function ScheduleClient({ initialRows }: { initialRows: any[] }) {
  const router = useRouter();
  const [groups, setGroups] = useState<any[]>(initialRows ?? []);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/schedule", { cache: "no-store" });
      const res: any = await response.json();
      if (!response.ok) throw new Error(res?.message || "Failed to load schedule");
      setGroups(res?.success ? res.data || [] : []);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return groups;
    return groups.filter((g) => String(g.project_name || "").toLowerCase().includes(kw));
  }, [groups, q]);

  return (
    <Page max="max-w-none">
      <PageHeader
        title="ກຳນົດໜ້າວຽກ"
        subtitle={`${filtered.length} ໂຄງການ`}
        actions={
          <Btn variant="outline" onClick={() => void refresh()} disabled={loading} className="hover:bg-slate-50 transition-colors">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Btn>
        }
      />

      {/* Styled Search Input */}
      <div className="mb-6 flex">
        <div className="relative flex h-10 w-full max-w-[360px] items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all duration-150 focus-within:border-blue-500 focus-within:ring-3 focus-within:ring-blue-500/15">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ຄົ້ນຫາໂຄງການ..."
            className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-800 placeholder-slate-400 outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-56 items-center justify-center gap-3 text-[var(--theme-text-mute)]">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--theme-border-subtle)] border-t-[var(--theme-primary)]" />
          <span className="text-sm font-semibold">ກຳລັງໂຫຼດ...</span>
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex h-56 flex-col items-center justify-center gap-2 text-[var(--theme-text-mute)]">
          <CalendarRange className="h-8 w-8 opacity-40" />
          <span className="text-sm">ຍັງບໍ່ມີໜ້າວຽກ</span>
        </Card>
      ) : (
        <div className="space-y-6">
          {filtered.map((g) => {
            const totalHours = g.tasks.reduce((s: number, t: any) => s + (Number(t.est_hours) || 0), 0);
            return (
              <Card key={g.project_id} className="overflow-hidden border-t-2 border-t-teal-500 shadow-sm hover:shadow-md transition-all duration-200">
                {/* Project Header section */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-3.5">
                  <button
                    onClick={() => g.project_id && router.push(`/projects/${g.project_id}`)}
                    className="group flex min-w-0 flex-1 items-center gap-2.5 text-left transition-colors"
                  >
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600 border border-teal-100/70 transition-transform duration-200 group-hover:scale-105">
                      <FolderKanban size={14} />
                    </span>
                    <span className="font-display truncate text-[14px] font-black text-slate-800 group-hover:text-blue-600 transition-colors">
                      {g.project_name}
                    </span>
                  </button>

                  <div className="flex items-center gap-3">
                    {/* Stats pills */}
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">
                        {g.tasks.length} ໜ້າວຽກ
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">
                        {totalHours} ຊມ
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600 font-mono">
                        {g.wo_count || 0} ໃບງານ
                      </span>
                    </div>

                    <button
                      onClick={() => router.push(`/projects/${g.project_id}/workorder/new`)}
                      className="group inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[11px] font-extrabold text-white shadow-sm shadow-blue-600/15 hover:bg-blue-700 hover:shadow-md transition-all active:scale-[0.97]"
                    >
                      <Wrench size={12} className="group-hover:rotate-12 transition-transform duration-150" />
                      <span>ສ້າງໃບງານ</span>
                    </button>
                  </div>
                </div>

                {/* Tasks Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0 text-[12.5px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/30 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                        <th className="sticky top-0 z-10 border-b border-slate-200 px-4 py-3 text-left">ໜ້າວຽກ</th>
                        <th className="sticky top-0 z-10 border-b border-slate-200 px-4 py-3 text-center w-28">ໄລຍະ</th>
                        <th className="sticky top-0 z-10 border-b border-slate-200 px-4 py-3 text-left w-44">ຊ່າງ / ທີມ</th>
                        <th className="sticky top-0 z-10 border-b border-slate-200 px-4 py-3 text-left w-52">ວັນ (ເຂົ້າເຮັດ)</th>
                        <th className="sticky top-0 z-10 border-b border-slate-200 px-4 py-3 text-right w-24">ຊົ່ວໂມງ</th>
                        <th className="sticky top-0 z-10 border-b border-slate-200 px-4 py-3 text-center w-28">ສະຖານະ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {g.tasks.map((t: any, i: number) => {
                        const done = t.status === "done";
                        return (
                          <tr key={t.id ?? i} className="group transition-colors duration-150 hover:bg-blue-50/20">
                            <td className="px-4 py-3.5 align-middle font-semibold text-slate-800">
                              {t.title}
                            </td>
                            <td className="px-4 py-3.5 align-middle text-center">
                              <span className="inline-flex items-center rounded border border-slate-200/50 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                                {t.phase || "-"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 align-middle">
                              {t.technician_name ? (
                                <span className="inline-flex items-center gap-1.5 font-bold text-slate-700">
                                  <span className="h-1.5 w-1.5 rounded-full bg-teal-500 shadow-[0_0_4px_rgba(20,184,166,0.5)]" />
                                  {t.technician_name}
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-md border border-slate-200/40 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-400 italic">
                                  ຍັງບໍ່ມອບໝາຍ
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 align-middle">
                              {t.planned_start || t.planned_end ? (
                                <span className="inline-flex items-center font-mono text-[11px] font-bold text-slate-600 bg-slate-50/70 border border-slate-200 px-2 py-0.5 rounded-md">
                                  {d10(t.planned_start)} <span className="text-slate-400 mx-1">→</span> {d10(t.planned_end)}
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 align-middle text-right font-mono font-bold text-slate-900 tabular-nums text-[13px]">
                              {Number(t.est_hours) || 0}
                            </td>
                            <td className="px-4 py-3.5 align-middle text-center">
                              <Pill tone={done ? "green" : "amber"}>
                                <span className="flex items-center gap-1.5">
                                  <span className="relative flex h-1.5 w-1.5">
                                    {done ? (
                                      <>
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                      </>
                                    ) : (
                                      <>
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
                                      </>
                                    )}
                                  </span>
                                  {done ? "ສຳເລັດ" : "ວາງແຜນ"}
                                </span>
                              </Pill>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Page>
  );
}
