"use client";

/**
 * Inventory / stock browser — flat list (ODIEN SERVICE layout): toolbar → stock
 * tabs → one table. Read-only list over the ERP `ic_inventory` table via
 * getInventory(). Click a row to open the item and see its remaining stock
 * balance (per warehouse / location).
 *
 * Initial rows are fetched on the server (see ./page.tsx) and handed in as
 * `initialRows`, so the first paint is instant — no client mount→fetch
 * waterfall. The server contract is unchanged: the search term is applied
 * SERVER-side (getInventory({ search, limit: LIMIT })). The search box is
 * staged — typing only edits the draft; Enter or the ຄົ້ນຫາ button commits it,
 * and the debounced effect then refetches (it skips the seeded first render).
 * Status tabs / sorting / paging work over the fetched page of rows.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BellRing,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import * as XLSX from "xlsx";
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
} from "../_components/ui";
import { getInventory } from "@/_actions/lookups";
import { useT } from "@/_lib/i18n";

type Item = { code?: string; name_1?: string; unit?: string; balance_qty?: unknown; [k: string]: unknown };

const PER_PAGE = 25;
const LIMIT = 100;

const qtyFmt = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "-";
};
const hasQty = (v: unknown) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
/** Out of stock = we know the balance and it is at or below zero. */
const isOut = (r: Item) => hasQty(r.balance_qty) && Number(r.balance_qty) <= 0;

type SortKey = "code" | "name_1" | "unit" | "balance_qty";

export default function InventoryClient({ initialRows }: { initialRows: any[] }) {
  const t = useT();
  const router = useRouter();
  const [draftQ, setDraftQ] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Item[]>(initialRows ?? []);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "in" | "out">("all");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "code", dir: "asc" });
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didMount = useRef(false);

  useEffect(() => {
    // Skip the first run: the server already provided the empty-search rows
    // (initialRows). Subsequent (committed) search changes still trigger a
    // debounced refetch.
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    setLoading(true);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        const res: any = await getInventory({ search: search.trim(), limit: LIMIT });
        setRows(res?.success ? res.data || [] : Array.isArray(res) ? res : []);
        setPage(1);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [search]);

  const runSearch = () => {
    setSearch(draftQ);
    setPage(1);
  };

  /** Manual reload — refetch the current search from the server. */
  const reload = async () => {
    setLoading(true);
    try {
      const res: any = await getInventory({ search: search.trim(), limit: LIMIT });
      setRows(res?.success ? res.data || [] : Array.isArray(res) ? res : []);
    } finally {
      setLoading(false);
    }
  };

  const counts = useMemo(() => {
    const out = rows.filter(isOut).length;
    return { all: rows.length, out, in: rows.length - out };
  }, [rows]);

  const filtered = useMemo(() => {
    const list = rows.filter((r) => (activeTab === "all" ? true : activeTab === "out" ? isOut(r) : !isOut(r)));
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sort.key === "balance_qty") {
        const av = hasQty(a.balance_qty) ? Number(a.balance_qty) : -Infinity;
        const bv = hasQty(b.balance_qty) ? Number(b.balance_qty) : -Infinity;
        return av > bv ? dir : -dir;
      }
      return String(a[sort.key] ?? "") > String(b[sort.key] ?? "") ? dir : -dir;
    });
  }, [rows, activeTab, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, pageCount);
  const pageRows = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const capped = rows.length >= LIMIT;

  const open = (c: unknown) => router.push(`/inventory/${encodeURIComponent(String(c ?? ""))}`);

  const stockFilters: { value: "all" | "in" | "out"; label: string }[] = [
    { value: "all", label: t("common.all", "ທັງໝົດ") },
    { value: "in", label: t("inventory.filterInStock", "ມີສະຕັອກ") },
    { value: "out", label: t("inventory.filterOutOfStock", "ໝົດສະຕັອກ") },
  ];

  const tabs = stockFilters.map((f) => ({
    value: f.value,
    label: (
      <span className="flex items-center gap-1.5">
        {f.label}
        <span className="rounded-full bg-black/10 px-1.5 text-[10px] font-black dark:bg-white/15">{counts[f.value] ?? 0}</span>
      </span>
    ),
  }));

  /** Excel export of exactly what is on screen (current filter + sort, all pages). */
  const exportExcel = () => {
    const sheet = XLSX.utils.json_to_sheet(
      filtered.map((r) => ({
        [t("inventory.code", "ລະຫັດ")]: r.code || "",
        [t("inventory.itemName", "ຊື່ສິນຄ້າ")]: r.name_1 || "",
        [t("inventory.unit", "ໜ່ວຍ")]: r.unit || "",
        [t("inventory.balance", "ຄົງເຫຼືອ")]: hasQty(r.balance_qty) ? Number(r.balance_qty) : "",
      })),
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "inventory");
    XLSX.writeFile(book, `inventory-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <Page max="max-w-none">
      <PageHeader
        title={t("inventory.title", "ສິນຄ້າ / ສະຕັອກ")}
        subtitle={`${t("inventory.totalPrefix", "ທັງໝົດ")} ${filtered.length}${capped ? "+" : ""} ${t("inventory.itemsUnit", "ລາຍການ")} · ${t("common.page", "ໜ້າ")} ${current}/${pageCount}`}
        actions={
          <>
            <Btn variant="outline" onClick={exportExcel} disabled={filtered.length === 0}>
              <FileSpreadsheet size={14} /> Excel
            </Btn>
            <Btn variant="outline" onClick={reload} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {t("common.reload", "ໂຫຼດໃໝ່")}
            </Btn>
            <Btn
              variant="danger-outline"
              onClick={() => {
                setActiveTab("out");
                setPage(1);
              }}
            >
              <BellRing size={14} /> {t("inventory.filterOutOfStock", "ໝົດສະຕັອກ")} <BtnCount value={counts.out} />
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
            placeholder={t("inventory.searchPlaceholder", "ຄ້ນຫາ ລະຫັດ ຫຼື ຊື່ສິນຄ້າ...")}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-mute)]"
          />
          {loading && <Loader2 size={14} className="flex-shrink-0 animate-spin text-[var(--text-mute)]" />}
          {(draftQ || search) && !loading && (
            <button
              type="button"
              onClick={() => {
                setDraftQ("");
                setSearch("");
                setPage(1);
              }}
              className="flex-shrink-0 text-[11px] font-bold text-[var(--text-mute)] hover:text-[var(--text)]"
            >
              {t("inventory.clear", "ລ້າງ")}
            </button>
          )}
        </label>

        <div className="w-52">
          <RSelect
            value={activeTab === "all" ? "" : activeTab}
            onChange={(v) => {
              setActiveTab((v as "in" | "out") || "all");
              setPage(1);
            }}
            isClearable
            isSearchable={false}
            placeholder={t("inventory.allStock", "ສະຖານະສະຕັອກທັງໝົດ")}
            options={stockFilters
              .filter((f) => f.value !== "all")
              .map((f) => ({ value: f.value, label: `${f.label} (${counts[f.value] ?? 0})` }))}
          />
        </div>

        <Btn variant="ink" onClick={runSearch}>
          <Search size={14} /> {t("common.search", "ຄົ້ນຫາ")}
        </Btn>
      </Toolbar>

      <div className="mb-4 overflow-x-auto">
        <Segmented<"all" | "in" | "out">
          value={activeTab}
          onChange={(v) => {
            setActiveTab(v);
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
                  label={t("inventory.code", "ລະຫັດ")}
                  active={sort.key === "code"}
                  dir={sort.dir}
                  onClick={() => toggleSort("code")}
                />
                <SortTh
                  label={t("inventory.itemName", "ຊື່ສິນຄ້າ")}
                  active={sort.key === "name_1"}
                  dir={sort.dir}
                  onClick={() => toggleSort("name_1")}
                />
                <SortTh
                  label={t("inventory.unit", "ໜ່ວຍ")}
                  active={sort.key === "unit"}
                  dir={sort.dir}
                  onClick={() => toggleSort("unit")}
                  className="w-28"
                />
                <SortTh
                  label={t("inventory.balance", "ຄົງເຫຼືອ")}
                  active={sort.key === "balance_qty"}
                  dir={sort.dir}
                  onClick={() => toggleSort("balance_qty")}
                  className="w-32 text-right"
                />
                <th className={`${thCls} w-36`}>{t("common.status", "ສະຖານະ")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[var(--text-mute)]">
                    <Loader2 size={20} className="mx-auto animate-spin" />
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[12.5px] text-[var(--text-mute)]">
                    {search ? t("inventory.notFound", "ບໍ່ພົບສິນຄ້າ") : t("inventory.empty", "ຍັງບໍ່ມີສິນຄ້າ")}
                  </td>
                </tr>
              ) : (
                pageRows.map((r, i) => {
                  const out = isOut(r);
                  return (
                    <tr
                      key={(r.code as string) ?? i}
                      onClick={() => open(r.code)}
                      className={`${trHover} cursor-pointer`}
                    >
                      <RowBar tone={out ? "danger" : hasQty(r.balance_qty) ? "success" : "neutral"} />
                      <td className={tdCls}>
                        <TwoLine primary={<span className="font-mono">{r.code || "-"}</span>} />
                      </td>
                      <td className={tdCls}>{r.name_1 || "-"}</td>
                      <td className={tdCls}>{(r.unit as string) || "-"}</td>
                      <td
                        className={`${tdCls} text-right font-semibold tabular-nums ${out ? "text-[var(--danger)]" : "text-[var(--text)]"}`}
                      >
                        {hasQty(r.balance_qty) ? qtyFmt(r.balance_qty) : <span className="text-[var(--text-mute)]">—</span>}
                      </td>
                      <td className={tdCls}>
                        {hasQty(r.balance_qty) ? (
                          <Pill tone={out ? "red" : "green"}>
                            {out ? t("inventory.filterOutOfStock", "ໝົດສະຕັອກ") : t("inventory.filterInStock", "ມີສະຕັອກ")}
                          </Pill>
                        ) : (
                          <span className="text-[var(--text-mute)]">—</span>
                        )}
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

        {capped && (
          <div className="border-t border-[var(--border-soft)] bg-[var(--surface-sunken)] px-4 py-2.5 text-center text-[11px] font-semibold text-[var(--text-mute)]">
            {t("inventory.cappedNote", "ສະແດງສູງສຸດ {limit} ລາຍການ — ພິມຄຳຄ້ນເພື່ອຄົ້ນຫາສິນຄ້າທີ່ຕ້ອງການ").replace("{limit}", String(LIMIT))}
          </div>
        )}
      </Card>
    </Page>
  );
}
