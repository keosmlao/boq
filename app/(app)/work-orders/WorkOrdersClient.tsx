"use client";

/**
 * ໃບງານ — flat list (ODIEN SERVICE layout): toolbar → stage tabs → one table.
 * Rows carry a status bar down the left edge; no day/project grouping.
 */
import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  BellRing,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  LayoutGrid,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Table as TableIcon,
} from "lucide-react";
import * as XLSX from "xlsx";
import ProjectPickerModal from "../_components/ProjectPickerModal";
import RSelect from "../_components/RSelect";
import TeamStatusCard from "./TeamStatusCard";
import {
  Btn,
  BtnCount,
  Card,
  Page,
  PageHeader,
  Pill,
  RowBar,
  RowBarTh,
  Segmented,
  SortTh,
  Toolbar,
  TwoLine,
  inputCls,
  tblCls,
  tdCls,
  thCls,
  trHover,
  type PillTone,
} from "../_components/ui";
import { getWorkOrders } from "@/_actions/workorder";
import { workOrderStage } from "@/_lib/workorder-stage";
import { useT } from "@/_lib/i18n";

const PER_PAGE = 25;

const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "-";
};

const d10 = (v: unknown) => {
  if (!v) return "-";
  const d = new Date(v as any);
  const p = (n: number) => String(n).padStart(2, "0");
  if (isNaN(d.getTime())) {
    // Fall back: reformat a YYYY-MM-DD string into dd-MM-yyyy.
    const m = String(v).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : String(v).slice(0, 10);
  }
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
};

/** Categorize both v2 work orders and legacy ERP work orders for tab filtering */
function getStageKey(r: any): string {
  if (r.src === "erp") {
    const status = String(r.status || "").trim();
    if (status === "ປິດງານແລ້ວ" || status === "closed" || status === "Closed") return "closed";
    if (status === "ກຳລັງເຂົ້າໜ້າງານ" || status === "IN_PROGRESS" || status === "in_progress") return "in_progress";
    if (status === "ຊ່າງຮັບງານ" || status === "ASSIGNED" || status === "assigned") return "accepted";
    if (status === "ບໍ່ອະນຸມັດ" || status === "rejected") return "rejected";
    return "issued"; // fallback for ອອກໃບງານ
  }
  const s = workOrderStage(r);
  if (s.key === "approval_rejected" || s.key === "accept_rejected") return "rejected";
  return s.key;
}

const STAGE_BAR: Record<string, "info" | "brand" | "warning" | "success" | "danger" | "neutral"> = {
  issued: "info",
  accepted: "brand",
  in_progress: "warning",
  awaiting_review: "warning",
  closed: "success",
  rejected: "danger",
};

const STAGE_PILL: Record<string, PillTone> = {
  issued: "blue",
  accepted: "brand",
  in_progress: "amber",
  awaiting_review: "amber",
  closed: "green",
  rejected: "red",
};

type SortKey = "work_no" | "work_date" | "technician_name" | "labor_cost";

/**
 * ອາຍຸງານ — how long a work order has been open (from its work date).
 * Closed / rejected orders are done, so they show no age badge.
 * amber past 7 days, red past 30.
 */
function ageBadge(r: any, stage: string, t: (k: string, f: string) => string) {
  if (stage === "closed" || stage === "rejected") return null;
  const start = r.work_date ?? r.created_at;
  if (!start) return null;
  const ms = Date.now() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const tone = days > 30 ? "red" : days > 7 ? "amber" : "neutral";
  return (
    <Pill tone={tone as PillTone}>
      {days} {t("workorders.daysUnit", "ມື້")} {String(hours).padStart(2, "0")}h
    </Pill>
  );
}

export default function WorkOrdersClient({ initialRows }: { initialRows: any[] }) {
  const t = useT();
  const router = useRouter();
  const [pick, setPick] = useState(false);
  const [allRows, setAllRows] = useState<any[]>(initialRows ?? []);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [draftQ, setDraftQ] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "work_date", dir: "desc" });
  const [view, setView] = useState<"table" | "board">("table");
  const [loading, setLoading] = useState(false);

  const runSearch = () => {
    setQ(draftQ);
    setPage(1);
  };

  const reload = async () => {
    setLoading(true);
    try {
      const res: any = await getWorkOrders({});
      const data = res?.success ? res.data || [] : Array.isArray(res) ? res : [];
      setAllRows(data);
    } finally {
      setLoading(false);
    }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: allRows.length };
    for (const key of ["issued", "accepted", "in_progress", "awaiting_review", "closed", "rejected"]) {
      c[key] = allRows.filter((r) => getStageKey(r) === key).length;
    }
    return c;
  }, [allRows]);

  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const list = allRows.filter((r) => {
      if (activeTab !== "all" && getStageKey(r) !== activeTab) return false;
      if (!kw) return true;
      return `${r.work_no ?? ""} ${r.technician_name ?? ""} ${r.technician_code ?? ""} ${r.title ?? ""} ${r.project_name ?? ""}`
        .toLowerCase()
        .includes(kw);
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = sort.key === "work_date" ? a.work_date ?? a.created_at : a[sort.key];
      const bv = sort.key === "work_date" ? b.work_date ?? b.created_at : b[sort.key];
      if (sort.key === "labor_cost") return (Number(av) || 0) > (Number(bv) || 0) ? dir : -dir;
      return String(av ?? "") > String(bv ?? "") ? dir : -dir;
    });
  }, [allRows, activeTab, q, sort]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const current = Math.min(page, pageCount);
  const pageRows = rows.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const stages = [
    { value: "all", label: t("common.all", "ທັງໝົດ") },
    { value: "issued", label: t("workorders.stageIssued", "ອອກໃບງານ") },
    { value: "accepted", label: t("workorders.stageAccepted", "ຊ່າງຮັບງານ") },
    { value: "in_progress", label: t("workorders.stageInProgress", "ກຳລັງເຂົ້າໜ້າງານ") },
    { value: "awaiting_review", label: t("workorders.stageAwaitingReview", "ລໍຖ້າກວດສອບ") },
    { value: "closed", label: t("workorders.stageClosed", "ປິດງານແລ້ວ") },
    { value: "rejected", label: t("workorders.stageRejected", "ປະຕິເສດ") },
  ];

  const tabs = stages.map((tab) => ({
    value: tab.value,
    label: (
      <span className="flex items-center gap-1.5">
        {tab.label}
        <span className="rounded-full bg-black/10 px-1.5 text-[10px] font-black dark:bg-white/15">{counts[tab.value] ?? 0}</span>
      </span>
    ),
  }));

  /** Excel export of exactly what is on screen (current filter + sort, all pages). */
  const exportExcel = () => {
    const sheet = XLSX.utils.json_to_sheet(
      rows.map((r) => ({
        [t("workorders.colWorkOrder", "ໃບງານ")]: r.work_no || "",
        [t("workorders.colJob", "ວຽກ")]: r.title || "",
        [t("common.project", "ໂຄງການ")]: r.project_name || "",
        [t("workorders.colTeam", "ທີມ/ຊ່າງ")]: r.technician_name || "",
        [t("common.date", "ວັນທີ")]: d10(r.work_date ?? r.created_at),
        [t("common.status", "ສະຖານະ")]: r.src === "erp" ? r.status || "" : workOrderStage(r).label,
        [t("workorders.colLaborCost", "ຄ່າແຮງ")]: r.src === "erp" ? "" : Number(r.labor_cost) || 0,
      })),
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "work-orders");
    XLSX.writeFile(book, `work-orders-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <Page max="max-w-none">
      <PageHeader
        title={t("workorders.title", "ໃບງານ")}
        subtitle={`${t("workorders.totalPrefix", "ທັງໝົດ")} ${rows.length} ${t("workorders.itemsUnit", "ລາຍການ")} · ${t("common.page", "ໜ້າ")} ${current}/${pageCount}`}
        actions={
          <>
            <Btn variant="go" onClick={() => setPick(true)}>
              <Plus size={14} /> {t("workorders.issue", "ອອກໃບງານ")}
            </Btn>
            <Btn variant="outline" onClick={exportExcel} disabled={rows.length === 0}>
              <FileSpreadsheet size={14} /> Excel
            </Btn>
            <Btn variant="outline" onClick={reload} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {t("common.reload", "ໂຫຼດໃໝ່")}
            </Btn>
            <Btn
              variant="danger-outline"
              onClick={() => {
                setActiveTab("rejected");
                setPage(1);
              }}
            >
              <BellRing size={14} /> {t("workorders.stageRejected", "ປະຕິເສດ")} <BtnCount value={counts.rejected ?? 0} />
            </Btn>
          </>
        }
      />

      <div className="mb-4">
        <TeamStatusCard />
      </div>

      <Toolbar>
        <label className="flex h-9 min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3">
          <Search size={15} className="text-[var(--text-mute)]" />
          <input
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder={t("workorders.searchPlaceholder", "ຄົ້ນຫາ ໃບງານ, ວຽກ, ທີມ...")}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-mute)]"
          />
        </label>

        <div className="w-52">
          <RSelect
            value={activeTab === "all" ? "" : activeTab}
            onChange={(v) => {
              setActiveTab(v || "all");
              setPage(1);
            }}
            isClearable
            isSearchable={false}
            placeholder={t("workorders.allStatuses", "ສະຖານະທັງໝົດ")}
            options={stages
              .filter((s) => s.value !== "all")
              .map((s) => ({ value: s.value, label: `${s.label} (${counts[s.value] ?? 0})` }))}
          />
        </div>

        <Btn variant="ink" onClick={runSearch}>
          <Search size={14} /> {t("common.search", "ຄົ້ນຫາ")}
        </Btn>

        <Segmented<"table" | "board">
          className="ml-auto"
          value={view}
          onChange={setView}
          options={[
            { value: "table", label: t("workorders.viewTable", "ຕາຕະລາງ"), icon: <TableIcon size={14} /> },
            { value: "board", label: t("workorders.viewBoard", "ກະດານ"), icon: <LayoutGrid size={14} /> },
          ]}
        />
      </Toolbar>

      <div className="mb-4 overflow-x-auto">
        <Segmented
          value={activeTab}
          onChange={(v) => {
            setActiveTab(v);
            setPage(1);
          }}
          options={tabs}
        />
      </div>

      {view === "board" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {stages
            .filter((s) => s.value !== "all")
            .filter((s) => activeTab === "all" || activeTab === s.value)
            .map((s) => {
              const col = rows.filter((r) => getStageKey(r) === s.value);
              return (
                <Card key={s.value} className="overflow-hidden">
                  <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-3 py-2">
                    <span className="flex items-center gap-2 text-[11.5px] font-bold text-[var(--text)]">
                      <Pill tone={STAGE_PILL[s.value] || "neutral"}>{s.label}</Pill>
                    </span>
                    <span className="text-[11px] font-bold text-[var(--text-mute)]">{col.length}</span>
                  </div>
                  <div className="max-h-[520px] space-y-1.5 overflow-y-auto p-2">
                    {col.length === 0 ? (
                      <p className="py-6 text-center text-[11px] text-[var(--text-mute)]">{t("workorders.empty", "ຍັງບໍ່ມີໃບງານ")}</p>
                    ) : (
                      col.map((r) => (
                        <button
                          key={`${r.src || "v2"}-${r.id}`}
                          type="button"
                          onClick={() => router.push(`/work-orders/${r.id}`)}
                          className="flex w-full items-start gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-2 text-left transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-sunken)]"
                        >
                          <span
                            className="mt-0.5 h-8 w-[3px] flex-shrink-0 rounded-full"
                            style={{ background: `var(--${STAGE_BAR[s.value] === "brand" ? "brand" : STAGE_BAR[s.value] || "border-strong"})` }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-mono text-[11.5px] font-semibold text-[var(--text)]">{r.work_no || "-"}</span>
                            <span className="block truncate text-[11px] text-[var(--text-soft)]">{r.title || "-"}</span>
                            <span className="block truncate text-[10px] text-[var(--text-mute)]">
                              {r.technician_name || "-"} · {d10(r.work_date ?? r.created_at)}
                            </span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </Card>
              );
            })}
        </div>
      ) : (
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className={tblCls}>
            <thead>
              <tr>
                <RowBarTh />
                <SortTh
                  label={t("workorders.colWorkOrder", "ໃບງານ")}
                  active={sort.key === "work_no"}
                  dir={sort.dir}
                  onClick={() => toggleSort("work_no")}
                />
                <th className={`${thCls} w-28`}>{t("workorders.colAge", "ຄ້າງມາ")}</th>
                <th className={thCls}>{t("workorders.colJob", "ວຽກ")}</th>
                <SortTh
                  label={t("workorders.colTeam", "ທີມ/ຊ່າງ")}
                  active={sort.key === "technician_name"}
                  dir={sort.dir}
                  onClick={() => toggleSort("technician_name")}
                  className="w-52"
                />
                <SortTh
                  label={t("common.date", "ວັນທີ")}
                  active={sort.key === "work_date"}
                  dir={sort.dir}
                  onClick={() => toggleSort("work_date")}
                  className="w-32"
                />
                <th className={`${thCls} w-40`}>{t("common.status", "ສະຖານະ")}</th>
                <SortTh
                  label={t("workorders.colLaborCost", "ຄ່າແຮງ")}
                  active={sort.key === "labor_cost"}
                  dir={sort.dir}
                  onClick={() => toggleSort("labor_cost")}
                  className="w-28 text-right"
                />
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[12.5px] text-[var(--text-mute)]">
                    {t("workorders.empty", "ຍັງບໍ່ມີໃບງານ")}
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => {
                  const stage = getStageKey(r);
                  const label = r.src === "erp" ? r.status || "-" : workOrderStage(r).label;
                  return (
                    <tr
                      key={`${r.src || "v2"}-${r.id}`}
                      onClick={() => router.push(`/work-orders/${r.id}`)}
                      className={`${trHover} cursor-pointer`}
                    >
                      <RowBar tone={STAGE_BAR[stage] || "neutral"} />
                      <td className={tdCls}>
                        <TwoLine
                          primary={
                            <span className="font-mono">
                              {r.work_no || "-"}
                              {r.src === "erp" && (
                                <span className="ml-1.5 rounded bg-[var(--surface-sunken)] px-1 py-0.5 text-[9px] font-normal text-[var(--text-mute)]">
                                  {t("workorders.legacy", "ເກົ່າ")}
                                </span>
                              )}
                            </span>
                          }
                          secondary={r.project_name || undefined}
                        />
                      </td>
                      <td className={tdCls}>{ageBadge(r, stage, t) ?? <span className="text-[var(--text-mute)]">-</span>}</td>
                      <td className={tdCls}>{r.title || "-"}</td>
                      <td className={tdCls}>
                        <TwoLine primary={r.technician_name || "-"} secondary={r.technician_code || undefined} />
                      </td>
                      <td className={`${tdCls} tabular-nums`}>{d10(r.work_date ?? r.created_at)}</td>
                      <td className={tdCls}>
                        <Pill tone={STAGE_PILL[stage] || "neutral"}>{label}</Pill>
                      </td>
                      <td className={`${tdCls} text-right font-semibold tabular-nums text-[var(--text)]`}>
                        {r.src === "erp" ? "-" : money(r.labor_cost)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--border-soft)] px-4 py-2.5">
            <span className="text-[11.5px] text-[var(--text-mute)]">
              {t("common.page", "ໜ້າ")} {current}/{pageCount}
            </span>
            <div className="flex gap-1.5">
              <Btn variant="outline" onClick={() => setPage(current - 1)} disabled={current <= 1}>
                <ChevronLeft size={14} /> {t("common.prev", "ກ່ອນ")}
              </Btn>
              <Btn variant="outline" onClick={() => setPage(current + 1)} disabled={current >= pageCount}>
                {t("common.next", "ຖັດໄປ")} <ChevronRight size={14} />
              </Btn>
            </div>
          </div>
        )}
      </Card>
      )}

      <ProjectPickerModal
        open={pick}
        onClose={() => setPick(false)}
        onPick={(p) => router.push(`/projects/${p.id}/workorder/new`)}
        title={t("workorders.pickProject", "ເລືອກໂຄງການເພື່ອອອກໃບງານ")}
      />
    </Page>
  );
}
