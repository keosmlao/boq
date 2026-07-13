"use client";

/**
 * ໃບສະເໜີລາຄາ — flat list (ODIEN SERVICE layout): toolbar → status tabs → one table.
 * Rows carry a status bar down the left edge; no customer/project accordion.
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
import { getQuotations } from "@/_actions/quotations";
import { useT } from "@/_lib/i18n";

const PER_PAGE = 25;

type Quote = Record<string, any>;

const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "0";
};

const d10 = (v: unknown) => {
  if (!v) return "-";
  const d = new Date(v as any);
  const p = (n: number) => String(n).padStart(2, "0");
  if (isNaN(d.getTime())) {
    const m = String(v).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : String(v).slice(0, 10);
  }
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
};

/** Statuses stored on odg_quotation — anything unknown counts as "awaiting approval". */
const APPROVED = "ອະນຸມັດແລ້ວ";
const REJECTED = "ປະຕິເສດ";
const PENDING = "ລໍຖ້າອະນຸມັດ";

const norm = (s: unknown) => String(s || PENDING);
/** Tab/board bucket for a quotation. */
const statusKey = (r: Quote) => {
  const s = norm(r.status);
  return s === APPROVED ? APPROVED : s === REJECTED ? REJECTED : PENDING;
};

const STATUS_BAR: Record<string, "info" | "brand" | "warning" | "success" | "danger" | "neutral"> = {
  [PENDING]: "warning",
  [APPROVED]: "success",
  [REJECTED]: "danger",
};

const STATUS_PILL: Record<string, PillTone> = {
  [PENDING]: "amber",
  [APPROVED]: "green",
  [REJECTED]: "red",
};

type SortKey = "quotation_no" | "quotation_date" | "customer_name" | "total_amount";

export default function QuotationsClient({ initialRows }: { initialRows: Quote[] }) {
  const t = useT();
  const router = useRouter();
  const [pick, setPick] = useState(false);
  const [allRows, setAllRows] = useState<Quote[]>(initialRows ?? []);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [draftQ, setDraftQ] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "quotation_date", dir: "desc" });
  const [view, setView] = useState<"table" | "board">("table");
  const [loading, setLoading] = useState(false);

  const runSearch = () => {
    setQ(draftQ);
    setPage(1);
  };

  const reload = async () => {
    setLoading(true);
    try {
      const res: any = await getQuotations({});
      setAllRows(res?.success ? res.data || [] : Array.isArray(res) ? res : []);
    } catch {
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: allRows.length };
    for (const key of [PENDING, APPROVED, REJECTED]) {
      c[key] = allRows.filter((r) => statusKey(r) === key).length;
    }
    return c;
  }, [allRows]);

  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const list = allRows.filter((r) => {
      if (activeTab !== "all" && statusKey(r) !== activeTab) return false;
      if (!kw) return true;
      return `${r.quotation_no ?? ""} ${r.project_name ?? ""} ${r.customer_name ?? ""}`.toLowerCase().includes(kw);
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = sort.key === "quotation_date" ? a.quotation_date ?? a.created_at : a[sort.key];
      const bv = sort.key === "quotation_date" ? b.quotation_date ?? b.created_at : b[sort.key];
      if (sort.key === "total_amount") return (Number(av) || 0) > (Number(bv) || 0) ? dir : -dir;
      return String(av ?? "") > String(bv ?? "") ? dir : -dir;
    });
  }, [allRows, activeTab, q, sort]);

  const totalValue = useMemo(() => rows.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0), [rows]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const current = Math.min(page, pageCount);
  const pageRows = rows.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const statuses = [
    { value: "all", label: t("common.all", "ທັງໝົດ") },
    { value: PENDING, label: t("status.pending", "ລໍຖ້າອະນຸມັດ") },
    { value: APPROVED, label: t("status.approved", "ອະນຸມັດແລ້ວ") },
    { value: REJECTED, label: t("status.rejected", "ປະຕິເສດ") },
  ];

  const tabs = statuses.map((tab) => ({
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
        [t("quotations.quotationNo", "ເລກທີໃບສະເໜີ")]: r.quotation_no || "",
        [t("common.project", "ໂຄງການ")]: r.project_name || "",
        [t("common.customer", "ລູກຄ້າ")]: r.customer_name || "",
        [t("common.date", "ວັນທີ")]: d10(r.quotation_date ?? r.created_at),
        [t("common.status", "ສະຖານະ")]: norm(r.status),
        [t("common.amount", "ມູນຄ່າ")]: Number(r.total_amount) || 0,
      })),
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "quotations");
    XLSX.writeFile(book, `quotations-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <Page max="max-w-none">
      <PageHeader
        title={t("quotations.title", "ໃບສະເໜີລາຄາ")}
        subtitle={`${t("quotations.totalPrefix", "ທັງໝົດ")} ${rows.length} ${t("quotations.itemsUnit", "ລາຍການ")} · ${t("quotations.totalValue", "ມູນຄ່າລວມ")} ${money(totalValue)} ${t("common.currencyKip", "ບາດ")} · ${t("common.page", "ໜ້າ")} ${current}/${pageCount}`}
        actions={
          <>
            <Btn variant="go" onClick={() => setPick(true)}>
              <Plus size={14} /> {t("quotations.create", "ສ້າງໃບສະເໜີລາຄາ")}
            </Btn>
            <Btn variant="outline" onClick={exportExcel} disabled={rows.length === 0}>
              <FileSpreadsheet size={14} /> Excel
            </Btn>
            <Btn variant="outline" onClick={() => void reload()} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {t("common.reload", "ໂຫຼດໃໝ່")}
            </Btn>
            <Btn
              variant="danger-outline"
              onClick={() => {
                setActiveTab(PENDING);
                setPage(1);
              }}
            >
              <BellRing size={14} /> {t("status.pending", "ລໍຖ້າອະນຸມັດ")} <BtnCount value={counts[PENDING] ?? 0} />
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
            placeholder={t("quotations.searchPlaceholder", "ຄົ້ນຫາ ເລກທີ, ໂຄງການ, ລູກຄ້າ...")}
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
            placeholder={t("quotations.allStatuses", "ສະຖານະທັງໝົດ")}
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
            { value: "table", label: t("quotations.viewTable", "ຕາຕະລາງ"), icon: <TableIcon size={14} /> },
            { value: "board", label: t("quotations.viewBoard", "ກະດານ"), icon: <LayoutGrid size={14} /> },
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
                    <span className="flex items-center gap-2 text-[11.5px] font-bold text-[var(--text)]">
                      <Pill tone={STATUS_PILL[s.value] || "neutral"}>{s.label}</Pill>
                    </span>
                    <span className="text-[11px] font-bold text-[var(--text-mute)]">{col.length}</span>
                  </div>
                  <div className="max-h-[520px] space-y-1.5 overflow-y-auto p-2">
                    {col.length === 0 ? (
                      <p className="py-6 text-center text-[11px] text-[var(--text-mute)]">{t("quotations.empty", "ຍັງບໍ່ມີໃບສະເໜີລາຄາ")}</p>
                    ) : (
                      col.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => router.push(`/quotations/${r.id}`)}
                          className="flex w-full items-start gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-2 text-left transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-sunken)]"
                        >
                          <span
                            className="mt-0.5 h-8 w-[3px] flex-shrink-0 rounded-full"
                            style={{ background: `var(--${STATUS_BAR[s.value] || "border-strong"})` }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-mono text-[11.5px] font-semibold text-[var(--text)]">
                              {r.quotation_no || t("quotations.noNumber", "(ບໍ່ມີເລກທີ່)")}
                            </span>
                            <span className="block truncate text-[11px] text-[var(--text-soft)]">
                              {r.project_name || t("quotations.noProject", "(ບໍ່ລະບຸໂຄງການ)")}
                            </span>
                            <span className="block truncate text-[10px] text-[var(--text-mute)]">
                              {r.customer_name || t("quotations.noCustomer", "(ບໍ່ລະບຸລູກຄ້າ)")} · {money(r.total_amount)}
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
                    label={t("quotations.quotationNo", "ເລກທີໃບສະເໜີ")}
                    active={sort.key === "quotation_no"}
                    dir={sort.dir}
                    onClick={() => toggleSort("quotation_no")}
                  />
                  <SortTh
                    label={`${t("common.project", "ໂຄງການ")} / ${t("common.customer", "ລູກຄ້າ")}`}
                    active={sort.key === "customer_name"}
                    dir={sort.dir}
                    onClick={() => toggleSort("customer_name")}
                  />
                  <SortTh
                    label={t("common.date", "ວັນທີ")}
                    active={sort.key === "quotation_date"}
                    dir={sort.dir}
                    onClick={() => toggleSort("quotation_date")}
                    className="w-32"
                  />
                  <th className={`${thCls} w-40`}>{t("common.status", "ສະຖານະ")}</th>
                  <SortTh
                    label={t("common.amount", "ມູນຄ່າ")}
                    active={sort.key === "total_amount"}
                    dir={sort.dir}
                    onClick={() => toggleSort("total_amount")}
                    className="w-32 text-right"
                  />
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-[12.5px] text-[var(--text-mute)]">
                      {allRows.length ? t("quotations.noMatch", "ບໍ່ພົບໃບສະເໜີທີ່ກົງ") : t("quotations.empty", "ຍັງບໍ່ມີໃບສະເໜີລາຄາ")}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => {
                    const key = statusKey(r);
                    return (
                      <tr key={r.id} onClick={() => router.push(`/quotations/${r.id}`)} className={`${trHover} cursor-pointer`}>
                        <RowBar tone={STATUS_BAR[key] || "neutral"} />
                        <td className={`${tdCls} w-44 max-w-44`}>
                          <span className="block truncate font-mono font-semibold text-[var(--text)]">
                            {r.quotation_no || t("quotations.noNumber", "(ບໍ່ມີເລກທີ່)")}
                          </span>
                        </td>
                        {/* Project + customer share a cell: on most quotations they are the same string. */}
                        <td className={`${tdCls} max-w-[320px]`}>
                          <TwoLine
                            primary={r.project_name || r.customer_name || t("quotations.noProject", "(ບໍ່ລະບຸໂຄງການ)")}
                            secondary={
                              r.customer_name && r.customer_name !== r.project_name ? r.customer_name : undefined
                            }
                          />
                        </td>
                        <td className={`${tdCls} tabular-nums`}>{d10(r.quotation_date ?? r.created_at)}</td>
                        <td className={tdCls}>
                          <Pill tone={STATUS_PILL[key] || "neutral"}>{norm(r.status)}</Pill>
                        </td>
                        <td className={`${tdCls} text-right font-semibold tabular-nums text-[var(--text)]`}>{money(r.total_amount)}</td>
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
        onPick={(p) => router.push(`/projects/${p.id}/quotation/new`)}
        title={t("quotations.pickProject", "ເລືອກໂຄງການເພື່ອສ້າງໃບສະເໜີລາຄາ")}
      />
    </Page>
  );
}
