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
import { Search, RefreshCw, Loader2, Wrench, CalendarRange, FolderKanban } from "lucide-react";
import { Page, PageHeader, Card, Btn, Pill, Toolbar, tblCls, thCls, tdCls, trHover } from "../_components/ui";
import { useT } from "@/_lib/i18n";

const d10 = (v: unknown) => (v ? String(v).slice(0, 10) : "?");

export default function ScheduleClient({ initialRows }: { initialRows: any[] }) {
  const t = useT();
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
        title={t("schedule.title", "ກຳນົດໜ້າວຽກ")}
        subtitle={`${filtered.length} ${t("installTracking.colProject", "ໂຄງການ")}`}
        actions={
          <Btn variant="outline" onClick={() => void refresh()} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {t("common.reload", "ໂຫຼດໃໝ່")}
          </Btn>
        }
      />

      <Toolbar>
        <label className="flex h-9 min-w-[240px] max-w-[360px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3">
          <Search size={15} className="text-[var(--text-mute)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("schedule.searchPlaceholder", "ຄົ້ນຫາໂຄງການ...")}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-mute)]"
          />
        </label>
      </Toolbar>

      {loading ? (
        <Card className="flex h-56 items-center justify-center gap-2 text-[var(--text-mute)]">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm font-semibold">{t("common.loading", "ກຳລັງໂຫຼດ...")}</span>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="flex h-56 flex-col items-center justify-center gap-2 text-[var(--text-mute)]">
          <CalendarRange className="h-8 w-8 opacity-40" />
          <span className="text-sm">{t("schedule.noTasks", "ຍັງບໍ່ມີໜ້າວຽກ")}</span>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((g) => {
            const totalHours = g.tasks.reduce((s: number, task: any) => s + (Number(task.est_hours) || 0), 0);
            return (
              <Card key={g.project_id} className="overflow-hidden">
                {/* Project header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-soft)] bg-[var(--surface-sunken)] px-4 py-3">
                  <button
                    onClick={() => g.project_id && router.push(`/projects/${g.project_id}`)}
                    className="group flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    <span className="flex h-7.5 w-7.5 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--brand-soft)] bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                      <FolderKanban size={14} />
                    </span>
                    <span className="truncate text-[14px] font-black text-[var(--text)] transition-colors group-hover:text-[var(--brand)]">
                      {g.project_name}
                    </span>
                  </button>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <Pill tone="neutral">{g.tasks.length} {t("schedule.tasksUnit", "ໜ້າວຽກ")}</Pill>
                      <Pill tone="neutral">{totalHours} {t("installTracking.hoursUnit", "ຊມ")}</Pill>
                      <Pill tone="neutral">{g.wo_count || 0} {t("tracking.workNo", "ໃບງານ")}</Pill>
                    </div>

                    <Btn variant="go" onClick={() => router.push(`/projects/${g.project_id}/workorder/new`)}>
                      <Wrench size={13} /> {t("schedule.createWorkOrder", "ສ້າງໃບງານ")}
                    </Btn>
                  </div>
                </div>

                {/* Tasks table */}
                <div className="overflow-x-auto">
                  <table className={tblCls}>
                    <thead>
                      <tr>
                        <th className={thCls}>{t("schedule.tasksUnit", "ໜ້າວຽກ")}</th>
                        <th className={`${thCls} w-28 text-center`}>{t("schedule.colPhase", "ໄລຍະ")}</th>
                        <th className={`${thCls} w-44`}>{t("schedule.colTechnician", "ຊ່າງ / ທີມ")}</th>
                        <th className={`${thCls} w-52`}>{t("schedule.colDays", "ວັນ (ເຂົ້າເຮັດ)")}</th>
                        <th className={`${thCls} w-24 text-right`}>{t("schedule.colHours", "ຊົ່ວໂມງ")}</th>
                        <th className={`${thCls} w-28 text-center`}>{t("common.status", "ສະຖານະ")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.tasks.map((tk: any, i: number) => {
                        const done = tk.status === "done";
                        return (
                          <tr key={tk.id ?? i} className={trHover}>
                            <td className={`${tdCls} font-semibold text-[var(--text)]`}>{tk.title}</td>
                            <td className={`${tdCls} text-center`}>
                              <Pill tone="neutral">{tk.phase || "-"}</Pill>
                            </td>
                            <td className={tdCls}>
                              {tk.technician_name ? (
                                <span className="inline-flex items-center gap-1.5 font-bold text-[var(--text)]">
                                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
                                  {tk.technician_name}
                                </span>
                              ) : (
                                <span className="text-[11px] font-medium italic text-[var(--text-mute)]">
                                  {t("schedule.unassigned", "ຍັງບໍ່ມອບໝາຍ")}
                                </span>
                              )}
                            </td>
                            <td className={tdCls}>
                              {tk.planned_start || tk.planned_end ? (
                                <span className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface-sunken)] px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--text-soft)]">
                                  {d10(tk.planned_start)} <span className="mx-1 text-[var(--text-mute)]">→</span> {d10(tk.planned_end)}
                                </span>
                              ) : (
                                <span className="text-[var(--text-mute)]">—</span>
                              )}
                            </td>
                            <td className={`${tdCls} text-right font-mono text-[13px] font-bold tabular-nums text-[var(--text)]`}>
                              {Number(tk.est_hours) || 0}
                            </td>
                            <td className={`${tdCls} text-center`}>
                              <Pill tone={done ? "green" : "amber"}>
                                {done ? t("schedule.done", "ສຳເລັດ") : t("schedule.planned", "ວາງແຜນ")}
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
