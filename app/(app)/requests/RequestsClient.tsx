"use client";

/**
 * ຂໍເບີກ — flat list (ODIEN SERVICE layout): toolbar → status tabs → one table.
 * Rows carry a status bar down the left edge; no project grouping.
 */
import React, { useMemo, useState } from "react";
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
  tblCls,
  tdCls,
  thCls,
  trHover,
  type PillTone,
} from "../_components/ui";
import { getRequests } from "@/_actions/request-v2";
import { useT } from "@/_lib/i18n";

const PER_PAGE = 25;

const d10 = (v: unknown) => {
  if (!v) return "-";
  const d = new Date(v as any);
  if (isNaN(d.getTime())) return String(v).slice(0, 10);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const itemCount = (r: any) => (Array.isArray(r.items) ? r.items.length : 0);

/**
 * Status of a request row. App requests (raised by craftsmen) keep their own
 * two waiting states: ລໍຫົວໜ້າຊ່າງ (pending) and ລໍຖ້າອອກໃບຂໍເບີກ (approved →
 * awaiting pull by the back office).
 */
function getStageKey(r: any): string {
  if (r.src === "app" && r.app_status === "approved") return "awaiting_pull";
  if (r.src === "app" && r.app_status === "pending") return "awaiting_head";
  const s = String(r.status || "requested");
  if (s === "withdrawn") return "withdrawn";
  if (s === "rejected") return "rejected";
  return "requested";
}

const STAGE_BAR: Record<string, "info" | "brand" | "warning" | "success" | "danger" | "neutral"> = {
  awaiting_pull: "danger",
  awaiting_head: "warning",
  requested: "info",
  withdrawn: "success",
  rejected: "neutral",
};

const STAGE_PILL: Record<string, PillTone> = {
  awaiting_pull: "red",
  awaiting_head: "amber",
  requested: "blue",
  withdrawn: "green",
  rejected: "neutral",
};

type SortKey = "request_no" | "project_name" | "created_at" | "items";

export default function RequestsClient({ initialRows }: { initialRows: any[] }) {
  const router = useRouter();
  const t = useT();
  const [pick, setPick] = useState(false);
  const [allRows, setAllRows] = useState<any[]>(initialRows ?? []);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [draftQ, setDraftQ] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "created_at", dir: "desc" });
  const [view, setView] = useState<"table" | "board">("table");
  const [loading, setLoading] = useState(false);

  const runSearch = () => {
    setQ(draftQ);
    setPage(1);
  };

  const reload = async () => {
    setLoading(true);
    try {
      const res: any = await getRequests({});
      setAllRows(res?.success ? res.data || [] : Array.isArray(res) ? res : []);
    } finally {
      setLoading(false);
    }
  };

  const stages = [
    { value: "all", label: t("common.all", "ທັງໝົດ") },
    { value: "awaiting_pull", label: t("requests.awaitingPull", "ລໍຖ້າອອກໃບຂໍເບີກ") },
    { value: "awaiting_head", label: t("requests.awaitingHead", "ລໍຫົວໜ້າຊ່າງ") },
    { value: "requested", label: t("requests.requested", "ຮ້ອງຂໍ") },
    { value: "withdrawn", label: t("requests.withdrawn", "ເບີກແລ້ວ") },
    { value: "rejected", label: t("status.rejected", "ປະຕິເສດ") },
  ];

  const stageLabel = (key: string) => stages.find((s) => s.value === key)?.label ?? key;

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: allRows.length };
    for (const key of ["awaiting_pull", "awaiting_head", "requested", "withdrawn", "rejected"]) {
      c[key] = allRows.filter((r) => getStageKey(r) === key).length;
    }
    return c;
  }, [allRows]);

  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const list = allRows.filter((r) => {
      if (activeTab !== "all" && getStageKey(r) !== activeTab) return false;
      if (!kw) return true;
      return `${r.request_no ?? ""} ${r.project_name ?? ""}`.toLowerCase().includes(kw);
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sort.key === "items") return itemCount(a) > itemCount(b) ? dir : -dir;
      return String(a[sort.key] ?? "") > String(b[sort.key] ?? "") ? dir : -dir;
    });
  }, [allRows, activeTab, q, sort]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const current = Math.min(page, pageCount);
  const pageRows = rows.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

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
        [t("requests.docNo", "ເລກທີ່")]: r.request_no || "",
        [t("requests.project", "ໂຄງການ")]: r.project_name || "",
        [t("common.date", "ວັນທີ")]: d10(r.created_at),
        [t("requests.items", "ລາຍການ")]: itemCount(r),
        [t("common.status", "ສະຖານະ")]: stageLabel(getStageKey(r)),
      })),
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "requests");
    XLSX.writeFile(book, `requests-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const openRequest = (r: any) => router.push(`/requests/${encodeURIComponent(r.id)}`);

  return (
    <Page max="max-w-none">
      <PageHeader
        title={t("requests.title", "ຂໍເບີກ")}
        subtitle={`${t("requests.totalPrefix", "ທັງໝົດ")} ${rows.length} ${t("requests.items", "ລາຍການ")} · ${t("common.page", "ໜ້າ")} ${current}/${pageCount}`}
        actions={
          <>
            <Btn variant="go" onClick={() => setPick(true)}>
              <Plus size={14} /> {t("requests.create", "ສ້າງໃບຂໍເບີກ")}
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
                setActiveTab("awaiting_pull");
                setPage(1);
              }}
            >
              <BellRing size={14} /> {t("requests.awaitingPull", "ລໍຖ້າອອກໃບຂໍເບີກ")} <BtnCount value={counts.awaiting_pull ?? 0} />
            </Btn>
          </>
        }
      />

      <Toolbar>
        <label className="flex h-9 min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3">
          <Search size={15} className="text-[var(--text-mute)]" />
          <input
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder={t("requests.searchPlaceholder", "ຄົ້ນຫາ ເລກທີ່, ໂຄງການ...")}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-mute)]"
          />
        </label>

        <div className="w-56">
          <RSelect
            value={activeTab === "all" ? "" : activeTab}
            onChange={(v) => {
              setActiveTab(v || "all");
              setPage(1);
            }}
            isClearable
            isSearchable={false}
            placeholder={t("requests.allStatuses", "ສະຖານະທັງໝົດ")}
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
            { value: "table", label: t("requests.viewTable", "ຕາຕະລາງ"), icon: <TableIcon size={14} /> },
            { value: "board", label: t("requests.viewBoard", "ກະດານ"), icon: <LayoutGrid size={14} /> },
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
                    <Pill tone={STAGE_PILL[s.value] || "neutral"}>{s.label}</Pill>
                    <span className="text-[11px] font-bold text-[var(--text-mute)]">{col.length}</span>
                  </div>
                  <div className="max-h-[520px] space-y-1.5 overflow-y-auto p-2">
                    {col.length === 0 ? (
                      <p className="py-6 text-center text-[11px] text-[var(--text-mute)]">{t("requests.empty", "ຍັງບໍ່ມີການຂໍເບີກ")}</p>
                    ) : (
                      col.map((r) => (
                        <button
                          key={String(r.id)}
                          type="button"
                          onClick={() => openRequest(r)}
                          className="flex w-full items-start gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-2 text-left transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-sunken)]"
                        >
                          <span
                            className="mt-0.5 h-8 w-[3px] flex-shrink-0 rounded-full"
                            style={{ background: `var(--${STAGE_BAR[s.value] === "neutral" ? "border-strong" : STAGE_BAR[s.value] || "border-strong"})` }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-mono text-[11.5px] font-semibold text-[var(--text)]">{r.request_no || "-"}</span>
                            <span className="block truncate text-[11px] text-[var(--text-soft)]">
                              {r.project_name || t("requests.noProject", "(ບໍ່ລະບຸໂຄງການ)")}
                            </span>
                            <span className="block truncate text-[10px] text-[var(--text-mute)]">
                              {d10(r.created_at)} · {itemCount(r)} {t("requests.items", "ລາຍການ")}
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
                    label={t("requests.docNo", "ເລກທີ່")}
                    active={sort.key === "request_no"}
                    dir={sort.dir}
                    onClick={() => toggleSort("request_no")}
                  />
                  <SortTh
                    label={t("requests.project", "ໂຄງການ")}
                    active={sort.key === "project_name"}
                    dir={sort.dir}
                    onClick={() => toggleSort("project_name")}
                  />
                  <SortTh
                    label={t("common.date", "ວັນທີ")}
                    active={sort.key === "created_at"}
                    dir={sort.dir}
                    onClick={() => toggleSort("created_at")}
                    className="w-32"
                  />
                  <SortTh
                    label={t("requests.items", "ລາຍການ")}
                    active={sort.key === "items"}
                    dir={sort.dir}
                    onClick={() => toggleSort("items")}
                    className="w-24 text-right"
                  />
                  <th className={`${thCls} w-48`}>{t("common.status", "ສະຖານະ")}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-[12.5px] text-[var(--text-mute)]">
                      {t("requests.empty", "ຍັງບໍ່ມີການຂໍເບີກ")}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => {
                    const stage = getStageKey(r);
                    return (
                      <tr key={String(r.id)} onClick={() => openRequest(r)} className={`${trHover} cursor-pointer`}>
                        <RowBar tone={STAGE_BAR[stage] || "neutral"} />
                        <td className={tdCls}>
                          <TwoLine
                            primary={<span className="font-mono">{r.request_no || "-"}</span>}
                            secondary={r.requester || undefined}
                          />
                        </td>
                        <td className={tdCls}>{r.project_name || t("requests.noProject", "(ບໍ່ລະບຸໂຄງການ)")}</td>
                        <td className={`${tdCls} tabular-nums`}>{d10(r.created_at)}</td>
                        <td className={`${tdCls} text-right font-semibold tabular-nums text-[var(--text)]`}>{itemCount(r)}</td>
                        <td className={tdCls}>
                          <Pill tone={STAGE_PILL[stage] || "neutral"}>{stageLabel(stage)}</Pill>
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
        onPick={(p) => router.push(`/projects/${p.id}/request/new`)}
        title={t("requests.pickProject", "ເລືອກໂຄງການເພື່ອຂໍເບີກ")}
        requireBoq
      />
    </Page>
  );
}
