"use client";


import AuthGuard from "@/_components/AuthGuard";
import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  ChevronDown,
  FolderOpen,
  RefreshCw,
  Search,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { usePageHeader } from "@/_components/PageHeader";
import { getTechnicians, getHelpers } from "@/_actions/lookups";
import { getWorkOrders } from "@/_actions/work-orders";

function _getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type Period = "week" | "month" | "custom";

const STATUS_META: Record<string, { label: string; dot: string; text: string }> = {
  draft: {
    label: "ສະບັບຮ່າງ",
    dot: "bg-stone-500",
    text: "text-stone-700",
  },
  assigned: {
    label: "ມອບໝາຍ",
    dot: "bg-amber-500",
    text: "text-amber-700",
  },
  in_progress: {
    label: "ກຳລັງດຳເນີນ",
    dot: "bg-sky-500",
    text: "text-sky-700",
  },
  completed: {
    label: "ສຳເລັດ",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
  },
  closed: {
    label: "ປິດ",
    dot: "bg-stone-700",
    text: "text-stone-700",
  },
};

const PERIOD_LABELS: Record<Period, string> = {
  week: "ອາທິດ",
  month: "ເດືອນ",
  custom: "ກຳນົດເອງ",
};

const fmtDate = (d: Date | null) => {
  if (!d) return "-";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const normalizeDate = (d: any) => {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
};

type TechRow = {
  techId: string;
  techName: string;
  totalOrders: number;
  statusCounts: Record<string, number>;
  projects: Array<{
    projectKey: string;
    projectName: string;
    totalOrders: number;
  }>;
};

function HeadTechnicianSummary() {
  const [orders, setOrders] = useState<any[]>([]);
  const [techs, setTechs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState({ from: "", to: "" });
  const [period, setPeriod] = useState<Period>("month");
  const [techSearch, setTechSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [woRes, techRes, helperRes] = await Promise.all([
        getWorkOrders(),
        getTechnicians(),
        getHelpers(),
      ]);
      setOrders(woRes?.success ? (woRes.data as any[]) : []);
      const techsData = techRes?.success ? (techRes.data as any[]) : [];
      const helpers = helperRes?.success ? (helperRes.data.data as any[]) : [];
      const personnelMap = new Map();
      helpers.forEach((p: any) => personnelMap.set(p.code, p));
      techsData.forEach((p: any) => personnelMap.set(p.code, p));
      setTechs(Array.from(personnelMap.values()));
    } catch (err) {
      console.error("Load summary failed", err);
    } finally {
      setLoading(false);
    }
  };

  const { fromDate, toDate } = useMemo(() => {
    const now = new Date();
    if (period === "week") {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const start = new Date(now);
      start.setDate(now.getDate() - diff);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { fromDate: start, toDate: end };
    }
    if (period === "month") {
      return {
        fromDate: new Date(now.getFullYear(), now.getMonth(), 1),
        toDate: new Date(now.getFullYear(), now.getMonth() + 1, 0),
      };
    }
    return {
      fromDate: normalizeDate(range.from),
      toDate: normalizeDate(range.to),
    };
  }, [period, range]);

  const techNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    techs.forEach((t) => {
      const code = t.code || t.name_1 || t.name;
      const name = t.name_1 || t.name || code;
      if (code) map[code] = name;
    });
    return map;
  }, [techs]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const date = normalizeDate(
        o.created_at || o.createdAt || o.date || o.issued_date,
      );
      if (!date) return true;
      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      return true;
    });
  }, [orders, fromDate, toDate]);

  const techProjectSummary: TechRow[] = useMemo(() => {
    const map: Record<string, TechRow> = {};
    filteredOrders.forEach((o: any) => {
      const projectKey = o.project_code || o.project_name || "unassigned";
      const projectName =
        o.project_name || o.project_code || "ບໍ່ລະບຸໂຄງການ";
      const status = String(o.status || "draft").toLowerCase();

      const addPerson = (id: string) => {
        if (!id) return;
        if (!map[id]) {
          map[id] = {
            techId: id,
            techName: techNameMap[id] || id,
            totalOrders: 0,
            statusCounts: {},
            projects: [],
          };
        }
        const entry = map[id];
        entry.totalOrders += 1;
        entry.statusCounts[status] = (entry.statusCounts[status] || 0) + 1;
        let proj = entry.projects.find((p) => p.projectKey === projectKey);
        if (!proj) {
          proj = { projectKey, projectName, totalOrders: 0 };
          entry.projects.push(proj);
        }
        proj.totalOrders += 1;
      };

      addPerson(o.technician_id || o.technician);
      const helpers = Array.isArray(o.helper_ids)
        ? o.helper_ids
        : typeof o.helper_ids === "string"
          ? o.helper_ids
              .split(",")
              .map((s: string) => s.trim())
              .filter(Boolean)
          : [];
      helpers.forEach((h: string) => addPerson(h));
    });

    return Object.values(map)
      .map((entry) => ({
        ...entry,
        projects: entry.projects.sort((a, b) => b.totalOrders - a.totalOrders),
      }))
      .sort((a, b) => {
        if (b.totalOrders !== a.totalOrders)
          return b.totalOrders - a.totalOrders;
        return a.techName.localeCompare(b.techName);
      });
  }, [filteredOrders, techNameMap]);

  const filteredTechRows = useMemo(() => {
    const s = techSearch.trim().toLowerCase();
    if (!s) return techProjectSummary;
    return techProjectSummary.filter(
      (t) =>
        t.techName.toLowerCase().includes(s) ||
        t.techId.toLowerCase().includes(s),
    );
  }, [techProjectSummary, techSearch]);

  // Overall summary across all techs
  const overall = useMemo(() => {
    const statusTotals: Record<string, number> = {};
    let totalOrders = 0;
    techProjectSummary.forEach((t) => {
      totalOrders += t.totalOrders;
      Object.entries(t.statusCounts).forEach(([k, v]) => {
        statusTotals[k] = (statusTotals[k] || 0) + (v as number);
      });
    });
    return {
      totalTechs: techProjectSummary.length,
      totalOrders,
      statusTotals,
    };
  }, [techProjectSummary]);

  const toggleExpand = (techId: string) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(techId)) n.delete(techId);
      else n.add(techId);
      return n;
    });

  const clearFilters = () => {
    setPeriod("month");
    setRange({ from: "", to: "" });
    setTechSearch("");
  };

  usePageHeader({
    title: "ສະຫຼຸບຜົນງານຊ່າງ",
    subtitle: `${filteredTechRows.length} ຄົນ · ${overall.totalOrders} ໃບງານ`,
    secondaryActions: [
      {
        label: "ໂຫຼດໃໝ່",
        icon: (
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        ),
        onClick: () => loadData(),
        disabled: loading,
      },
    ],
  });

  return (
    <div className="bg-[var(--theme-page)] px-3 py-3 md:px-4">
      <div className="mx-auto max-w-[1480px] space-y-3">
        {/* Filter toolbar */}
        <section className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--theme-border-subtle)] bg-white px-3 py-2 text-[12px]">
          {/* Period segmented control */}
          <div className="inline-flex rounded-md border border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] p-0.5">
            {(["week", "month", "custom"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded px-2.5 py-1 text-[11px] font-medium transition ${
                  period === p
                    ? "bg-white text-[var(--theme-text)] shadow-sm"
                    : "text-[var(--theme-text-mute)] hover:text-[var(--theme-text-soft)]"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {period === "custom" && (
            <>
              <div className="flex h-7 items-center gap-1.5 rounded-md border border-[var(--theme-border-subtle)] bg-white px-2">
                <Calendar className="h-3 w-3 text-[var(--theme-text-mute)]" />
                <input
                  type="date"
                  value={range.from}
                  onChange={(e) =>
                    setRange((s) => ({ ...s, from: e.target.value }))
                  }
                  className="bg-transparent text-[11px] outline-none"
                />
              </div>
              <span className="text-[var(--theme-text-mute)]">→</span>
              <div className="flex h-7 items-center gap-1.5 rounded-md border border-[var(--theme-border-subtle)] bg-white px-2">
                <Calendar className="h-3 w-3 text-[var(--theme-text-mute)]" />
                <input
                  type="date"
                  value={range.to}
                  onChange={(e) =>
                    setRange((s) => ({ ...s, to: e.target.value }))
                  }
                  className="bg-transparent text-[11px] outline-none"
                />
              </div>
            </>
          )}

          {/* Date display */}
          <span className="hidden text-[11px] text-[var(--theme-text-mute)] md:inline">
            {fmtDate(fromDate)} → {fmtDate(toDate)}
          </span>

          {/* Tech search */}
          <div className="ml-auto flex h-7 min-w-[200px] items-center gap-2 rounded-md border border-[var(--theme-border-subtle)] bg-white px-2">
            <Search className="h-3 w-3 text-[var(--theme-text-mute)]" />
            <input
              value={techSearch}
              onChange={(e) => setTechSearch(e.target.value)}
              placeholder="ຄົ້ນຫາຊ່າງ..."
              className="min-w-0 flex-1 bg-transparent text-[11px] outline-none"
            />
            {techSearch && (
              <button
                onClick={() => setTechSearch("")}
                className="text-[var(--theme-text-mute)] hover:text-[var(--theme-text)]"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {(period !== "month" || techSearch) && (
            <button
              onClick={clearFilters}
              className="text-[11px] font-medium text-[var(--theme-primary)] hover:underline"
            >
              ລ້າງ
            </button>
          )}
        </section>

        {/* Overall stats */}
        <section className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-[var(--theme-border-subtle)] bg-white px-3 py-2 text-[12px]">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-[var(--theme-primary)]" />
            <span className="font-semibold tabular-nums text-[var(--theme-text)]">
              {overall.totalTechs}
            </span>
            <span className="text-[var(--theme-text-mute)]">ຄົນ</span>
          </span>
          <span className="hidden text-[var(--theme-border)] md:inline">|</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="font-semibold tabular-nums text-[var(--theme-text)]">
              {overall.totalOrders}
            </span>
            <span className="text-[var(--theme-text-mute)]">ໃບງານທັງໝົດ</span>
          </span>
          <span className="hidden text-[var(--theme-border)] md:inline">|</span>
          {Object.entries(STATUS_META).map(([key, meta]) => {
            const count = overall.statusTotals[key] || 0;
            if (count === 0) return null;
            return (
              <span key={key} className="inline-flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                <span
                  className={`font-semibold tabular-nums ${meta.text}`}
                >
                  {count}
                </span>
                <span className="text-[var(--theme-text-mute)]">
                  {meta.label}
                </span>
              </span>
            );
          })}
        </section>

        {/* Technician ranking list */}
        <section className="overflow-hidden rounded-md border border-[var(--theme-border-subtle)] bg-white">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="flex items-center gap-3 text-[var(--theme-text-mute)]">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--theme-border-subtle)] border-t-[var(--theme-primary)]" />
                <span className="text-sm">ກຳລັງໂຫຼດ...</span>
              </div>
            </div>
          ) : filteredTechRows.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-[var(--theme-text-mute)]">
              <FolderOpen className="h-6 w-6 opacity-50" />
              <span className="text-sm">ບໍ່ພົບຂໍ້ມູນ</span>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--theme-border-subtle)]">
              {filteredTechRows.map((t, idx) => {
                const isOpen = expanded.has(t.techId);
                const rank = idx + 1;
                const isTopRank = rank <= 3;
                return (
                  <li key={t.techId} className="bg-white">
                    <div
                      onClick={() => toggleExpand(t.techId)}
                      className={[
                        "group flex cursor-pointer items-center gap-3 px-3 py-2.5 transition",
                        isOpen
                          ? "bg-[var(--theme-bg-muted)]"
                          : "hover:bg-[var(--theme-bg-muted)]/60",
                      ].join(" ")}
                    >
                      <ChevronDown
                        className={`h-4 w-4 flex-shrink-0 text-[var(--theme-text-mute)] transition ${isOpen ? "" : "-rotate-90"}`}
                      />

                      {/* Rank badge */}
                      <span
                        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold ${
                          isTopRank
                            ? "bg-[var(--theme-primary-tint)] text-[var(--theme-primary)] ring-1 ring-[var(--theme-primary-soft)]"
                            : "bg-[var(--theme-bg-muted)] text-[var(--theme-text-mute)]"
                        }`}
                      >
                        {isTopRank ? (
                          <Trophy className="h-3.5 w-3.5" />
                        ) : (
                          rank
                        )}
                      </span>

                      {/* Tech info */}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-[var(--theme-text)]">
                          {t.techName}
                        </div>
                        <div className="mt-0.5 truncate font-mono text-[10px] text-[var(--theme-text-mute)]">
                          {t.techId}
                        </div>
                      </div>

                      {/* Status breakdown inline */}
                      <div className="hidden flex-wrap items-center gap-x-3 gap-y-0 lg:flex">
                        {Object.entries(STATUS_META).map(([key, meta]) => {
                          const count = t.statusCounts[key] || 0;
                          if (count === 0) return null;
                          return (
                            <span
                              key={key}
                              className="inline-flex items-center gap-1 text-[10px]"
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${meta.dot}`}
                              />
                              <span
                                className={`font-semibold tabular-nums ${meta.text}`}
                              >
                                {count}
                              </span>
                            </span>
                          );
                        })}
                      </div>

                      {/* Total + project count */}
                      <div className="flex flex-shrink-0 items-center gap-3">
                        <span className="text-[11px] text-[var(--theme-text-mute)]">
                          <span className="font-semibold tabular-nums text-[var(--theme-text-soft)]">
                            {t.projects.length}
                          </span>{" "}
                          ໂຄງການ
                        </span>
                        <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-[var(--theme-primary-tint)] px-2.5 text-[12px] font-bold tabular-nums text-[var(--theme-primary)]">
                          {t.totalOrders}
                          <span className="text-[10px] font-medium">ໃບງານ</span>
                        </span>
                      </div>
                    </div>

                    {/* Expanded — project breakdown */}
                    {isOpen && (
                      <div className="border-t border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)]/40">
                        <table className="min-w-full text-[12px]">
                          <thead>
                            <tr className="border-b border-[var(--theme-border-subtle)] text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text-mute)]">
                              <th className="px-4 py-2 text-left">#</th>
                              <th className="px-4 py-2 text-left">ໂຄງການ</th>
                              <th className="px-4 py-2 text-right">ຈຳນວນງານ</th>
                              <th className="px-4 py-2 w-32 text-right">%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {t.projects.map((p, i) => {
                              const pct =
                                t.totalOrders > 0
                                  ? Math.round(
                                      (p.totalOrders / t.totalOrders) * 100,
                                    )
                                  : 0;
                              return (
                                <tr
                                  key={p.projectKey}
                                  className="border-b border-[var(--theme-border-subtle)] last:border-b-0"
                                >
                                  <td className="whitespace-nowrap px-4 py-1.5 font-mono text-[10px] text-[var(--theme-text-mute)]">
                                    {String(i + 1).padStart(2, "0")}
                                  </td>
                                  <td className="px-4 py-1.5">
                                    <div className="text-[var(--theme-text)]">
                                      {p.projectName}
                                    </div>
                                    {p.projectKey !== p.projectName && (
                                      <div className="mt-0.5 font-mono text-[10px] text-[var(--theme-text-mute)]">
                                        {p.projectKey}
                                      </div>
                                    )}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-1.5 text-right font-mono font-semibold tabular-nums">
                                    {p.totalOrders}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-1.5 text-right">
                                    <div className="inline-flex items-center gap-2">
                                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--theme-bg-muted)]">
                                        <div
                                          className="h-full bg-[var(--theme-primary)]"
                                          style={{ width: `${pct}%` }}
                                        />
                                      </div>
                                      <span className="font-mono text-[10px] tabular-nums text-[var(--theme-text-mute)]">
                                        {pct}%
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <AuthGuard roles={["head_technician", "service_manager", "service_admin"]}>
      <HeadTechnicianSummary />
    </AuthGuard>
  );
}
