"use client";

/**
 * ສະຕັອກຕາມ BOQ (ODIEN SERVICE layout): toolbar → tabs → one table.
 *
 * Rows are the BOQ items of the still-open projects — what the live jobs need —
 * measured against stock on hand and anything already on order. Every filter,
 * sort and page change is a server call that returns ONE page; nothing is
 * filtered in the browser, so the screen stays fast no matter how big the BOQ
 * book gets.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, FileSpreadsheet, Loader2, RefreshCw, Search, TriangleAlert } from "lucide-react";
import * as XLSX from "xlsx";
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
  Stat,
  Toolbar,
  TwoLine,
  tblCls,
  tdCls,
  thCls,
  trHover,
} from "../_components/ui";
import { getBoqStock, getBoqStockForExport, type DemandPage, type DemandQuery } from "@/_actions/purchase";
import { useT } from "@/_lib/i18n";

const qtyFmt = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "-";
};

type SortKey = NonNullable<DemandQuery["sort"]>;

export default function InventoryClient({ initial }: { initial: DemandPage | null }) {
  const t = useT();
  const router = useRouter();
  const [data, setData] = useState<DemandPage | null>(initial);
  const [loading, setLoading] = useState(false);
  const [draftQ, setDraftQ] = useState("");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "short" | "enough" | "unit_mismatch">("all");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "shortfall_qty", dir: "desc" });
  const first = useRef(true);

  // Any change to the query is answered by the server with a single page.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const res = await getBoqStock({ q, tab, page, sort: sort.key, dir: sort.dir });
        if (alive && res.success) setData(res.data);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [q, tab, page, sort]);

  const reload = () => setSort((s) => ({ ...s }));

  const toggleSort = (key: SortKey) => {
    setPage(1);
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  };

  const rows = data?.rows ?? [];
  const counts = data?.counts ?? { all: 0, short: 0, enough: 0, unit_mismatch: 0 };
  const summary = data?.summary ?? { items: 0, shortItems: 0, shortQty: 0, unitMismatch: 0 };
  const perPage = data?.perPage ?? 25;
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / perPage));
  const current = data?.page ?? 1;

  /** Export pulls the full filtered set once, on demand — not on every render. */
  const exportExcel = async () => {
    const res = await getBoqStockForExport({ q, tab });
    if (!res.success) return;
    const sheet = XLSX.utils.json_to_sheet(
      res.data.map((r) => ({
        [t("inventory.code", "ລະຫັດ")]: r.item_code,
        [t("inventory.itemName", "ຊື່ສິນຄ້າ")]: r.item_name,
        [t("inventory.unit", "ໜ່ວຍ")]: r.unit,
        [t("inventory.demand", "ຄວາມຕ້ອງການ BOQ")]: r.demand_qty,
        [t("inventory.balance", "ຄົງເຫຼືອ")]: r.stock_qty,
        [t("purchase.colOrdered", "ສັ່ງຊື້ແລ້ວ")]: r.ordered_qty,
        [t("purchase.colShortfall", "ຕ້ອງຊື້ເພີ່ມ")]: r.shortfall_qty,
      })),
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "boq-stock");
    XLSX.writeFile(book, `boq-stock-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const tabs: { value: "all" | "short" | "enough" | "unit_mismatch"; label: string; count: number }[] = [
    { value: "all", label: t("common.all", "ທັງໝົດ"), count: counts.all },
    { value: "short", label: t("inventory.filterShort", "ບໍ່ພຽງພໍ"), count: counts.short },
    { value: "enough", label: t("inventory.filterEnough", "ພຽງພໍ"), count: counts.enough },
    // Rows whose BOQ / stock units disagree — they cannot be compared at all
    // until the unit is fixed, so they get their own queue.
    { value: "unit_mismatch", label: t("inventory.unitMismatch", "ຫົວໜ່ວຍບໍ່ຕົງ"), count: counts.unit_mismatch },
  ];

  return (
    <Page max="max-w-none w-full">
      <PageHeader
        title={t("inventory.title", "ສະຕັອກຕາມ BOQ")}
        subtitle={`${t("inventory.subtitle", "ວັດສະດຸທີ່ໂຄງການທີ່ຍັງບໍ່ປິດຕ້ອງການ ທຽບກັບສະຕັອກ")} · ${data?.total ?? 0} ${t("inventory.items", "ລາຍການ")} · ${t("common.page", "ໜ້າ")} ${current}/${pageCount}`}
        actions={
          <>
            <Btn variant="outline" onClick={exportExcel} disabled={!rows.length}>
              <FileSpreadsheet size={14} /> Excel
            </Btn>
            <Btn variant="outline" onClick={reload} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {t("common.reload", "ໂຫຼດໃໝ່")}
            </Btn>
            <Btn
              variant="danger-outline"
              onClick={() => {
                setTab("short");
                setPage(1);
              }}
            >
              <TriangleAlert size={14} /> {t("inventory.filterShort", "ບໍ່ພຽງພໍ")} <BtnCount value={summary.shortItems} />
            </Btn>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat icon={<FileSpreadsheet size={18} />} label={t("inventory.statItems", "ລາຍການ BOQ ທີ່ຕິດຕາມ")} value={summary.items} />
        <Stat
          icon={<TriangleAlert size={18} />}
          label={t("inventory.statShort", "ລາຍການທີ່ບໍ່ພຽງພໍ")}
          value={summary.shortItems}
          active={tab === "short"}
          onClick={() => {
            setTab("short");
            setPage(1);
          }}
        />
        <Stat icon={<TriangleAlert size={18} />} label={t("inventory.statShortQty", "ຈຳນວນທີ່ຂາດລວມ")} value={qtyFmt(summary.shortQty)} />
      </div>

      <Toolbar>
        <label className="flex h-9 min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3">
          <Search size={15} className="text-[var(--text-mute)]" />
          <input
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              setQ(draftQ);
              setPage(1);
            }}
            placeholder={t("inventory.searchPlaceholder", "ຄົ້ນຫາ ລະຫັດ ຫຼື ຊື່ສິນຄ້າ...")}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-mute)]"
          />
        </label>
        <Btn
          variant="ink"
          onClick={() => {
            setQ(draftQ);
            setPage(1);
          }}
        >
          <Search size={14} /> {t("common.search", "ຄົ້ນຫາ")}
        </Btn>
      </Toolbar>

      <div className="mb-4 overflow-x-auto">
        <Segmented<"all" | "short" | "enough" | "unit_mismatch">
          value={tab}
          onChange={(v) => {
            setTab(v);
            setPage(1);
          }}
          options={tabs.map((x) => ({
            value: x.value,
            label: (
              <span className="flex items-center gap-1.5">
                {x.label}
                <span className="rounded-full bg-black/10 px-1.5 text-[10px] font-black dark:bg-white/15">{x.count}</span>
              </span>
            ),
          }))}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className={tblCls}>
            <thead>
              <tr>
                <RowBarTh />
                <SortTh
                  label={t("inventory.itemName", "ລາຍການ (BOQ)")}
                  active={sort.key === "item_name"}
                  dir={sort.dir}
                  onClick={() => toggleSort("item_name")}
                />
                <th className={`${thCls} w-20`}>{t("inventory.unit", "ໜ່ວຍ")}</th>
                <SortTh
                  label={t("inventory.demand", "ຄວາມຕ້ອງການ")}
                  active={sort.key === "demand_qty"}
                  dir={sort.dir}
                  onClick={() => toggleSort("demand_qty")}
                  className="w-32 text-right"
                />
                <SortTh
                  label={t("inventory.balance", "ສະຕັອກຄົງເຫຼືອ")}
                  active={sort.key === "stock_qty"}
                  dir={sort.dir}
                  onClick={() => toggleSort("stock_qty")}
                  className="w-32 text-right"
                />
                <SortTh
                  label={t("purchase.colOrdered", "ສັ່ງຊື້ແລ້ວ")}
                  active={sort.key === "ordered_qty"}
                  dir={sort.dir}
                  onClick={() => toggleSort("ordered_qty")}
                  className="w-28 text-right"
                />
                <SortTh
                  label={t("purchase.colShortfall", "ຕ້ອງຊື້ເພີ່ມ")}
                  active={sort.key === "shortfall_qty"}
                  dir={sort.dir}
                  onClick={() => toggleSort("shortfall_qty")}
                  className="w-32 text-right"
                />
                <th className={`${thCls} w-32`}>{t("common.status", "ສະຖານະ")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[var(--text-mute)]">
                    <Loader2 size={20} className="mx-auto animate-spin" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[12.5px] text-[var(--text-mute)]">
                    {q ? t("inventory.notFound", "ບໍ່ພົບສິນຄ້າ") : t("inventory.empty", "ບໍ່ມີລາຍການ BOQ ທີ່ຍັງເປີດ")}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.item_code}
                    onClick={() => router.push(`/inventory/${encodeURIComponent(r.item_code)}`)}
                    className={`${trHover} cursor-pointer`}
                  >
                    <RowBar tone={r.unit_mismatch ? "warning" : (r.shortfall_qty ?? 0) > 0 ? "danger" : r.ordered_qty > 0 ? "warning" : "success"} />
                    <td className={tdCls}>
                      <TwoLine
                        primary={r.item_name || r.item_code}
                        secondary={
                          <span>
                            <span className="font-mono">{r.item_code}</span>
                            {r.projects.length > 0 && (
                              <span className="ml-2 text-[var(--text-mute)]">
                                · {r.projects.slice(0, 2).join(", ")}
                                {r.projects.length > 2 ? ` +${r.projects.length - 2}` : ""}
                              </span>
                            )}
                          </span>
                        }
                      />
                    </td>
                    <td className={`${tdCls} text-[var(--text-mute)]`}>
                        {r.unit || "-"}
                        {r.unit_mismatch && (
                          <span className="ml-1 text-[10px] text-[var(--warning)]" title={`BOQ: ${r.boq_unit || "?"} · Stock: ${r.stock_unit || "?"}`}>
                            ⚠
                          </span>
                        )}
                      </td>
                    <td className={`${tdCls} text-right font-semibold tabular-nums text-[var(--text)]`}>{qtyFmt(r.demand_qty)}</td>
                    <td
                      className={`${tdCls} text-right font-semibold tabular-nums ${
                        r.stock_qty >= r.demand_qty ? "text-[var(--success)]" : "text-[var(--text-soft)]"
                      }`}
                    >
                      {qtyFmt(r.stock_qty)}
                      {r.stock_unit && r.unit_mismatch && (
                        <span className="ml-1 text-[10px] font-normal text-[var(--warning)]">{r.stock_unit}</span>
                      )}
                    </td>
                    <td className={`${tdCls} text-right tabular-nums ${r.ordered_qty > 0 ? "text-[var(--warning)]" : "text-[var(--text-mute)]"}`}>
                      {r.ordered_qty > 0 ? qtyFmt(r.ordered_qty) : "—"}
                    </td>
                    <td className={`${tdCls} text-right`}>
                      {r.unit_mismatch ? (
                        <Pill tone="amber">{t("inventory.unitMismatch", "ຫົວໜ່ວຍບໍ່ຕົງ")}</Pill>
                      ) : (r.shortfall_qty ?? 0) > 0 ? (
                        <span className="font-black tabular-nums text-[var(--danger)]">{qtyFmt(r.shortfall_qty)}</span>
                      ) : (
                        <span className="text-[var(--text-mute)]">—</span>
                      )}
                    </td>
                    <td className={tdCls}>
                      <Pill tone={r.unit_mismatch ? "amber" : (r.shortfall_qty ?? 0) > 0 ? "red" : "green"}>
                        {r.unit_mismatch
                          ? `${r.boq_unit || "?"} ↔ ${r.stock_unit || "?"}`
                          : (r.shortfall_qty ?? 0) > 0
                            ? t("inventory.notEnough", "ບໍ່ພຽງພໍ")
                            : t("purchase.enough", "ພຽງພໍ")}
                      </Pill>
                    </td>
                  </tr>
                ))
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
              <Btn variant="outline" onClick={() => setPage(current - 1)} disabled={current <= 1 || loading}>
                <ChevronLeft size={14} /> {t("common.prev", "ກ່ອນ")}
              </Btn>
              <Btn variant="outline" onClick={() => setPage(current + 1)} disabled={current >= pageCount || loading}>
                {t("common.next", "ຖັດໄປ")} <ChevronRight size={14} />
              </Btn>
            </div>
          </div>
        )}
      </Card>

      <p className="mt-3 px-1 text-[11px] text-[var(--text-mute)]">
        {t("inventory.footnote", "ຄວາມຕ້ອງການ = BOQ ຂອງໂຄງການທີ່ຍັງບໍ່ປິດ − ທີ່ເບີກອອກໄປແລ້ວ")}
      </p>
    </Page>
  );
}
