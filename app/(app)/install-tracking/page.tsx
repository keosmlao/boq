"use client";

/** Per-project installation tracking: start date, worked hours, status, and the
 *  pause workflow (employee requests → manager reviews → admin approves). */
import { useEffect, useMemo, useState } from "react";
import { CalendarRange, CheckCircle2, Clock, Download, Loader2, PauseCircle, PlayCircle, RefreshCw, Search, Timer } from "lucide-react";
import { Page, PageHeader, Card, Stat, Btn, inputCls, tblCls, thCls, tdCls, trHover } from "../_components/ui";
import { StatusBadge } from "@/_components/pipeline";
import { useConfirm } from "../_components/Confirm";
import { isManager, isAdmin } from "@/_lib/permissions";
import { getV2User, type V2User } from "../../_lib/session";
import { useT } from "@/_lib/i18n";
import {
  getInstallTracking,
  requestProjectPause,
  reviewProjectPause,
  approveProjectPause,
  rejectProjectPause,
  resumeProject,
  type InstallRow,
} from "@/_actions/install-tracking";

const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString("en-GB") : "—");

export default function InstallTrackingPage() {
  const t = useT();
  const [rows, setRows] = useState<InstallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<V2User | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const confirm = useConfirm();

  const mgr = useMemo(() => isManager(user), [user]);
  const adm = useMemo(() => isAdmin(user), [user]);

  const load = async () => {
    const res = await getInstallTracking();
    if (res.success) { setRows(res.data); setError(null); }
    else setError((res as { message?: string }).message || t("installTracking.loadFailed", "ໂຫຼດບໍ່ສຳເລັດ"));
    setLoading(false);
  };

  useEffect(() => { setUser(getV2User()); load(); }, []);

  const run = async (key: string, fn: () => Promise<any>) => {
    setBusy(key);
    const res = await fn();
    setBusy(null);
    if (res?.success) load();
    else setError(res?.message || t("installTracking.actionFailed", "ດຳເນີນການບໍ່ສຳເລັດ"));
  };

  const askPause = async (r: InstallRow) => {
    const reason = window.prompt(`${t("installTracking.pauseReasonPrompt", "ເຫດຜົນທີ່ຂໍພັກໂຄງການ")} "${r.project_name}":`, "");
    if (reason == null) return;
    run(`req-${r.project_id}`, () => requestProjectPause(r.project_id, reason));
  };

  const totals = useMemo(() => ({
    active: rows.filter((r) => !r.paused).length,
    paused: rows.filter((r) => r.paused).length,
    hours: Math.round(rows.reduce((a, r) => a + (r.worked_hours || 0), 0) * 10) / 10,
    pending: rows.filter((r) => r.req_id).length,
  }), [rows]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? rows.filter((r) => r.project_name.toLowerCase().includes(s)) : rows;
  }, [rows, q]);

  const exportCsv = () => {
    const head = [t("installTracking.colProject", "ໂຄງການ"), t("common.status", "ສະຖານະ"), t("installTracking.colStarted", "ເລີ່ມຕິດຕັ້ງ"), t("installTracking.colHours", "ຊົ່ວໂມງ"), t("tracking.workNo", "ໃບງານ"), t("installTracking.colPauseDays", "ພັກ(ມື້)"), t("installTracking.colTotalPauseDays", "ພັກລວມ(ມື້)")];
    const body = filtered.map((r) => [r.project_name, r.project_status, r.install_started_at ? fmtDate(r.install_started_at) : "", r.worked_hours, r.wo_count, r.paused ? r.current_pause_days : 0, r.total_pause_days]);
    const csv = [head, ...body].map((row) => row.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "install-tracking.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Page max="max-w-none">
      <PageHeader
        title={t("installTracking.title", "ຕິດຕາມການຕິດຕັ້ງ")}
        subtitle={`${rows.length} ${t("installTracking.colProject", "ໂຄງການ")} · ${t("installTracking.statActive", "ກຳລັງດຳເນີນ")} ${totals.active} · ${t("installTracking.statPaused", "ພັກ")} ${totals.paused}`}
        actions={
          <>
            <Btn variant="outline" onClick={exportCsv} disabled={loading || !rows.length}><Download size={14} /> CSV</Btn>
            <Btn variant="outline" onClick={load} disabled={loading}><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {t("installTracking.reload", "ໂຫຼດໃໝ່")}</Btn>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<PlayCircle size={18} />} label={t("installTracking.statActive", "ກຳລັງດຳເນີນ")} value={totals.active} />
        <Stat icon={<PauseCircle size={18} />} label={t("installTracking.statPausedProjects", "ພັກໂຄງການ")} value={totals.paused} />
        <Stat icon={<Timer size={18} />} label={t("installTracking.statTotalHours", "ຊົ່ວໂມງລວມ")} value={`${totals.hours} ${t("installTracking.hoursUnit", "ຊມ")}`} />
        <Stat icon={<Clock size={18} />} label={t("installTracking.statPauseRequests", "ຄຳຮ້ອງພັກ (ລໍຖ້າ)")} value={totals.pending} />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <div className="relative max-w-xs flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("installTracking.searchPlaceholder", "ຄົ້ນຫາໂຄງການ")} className={`${inputCls} pl-9`} />
          </div>
        </div>

        {error ? (
          <p className="px-4 py-10 text-center text-sm font-semibold text-rose-600">{error}</p>
        ) : loading ? (
          <p className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> {t("common.loading", "ກຳລັງໂຫຼດ...")}</p>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-slate-400">{t("installTracking.noProjects", "ຍັງບໍ່ມີໂຄງການທີ່ເລີ່ມຕິດຕັ້ງ")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tblCls}>
              <thead>
                <tr>
                  <th className={thCls}>{t("installTracking.colProject", "ໂຄງການ")}</th>
                  <th className={thCls}>{t("common.status", "ສະຖານະ")}</th>
                  <th className={thCls}>{t("installTracking.colStarted", "ເລີ່ມຕິດຕັ້ງ")}</th>
                  <th className={`${thCls} text-center`}>{t("installTracking.colWorkedHours", "ຊົ່ວໂມງເຮັດງານ")}</th>
                  <th className={thCls}>{t("installTracking.colPause", "ການພັກ")}</th>
                  <th className={`${thCls} text-right`}>{t("common.actions", "ການດຳເນີນ")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const k = r.project_id;
                  const isBusy = busy === `req-${k}` || busy === `act-${k}`;
                  return (
                    <tr key={k} className={trHover}>
                      <td className={tdCls}><a href={`/projects/${r.project_id}`} className="font-bold text-slate-800 hover:text-blue-600">{r.project_name}</a></td>
                      <td className={tdCls}><StatusBadge status={r.project_status} /></td>
                      <td className={`${tdCls} text-[11.5px]`}>{fmtDate(r.install_started_at)}</td>
                      <td className={`${tdCls} text-center`}><span className="font-bold text-slate-800">{(r.worked_hours || 0).toFixed(1)}</span><span className="text-[11px] text-slate-400"> {t("installTracking.hoursUnit", "ຊມ")}</span></td>
                      <td className={`${tdCls} text-[11.5px]`}>
                        {r.paused ? (
                          <span className="font-bold text-rose-600">{t("installTracking.statPaused", "ພັກ")} {r.current_pause_days} {t("installTracking.daysUnit", "ມື້")} ({t("installTracking.since", "ຕັ້ງແຕ່")} {fmtDate(r.paused_since)})</span>
                        ) : r.total_pause_days > 0 ? (
                          <span className="text-slate-500">{t("installTracking.everPaused", "ເຄີຍພັກລວມ")} {r.total_pause_days} {t("installTracking.daysUnit", "ມື້")}</span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className={`${tdCls} text-right`}>
                        <div className="flex justify-end gap-1.5">
                          {isBusy && <Loader2 size={14} className="animate-spin text-slate-400" />}
                          {/* paused → resume (manager/admin) */}
                          {r.paused && mgr && (
                            <button onClick={() => run(`act-${k}`, async () => (await confirm({ title: t("installTracking.resume", "ກັບມາດຳເນີນ"), message: `${t("installTracking.resumeConfirm", "ຍົກເລີກການພັກ ແລະ ກັບໄປຕິດຕັ້ງ")} "${r.project_name}"?`, confirmLabel: t("installTracking.resume", "ກັບມາດຳເນີນ") })) ? resumeProject(r.project_id) : { success: false, message: "" })} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100">{t("installTracking.resume", "ກັບມາດຳເນີນ")}</button>
                          )}
                          {/* no pending request & not paused → request pause (anyone) */}
                          {!r.paused && !r.req_id && (
                            <button onClick={() => askPause(r)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50">{t("installTracking.requestPause", "ຮ້ອງຂໍພັກ")}</button>
                          )}
                          {/* requested → manager review */}
                          {r.req_status === "requested" && (mgr ? (
                            <>
                              <button onClick={() => run(`act-${k}`, async () => (await confirm({ title: t("installTracking.reviewPauseTitle", "ກວດສອບຄຳຮ້ອງພັກ"), message: `${t("installTracking.reviewPauseMsg", "ຜ່ານ ຄຳຮ້ອງພັກ")} "${r.project_name}"? (${r.req_reason || t("installTracking.noReason", "ບໍ່ມີເຫດຜົນ")})`, confirmLabel: t("installTracking.reviewPass", "ກວດສອບຜ່ານ") })) ? reviewProjectPause(r.req_id!, true) : { success: false, message: "" })} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100">{t("installTracking.reviewPass", "ກວດສອບຜ່ານ")}</button>
                              <button onClick={() => run(`act-${k}`, async () => (await confirm({ title: t("common.reject", "ປະຕິເສດ"), message: t("installTracking.rejectPauseMsg", "ປະຕິເສດ ຄຳຮ້ອງພັກ?"), confirmLabel: t("common.reject", "ປະຕິເສດ"), tone: "danger" })) ? rejectProjectPause(r.req_id!) : { success: false, message: "" })} className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50">{t("common.reject", "ປະຕິເສດ")}</button>
                            </>
                          ) : <span className="text-[11px] font-semibold text-amber-600">{t("installTracking.waitingManager", "ລໍຖ້າຜູ້ຈັດການກວດສອບ")}</span>)}
                          {/* manager_ok → admin approve */}
                          {r.req_status === "manager_ok" && (adm ? (
                            <>
                              <button onClick={() => run(`act-${k}`, async () => (await confirm({ title: t("installTracking.approvePauseTitle", "ອະນຸມັດ ພັກໂຄງການ"), message: `${t("installTracking.approvePauseMsg1", "ອະນຸມັດ ໃຫ້")} "${r.project_name}" ${t("installTracking.approvePauseMsg2", "ພັກໂຄງການ?")}`, confirmLabel: t("common.approve", "ອະນຸມັດ") })) ? approveProjectPause(r.req_id!) : { success: false, message: "" })} className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100">{t("installTracking.approvePause", "ອະນຸມັດພັກ")}</button>
                              <button onClick={() => run(`act-${k}`, async () => (await confirm({ title: t("common.reject", "ປະຕິເສດ"), message: t("installTracking.rejectPauseMsg", "ປະຕິເສດ ຄຳຮ້ອງພັກ?"), confirmLabel: t("common.reject", "ປະຕິເສດ"), tone: "danger" })) ? rejectProjectPause(r.req_id!) : { success: false, message: "" })} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-50">{t("common.reject", "ປະຕິເສດ")}</button>
                            </>
                          ) : <span className="text-[11px] font-semibold text-amber-600">{t("installTracking.waitingAdmin", "ລໍຖ້າຜູ້ດູແລລະບົບອະນຸມັດ")}</span>)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-3 flex items-center gap-1.5 px-1 text-[11px] text-slate-400">
        <CheckCircle2 size={12} /> {t("installTracking.footerNote", "ການພັກ: ພະນັກງານຮ້ອງຂໍ → ຜູ້ຈັດການກວດສອບ → ຜູ້ດູແລລະບົບອະນຸມັດ. ຊົ່ວໂມງ = check-in/out ຂອງຊ່າງ.")}
      </p>
    </Page>
  );
}
