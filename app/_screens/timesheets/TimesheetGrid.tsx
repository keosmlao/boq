"use client";

import React, { useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { usePageHeader } from "@/_components/PageHeader";

/* ─── Types ─── */

type TaskLine = {
  id: string;
  projectId: string;
  projectName: string;
  taskId: string;
  taskName: string;
  hours: number[]; // length 7, Mon..Sun
};

/* ─── Date helpers ─── */

const DAY_LABELS_LO = ["ຈັນ", "ອັງ", "ພຸດ", "ພະຫັດ", "ສຸກ", "ເສົາ", "ອາທິດ"];
const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function startOfWeek(d: Date): Date {
  // Monday as first day of week (Odoo default in most locales).
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0 = Sun .. 6 = Sat
  const diff = (day + 6) % 7; // days to subtract to land on Monday
  date.setDate(date.getDate() - diff);
  return date;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatWeekRange(start: Date): string {
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();
  if (sameMonth && sameYear) {
    return `${start.getDate()} – ${end.getDate()} ${MONTH_SHORT[start.getMonth()]} ${start.getFullYear()}`;
  }
  if (sameYear) {
    return `${start.getDate()} ${MONTH_SHORT[start.getMonth()]} – ${end.getDate()} ${MONTH_SHORT[end.getMonth()]} ${start.getFullYear()}`;
  }
  return `${start.getDate()} ${MONTH_SHORT[start.getMonth()]} ${start.getFullYear()} – ${end.getDate()} ${MONTH_SHORT[end.getMonth()]} ${end.getFullYear()}`;
}

function formatHHMM(value: number): string {
  if (!value || value <= 0) return "0:00";
  const h = Math.floor(value);
  const m = Math.round((value - h) * 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

/* ─── Mock data ─── */

const PROJECTS: { id: string; name: string }[] = [
  { id: "p1", name: "ໂຄງການຕິດຕັ້ງລະບົບສຸວັນ" },
  { id: "p2", name: "ຕິດຕັ້ງ Mall Complex" },
  { id: "p3", name: "ການບໍລິການຫຼັງການຂາຍ" },
];

const PROJECT_TASKS: Record<string, { id: string; name: string }[]> = {
  p1: [
    { id: "t1", name: "ສຳຫຼວດສະຖານທີ່" },
    { id: "t2", name: "ອອກແບບລະບົບ" },
    { id: "t3", name: "ປະຊຸມລູກຄ້າ" },
  ],
  p2: [
    { id: "t4", name: "ຕິດຕັ້ງລະບົບໄຟຟ້າ" },
    { id: "t5", name: "ທົດສອບລະບົບ" },
  ],
  p3: [
    { id: "t6", name: "Maintenance" },
    { id: "t7", name: "Support" },
  ],
};

function buildInitialLines(): TaskLine[] {
  return [
    {
      id: "l1",
      projectId: "p1",
      projectName: "ໂຄງການຕິດຕັ້ງລະບົບສຸວັນ",
      taskId: "t1",
      taskName: "ສຳຫຼວດສະຖານທີ່",
      hours: [8, 4.5, 0, 0, 8, 0, 0],
    },
    {
      id: "l2",
      projectId: "p1",
      projectName: "ໂຄງການຕິດຕັ້ງລະບົບສຸວັນ",
      taskId: "t2",
      taskName: "ອອກແບບລະບົບ",
      hours: [0, 3.5, 8, 0, 0, 0, 0],
    },
    {
      id: "l3",
      projectId: "p1",
      projectName: "ໂຄງການຕິດຕັ້ງລະບົບສຸວັນ",
      taskId: "t3",
      taskName: "ປະຊຸມລູກຄ້າ",
      hours: [0, 0, 0, 2, 0, 0, 0],
    },
    {
      id: "l4",
      projectId: "p2",
      projectName: "ຕິດຕັ້ງ Mall Complex",
      taskId: "t4",
      taskName: "ຕິດຕັ້ງລະບົບໄຟຟ້າ",
      hours: [0, 0, 0, 6, 0, 0, 0],
    },
    {
      id: "l5",
      projectId: "p2",
      projectName: "ຕິດຕັ້ງ Mall Complex",
      taskId: "t5",
      taskName: "ທົດສອບລະບົບ",
      hours: [0, 0, 0, 0, 0, 4, 0],
    },
    {
      id: "l6",
      projectId: "p3",
      projectName: "ການບໍລິການຫຼັງການຂາຍ",
      taskId: "t6",
      taskName: "Maintenance",
      hours: [0, 0, 0, 0, 0, 0, 0],
    },
    {
      id: "l7",
      projectId: "p3",
      projectName: "ການບໍລິການຫຼັງການຂາຍ",
      taskId: "t7",
      taskName: "Support",
      hours: [0, 0, 0, 0, 0, 0, 0],
    },
  ];
}

/* ─── Component ─── */

export default function TimesheetGrid() {
  const today = useMemo(() => new Date(), []);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [lines, setLines] = useState<TaskLine[]>(() => buildInitialLines());
  const [nextLineId, setNextLineId] = useState<number>(100);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  // Group lines by project, preserving project order from PROJECTS list.
  const grouped = useMemo(() => {
    const order = new Map<string, number>();
    PROJECTS.forEach((p, i) => order.set(p.id, i));
    const map = new Map<string, TaskLine[]>();
    for (const ln of lines) {
      const arr = map.get(ln.projectId) || [];
      arr.push(ln);
      map.set(ln.projectId, arr);
    }
    return Array.from(map.entries()).sort(
      (a, b) => (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999),
    );
  }, [lines]);

  const rowTotal = (hours: number[]) =>
    hours.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);

  const dailyTotals = useMemo(() => {
    const totals = new Array(7).fill(0);
    for (const ln of lines) {
      for (let i = 0; i < 7; i++) {
        totals[i] += Number.isFinite(ln.hours[i]) ? ln.hours[i] : 0;
      }
    }
    return totals;
  }, [lines]);

  const grandTotal = useMemo(
    () => dailyTotals.reduce((s, v) => s + v, 0),
    [dailyTotals],
  );

  const updateHour = (lineId: string, dayIdx: number, raw: string) => {
    let v = parseFloat(raw);
    if (!Number.isFinite(v)) v = 0;
    if (v < 0) v = 0;
    if (v > 24) v = 24;
    setLines((prev) =>
      prev.map((ln) =>
        ln.id === lineId
          ? { ...ln, hours: ln.hours.map((h, i) => (i === dayIdx ? v : h)) }
          : ln,
      ),
    );
  };

  const addTaskLine = (projectId: string) => {
    const project = PROJECTS.find((p) => p.id === projectId);
    if (!project) return;
    const used = new Set(
      lines.filter((l) => l.projectId === projectId).map((l) => l.taskId),
    );
    const available = (PROJECT_TASKS[projectId] || []).filter(
      (t) => !used.has(t.id),
    );
    const next = available[0];
    const id = `l${nextLineId}`;
    setNextLineId((n) => n + 1);
    setLines((prev) => [
      ...prev,
      {
        id,
        projectId,
        projectName: project.name,
        taskId: next ? next.id : `t-new-${id}`,
        taskName: next ? next.name : "ໜ້າວຽກໃໝ່",
        hours: [0, 0, 0, 0, 0, 0, 0],
      },
    ]);
  };

  const removeLine = (lineId: string) => {
    setLines((prev) => prev.filter((l) => l.id !== lineId));
  };

  const goPrevWeek = () => setWeekStart((d) => addDays(d, -7));
  const goNextWeek = () => setWeekStart((d) => addDays(d, 7));
  const goToday = () => setWeekStart(startOfWeek(new Date()));

  const handleSubmit = () => {
    void Swal.fire({
      icon: "success",
      title: "Timesheet ສົ່ງສຳເລັດ",
      text: "ລໍຖ້າອະນຸມັດ",
      confirmButtonColor: "#714b67",
    });
  };

  /* ── Register page header ── */
  usePageHeader({
    title: "Timesheets",
    subtitle: `${grandTotal.toFixed(1)} ຊົ່ວໂມງ ໃນອາທິດນີ້`,
    primaryAction: {
      label: "Submit",
      icon: <Send size={13} />,
      onClick: handleSubmit,
    },
    secondaryActions: [
      {
        label: "ມື້ນີ້",
        icon: <Calendar size={13} />,
        onClick: goToday,
      },
    ],
  });

  /* ── Render ── */
  return (
    <div className="p-4">
      <div className="theme-page-surface overflow-hidden">
        {/* Tools row: week navigator */}
        <div
          className="flex items-center justify-between gap-3 px-4 py-2.5 border-b"
          style={{ borderColor: "var(--theme-border)" }}
        >
          <div className="flex items-center gap-2">
            <span
              className="text-[13px] font-semibold"
              style={{ color: "var(--theme-text)" }}
            >
              My Timesheet
            </span>
            <span
              className="text-[12px]"
              style={{ color: "var(--theme-text-mute)" }}
            >
              ·
            </span>
            <span
              className="text-[12px]"
              style={{ color: "var(--theme-text-soft)" }}
            >
              {lines.length} ລາຍການ
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={goPrevWeek}
              className="odoo-action !h-7 !px-2 inline-flex items-center justify-center"
              aria-label="Previous week"
            >
              <ChevronLeft size={14} />
            </button>
            <div
              className="min-w-[180px] text-center text-[12.5px] font-semibold px-3 py-1 rounded border"
              style={{
                color: "var(--theme-text)",
                borderColor: "var(--theme-border)",
                background: "var(--theme-surface-muted)",
              }}
            >
              {formatWeekRange(weekStart)}
            </div>
            <button
              type="button"
              onClick={goNextWeek}
              className="odoo-action !h-7 !px-2 inline-flex items-center justify-center"
              aria-label="Next week"
            >
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="odoo-action !h-7 ml-1"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="odoo-action odoo-action-primary !h-7 inline-flex items-center gap-1.5"
            >
              <Send size={12} />
              Submit
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="overflow-x-auto theme-scrollbar">
          <table
            className="w-full text-[12.5px] border-separate"
            style={{ borderSpacing: 0, minWidth: 920 }}
          >
            <colgroup>
              <col style={{ width: 220 }} />
              <col style={{ width: 240 }} />
              {weekDays.map((_, i) => (
                <col key={i} style={{ width: 88 }} />
              ))}
              <col style={{ width: 90 }} />
              <col style={{ width: 36 }} />
            </colgroup>

            {/* Header */}
            <thead>
              <tr>
                <th
                  className="text-left px-3 py-2 font-semibold border-b"
                  style={{
                    color: "var(--theme-text-soft)",
                    background: "var(--theme-surface-muted)",
                    borderColor: "var(--theme-border)",
                  }}
                >
                  Project
                </th>
                <th
                  className="text-left px-3 py-2 font-semibold border-b"
                  style={{
                    color: "var(--theme-text-soft)",
                    background: "var(--theme-surface-muted)",
                    borderColor: "var(--theme-border)",
                  }}
                >
                  Task
                </th>
                {weekDays.map((d, i) => {
                  const isWeekend = i >= 5;
                  const isToday = sameDay(d, today);
                  return (
                    <th
                      key={i}
                      className="text-center px-1 py-2 font-semibold border-b"
                      style={{
                        color: isToday
                          ? "var(--theme-primary)"
                          : "var(--theme-text-soft)",
                        background: isToday
                          ? "var(--theme-primary-tint)"
                          : isWeekend
                            ? "#fafafa"
                            : "var(--theme-surface-muted)",
                        borderColor: "var(--theme-border)",
                        borderLeft: isToday
                          ? `1px solid var(--theme-primary)`
                          : undefined,
                        borderRight: isToday
                          ? `1px solid var(--theme-primary)`
                          : undefined,
                      }}
                    >
                      <div className="text-[11px] uppercase tracking-wide">
                        {DAY_LABELS_LO[i]}
                      </div>
                      <div
                        className="text-[13px]"
                        style={{
                          color: isToday
                            ? "var(--theme-primary)"
                            : "var(--theme-text)",
                          fontWeight: isToday ? 700 : 600,
                        }}
                      >
                        {d.getDate()}
                      </div>
                    </th>
                  );
                })}
                <th
                  className="text-right px-3 py-2 font-semibold border-b"
                  style={{
                    color: "var(--theme-text-soft)",
                    background: "var(--theme-surface-muted)",
                    borderColor: "var(--theme-border)",
                    borderLeft: "1px solid var(--theme-border)",
                  }}
                >
                  Total
                </th>
                <th
                  className="border-b"
                  style={{
                    background: "var(--theme-surface-muted)",
                    borderColor: "var(--theme-border)",
                  }}
                />
              </tr>
            </thead>

            <tbody>
              {grouped.map(([projectId, projectLines]) => {
                const projectName = projectLines[0].projectName;
                const projectTotal = projectLines.reduce(
                  (s, l) => s + rowTotal(l.hours),
                  0,
                );
                return (
                  <React.Fragment key={projectId}>
                    {/* Project header row */}
                    <tr>
                      <td
                        colSpan={9}
                        className="px-3 py-1.5 font-semibold border-b"
                        style={{
                          background: "var(--theme-primary-tint)",
                          color: "var(--theme-primary-strong)",
                          borderColor: "var(--theme-border-subtle)",
                        }}
                      >
                        <span className="text-[12.5px]">{projectName}</span>
                      </td>
                      <td
                        className="text-right px-3 py-1.5 font-semibold border-b"
                        style={{
                          background: "var(--theme-primary-tint)",
                          color: "var(--theme-primary-strong)",
                          borderColor: "var(--theme-border-subtle)",
                          borderLeft: "1px solid var(--theme-border)",
                        }}
                      >
                        {formatHHMM(projectTotal)}
                      </td>
                      <td
                        className="border-b"
                        style={{
                          background: "var(--theme-primary-tint)",
                          borderColor: "var(--theme-border-subtle)",
                        }}
                      />
                    </tr>

                    {/* Task rows */}
                    {projectLines.map((ln) => {
                      const total = rowTotal(ln.hours);
                      return (
                        <tr
                          key={ln.id}
                          className="group transition-colors"
                          style={{ background: "var(--theme-surface)" }}
                        >
                          <td
                            className="pl-6 pr-3 py-1.5 border-b"
                            style={{
                              color: "var(--theme-text-mute)",
                              borderColor: "var(--theme-border-subtle)",
                            }}
                          >
                            <span className="text-[12px]">·</span>
                          </td>
                          <td
                            className="px-3 py-1.5 border-b"
                            style={{
                              color: "var(--theme-text)",
                              borderColor: "var(--theme-border-subtle)",
                            }}
                          >
                            {ln.taskName}
                          </td>
                          {ln.hours.map((h, i) => {
                            const isWeekend = i >= 5;
                            const isToday = sameDay(weekDays[i], today);
                            return (
                              <td
                                key={i}
                                className="px-1 py-1 border-b text-center"
                                style={{
                                  background: isToday
                                    ? "rgba(113, 75, 103, 0.05)"
                                    : isWeekend
                                      ? "#fafafa"
                                      : undefined,
                                  borderColor: "var(--theme-border-subtle)",
                                  borderLeft: isToday
                                    ? `1px solid var(--theme-primary)`
                                    : undefined,
                                  borderRight: isToday
                                    ? `1px solid var(--theme-primary)`
                                    : undefined,
                                }}
                              >
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step={0.25}
                                  min={0}
                                  max={24}
                                  value={h ? String(h) : ""}
                                  onChange={(e) =>
                                    updateHour(ln.id, i, e.target.value)
                                  }
                                  placeholder="0:00"
                                  className="w-full h-7 text-center bg-transparent outline-none rounded text-[12.5px] focus:bg-white focus:ring-1"
                                  style={
                                    {
                                      color: h
                                        ? "var(--theme-text)"
                                        : "var(--theme-text-mute)",
                                      "--tw-ring-color":
                                        "var(--theme-primary)",
                                    } as React.CSSProperties
                                  }
                                />
                              </td>
                            );
                          })}
                          <td
                            className="text-right px-3 py-1.5 border-b font-semibold"
                            style={{
                              color: "var(--theme-text)",
                              borderColor: "var(--theme-border-subtle)",
                              borderLeft: "1px solid var(--theme-border)",
                            }}
                          >
                            {formatHHMM(total)}
                          </td>
                          <td
                            className="text-center px-1 py-1 border-b"
                            style={{
                              borderColor: "var(--theme-border-subtle)",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => removeLine(ln.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50"
                              style={{ color: "var(--theme-danger)" }}
                              aria-label="Remove line"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Add task line */}
                    <tr>
                      <td
                        colSpan={10}
                        className="px-3 py-1.5 border-b"
                        style={{
                          borderColor: "var(--theme-border-subtle)",
                          background: "var(--theme-surface)",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => addTaskLine(projectId)}
                          className="inline-flex items-center gap-1 text-[12px] font-medium ml-3 hover:underline"
                          style={{ color: "var(--theme-primary)" }}
                        >
                          <Plus size={12} />
                          Add a line
                        </button>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}

              {/* Daily total row */}
              <tr>
                <td
                  className="px-3 py-2 font-bold"
                  style={{
                    background: "var(--theme-primary-tint)",
                    color: "var(--theme-primary-strong)",
                    borderTop: "1px solid var(--theme-border)",
                  }}
                >
                  Daily total
                </td>
                <td
                  className="px-3 py-2"
                  style={{
                    background: "var(--theme-primary-tint)",
                    borderTop: "1px solid var(--theme-border)",
                  }}
                />
                {dailyTotals.map((t, i) => {
                  const isWeekend = i >= 5;
                  const isToday = sameDay(weekDays[i], today);
                  return (
                    <td
                      key={i}
                      className="text-center px-1 py-2 font-bold"
                      style={{
                        background: isToday
                          ? "var(--theme-primary-tint)"
                          : isWeekend
                            ? "#f3f0f2"
                            : "var(--theme-primary-tint)",
                        color: "var(--theme-accent-strong)",
                        borderTop: "1px solid var(--theme-border)",
                        borderLeft: isToday
                          ? `1px solid var(--theme-primary)`
                          : undefined,
                        borderRight: isToday
                          ? `1px solid var(--theme-primary)`
                          : undefined,
                      }}
                    >
                      {formatHHMM(t)}
                    </td>
                  );
                })}
                <td
                  className="text-right px-3 py-2 font-bold"
                  style={{
                    background: "var(--theme-primary-tint)",
                    color: "var(--theme-accent-strong)",
                    borderTop: "1px solid var(--theme-border)",
                    borderLeft: "1px solid var(--theme-border)",
                  }}
                >
                  {formatHHMM(grandTotal)}
                </td>
                <td
                  style={{
                    background: "var(--theme-primary-tint)",
                    borderTop: "1px solid var(--theme-border)",
                  }}
                />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer hint */}
        <div
          className="px-4 py-2 text-[11.5px] flex items-center justify-between"
          style={{
            color: "var(--theme-text-mute)",
            background: "var(--theme-surface-muted)",
            borderTop: "1px solid var(--theme-border)",
          }}
        >
          <span>
            ບັນທຶກຊົ່ວໂມງເຮັດວຽກປະຈຳວັນ — ກົດ Submit ເພື່ອສົ່ງຂໍອະນຸມັດ
          </span>
          <span>
            ລວມ: <strong style={{ color: "var(--theme-text)" }}>{formatHHMM(grandTotal)}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
