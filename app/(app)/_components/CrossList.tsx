"use client";

/** Reusable cross-project list (search + table) for the sidebar module pages. */
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, RefreshCw, ChevronRight, Inbox, Layers, FolderOpen, CircleAlert } from "lucide-react";
import { Page, PageHeader, Card, Btn, tblCls, thCls, tdCls, trHover } from "./ui";
import { useT } from "@/_lib/i18n";

export type Column = { header: string; align?: "right" | "center"; cell: (r: any) => React.ReactNode };

export default function CrossList({
  title,
  subtitle,
  columns,
  load,
  initialRows,
  searchText,
  rowHref,
  searchPlaceholder,
  empty,
  headerActions,
  groupBy,
  subGroupBy,
  groupLabel,
  aboveTable,
}: {
  title: string;
  subtitle?: (n: number) => string;
  columns: Column[];
  load: () => Promise<any>;
  /**
   * When provided, the list is seeded from these rows (fetched on the server)
   * and the initial client-side mount fetch is skipped — removing the
   * navigation waterfall. Manual refresh still re-pulls via `load`.
   */
  initialRows?: any[];
  searchText: (r: any) => string;
  rowHref?: (r: any) => string;
  searchPlaceholder?: string;
  empty?: string;
  headerActions?: React.ReactNode;
  groupBy?: (r: any) => string;
  /** Optional second-level grouping rendered as sub-sections inside each group. */
  subGroupBy?: (r: any) => string;
  groupLabel?: string;
  aboveTable?: React.ReactNode;
}) {
  const t = useT();
  const searchPh = searchPlaceholder ?? t("common.search", "ຄົ້ນຫາ...");
  const emptyText = empty ?? t("common.noData", "ບໍ່ມີຂໍ້ມູນ");
  const groupLbl = groupLabel ?? t("components.crossList.group", "ຈັດກຸ່ມ");
  const router = useRouter();
  const seeded = initialRows !== undefined;
  const [rows, setRows] = useState<any[]>(initialRows ?? []);
  const [loading, setLoading] = useState(!seeded);
  const [q, setQ] = useState("");
  const [grouped, setGrouped] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const res: any = await load();
      if (res?.success) {
        setRows(res.data || []);
      } else if (Array.isArray(res)) {
        setRows(res);
      } else {
        setRows([]);
        setError(res?.message || "Unable to load data");
      }
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Unable to load data");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    // Rows seeded from the server (initialRows) skip the mount fetch.
    if (seeded) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter((r) => searchText(r).toLowerCase().includes(kw));
  }, [rows, q, searchText]);

  const groups = useMemo(() => {
    if (!groupBy) return [];
    const map: Record<string, any[]> = {};
    filtered.forEach((r) => {
      const k = groupBy(r) || t("components.crossList.unspecified", "(ບໍ່ລະບຸ)");
      (map[k] ||= []).push(r);
    });
    return Object.entries(map).map(([name, items]) => {
      if (!subGroupBy) return { name, items, subs: null as null | { name: string; items: any[] }[] };
      const sm: Record<string, any[]> = {};
      items.forEach((r) => {
        const sk = subGroupBy(r) || t("components.crossList.unspecified", "(ບໍ່ລະບຸ)");
        (sm[sk] ||= []).push(r);
      });
      return { name, items, subs: Object.entries(sm).map(([sname, sitems]) => ({ name: sname, items: sitems })) };
    });
  }, [filtered, groupBy, subGroupBy]);

  const headRow = (
    <tr>
      {columns.map((c, i) => (
        <th
          key={i}
          className={`${thCls} ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"}`}
        >
          {c.header}
        </th>
      ))}
      {rowHref && <th className={`${thCls} w-10`} />}
    </tr>
  );

  const bodyRows = (items: any[]) =>
    items.map((r, ri) => (
      <tr
        key={ri}
        onClick={rowHref ? () => router.push(rowHref(r)) : undefined}
        className={`group ${trHover} ${rowHref ? "cursor-pointer" : ""}`}
      >
        {columns.map((c, ci) => (
          <td
            key={ci}
            className={`${tdCls} font-semibold ${
              c.align === "right"
                ? "text-right font-mono tabular-nums text-[var(--text)]"
                : c.align === "center"
                  ? "text-center"
                  : "text-left"
            }`}
          >
            {c.cell(r)}
          </td>
        ))}
        {rowHref && (
          <td className={`${tdCls} w-10 text-right`}>
            <ChevronRight className="inline-block h-4 w-4 text-[var(--text-mute)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--brand)]" />
          </td>
        )}
      </tr>
    ));

  const useGrouped = groupBy && grouped;

  return (
    <Page max="max-w-none w-full">
      <PageHeader
        title={title}
        subtitle={subtitle ? subtitle(filtered.length) : `${filtered.length} ${t("components.crossList.items", "ລາຍການ")}`}
        actions={
          <div className="flex items-center gap-2">
            <Btn variant="outline" onClick={() => void refresh()} disabled={loading} className="w-9 p-0">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </Btn>
            {headerActions}
          </div>
        }
      />
      <Card className="overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-soft)] bg-[var(--surface-sunken)] p-3">
          <label className="flex h-9 w-full max-w-xs items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 transition-all focus-within:border-[var(--brand)] focus-within:ring-3 focus-within:ring-[var(--brand-ring)]">
            <Search className="h-4 w-4 text-[var(--text-mute)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPh}
              className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-mute)]"
            />
          </label>
          {groupBy && (
            <button
              onClick={() => setGrouped((g) => !g)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[11.5px] font-bold transition-all active:scale-[0.98] ${
                grouped
                  ? "bg-[var(--ink)] text-[var(--ink-text)]"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-soft)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text)]"
              }`}
            >
              <Layers size={13} />
              <span>{groupLbl}</span>
            </button>
          )}
        </div>
        {aboveTable}

        {loading ? (
          <div className="flex h-56 items-center justify-center gap-3 text-[var(--text-mute)]">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--brand)]" />
            <span className="text-[13px] font-semibold">{t("common.loading", "ກຳລັງໂຫຼດ...")}</span>
          </div>
        ) : error ? (
          <div className="flex h-56 flex-col items-center justify-center gap-2 px-6 text-center text-[var(--danger)]">
            <CircleAlert className="h-8 w-8 opacity-70" />
            <span className="text-[13px] font-bold">{t("components.crossList.loadError", "ບໍ່ສາມາດໂຫຼດຂໍ້ມູນໄດ້")}</span>
            <span className="max-w-xl font-mono text-[10.5px] font-medium opacity-80">{error}</span>
            <Btn variant="outline" onClick={() => void refresh()} className="mt-2">
              <RefreshCw size={13} /> {t("components.crossList.retry", "ລອງໃໝ່")}
            </Btn>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center gap-2 text-[var(--text-mute)]">
            <Inbox className="h-8 w-8 opacity-40" />
            <span className="text-[13px] font-semibold">{emptyText}</span>
          </div>
        ) : useGrouped ? (
          <div className="space-y-4 border-t border-[var(--border-soft)] bg-[var(--surface-sunken)] p-3">
            {groups.map((g, gi) => (
              <div key={gi} className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
                <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[11px] font-black text-[var(--brand-strong)]">
                      {g.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-[12.5px] font-extrabold text-[var(--text)]">{g.name}</span>
                  </div>
                  <span className="rounded-md border border-[var(--border)] bg-[var(--surface-sunken)] px-2.5 py-0.5 text-[10.5px] font-extrabold tracking-wide text-[var(--text-soft)]">
                    {g.items.length} {t("components.crossList.items", "ລາຍການ")}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className={tblCls}>
                    <thead>{headRow}</thead>
                    {g.subs ? (
                      <tbody>
                        {g.subs.map((s, si) => (
                          <React.Fragment key={si}>
                            <tr>
                              <td
                                colSpan={columns.length + (rowHref ? 1 : 0)}
                                className="border-b border-[var(--border-soft)] bg-[var(--surface-sunken)] px-4 py-2"
                              >
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-soft)]">
                                  <FolderOpen size={12} className="text-[var(--brand)]" /> {s.name}
                                  <span className="text-[var(--text-mute)]">· {s.items.length}</span>
                                </span>
                              </td>
                            </tr>
                            {bodyRows(s.items)}
                          </React.Fragment>
                        ))}
                      </tbody>
                    ) : (
                      <tbody>{bodyRows(g.items)}</tbody>
                    )}
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto border-t border-[var(--border-soft)]">
            <table className={tblCls}>
              <thead>{headRow}</thead>
              <tbody>{bodyRows(filtered)}</tbody>
            </table>
          </div>
        )}
      </Card>
    </Page>
  );
}
