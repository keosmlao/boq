"use client";

/**
 * BOQ cross-project list — flat list (ODIEN SERVICE layout):
 * toolbar → status tabs → one table (or a status board). Rows carry a status
 * bar down the left edge.
 *
 * Data is fetched on the SERVER in page.tsx and passed in via `initialRows`,
 * so navigation no longer triggers a client mount→fetch("/api/boqs") waterfall:
 * the rows are present in the first render. The reload button still re-pulls
 * via /api/boqs on demand.
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
import { useT } from "@/_lib/i18n";

const PER_PAGE = 25;

const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "-";
};

const d10 = (v: unknown) => (v ? String(v).slice(0, 10) : "-");

/** ERP BOQ rows carry a Lao status string built by getAllBoqsForList(). */
function statusKey(r: any): "approved" | "rejected" | "pending" {
  const s = String(r.status || "").trim();
  if (s === "ອະນຸມັດແລ້ວ" || s === "approved") return "approved";
  if (s === "ປະຕິເສດ" || s === "rejected") return "rejected";
  return "pending";
}

const BAR: Record<string, "success" | "danger" | "warning"> = {
  approved: "success",
  rejected: "danger",
  pending: "warning",
};

const PILL: Record<string, PillTone> = {
  approved: "green",
  rejected: "red",
  pending: "amber",
};

type SortKey = "boq_no" | "project_name" | "total_amount" | "created_at";

export default function BoqClient({ initialRows }: { initialRows: any[] }) {
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
      const response = await fetch("/api/boqs", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.message || "Failed to load BOQs");
      const data = result?.success ? result.data || [] : Array.isArray(result) ? result : [];
      setAllRows(data);
    } catch {
      /* keep the rows we already have on a failed refresh */
    } finally {
      setLoading(false);
    }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: allRows.length, approved: 0, rejected: 0, pending: 0 };
    for (const r of allRows) c[statusKey(r)] += 1;
    return c;
  }, [allRows]);

  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const list = allRows.filter((r) => {
      if (activeTab !== "all" && statusKey(r) !== activeTab) return false;
      if (!kw) return true;
      return `${r.boq_no ?? ""} ${r.project_name ?? ""} ${r.customer_name ?? ""} ${r.requester ?? ""} ${r.approver ?? ""}`
        .toLowerCase()
        .includes(kw);
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sort.key === "total_amount") {
        const av = Number(a.total_amount ?? a.subtotal) || 0;
        const bv = Number(b.total_amount ?? b.subtotal) || 0;
        return av > bv ? dir : -dir;
      }
      return String(a[sort.key] ?? "") > String(b[sort.key] ?? "") ? dir : -dir;
    });
  }, [allRows, activeTab, q, sort]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const current = Math.min(page, pageCount);
  const pageRows = rows.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const href = (r: any) => (r.src === "erp" ? `/boq/${encodeURIComponent(r.boq_no || "")}` : `/boq/${r.id}`);

  const statuses = [
    { value: "all", label: t("common.all", "ທັງໝົດ") },
    { value: "pending", label: t("status.pending", "ລໍຖ້າອະນຸມັດ") },
    { value: "approved", label: t("status.approved", "ອະນຸມັດແລ້ວ") },
    { value: "rejected", label: t("status.rejected", "ປະຕິເສດ") },
  ];

  const tabs = statuses.map((s) => ({
    value: s.value,
    label: (
      <span className="flex items-center gap-1.5">
        {s.label}
        <span className="rounded-full bg-black/10 px-1.5 text-[10px] font-black dark:bg-white/15">{counts[s.value] ?? 0}</span>
      </span>
    ),
  }));

  /** Excel export of exactly what is on screen (current filter + sort, all pages). */
  const exportExcel = () => {
    const sheet = XLSX.utils.json_to_sheet(
      rows.map((r) => ({
        [t("boq.boqNo", "BOQ ເລກທີ່")]: r.boq_no || "",
        [t("boq.project", "ໂຄງການ")]: r.project_name || "",
        [t("common.customer", "ລູກຄ້າ")]: r.customer_name || "",
        [t("common.amount", "ມູນຄ່າ")]: Number(r.total_amount ?? r.subtotal) || 0,
        [t("boq.requester", "ຜູ້ຂໍ")]: r.requester || "",
        [t("common.approver", "ຜູ້ອະນຸມັດ")]: r.approver || "",
        [t("common.status", "ສະຖານະ")]: r.status || t("status.pending", "ລໍຖ້າອະນຸມັດ"),
        [t("common.date", "ວັນທີ")]: d10(r.created_at),
      })),
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "boq");
    XLSX.writeFile(book, `boq-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <Page max="max-w-none">
      <PageHeader
        title="BOQ"
        subtitle={`${t("boq.totalPrefix", "ທັງໝົດ")} ${rows.length} ${t("boq.itemUnit", "ລາຍການ")} · ${t("common.page", "ໜ້າ")} ${current}/${pageCount}`}
        actions={
          <>
            <Btn variant="go" onClick={() => setPick(true)}>
              <Plus size={14} /> {t("boq.create", "ສ້າງ BOQ")}
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
                setActiveTab("pending");
                setPage(1);
              }}
            >
              <BellRing size={14} /> {t("status.pending", "ລໍຖ້າອະນຸມັດ")} <BtnCount value={counts.pending ?? 0} />
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
            placeholder={t("boq.searchPlaceholder", "ຄົ້ນຫາ BOQ, ໂຄງການ, ລູກຄ້າ...")}
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
            placeholder={t("boq.allStatuses", "ສະຖານະທັງໝົດ")}
            options={statuses
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
            { value: "table", label: t("boq.viewTable", "ຕາຕະລາງ"), icon: <TableIcon size={14} /> },
            { value: "board", label: t("boq.viewBoard", "ກະດານ"), icon: <LayoutGrid size={14} /> },
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
          {statuses
            .filter((s) => s.value !== "all")
            .filter((s) => activeTab === "all" || activeTab === s.value)
            .map((s) => {
              const col = rows.filter((r) => statusKey(r) === s.value);
              return (
                <Card key={s.value} className="overflow-hidden">
                  <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-3 py-2">
                    <Pill tone={PILL[s.value] || "neutral"}>{s.label}</Pill>
                    <span className="text-[11px] font-bold text-[var(--text-mute)]">{col.length}</span>
                  </div>
                  <div className="max-h-[520px] space-y-1.5 overflow-y-auto p-2">
                    {col.length === 0 ? (
                      <p className="py-6 text-center text-[11px] text-[var(--text-mute)]">{t("boq.empty", "ຍັງບໍ່ມີ BOQ")}</p>
                    ) : (
                      col.map((r, i) => (
                        <button
                          key={r.id ?? r.boq_no ?? i}
                          type="button"
                          onClick={() => router.push(href(r))}
                          className="flex w-full items-start gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-2 text-left transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-sunken)]"
                        >
                          <span
                            className="mt-0.5 h-8 w-[3px] flex-shrink-0 rounded-full"
                            style={{ background: `var(--${BAR[s.value] || "border-strong"})` }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-mono text-[11.5px] font-semibold text-[var(--text)]">{r.boq_no || "-"}</span>
                            <span className="block truncate text-[11px] text-[var(--text-soft)]">{r.project_name || "-"}</span>
                            <span className="block truncate text-[10px] text-[var(--text-mute)]">
                              {r.requester || "-"} · {d10(r.created_at)}
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
                    label={t("boq.boqNo", "BOQ ເລກທີ່")}
                    active={sort.key === "boq_no"}
                    dir={sort.dir}
                    onClick={() => toggleSort("boq_no")}
                  />
                  <SortTh
                    label={t("boq.project", "ໂຄງການ")}
                    active={sort.key === "project_name"}
                    dir={sort.dir}
                    onClick={() => toggleSort("project_name")}
                  />
                  <SortTh
                    label={t("common.amount", "ມູນຄ່າ")}
                    active={sort.key === "total_amount"}
                    dir={sort.dir}
                    onClick={() => toggleSort("total_amount")}
                    className="w-32 text-right"
                  />
                  <th className={`${thCls} w-40`}>{t("boq.requester", "ຜູ້ຂໍ")}</th>
                  <th className={`${thCls} w-40`}>{t("common.approver", "ຜູ້ອະນຸມັດ")}</th>
                  <th className={`${thCls} w-36`}>{t("common.status", "ສະຖານະ")}</th>
                  <SortTh
                    label={t("common.date", "ວັນທີ")}
                    active={sort.key === "created_at"}
                    dir={sort.dir}
                    onClick={() => toggleSort("created_at")}
                    className="w-32"
                  />
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-[12.5px] text-[var(--text-mute)]">
                      {t("boq.empty", "ຍັງບໍ່ມີ BOQ")}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r, i) => {
                    const key = statusKey(r);
                    return (
                      <tr
                        key={r.id ?? r.boq_no ?? i}
                        onClick={() => router.push(href(r))}
                        className={`${trHover} cursor-pointer`}
                      >
                        <RowBar tone={BAR[key] || "neutral"} />
                        <td className={tdCls}>
                          <TwoLine
                            primary={<span className="font-mono">{r.boq_no || "-"}</span>}
                            secondary={r.customer_name || undefined}
                          />
                        </td>
                        <td className={tdCls}>{r.project_name || "-"}</td>
                        <td className={`${tdCls} text-right font-semibold tabular-nums text-[var(--text)]`}>
                          {money(r.total_amount ?? r.subtotal)}
                        </td>
                        <td className={tdCls}>{r.requester || "-"}</td>
                        <td className={tdCls}>{r.approver || "-"}</td>
                        <td className={tdCls}>
                          <Pill tone={PILL[key] || "neutral"}>{r.status || t("status.pending", "ລໍຖ້າອະນຸມັດ")}</Pill>
                        </td>
                        <td className={`${tdCls} tabular-nums`}>{d10(r.created_at)}</td>
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
        onPick={(p) => router.push(`/projects/${p.id}/boq/new`)}
        title={t("boq.pickProjectTitle", "ເລືອກໂຄງການເພື່ອສ້າງ BOQ (ຕ້ອງມີສັນຍາທີ່ອະນຸມັດແລ້ວ)")}
        requireApprovedContract
      />
    </Page>
  );
}
