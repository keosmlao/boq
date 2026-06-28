"use client";

/** Craftsman work calendar — month grid: per day, jobs assigned vs done + shifts. */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CalendarRange, RefreshCw, HardHat, CheckCircle2, Clock, Truck } from "lucide-react";
import { getTechCalendar, type TechCalRow } from "@/_actions/tech-calendar";
import { Page } from "../_components/ui";
import { useT } from "@/_lib/i18n";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

type DayAgg = { assigned: number; done: number; morning: number; afternoon: number };

export default function TechCalendarPage() {
  const t = useT();
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-based
  const [rows, setRows] = useState<TechCalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>(iso(now));

  const first = useMemo(() => new Date(year, month, 1), [year, month]);
  const last = useMemo(() => new Date(year, month + 1, 0), [year, month]);
  const from = iso(first);
  const to = iso(last);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getTechCalendar(from, to);
      setRows(res.success ? res.data : []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [from, to]);

  // Aggregate work orders per date.
  const byDate = useMemo(() => {
    const m = new Map<string, DayAgg>();
    for (const r of rows) {
      if (!r.wo_id || !r.work_date) continue;
      const e = m.get(r.work_date) || { assigned: 0, done: 0, morning: 0, afternoon: 0 };
      e.assigned += 1;
      const s = String(r.status || "").toLowerCase();
      if (s === "closed" || r.checkout_at) e.done += 1;
      // Shift from check-in hour (default to morning when not checked in yet).
      const h = r.checkin_at ? new Date(r.checkin_at).getHours() : 8;
      if (h < 12) e.morning += 1; else e.afternoon += 1;
      m.set(r.work_date, e);
    }
    return m;
  }, [rows]);

  // Build the month grid (weeks start Sunday).
  const cells = useMemo(() => {
    const lead = first.getDay(); // 0=Sun
    const total = last.getDate();
    const arr: (Date | null)[] = [];
    for (let i = 0; i < lead; i++) arr.push(null);
    for (let d = 1; d <= total; d++) arr.push(new Date(year, month, d));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [first, last, year, month]);

  const dows = [t("techCal.sun", "ອາທິດ"), t("techCal.mon", "ຈັນ"), t("techCal.tue", "ອັງຄານ"), t("techCal.wed", "ພຸດ"), t("techCal.thu", "ພະຫັດ"), t("techCal.fri", "ສຸກ"), t("techCal.sat", "ເສົາ")];

  const isDone = (r: TechCalRow) => String(r.status || "").toLowerCase() === "closed" || !!r.checkout_at;
  const shiftKey = (r: TechCalRow) => ((r.checkin_at ? new Date(r.checkin_at).getHours() : 8) < 12 ? "morning" : "afternoon");
  const hhmm = (v: string | null) => (v ? `${pad(new Date(v).getHours())}:${pad(new Date(v).getMinutes())}` : "");
  const statusText = (r: TechCalRow) => {
    if (isDone(r)) return t("techCal.done", "ສຳເລັດ");
    if (String(r.status || "").toLowerCase() === "in_progress" || r.checkin_at) return t("techCal.working", "ກຳລັງເຮັດ");
    return t("techCal.ready", "ພ້ອມຮັບ");
  };
  const selDdmmyyyy = selected.split("-").reverse().join("-");
  const dowsShort = ["ອາ", "ຈ", "ອັ", "ພ", "ພຫ", "ສຸ", "ສ"];

  const shiftList = (by: { morning: TechCalRow[]; afternoon: TechCalRow[] }, mode: "planned" | "done") => (
    (["morning", "afternoon"] as const).map((sh) => {
      const list = by[sh];
      if (!list.length) return null;
      return (
        <div key={sh} className="mb-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
            <Clock size={11} /> {sh === "morning" ? t("techCal.morning", "ຮอบเช้า") : t("techCal.afternoon", "ຮอบบ่าย")} · {list.length}
          </div>
          <div className="space-y-1">
            {list.map((r) => (
              <button key={r.wo_id} onClick={() => router.push(`/work-orders/${r.wo_id}`)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/40 px-2.5 py-1.5 text-left hover:bg-slate-100/60">
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-semibold text-slate-800">{r.project_name || r.tech_name || r.work_no}</span>
                  <span className="block truncate text-[10.5px] text-slate-400"><span className="font-mono">{r.work_no}</span> · {mode === "done" ? (hhmm(r.checkout_at || r.checkin_at) || statusText(r)) : statusText(r)}</span>
                </span>
                {r.tech_name && <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200"><Truck size={10} /> {r.tech_name}</span>}
              </button>
            ))}
          </div>
        </div>
      );
    })
  );

  // Selected-day breakdown: planned (all) vs done, each grouped by shift.
  const dayDetail = useMemo(() => {
    const dayRows = rows.filter((r) => r.wo_id && r.work_date === selected);
    const group = (list: TechCalRow[]) => ({
      morning: list.filter((r) => shiftKey(r) === "morning"),
      afternoon: list.filter((r) => shiftKey(r) === "afternoon"),
    });
    return { planned: dayRows, done: dayRows.filter(isDone), byShiftPlanned: group(dayRows), byShiftDone: group(dayRows.filter(isDone)) };
  }, [rows, selected]);
  const monthNames = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
  const todayIso = iso(now);

  const go = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  return (
    <Page max="max-w-none w-full">
      <div className="mb-5 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-emerald-500 p-5 text-white shadow-lg shadow-indigo-600/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur"><CalendarRange size={24} /></span>
            <div>
              <h1 className="text-xl font-black leading-tight md:text-2xl">{t("techCal.title", "ປະຕິທິນງານຊ່າງ")}</h1>
              <p className="mt-0.5 text-[12px] font-medium text-white/80">{t("techCal.subtitle", "ແຕ່ລະວັນ ມีงานเข้า · ผลสำเร็จ · รอบเช้า/บ่าย")}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }} className="h-9 rounded-xl bg-white/15 px-3 text-xs font-bold text-white backdrop-blur transition hover:bg-white/25">{t("techCal.thisMonth", "ເດືອนนี้")}</button>
            <button onClick={() => go(-1)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur transition hover:bg-white/25"><ChevronLeft size={16} /></button>
            <span className="min-w-[96px] rounded-xl bg-white/20 px-2 py-2 text-center text-sm font-black tabular-nums backdrop-blur">{monthNames[month]}-{year}</span>
            <button onClick={() => go(1)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur transition hover:bg-white/25"><ChevronRight size={16} /></button>
            <button onClick={() => void load()} disabled={loading} className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur transition hover:bg-white/25 disabled:opacity-60"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Calendar (compact) */}
        <div className="xl:col-span-7">
          <div className="mb-1.5 grid grid-cols-7 gap-1">
            {dowsShort.map((d, i) => <div key={i} className="text-center text-[10.5px] font-bold text-slate-400">{d}</div>)}
          </div>
          <div className={`grid grid-cols-7 gap-1 ${loading ? "opacity-50" : ""}`}>
            {cells.map((d, i) => {
              if (!d) return <div key={`e-${i}`} className="min-h-[58px] rounded-lg border border-dashed border-slate-100 bg-slate-50/30" />;
              const key = iso(d);
              const a = byDate.get(key);
              const isToday = key === todayIso;
              const isSel = key === selected;
              const base = isSel
                ? "border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-400 shadow-md shadow-indigo-500/15"
                : isToday
                  ? "border-emerald-400 bg-emerald-50/50 ring-1 ring-emerald-300"
                  : a
                    ? (a.assigned >= 5 ? "border-emerald-200 bg-emerald-100/50 hover:bg-emerald-100" : "border-emerald-100 bg-emerald-50/30 hover:bg-emerald-50/70")
                    : "border-slate-200 bg-white hover:bg-slate-50";
              return (
                <button
                  key={key}
                  onClick={() => setSelected(key)}
                  className={`flex min-h-[62px] flex-col rounded-xl border p-1.5 text-left transition-all active:scale-[0.97] ${base}`}
                >
                  <div className="flex items-center justify-between">
                    {isToday ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-black text-white shadow-sm shadow-emerald-500/40">{d.getDate()}</span>
                    ) : (
                      <span className={`text-[12.5px] font-bold ${isSel ? "text-indigo-700" : "text-slate-700"}`}>{d.getDate()}</span>
                    )}
                  </div>
                  {a && (
                    <div className="mt-auto flex flex-wrap gap-1 pt-1">
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 px-1 py-0.5 text-[9.5px] font-black text-amber-700"><HardHat size={9} /> {a.assigned}</span>
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500 px-1 py-0.5 text-[9.5px] font-black text-white"><CheckCircle2 size={9} /> {a.done}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day detail */}
        <div className="xl:col-span-5">
          <div className="flex max-h-[660px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-md shadow-slate-200/60">
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3 text-white">
              <h2 className="flex items-center gap-2 text-[14px] font-bold">
                <CalendarRange size={16} /> {dows[new Date(selected).getDay()]} · {selDdmmyyyy}
              </h2>
              <div className="mt-2 flex gap-2">
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-400 px-2.5 py-1 text-[11px] font-black text-amber-950"><HardHat size={11} /> {t("techCal.planned", "ວາງແผน")} {dayDetail.planned.length}</span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-400 px-2.5 py-1 text-[11px] font-black text-emerald-950"><CheckCircle2 size={11} /> {t("techCal.done", "ສຳເລັດ")} {dayDetail.done.length}</span>
              </div>
            </div>
            {dayDetail.planned.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm font-semibold text-slate-400">{t("techCal.noJobs", "ບໍ່ມีงานในวันนี้")}</div>
            ) : (
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-bold text-amber-700"><HardHat size={14} /> {t("techCal.planned", "ວາງແผน")} ({dayDetail.planned.length})</div>
                  {shiftList(dayDetail.byShiftPlanned, "planned")}
                </div>
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-bold text-emerald-700"><CheckCircle2 size={14} /> {t("techCal.done", "ສຳເລັດ")} ({dayDetail.done.length})</div>
                  {dayDetail.done.length === 0 ? <div className="px-1 text-[11.5px] text-slate-400">—</div> : shiftList(dayDetail.byShiftDone, "done")}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Page>
  );
}
