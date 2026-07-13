"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  RefreshCw,
  Sparkles,
  Truck,
} from "lucide-react";
import { getTechCalendar, type TechCalRow } from "@/_actions/tech-calendar";
import { Btn, Card, Page, PageHeader, Stat } from "../_components/ui";
import { useT } from "@/_lib/i18n";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

type DayAgg = { assigned: number; done: number; morning: number; afternoon: number };

export default function TechCalendarPage() {
  const t = useT();
  const router = useRouter();
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [rows, setRows] = useState<TechCalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(iso(now));

  const first = useMemo(() => new Date(year, month, 1), [year, month]);
  const last = useMemo(() => new Date(year, month + 1, 0), [year, month]);
  const from = iso(first);
  const to = iso(last);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTechCalendar(from, to);
      setRows(res.success ? res.data : []);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { void load(); }, [load]);

  const isDone = (row: TechCalRow) => String(row.status || "").toLowerCase() === "closed" || Boolean(row.checkout_at);
  const shiftKey = (row: TechCalRow): "morning" | "afternoon" => {
    if (row.shift === "morning" || row.shift === "afternoon") return row.shift;
    return (row.checkin_at ? new Date(row.checkin_at).getHours() : 8) < 12 ? "morning" : "afternoon";
  };

  const byDate = useMemo(() => {
    const map = new Map<string, DayAgg>();
    for (const row of rows) {
      if (!row.wo_id || !row.work_date) continue;
      const value = map.get(row.work_date) || { assigned: 0, done: 0, morning: 0, afternoon: 0 };
      value.assigned += 1;
      if (isDone(row)) value.done += 1;
      value[shiftKey(row)] += 1;
      map.set(row.work_date, value);
    }
    return map;
  }, [rows]);

  const cells = useMemo(() => {
    const values: (Date | null)[] = Array.from({ length: first.getDay() }, () => null);
    for (let day = 1; day <= last.getDate(); day += 1) values.push(new Date(year, month, day));
    while (values.length % 7 !== 0) values.push(null);
    return values;
  }, [first, last, year, month]);

  const dayDetail = useMemo(() => {
    const planned = rows.filter((row) => row.wo_id && row.work_date === selected);
    const done = planned.filter(isDone);
    const group = (list: TechCalRow[]) => ({
      morning: list.filter((row) => shiftKey(row) === "morning"),
      afternoon: list.filter((row) => shiftKey(row) === "afternoon"),
    });
    return { planned, done, byShiftPlanned: group(planned), byShiftDone: group(done) };
  }, [rows, selected]);

  const totals = useMemo(() => {
    const assigned = Array.from(byDate.values()).reduce((sum, day) => sum + day.assigned, 0);
    const done = Array.from(byDate.values()).reduce((sum, day) => sum + day.done, 0);
    return {
      assigned,
      done,
      activeDays: byDate.size,
      rate: assigned ? Math.round((done / assigned) * 100) : 0,
    };
  }, [byDate]);

  const dowsShort = ["ອາ", "ຈ", "ອ", "ພ", "ພຫ", "ສ", "ສວ"];
  const dows = ["ວັນອາທິດ", "ວັນຈັນ", "ວັນອັງຄານ", "ວັນພຸດ", "ວັນພະຫັດ", "ວັນສຸກ", "ວັນເສົາ"];
  const monthNames = ["ມັງກອນ", "ກຸມພາ", "ມີນາ", "ເມສາ", "ພຶດສະພາ", "ມິຖຸນາ", "ກໍລະກົດ", "ສິງຫາ", "ກັນຍາ", "ຕຸລາ", "ພະຈິກ", "ທັນວາ"];
  const todayIso = iso(now);
  const selectedDate = localDate(selected);
  const hhmm = (value: string | null) => value ? `${pad(new Date(value).getHours())}:${pad(new Date(value).getMinutes())}` : "";

  const statusText = (row: TechCalRow) => {
    if (isDone(row)) return t("techCal.done", "ສຳເລັດ");
    if (String(row.status || "").toLowerCase() === "in_progress" || row.checkin_at) return t("techCal.working", "ກຳລັງເຮັດ");
    return t("techCal.ready", "ລໍຖ້າດຳເນີນງານ");
  };

  const changeMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
    setSelected(iso(next));
  };

  const goToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelected(todayIso);
  };

  const shiftList = (groups: { morning: TechCalRow[]; afternoon: TechCalRow[] }, mode: "planned" | "done") => (
    (["morning", "afternoon"] as const).map((shift) => {
      const list = groups[shift];
      if (!list.length) return null;
      return (
        <section key={shift} className="space-y-2">
          <div className="flex items-center gap-2 text-[11px] font-bold text-[var(--text-mute)]">
            <span className="h-px flex-1 bg-[var(--border-soft)]" />
            <Clock3 size={12} />
            {shift === "morning" ? t("techCal.morning", "ຊ່ວງເຊົ້າ") : t("techCal.afternoon", "ຊ່ວງບ່າຍ")} · {list.length}
            <span className="h-px flex-1 bg-[var(--border-soft)]" />
          </div>
          <div className="space-y-2">
            {list.map((row) => (
              <button
                key={row.wo_id}
                onClick={() => router.push(`/work-orders/${row.wo_id}`)}
                className="group flex w-full items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-sunken)] p-3 text-left transition hover:border-[var(--border-strong)] hover:bg-[var(--surface)]"
              >
                <span
                  className="h-9 w-1 shrink-0 rounded-full"
                  style={{ background: isDone(row) ? "var(--success)" : "var(--info)" }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-bold text-[var(--text)]">{row.project_name || row.tech_name || row.work_no}</span>
                  <span className="mt-0.5 block truncate font-mono text-[10px] text-[var(--text-mute)]">
                    {row.work_no} · {mode === "done" ? (hhmm(row.checkout_at || row.checkin_at) || statusText(row)) : statusText(row)}
                  </span>
                </span>
                {row.tech_name && (
                  <span className="hidden max-w-24 items-center gap-1 truncate rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[9.5px] font-bold text-[var(--text-soft)] sm:inline-flex">
                    <Truck size={10} /> {row.tech_name}
                  </span>
                )}
                <ChevronRight size={14} className="shrink-0 text-[var(--text-mute)] transition group-hover:translate-x-0.5 group-hover:text-[var(--brand)]" />
              </button>
            ))}
          </div>
        </section>
      );
    })
  );

  return (
    <Page max="max-w-[1600px] w-full">
      <PageHeader
        title={t("techCal.title", "ປະຕິທິນງານຊ່າງ")}
        subtitle={t("techCal.subtitle", "ກວດສອບແຜນວຽກ ແລະ ຄວາມຄືບໜ້າຂອງທີມຊ່າງໃນແຕ່ລະມື້")}
        actions={
          <>
            <Btn variant="outline" onClick={goToday}>
              <CalendarDays size={14} /> {t("techCal.today", "ມື້ນີ້")}
            </Btn>
            <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
              <button
                onClick={() => changeMonth(-1)}
                aria-label={t("techCal.prevMonth", "ເດືອນກ່ອນ")}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-soft)] transition hover:bg-[var(--surface-sunken)] hover:text-[var(--text)]"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="min-w-[110px] px-1 text-center">
                <div className="truncate text-[11.5px] font-extrabold text-[var(--text)]">{monthNames[month]} {year}</div>
                <div className="text-[9px] font-semibold tabular-nums text-[var(--text-mute)]">{pad(month + 1)} / {year}</div>
              </div>
              <button
                onClick={() => changeMonth(1)}
                aria-label={t("techCal.nextMonth", "ເດືອນຖັດໄປ")}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-soft)] transition hover:bg-[var(--surface-sunken)] hover:text-[var(--text)]"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <Btn variant="ink" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {t("common.reload", "ໂຫຼດໃໝ່")}
            </Btn>
          </>
        }
      />

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={<BriefcaseBusiness size={18} />}
          label={t("techCal.totalJobs", "ວຽກທັງໝົດ")}
          value={loading ? "—" : `${totals.assigned} ${t("techCal.jobsUnit", "ວຽກ")}`}
        />
        <Stat
          icon={<CheckCircle2 size={18} />}
          label={t("techCal.completed", "ສຳເລັດແລ້ວ")}
          value={loading ? "—" : `${totals.done} ${t("techCal.jobsUnit", "ວຽກ")}`}
        />
        <Stat
          icon={<CalendarDays size={18} />}
          label={t("techCal.activeDays", "ມື້ທີ່ມີວຽກ")}
          value={loading ? "—" : `${totals.activeDays} ${t("techCal.daysUnit", "ມື້")}`}
        />
        <Stat
          icon={<Sparkles size={18} />}
          label={t("techCal.completionRate", "ອັດຕາສຳເລັດ")}
          value={loading ? "—" : `${totals.rate}%`}
        />
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,.85fr)]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-soft)] px-4 py-3.5 md:px-5">
            <div>
              <h2 className="text-[13px] font-black text-[var(--text)]">{monthNames[month]} {year}</h2>
              <p className="mt-0.5 text-[9.5px] font-semibold text-[var(--text-mute)]">{t("techCal.pickDayHint", "ເລືອກວັນທີເພື່ອເບິ່ງລາຍລະອຽດວຽກ")}</p>
            </div>
            <div className="flex items-center gap-3 text-[9.5px] font-bold text-[var(--text-mute)]">
              <span className="inline-flex items-center gap-1.5">
                <i className="h-2 w-2 rounded-full" style={{ background: "var(--info)" }} /> {t("techCal.legendPlanned", "ວາງແຜນ")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="h-2 w-2 rounded-full" style={{ background: "var(--success)" }} /> {t("techCal.legendDone", "ສຳເລັດ")}
              </span>
            </div>
          </div>

          <div className={`p-2.5 transition-opacity md:p-4 ${loading ? "opacity-45" : ""}`}>
            <div className="mb-1.5 grid grid-cols-7 gap-1 md:gap-2">
              {dowsShort.map((day, index) => (
                <div
                  key={day}
                  className={`py-1 text-center text-[9.5px] font-black ${index === 0 || index === 6 ? "text-[var(--danger)]" : "text-[var(--text-mute)]"}`}
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 md:gap-2">
              {cells.map((date, index) => {
                if (!date) return <div key={`empty-${index}`} className="min-h-[68px] rounded-xl bg-[var(--surface-sunken)]/50 md:min-h-[94px]" />;
                const key = iso(date);
                const aggregate = byDate.get(key);
                const isToday = key === todayIso;
                const isSelected = key === selected;
                return (
                  <button
                    key={key}
                    onClick={() => setSelected(key)}
                    className={`group relative flex min-h-[68px] flex-col overflow-hidden rounded-xl border p-1.5 text-left transition-all duration-200 md:min-h-[94px] md:p-2.5 ${
                      isSelected
                        ? "border-[var(--brand)] bg-[var(--brand-tint)] ring-2 ring-[var(--brand-ring)]"
                        : aggregate
                          ? "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-sunken)]"
                          : "border-[var(--border-soft)] bg-[var(--surface)] hover:bg-[var(--surface-sunken)]"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span
                        className={`flex h-6 min-w-6 items-center justify-center rounded-lg px-1 text-[11px] font-black tabular-nums ${
                          isToday
                            ? "bg-[var(--ink)] text-[var(--ink-text)]"
                            : isSelected
                              ? "text-[var(--brand-strong)]"
                              : "text-[var(--text-soft)]"
                        }`}
                      >
                        {date.getDate()}
                      </span>
                      {aggregate && (
                        <span className="hidden text-[8px] font-bold tabular-nums text-[var(--text-mute)] md:block">
                          {aggregate.done}/{aggregate.assigned}
                        </span>
                      )}
                    </div>
                    {aggregate && (
                      <div className="mt-auto w-full pt-2">
                        <div className="mb-1.5 hidden h-1.5 overflow-hidden rounded-full bg-[var(--surface-sunken)] md:block">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${aggregate.assigned ? (aggregate.done / aggregate.assigned) * 100 : 0}%`,
                              background: "var(--success)",
                            }}
                          />
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <span className="inline-flex items-center gap-0.5 rounded-md bg-[var(--info-soft)] px-1.5 py-0.5 text-[8.5px] font-black text-[var(--info)]">
                            <BriefcaseBusiness size={8} /> {aggregate.assigned}
                          </span>
                          <span className="inline-flex items-center gap-0.5 rounded-md bg-[var(--success-soft)] px-1.5 py-0.5 text-[8.5px] font-black text-[var(--success)]">
                            <CheckCircle2 size={8} /> {aggregate.done}
                          </span>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        <Card className="flex min-h-[420px] flex-col overflow-hidden xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)]">
          <div className="border-b border-[var(--border-soft)] bg-[var(--surface-sunken)] px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9.5px] font-black tracking-[0.16em] text-[var(--brand-strong)]">{t("techCal.dayDetail", "ລາຍລະອຽດປະຈຳວັນ")}</p>
                <h2 className="mt-1 text-[15px] font-black text-[var(--text)]">{dows[selectedDate.getDay()]}</h2>
                <p className="mt-0.5 font-mono text-[10px] font-semibold tabular-nums text-[var(--text-mute)]">
                  {pad(selectedDate.getDate())} / {pad(selectedDate.getMonth() + 1)} / {selectedDate.getFullYear()}
                </p>
              </div>
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-xl text-lg font-black tabular-nums ${
                  selected === todayIso
                    ? "bg-[var(--ink)] text-[var(--ink-text)]"
                    : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                }`}
              >
                {selectedDate.getDate()}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-[var(--info-soft)] bg-[var(--info-soft)] px-3 py-2 text-[var(--info)]">
                <span className="block text-[9px] font-bold">{t("techCal.legendPlanned", "ວາງແຜນ")}</span>
                <strong className="text-lg font-black tabular-nums">{dayDetail.planned.length}</strong>{" "}
                <small className="text-[9px] font-bold">{t("techCal.jobsUnit", "ວຽກ")}</small>
              </div>
              <div className="rounded-xl border border-[var(--success-soft)] bg-[var(--success-soft)] px-3 py-2 text-[var(--success)]">
                <span className="block text-[9px] font-bold">{t("techCal.completed", "ສຳເລັດແລ້ວ")}</span>
                <strong className="text-lg font-black tabular-nums">{dayDetail.done.length}</strong>{" "}
                <small className="text-[9px] font-bold">{t("techCal.jobsUnit", "ວຽກ")}</small>
              </div>
            </div>
          </div>

          {dayDetail.planned.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-14 text-center">
              <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-sunken)] text-[var(--text-mute)]">
                <CalendarDays size={28} strokeWidth={1.6} />
              </span>
              <h3 className="text-[13px] font-black text-[var(--text)]">{t("techCal.noJobs", "ບໍ່ມີວຽກໃນມື້ນີ້")}</h3>
              <p className="mt-1.5 max-w-56 text-[10.5px] font-medium leading-5 text-[var(--text-mute)]">
                {t("techCal.noJobsHint", "ຍັງບໍ່ມີການວາງແຜນວຽກໃຫ້ທີມຊ່າງໃນວັນທີນີ້")}
              </p>
            </div>
          ) : (
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-[11.5px] font-black text-[var(--text)]">
                    <BriefcaseBusiness size={14} className="text-[var(--info)]" /> {t("techCal.plannedJobs", "ວຽກທີ່ວາງແຜນ")}
                  </h3>
                  <span className="rounded-md bg-[var(--info-soft)] px-2 py-0.5 text-[9px] font-black tabular-nums text-[var(--info)]">
                    {dayDetail.planned.length}
                  </span>
                </div>
                {shiftList(dayDetail.byShiftPlanned, "planned")}
              </section>
              {dayDetail.done.length > 0 && (
                <section className="space-y-3 border-t border-[var(--border-soft)] pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-[11.5px] font-black text-[var(--text)]">
                      <CheckCircle2 size={14} className="text-[var(--success)]" /> {t("techCal.doneJobs", "ວຽກທີ່ສຳເລັດ")}
                    </h3>
                    <span className="rounded-md bg-[var(--success-soft)] px-2 py-0.5 text-[9px] font-black tabular-nums text-[var(--success)]">
                      {dayDetail.done.length}
                    </span>
                  </div>
                  {shiftList(dayDetail.byShiftDone, "done")}
                </section>
              )}
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}
