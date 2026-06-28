"use client";

/** Daily craftsman-team status — who's free today, who's on a job, with outcome. */
import { useEffect, useMemo, useState } from "react";
import { UsersRound, Wrench, CircleDot, RefreshCw } from "lucide-react";
import { getTechCalendar, type TechCalRow } from "@/_actions/tech-calendar";
import { useT } from "@/_lib/i18n";

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ddmmyyyy = (d: Date) => `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;

type Tech = { code: string; name: string; wos: TechCalRow[] };

export default function TeamStatusCard() {
  const t = useT();
  const [rows, setRows] = useState<TechCalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const todayIso = isoOf(today);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getTechCalendar(todayIso, todayIso);
      setRows(res.success ? res.data : []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const { free, busy, working } = useMemo(() => {
    const map = new Map<string, Tech>();
    for (const r of rows) {
      let e = map.get(r.code);
      if (!e) { e = { code: r.code, name: r.tech_name || r.code, wos: [] }; map.set(r.code, e); }
      if (r.wo_id) e.wos.push(r);
    }
    const all = [...map.values()];
    const busyT = all.filter((x) => x.wos.length > 0);
    return {
      free: all.filter((x) => x.wos.length === 0),
      busy: busyT,
      working: busyT.filter((x) => x.wos.some((w) => w.checkin_at || String(w.status).toLowerCase() === "in_progress")).length,
    };
  }, [rows]);

  const total = free.length + busy.length;
  const stats = [
    { label: t("teamStatus.total", "ທີມທັງໝົດ"), value: total, tone: "text-slate-700 bg-slate-100" },
    { label: t("teamStatus.free", "ວ່າງ"), value: free.length, tone: "text-emerald-700 bg-emerald-100" },
    { label: t("teamStatus.busy", "ມีงาน"), value: busy.length, tone: "text-amber-700 bg-amber-100" },
    { label: t("teamStatus.working", "ກຳລັງເຮັດ"), value: working, tone: "text-blue-700 bg-blue-100" },
  ];

  const statusLabel = (w: TechCalRow) => {
    const s = String(w.status || "").toLowerCase();
    if (s === "closed" || w.checkout_at) return t("teamStatus.done", "ສຳເລັດ");
    if (s === "in_progress" || w.checkin_at) return t("teamStatus.working", "ກຳລັງເຮັດ");
    return t("teamStatus.assigned", "ຮັບງານ");
  };

  return (
    <div className="mb-4 rounded-xl border border-slate-200/80 bg-white shadow-2xs">
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><UsersRound size={15} /></span>
        <span className="text-[13px] font-bold text-slate-800">{t("teamStatus.title", "ສະຖານະທີມຊ່າງປະຈຳວັນ")}</span>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-500">{ddmmyyyy(today)}</span>
        <button onClick={() => void load()} disabled={loading} className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-60">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
            <div className={`inline-flex rounded-md px-1.5 py-0.5 text-[16px] font-black leading-none ${s.tone}`}>{s.value}</div>
            <div className="mt-1.5 text-[10.5px] font-semibold text-slate-400">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ຊ່າງວ່າງມື້ນີ້ */}
      {free.length > 0 && (
        <div className="border-t border-slate-100 px-3 pb-3 pt-2">
          <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-emerald-500">{t("teamStatus.freeToday", "ຊ່າງວ່າງມື້ນີ້")} ({free.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {free.map((f) => (
              <span key={f.code} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700">
                <CircleDot size={11} className="text-emerald-500" /> {f.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ມีงานวันนี้ */}
      {busy.length > 0 && (
        <div className="border-t border-slate-100 px-3 pb-3 pt-2">
          <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">{t("teamStatus.busyToday", "ມีงานวันนี้")} ({busy.length})</div>
          <div className="flex flex-wrap gap-2">
            {busy.map((b) => (
              <div key={b.code} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
                <Wrench size={11} className="text-amber-500" />
                <span className="text-[12px] font-semibold text-slate-700">{b.name}</span>
                {b.wos[0]?.work_no && <span className="font-mono text-[10px] text-slate-400">{b.wos[0].work_no}</span>}
                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">{statusLabel(b.wos[0])}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
