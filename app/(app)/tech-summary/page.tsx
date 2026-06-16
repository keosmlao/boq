"use client";

/** Per-craftsman work-order performance summary. */
import { useEffect, useMemo, useState } from "react";
import { Award, CheckCircle2, Clock, Download, Loader2, RefreshCw, Search, Timer, XCircle } from "lucide-react";
import { Page, PageHeader, Card, Stat, Btn, inputCls, tblCls, thCls, tdCls, trHover } from "../_components/ui";
import { getTechSummary, type TechSummaryRow } from "@/_actions/tech-summary";

const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString("en-GB") : "—");
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

export default function TechSummaryPage() {
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
      setError((res as { message?: string }).message || "ໂຫຼດບໍ່ສຳເລັດ");
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
    const head = ["ຊ່າງ", "ລະຫັດ", "ລວມ", "ສຳເລັດ", "ກຳລັງເຮັດ", "ລໍກວດສອບ", "ຍັງບໍ່ເລີ່ມ", "ປະຕິເສດ", "ຊົ່ວໂມງ", "ເຄື່ອນໄຫວລ່າສຸດ"];
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
        title="ສະຫຼຸບຜົນງານຊ່າງ"
        subtitle={`ຊ່າງທັງໝົດ ${rows.length} ຄົນ · ໃບງານລວມ ${totals.total}`}
        actions={
          <>
            <Btn variant="outline" onClick={exportCsv} disabled={loading || !rows.length}>
              <Download size={14} /> CSV
            </Btn>
            <Btn variant="outline" onClick={load} disabled={loading}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> ໂຫຼດໃໝ່
            </Btn>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Award size={18} />} label="ໃບງານລວມ" value={totals.total} />
        <Stat icon={<CheckCircle2 size={18} />} label="ສຳເລັດ" value={totals.closed} />
        <Stat icon={<Clock size={18} />} label="ກຳລັງເຮັດ" value={totals.in_progress} />
        <Stat icon={<Timer size={18} />} label="ຊົ່ວໂມງລວມ" value={`${totals.hours.toFixed(1)} ຊມ`} />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <div className="relative max-w-xs flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ຄົ້ນຫາຊື່ / ລະຫັດຊ່າງ" className={`${inputCls} pl-9`} />
          </div>
        </div>

        {error ? (
          <p className="px-4 py-10 text-center text-sm font-semibold text-rose-600">ໂຫຼດບໍ່ສຳເລັດ: {error}</p>
        ) : loading ? (
          <p className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-slate-400">
            <Loader2 size={16} className="animate-spin" /> ກຳລັງໂຫຼດ...
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-slate-400">ຍັງບໍ່ມີຂໍ້ມູນໃບງານ</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tblCls}>
              <thead>
                <tr>
                  <th className={thCls}>ຊ່າງ</th>
                  <th className={`${thCls} text-center`}>ລວມ</th>
                  <th className={`${thCls} text-center`}>ສຳເລັດ</th>
                  <th className={`${thCls} text-center`}>ກຳລັງເຮັດ</th>
                  <th className={`${thCls} text-center`}>ລໍກວດສອບ</th>
                  <th className={`${thCls} text-center`}>ຍັງບໍ່ເລີ່ມ</th>
                  <th className={`${thCls} text-center`}>ປະຕິເສດ</th>
                  <th className={`${thCls} text-center`}>ຊົ່ວໂມງເຮັດງານ</th>
                  <th className={`${thCls}`}>ອັດຕາສຳເລັດ</th>
                  <th className={`${thCls}`}>ເຄື່ອນໄຫວລ່າສຸດ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const rate = pct(r.closed, r.total);
                  return (
                    <tr key={(r.code || r.name) + i} className={trHover}>
                      <td className={tdCls}>
                        <div className="font-bold text-slate-800">{r.name}</div>
                        {r.code && <div className="text-[11px] text-slate-400">{r.code}</div>}
                      </td>
                      <td className={`${tdCls} text-center font-extrabold`}>{r.total}</td>
                      <td className={`${tdCls} text-center font-bold text-emerald-600`}>{r.closed}</td>
                      <td className={`${tdCls} text-center text-blue-600`}>{r.in_progress}</td>
                      <td className={`${tdCls} text-center text-amber-600`}>{r.review}</td>
                      <td className={`${tdCls} text-center text-slate-500`}>{r.pending}</td>
                      <td className={`${tdCls} text-center ${r.rejected ? "text-rose-600 font-bold" : "text-slate-400"}`}>{r.rejected}</td>
                      <td className={`${tdCls} text-center`}>
                        <span className="font-bold text-slate-800">{(r.worked_hours || 0).toFixed(1)}</span>
                        <span className="text-[11px] text-slate-400"> ຊມ</span>
                        {r.sessions > 0 && <div className="text-[10px] text-slate-400">{r.sessions} ຄັ້ງ</div>}
                      </td>
                      <td className={tdCls}>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${rate}%` }} />
                          </div>
                          <span className="text-[11px] font-bold text-slate-500">{rate}%</span>
                        </div>
                      </td>
                      <td className={`${tdCls} text-[11.5px] text-slate-500`}>{fmtDate(r.last_activity)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-3 flex items-center gap-1.5 px-1 text-[11px] text-slate-400">
        <XCircle size={12} /> ໝາຍເຫດ: ນັບຈາກໃບງານ (odg_work_order) ຕາມສະຖານະປັດຈຸບັນ.
      </p>
    </Page>
  );
}
