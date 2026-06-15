"use client";

/** Reusable cross-project list (search + table) for the sidebar module pages. */
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, RefreshCw, ChevronRight, Inbox, Layers, FolderOpen, CircleAlert } from "lucide-react";
import { Page, PageHeader, Card, Btn } from "./ui";

export type Column = { header: string; align?: "right" | "center"; cell: (r: any) => React.ReactNode };

export default function CrossList({
  title,
  subtitle,
  columns,
  load,
  initialRows,
  searchText,
  rowHref,
  searchPlaceholder = "ຄົ້ນຫາ...",
  empty = "ບໍ່ມີຂໍ້ມູນ",
  headerActions,
  groupBy,
  subGroupBy,
  groupLabel = "ຈັດກຸ່ມ",
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
}) {
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
      const k = groupBy(r) || "(ບໍ່ລະບຸ)";
      (map[k] ||= []).push(r);
    });
    return Object.entries(map).map(([name, items]) => {
      if (!subGroupBy) return { name, items, subs: null as null | { name: string; items: any[] }[] };
      const sm: Record<string, any[]> = {};
      items.forEach((r) => {
        const sk = subGroupBy(r) || "(ບໍ່ລະບຸ)";
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
          className={`px-5 py-3 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200/60 ${
            c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"
          }`}
        >
          {c.header}
        </th>
      ))}
      {rowHref && <th className="px-5 py-3 bg-slate-50/80 border-b border-slate-200/60 w-10" />}
    </tr>
  );

  const bodyRows = (items: any[]) =>
    items.map((r, ri) => (
      <tr
        key={ri}
        onClick={rowHref ? () => router.push(rowHref(r)) : undefined}
        className={`group transition-colors duration-150 hover:bg-blue-50/40 ${rowHref ? "cursor-pointer" : ""}`}
      >
        {columns.map((c, ci) => (
          <td
            key={ci}
            className={`px-5 py-3.5 align-middle text-xs font-semibold text-slate-700 border-b border-slate-100 ${
              c.align === "right" ? "text-right font-mono text-slate-900" : c.align === "center" ? "text-center" : "text-left"
            }`}
          >
            {c.cell(r)}
          </td>
        ))}
        {rowHref && (
          <td className="px-5 py-3.5 align-middle border-b border-slate-100 text-right w-10">
            <ChevronRight className="inline-block h-4 w-4 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-blue-500" />
          </td>
        )}
      </tr>
    ));

  const useGrouped = groupBy && grouped;

  return (
    <Page max="max-w-none w-full">
      <PageHeader
        title={title}
        subtitle={subtitle ? subtitle(filtered.length) : `${filtered.length} ລາຍການ`}
        actions={
          <div className="flex items-center gap-2">
            <Btn variant="outline" onClick={() => void refresh()} disabled={loading} className="h-10 w-10 p-0 rounded-xl">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </Btn>
            {headerActions}
          </div>
        }
      />
      <Card className="overflow-hidden border border-slate-200 shadow-sm rounded-2xl">
        {/* Modern toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 p-4">
          <div className="relative flex h-10 w-full max-w-xs items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15 transition-all">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none"
            />
          </div>
          {groupBy && (
            <button
              onClick={() => setGrouped((g) => !g)}
              className={`flex h-10 items-center gap-2 rounded-xl border px-4 text-xs font-bold transition-all active:scale-[0.98] ${
                grouped
                  ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/25"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              <Layers size={13} />
              <span>{groupLabel}</span>
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex h-56 items-center justify-center gap-3 text-slate-400">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
            <span className="text-sm font-semibold">ກຳລັງໂຫຼດ...</span>
          </div>
        ) : error ? (
          <div className="flex h-56 flex-col items-center justify-center gap-2 px-6 text-center text-rose-500">
            <CircleAlert className="h-8 w-8 opacity-70" />
            <span className="text-sm font-bold">ບໍ່ສາມາດໂຫຼດຂໍ້ມູນໄດ້</span>
            <span className="max-w-xl font-mono text-[10.5px] font-medium text-rose-400">{error}</span>
            <Btn variant="outline" onClick={() => void refresh()} className="mt-2">
              <RefreshCw size={13} /> ລອງໃໝ່
            </Btn>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center gap-2 text-slate-400">
            <Inbox className="h-8 w-8 opacity-40" />
            <span className="text-sm font-semibold">{empty}</span>
          </div>
        ) : useGrouped ? (
          <div className="space-y-5 bg-slate-50/50 p-4 border-t border-slate-100">
            {groups.map((g, gi) => (
              <div key={gi} className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)]">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="font-display flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-[12px] font-black text-white shadow-sm shadow-blue-600/25">
                      {g.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-sm font-extrabold text-slate-800">{g.name}</span>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-bold text-slate-500">
                    {g.items.length} ລາຍການ
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0 text-xs">
                    <thead>{headRow}</thead>
                    {g.subs ? (
                      <tbody className="divide-y divide-slate-100">
                        {g.subs.map((s, si) => (
                          <React.Fragment key={si}>
                            <tr>
                              <td
                                colSpan={columns.length + (rowHref ? 1 : 0)}
                                className="bg-slate-50/70 px-5 py-2 border-b border-slate-100"
                              >
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                                  <FolderOpen size={12} className="text-blue-500" /> {s.name}
                                  <span className="text-slate-400">· {s.items.length}</span>
                                </span>
                              </td>
                            </tr>
                            {bodyRows(s.items)}
                          </React.Fragment>
                        ))}
                      </tbody>
                    ) : (
                      <tbody className="divide-y divide-slate-100">{bodyRows(g.items)}</tbody>
                    )}
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto border-t border-slate-100">
            <table className="min-w-full border-separate border-spacing-0 text-xs">
              <thead>{headRow}</thead>
              <tbody className="divide-y divide-slate-100">{bodyRows(filtered)}</tbody>
            </table>
          </div>
        )}
      </Card>
    </Page>
  );
}
