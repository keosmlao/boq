"use client";

/** Per-craftsman work-order performance summary. */
import { useEffect, useMemo, useState } from "react";
import { Award, CheckCircle2, Clock, Download, Loader2, RefreshCw, Search, Timer, XCircle } from "lucide-react";
import { Page, PageHeader, Card, Stat, Btn, TwoLine, inputCls, tblCls, thCls, tdCls, trHover } from "../_components/ui";
import { getTechSummary, type TechSummaryRow } from "@/_actions/tech-summary";
import { useT } from "@/_lib/i18n";

const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString("en-GB") : "—");
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

export default function TechSummaryPage() {
  const t = useT();
  const [rows, setRows] = useState<TechSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await getTechSummary();
    if (res.success) {
      setRows(res.data);
      setError(null);
    } else {
      setError((res as { message?: string }).message || t("techSummary.loadFailed", "ໂຫຼດບໍ່ສຳເລັດ"));
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    return rows.reduce(
      (a, r) => ({
        total: a.total + r.total,
        closed: a.closed + r.closed,
        in_progress: a.in_progress + r.in_progress,
        hours: a.hours + (r.worked_hours || 0),
      }),
      { total: 0, closed: 0, in_progress: 0, hours: 0 },
    );
  }, [rows]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(s) || (r.code || "").toLowerCase().includes(s));
  }, [rows, q]);

  const exportCsv = () => {
    const head = [
      t("techSummary.tech", "ຊ່າງ"),
      t("techSummary.code", "ລະຫັດ"),
      t("techSummary.total", "ລວມ"),
      t("techSummary.completed", "ສຳເລັດ"),
      t("techSummary.inProgress", "ກຳລັງເຮັດ"),
      t("techSummary.awaitingReview", "ລໍກວດສອບ"),
      t("techSummary.notStarted", "ຍັງບໍ່ເລີ່ມ"),
      t("status.rejected", "ປະຕິເສດ"),
      t("techSummary.hours", "ຊົ່ວໂມງ"),
      t("techSummary.lastActivity", "ເຄື່ອນໄຫວລ່າສຸດ"),
    ];
    const body = filtered.map((r) => [r.name, r.code || "", r.total, r.closed, r.in_progress, r.review, r.pending, r.rejected, r.worked_hours, r.last_activity ? fmtDate(r.last_activity) : ""]);
    const csv = [head, ...body].map((row) => row.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "tech-summary.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Page max="max-w-none">
      <PageHeader
        title={t("techSummary.title", "ສະຫຼຸບຜົນງານຊ່າງ")}
        subtitle={`${t("techSummary.techTotalPrefix", "ຊ່າງທັງໝົດ")} ${rows.length} ${t("techSummary.peopleUnit", "ຄົນ")} · ${t("techSummary.workOrderTotal", "ໃບງານລວມ")} ${totals.total}`}
        actions={
          <>
            <Btn variant="outline" onClick={exportCsv} disabled={loading || !rows.length}>
              <Download size={14} /> CSV
            </Btn>
            <Btn variant="outline" onClick={load} disabled={loading}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {t("techSummary.reload", "ໂຫຼດໃໝ່")}
            </Btn>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Award size={18} />} label={t("techSummary.workOrderTotal", "ໃບງານລວມ")} value={totals.total} />
        <Stat icon={<CheckCircle2 size={18} />} label={t("techSummary.completed", "ສຳເລັດ")} value={totals.closed} />
        <Stat icon={<Clock size={18} />} label={t("techSummary.inProgress", "ກຳລັງເຮັດ")} value={totals.in_progress} />
        <Stat icon={<Timer size={18} />} label={t("techSummary.totalHours", "ຊົ່ວໂມງລວມ")} value={`${totals.hours.toFixed(1)} ${t("techSummary.hoursAbbr", "ຊມ")}`} />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-[var(--border-soft)] bg-[var(--surface-sunken)] px-3 py-3">
          <div className="relative max-w-xs flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-mute)]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("techSummary.searchPlaceholder", "ຄົ້ນຫາຊື່ / ລະຫັດຊ່າງ")} className={`${inputCls} pl-9`} />
          </div>
        </div>

        {error ? (
          <p className="px-4 py-10 text-center text-[13px] font-semibold text-[var(--danger)]">{t("techSummary.loadFailed", "ໂຫຼດບໍ່ສຳເລັດ")}: {error}</p>
        ) : loading ? (
          <p className="flex items-center justify-center gap-2 px-4 py-12 text-[13px] text-[var(--text-mute)]">
            <Loader2 size={16} className="animate-spin" /> {t("common.loading", "ກຳລັງໂຫຼດ...")}
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-12 text-center text-[13px] text-[var(--text-mute)]">{t("techSummary.noData", "ຍັງບໍ່ມີຂໍ້ມູນໃບງານ")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tblCls}>
              <thead>
                <tr>
                  <th className={thCls}>{t("techSummary.tech", "ຊ່າງ")}</th>
                  <th className={`${thCls} text-center`}>{t("techSummary.total", "ລວມ")}</th>
                  <th className={`${thCls} text-center`}>{t("techSummary.completed", "ສຳເລັດ")}</th>
                  <th className={`${thCls} text-center`}>{t("techSummary.inProgress", "ກຳລັງເຮັດ")}</th>
                  <th className={`${thCls} text-center`}>{t("techSummary.awaitingReview", "ລໍກວດສອບ")}</th>
                  <th className={`${thCls} text-center`}>{t("techSummary.notStarted", "ຍັງບໍ່ເລີ່ມ")}</th>
                  <th className={`${thCls} text-center`}>{t("status.rejected", "ປະຕິເສດ")}</th>
                  <th className={`${thCls} text-center`}>{t("techSummary.workedHours", "ຊົ່ວໂມງເຮັດງານ")}</th>
                  <th className={`${thCls}`}>{t("techSummary.completionRate", "ອັດຕາສຳເລັດ")}</th>
                  <th className={`${thCls}`}>{t("techSummary.lastActivity", "ເຄື່ອນໄຫວລ່າສຸດ")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const rate = pct(r.closed, r.total);
                  return (
                    <tr key={(r.code || r.name) + i} className={trHover}>
                      <td className={tdCls}>
                        <TwoLine primary={r.name} secondary={r.code || undefined} />
                      </td>
                      <td className={`${tdCls} text-center font-extrabold tabular-nums text-[var(--text)]`}>{r.total}</td>
                      <td className={`${tdCls} text-center font-bold tabular-nums text-[var(--success)]`}>{r.closed}</td>
                      <td className={`${tdCls} text-center tabular-nums text-[var(--info)]`}>{r.in_progress}</td>
                      <td className={`${tdCls} text-center tabular-nums text-[var(--warning)]`}>{r.review}</td>
                      <td className={`${tdCls} text-center tabular-nums text-[var(--text-soft)]`}>{r.pending}</td>
                      <td className={`${tdCls} text-center tabular-nums ${r.rejected ? "font-bold text-[var(--danger)]" : "text-[var(--text-mute)]"}`}>{r.rejected}</td>
                      <td className={`${tdCls} text-center`}>
                        <span className="font-bold tabular-nums text-[var(--text)]">{(r.worked_hours || 0).toFixed(1)}</span>
                        <span className="text-[11px] text-[var(--text-mute)]"> {t("techSummary.hoursAbbr", "ຊມ")}</span>
                        {r.sessions > 0 && <div className="text-[10px] text-[var(--text-mute)]">{r.sessions} {t("techSummary.timesUnit", "ຄັ້ງ")}</div>}
                      </td>
                      <td className={tdCls}>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                            <div className="h-full rounded-full bg-[var(--success)]" style={{ width: `${rate}%` }} />
                          </div>
                          <span className="text-[11px] font-bold tabular-nums text-[var(--text-soft)]">{rate}%</span>
                        </div>
                      </td>
                      <td className={`${tdCls} text-[11.5px] tabular-nums text-[var(--text-soft)]`}>{fmtDate(r.last_activity)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-3 flex items-center gap-1.5 px-1 text-[11px] text-[var(--text-mute)]">
        <XCircle size={12} /> {t("techSummary.footnote", "ໝາຍເຫດ: ນັບຈາກໃບງານ (odg_work_order) ຕາມສະຖານະປັດຈຸບັນ.")}
      </p>
    </Page>
  );
}
