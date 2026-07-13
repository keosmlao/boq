"use client";

/**
 * ລູກຄ້າ — flat list (ODIEN SERVICE layout): toolbar → filter tabs → one table.
 * Rows carry a status bar down the left edge and open the customer detail page
 * (/customers/[code]), where their projects live.
 *
 * Initial customers + projects are fetched on the SERVER (see page.tsx) and
 * seeded via props — this removes the old mount→useEffect→server-action
 * waterfall. The reload button still calls load() to re-fetch client-side.
 */
import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import * as XLSX from "xlsx";
import { getCustomers, deleteCustomer } from "@/_actions/customers";
import { getProjects } from "@/_actions/projects";
import RSelect from "../_components/RSelect";
import {
  Btn,
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
} from "../_components/ui";
import { useT } from "@/_lib/i18n";

const PER_PAGE = 25;

const arr = (res: any): any[] => (res?.success ? res.data || [] : Array.isArray(res) ? res : []);

const FILTERS = [
  { key: "all", i18nKey: "common.all", label: "ທັງໝົດ" },
  { key: "has", i18nKey: "customers.filterHasProject", label: "ມີໂຄງການ" },
  { key: "none", i18nKey: "customers.filterNoProject", label: "ບໍ່ມີໂຄງການ" },
];

type Customer = Record<string, any> & { projects: any[] };
type SortKey = "name" | "code" | "phone" | "projects";

/** Build the sml_code → projects[] map exactly as the old client did. */
const buildProjMap = (projects: any[]): Record<string, any[]> => {
  const map: Record<string, any[]> = {};
  projects.forEach((p: any) => {
    const code = String(p.sml_code ?? "");
    if (!code) return;
    (map[code] ||= []).push(p);
  });
  return map;
};

export default function CustomersClient({
  initialCustomers,
  initialProjects,
}: {
  initialCustomers: any[];
  initialProjects: any[];
}) {
  const t = useT();
  const router = useRouter();
  const [rows, setRows] = useState<any[]>(initialCustomers);
  const [projMap, setProjMap] = useState<Record<string, any[]>>(() => buildProjMap(initialProjects));
  const [loading, setLoading] = useState(false);
  const [draftQ, setDraftQ] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "projects", dir: "desc" });

  const runSearch = () => {
    setQ(draftQ);
    setPage(1);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [cRes, pRes]: any = await Promise.all([getCustomers(), getProjects({ summary: true })]);
      setRows(cRes?.success ? cRes.data || [] : []);
      setProjMap(buildProjMap(arr(pRes)));
    } catch {
      setRows([]);
      setProjMap({});
    } finally {
      setLoading(false);
    }
  };

  const customers: Customer[] = useMemo(
    () => rows.map((c) => ({ ...c, projects: projMap[String(c.code)] || [] })),
    [rows, projMap],
  );

  const counts = useMemo(() => {
    const withP = customers.filter((c) => c.projects.length > 0).length;
    return { all: customers.length, has: withP, none: customers.length - withP };
  }, [customers]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const list = customers.filter((c) => {
      if (filter === "has" && c.projects.length === 0) return false;
      if (filter === "none" && c.projects.length > 0) return false;
      if (!kw) return true;
      const inCust = [c.name, c.code, c.phone].some((x) => (x ?? "").toString().toLowerCase().includes(kw));
      const inProj = c.projects.some((p) => (p.project_name ?? "").toString().toLowerCase().includes(kw));
      return inCust || inProj;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sort.key === "projects") {
        if (a.projects.length !== b.projects.length) return a.projects.length > b.projects.length ? dir : -dir;
        return String(a.name ?? "").localeCompare(String(b.name ?? ""));
      }
      return String(a[sort.key] ?? "") > String(b[sort.key] ?? "") ? dir : -dir;
    });
  }, [customers, q, filter, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, pageCount);
  const pageRows = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const del = async (code: string) => {
    if (!window.confirm(t("customers.deleteConfirm", "ລົບລູກຄ້ານີ້? ກູ້ຄືນບໍ່ໄດ້."))) return;
    const res: any = await deleteCustomer(code);
    if (res?.success) setRows((a) => a.filter((x) => String(x.code) !== String(code)));
    else alert(res?.message || t("customers.deleteFailed", "ລົບບໍ່ສຳເລັດ"));
  };

  const tabs = FILTERS.map((f) => ({
    value: f.key,
    label: (
      <span className="flex items-center gap-1.5">
        {t(f.i18nKey, f.label)}
        <span className="rounded-full bg-black/10 px-1.5 text-[10px] font-black dark:bg-white/15">
          {counts[f.key as keyof typeof counts] ?? 0}
        </span>
      </span>
    ),
  }));

  /** Excel export of exactly what is on screen (current filter + sort, all pages). */
  const exportExcel = () => {
    const sheet = XLSX.utils.json_to_sheet(
      filtered.map((c) => ({
        [t("customers.code", "ລະຫັດ")]: c.code || "",
        [t("customers.title", "ລູກຄ້າ")]: c.name || "",
        [t("customers.phone", "ເບີໂທ")]: c.phone || "",
        [t("customers.colProjects", "ໂຄງການ")]: c.projects.length,
      })),
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "customers");
    XLSX.writeFile(book, `customers-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <Page max="max-w-none">
      <PageHeader
        title={t("customers.title", "ລູກຄ້າ")}
        subtitle={`${t("customers.totalPrefix", "ທັງໝົດ")} ${filtered.length} ${t("customers.itemsUnit", "ລາຍການ")} · ${t("common.page", "ໜ້າ")} ${current}/${pageCount}`}
        actions={
          <>
            <Btn variant="go" onClick={() => router.push("/customers/new")}>
              <Plus size={14} /> {t("customers.createCustomer", "ສ້າງລູກຄ້າ")}
            </Btn>
            <Btn variant="outline" onClick={exportExcel} disabled={filtered.length === 0}>
              <FileSpreadsheet size={14} /> Excel
            </Btn>
            <Btn variant="outline" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {t("common.reload", "ໂຫຼດໃໝ່")}
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
            placeholder={t("customers.searchPlaceholder", "ຄົ້ນຫາ ລະຫັດ, ຊື່ລູກຄ້າ...")}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-mute)]"
          />
        </label>

        <div className="w-52">
          <RSelect
            value={filter === "all" ? "" : filter}
            onChange={(v) => {
              setFilter(v || "all");
              setPage(1);
            }}
            isClearable
            isSearchable={false}
            placeholder={t("customers.allFilters", "ຕົວກອງທັງໝົດ")}
            options={FILTERS.filter((f) => f.key !== "all").map((f) => ({
              value: f.key,
              label: `${t(f.i18nKey, f.label)} (${counts[f.key as keyof typeof counts] ?? 0})`,
            }))}
          />
        </div>

        <Btn variant="ink" onClick={runSearch}>
          <Search size={14} /> {t("common.search", "ຄົ້ນຫາ")}
        </Btn>
      </Toolbar>

      <div className="mb-4 overflow-x-auto">
        <Segmented
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
          options={tabs}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className={tblCls}>
            <thead>
              <tr>
                <RowBarTh />
                <SortTh
                  label={t("customers.title", "ລູກຄ້າ")}
                  active={sort.key === "name"}
                  dir={sort.dir}
                  onClick={() => toggleSort("name")}
                />
                <SortTh
                  label={t("customers.code", "ລະຫັດ")}
                  active={sort.key === "code"}
                  dir={sort.dir}
                  onClick={() => toggleSort("code")}
                  className="w-36"
                />
                <SortTh
                  label={t("customers.phone", "ເບີໂທ")}
                  active={sort.key === "phone"}
                  dir={sort.dir}
                  onClick={() => toggleSort("phone")}
                  className="w-36"
                />
                <SortTh
                  label={t("customers.colProjects", "ໂຄງການ")}
                  active={sort.key === "projects"}
                  dir={sort.dir}
                  onClick={() => toggleSort("projects")}
                  className="w-24 text-right"
                />
                <th className={`${thCls} w-40`}>{t("common.status", "ສະຖານະ")}</th>
                <th className={`${thCls} w-24 text-right`}>{t("common.actions", "ຈັດການ")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[var(--text-mute)]">
                    <Loader2 size={20} className="mx-auto animate-spin" />
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[12.5px] text-[var(--text-mute)]">
                    {rows.length ? t("customers.noMatch", "ບໍ່ພົບລູກຄ້າ") : t("customers.empty", "ຍັງບໍ່ມີລູກຄ້າ")}
                  </td>
                </tr>
              ) : (
                pageRows.map((c) => {
                  const code = String(c.code);
                  const hasP = c.projects.length > 0;
                  return (
                    <tr key={code} onClick={() => router.push(`/customers/${encodeURIComponent(code)}`)} className={`${trHover} cursor-pointer`}>
                      <RowBar tone={hasP ? "brand" : "neutral"} />
                      <td className={tdCls}>
                        <TwoLine
                          primary={c.name || code}
                          secondary={hasP ? c.projects.map((p: any) => p.project_name).filter(Boolean).join(" · ") || undefined : undefined}
                        />
                      </td>
                      <td className={`${tdCls} font-mono`}>{code}</td>
                      <td className={tdCls}>{c.phone || "-"}</td>
                      <td className={`${tdCls} text-right font-semibold tabular-nums text-[var(--text)]`}>{c.projects.length}</td>
                      <td className={tdCls}>
                        <Pill tone={hasP ? "brand" : "neutral"}>
                          {hasP ? t("customers.withProject", "ມີໂຄງການ") : t("customers.withoutProject", "ບໍ່ມີໂຄງການ")}
                        </Pill>
                      </td>
                      <td className={`${tdCls} text-right`} onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            type="button"
                            onClick={() => router.push(`/customers/new?edit=${encodeURIComponent(code)}`)}
                            title={t("common.edit", "ແກ້ໄຂ")}
                            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[var(--text-mute)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text)]"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => del(code)}
                            title={t("common.delete", "ລົບ")}
                            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[var(--text-mute)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
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
    </Page>
  );
}
