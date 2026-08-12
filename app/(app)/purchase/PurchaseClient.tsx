"use client";

/**
 * ຂໍຊື້ (ODIEN SERVICE layout): stats → toolbar → tabs → one table.
 *
 * Two tables share the screen:
 *   ຕ້ອງຊື້ / ພຽງພໍ — BOQ items of the open projects vs stock and orders
 *   ສັ່ງຊື້ແລ້ວ      — the purchase lines this office recorded
 *
 * Both are searched, sorted and paged ON THE SERVER; each interaction fetches
 * one page. Nothing is filtered in the browser.
 */
import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  PackageCheck,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  createPurchaseOrder,
  deletePurchaseLine,
  getBoqStock,
  getBoqStockForExport,
  getPurchaseLines,
  setPurchaseLineStatus,
  type DemandPage,
  type DemandQuery,
  type DemandRow,
  type PurchaseLine,
} from "@/_actions/purchase";
import {
  Btn,
  Card,
  Field,
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
  inputCls,
  tblCls,
  tdCls,
  thCls,
  trHover,
  type PillTone,
} from "../_components/ui";
import { getV2User } from "../../_lib/session";
import { can } from "@/_lib/permissions";
import { useT } from "@/_lib/i18n";

const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0";
};
const d10 = (v: unknown) => (v ? String(new Date(v as any).toISOString()).slice(0, 10) : "-");

const LINE_PILL: Record<string, PillTone> = { ordered: "amber", received: "green", cancelled: "neutral" };

type LinePage = { rows: PurchaseLine[]; total: number; page: number; perPage: number };
type SortKey = NonNullable<DemandQuery["sort"]>;
type Tab = "shortfall" | "covered" | "unit_mismatch" | "ordered";

export default function PurchaseClient({
  initialDemand,
  initialLines,
}: {
  initialDemand: DemandPage | null;
  initialLines: LinePage | null;
}) {
  const t = useT();
  const user = getV2User();
  const canCreate = can(user, "purchase", "create");
  const canEdit = can(user, "purchase", "edit");
  const canDelete = can(user, "purchase", "delete");

  const [demand, setDemand] = useState<DemandPage | null>(initialDemand);
  const [lines, setLines] = useState<LinePage | null>(initialLines);
  const [tab, setTab] = useState<Tab>("shortfall");
  const [draftQ, setDraftQ] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "shortfall_qty", dir: "desc" });
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<{ row: DemandRow; qty: string; supplier: string; note: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const first = useRef(true);

  /** One request per interaction, returning exactly one page. */
  const fetchPage = async () => {
    setLoading(true);
    try {
      if (tab === "ordered") {
        const res = await getPurchaseLines({ q, page });
        if (res.success) setLines(res.data);
      } else {
        const res = await getBoqStock({
          q,
          page,
          tab: tab === "shortfall" ? "short" : tab === "unit_mismatch" ? "unit_mismatch" : "enough",
          sort: sort.key,
          dir: sort.dir,
        });
        if (res.success) setDemand(res.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void fetchPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tab, page, sort]);

  /** After a write both tables are stale — the demand snapshot changed too. */
  const reloadAll = async () => {
    setLoading(true);
    try {
      const [d, l] = await Promise.all([
        getBoqStock({
          q,
          page: tab === "ordered" ? 1 : page,
          tab: tab === "covered" ? "enough" : tab === "unit_mismatch" ? "unit_mismatch" : "short",
          sort: sort.key,
          dir: sort.dir,
        }),
        getPurchaseLines({ q, page: tab === "ordered" ? page : 1 }),
      ]);
      if (d.success) setDemand(d.data);
      if (l.success) setLines(l.data);
    } finally {
      setLoading(false);
    }
  };

  const toggleSort = (key: SortKey) => {
    setPage(1);
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  };

  const rows = demand?.rows ?? [];
  const lineRows = lines?.rows ?? [];
  const summary = demand?.summary ?? { items: 0, shortItems: 0, shortQty: 0, unitMismatch: 0 };
  const counts = demand?.counts ?? { all: 0, short: 0, enough: 0, unit_mismatch: 0 };
  const total = tab === "ordered" ? lines?.total ?? 0 : demand?.total ?? 0;
  const perPage = (tab === "ordered" ? lines?.perPage : demand?.perPage) ?? 25;
  const current = (tab === "ordered" ? lines?.page : demand?.page) ?? 1;
  const pageCount = Math.max(1, Math.ceil(total / perPage));

  const submitOrder = async () => {
    if (!order) return;
    setSaving(true);
    try {
      const res: any = await createPurchaseOrder({
        items: [{ item_code: order.row.item_code, item_name: order.row.item_name, unit: order.row.unit, qty: Number(order.qty) }],
        supplier: order.supplier,
        note: order.note,
      });
      if (!res?.success) {
        alert(res?.message || t("purchase.saveFailed", "ບັນທຶກບໍ່ສຳເລັດ"));
        return;
      }
      setOrder(null);
      await reloadAll();
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (line: PurchaseLine, status: string) => {
    const res: any = await setPurchaseLineStatus(String(line.id), status);
    if (!res?.success) return alert(res?.message || t("purchase.saveFailed", "ບັນທຶກບໍ່ສຳເລັດ"));
    await reloadAll();
  };

  const removeLine = async (line: PurchaseLine) => {
    if (!window.confirm(`${t("purchase.deleteConfirm", "ລຶບລາຍການສັ່ງຊື້")} ${line.item_code}?`)) return;
    const res: any = await deletePurchaseLine(String(line.id));
    if (!res?.success) return alert(res?.message || t("purchase.deleteFailed", "ລຶບບໍ່ສຳເລັດ"));
    await reloadAll();
  };

  const exportExcel = async () => {
    const res = await getBoqStockForExport({
      q,
      tab: tab === "covered" ? "enough" : tab === "unit_mismatch" ? "unit_mismatch" : "short",
    });
    if (!res.success) return;
    const sheet = XLSX.utils.json_to_sheet(
      res.data.map((r) => ({
        [t("purchase.colCode", "ລະຫັດ")]: r.item_code,
        [t("purchase.colItem", "ລາຍການ")]: r.item_name,
        [t("common.unit", "ໜ່ວຍ")]: r.unit,
        [t("purchase.colDemand", "ຄວາມຕ້ອງການ")]: r.demand_qty,
        [t("purchase.colStock", "ສະຕັອກ")]: r.stock_qty,
        [t("purchase.colOrdered", "ສັ່ງແລ້ວ")]: r.ordered_qty,
        [t("purchase.colShortfall", "ຕ້ອງຊື້")]: r.shortfall_qty,
      })),
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "purchase");
    XLSX.writeFile(book, `purchase-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const tabs: { value: Tab; label: string; count: number }[] = [
    { value: "shortfall", label: t("purchase.tabShortfall", "ຕ້ອງຊື້"), count: summary.shortItems },
    { value: "covered", label: t("purchase.tabCovered", "ພຽງພໍ"), count: counts.enough },
    { value: "unit_mismatch", label: t("inventory.unitMismatch", "ຫົວໜ່ວຍບໍ່ຕົງ"), count: summary.unitMismatch },
    { value: "ordered", label: t("purchase.tabOrdered", "ສັ່ງຊື້ແລ້ວ"), count: lines?.total ?? 0 },
  ];

  return (
    <Page max="max-w-none w-full">
      <PageHeader
        title={t("purchase.title", "ຂໍຊື້")}
        subtitle={`${t("purchase.subtitle", "ຄວາມຕ້ອງການຈາກ BOQ ຂອງໂຄງການທີ່ຍັງບໍ່ປິດ ທຽບກັບສະຕັອກ ແລະ ຈຳນວນທີ່ສັ່ງຊື້ໄປແລ້ວ")} · ${total} ${t("purchase.items", "ລາຍການ")} · ${t("common.page", "ໜ້າ")} ${current}/${pageCount}`}
        actions={
          <>
            <Btn variant="outline" onClick={exportExcel} disabled={tab === "ordered"}>
              <Boxes size={14} /> Excel
            </Btn>
            <Btn variant="outline" onClick={() => void reloadAll()} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {t("common.reload", "ໂຫຼດໃໝ່")}
            </Btn>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Boxes size={18} />} label={t("purchase.statItems", "ລາຍການ BOQ ທີ່ຕິດຕາມ")} value={summary.items} />
        <Stat
          icon={<TriangleAlert size={18} />}
          label={t("purchase.statShort", "ລາຍການທີ່ຂາດ")}
          value={summary.shortItems}
          active={tab === "shortfall"}
          onClick={() => {
            setTab("shortfall");
            setPage(1);
          }}
        />
        <Stat icon={<AlertTriangle size={18} />} label={t("purchase.statShortQty", "ຈຳນວນທີ່ຂາດລວມ")} value={n(summary.shortQty)} />
        <Stat
          icon={<ShoppingCart size={18} />}
          label={t("purchase.statOnOrder", "ລາຍການສັ່ງຊື້")}
          value={lines?.total ?? 0}
          active={tab === "ordered"}
          onClick={() => {
            setTab("ordered");
            setPage(1);
          }}
        />
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
            placeholder={t("purchase.searchPlaceholder", "ຄົ້ນຫາ ລະຫັດ / ຊື່ສິນຄ້າ...")}
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
        <Segmented<Tab>
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
          {tab === "ordered" ? (
            <table className={tblCls}>
              <thead>
                <tr>
                  <RowBarTh />
                  <th className={thCls}>{t("purchase.colItem", "ລາຍການ")}</th>
                  <th className={`${thCls} w-36`}>{t("purchase.colPrNo", "ເລກໃບຂໍຊື້")}</th>
                  <th className={`${thCls} w-28 text-right`}>{t("purchase.colQty", "ຈຳນວນ")}</th>
                  <th className={`${thCls} w-40`}>{t("purchase.colSupplier", "ຜູ້ສະໜອງ")}</th>
                  <th className={`${thCls} w-28`}>{t("common.date", "ວັນທີ")}</th>
                  <th className={`${thCls} w-32`}>{t("common.status", "ສະຖານະ")}</th>
                  <th className={`${thCls} w-32 text-right`}>{t("common.actions", "ການດຳເນີນ")}</th>
                </tr>
              </thead>
              <tbody>
                {lineRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-[12.5px] text-[var(--text-mute)]">
                      {t("purchase.noOrders", "ຍັງບໍ່ມີການສັ່ງຊື້")}
                    </td>
                  </tr>
                ) : (
                  lineRows.map((l) => (
                    <tr key={l.id} className={trHover}>
                      <RowBar tone={l.status === "received" ? "success" : l.status === "cancelled" ? "neutral" : "warning"} />
                      <td className={tdCls}>
                        <TwoLine primary={l.item_name || l.item_code} secondary={<span className="font-mono">{l.item_code}</span>} />
                      </td>
                      <td className={`${tdCls} font-mono text-[11.5px]`}>{l.pr_no}</td>
                      <td className={`${tdCls} text-right font-bold tabular-nums text-[var(--text)]`}>
                        {n(l.qty)} <span className="text-[11px] font-normal text-[var(--text-mute)]">{l.unit}</span>
                      </td>
                      <td className={tdCls}>{l.supplier || "-"}</td>
                      <td className={`${tdCls} tabular-nums`}>{d10(l.ordered_at || l.created_at)}</td>
                      <td className={tdCls}>
                        <Pill tone={LINE_PILL[l.status] || "neutral"}>
                          {l.status === "received"
                            ? t("purchase.statusReceived", "ຮັບເຂົ້າສາງແລ້ວ")
                            : l.status === "cancelled"
                              ? t("purchase.statusCancelled", "ຍົກເລີກ")
                              : t("purchase.statusOrdered", "ສັ່ງແລ້ວ")}
                        </Pill>
                      </td>
                      <td className={`${tdCls} text-right`}>
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && l.status === "ordered" && (
                            <>
                              <button
                                onClick={() => changeStatus(l, "received")}
                                title={t("purchase.markReceived", "ຮັບເຂົ້າສາງ")}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-mute)] hover:bg-[var(--success-soft)] hover:text-[var(--success)]"
                              >
                                <PackageCheck size={14} />
                              </button>
                              <button
                                onClick={() => changeStatus(l, "cancelled")}
                                title={t("purchase.cancel", "ຍົກເລີກ")}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-mute)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text)]"
                              >
                                <X size={14} />
                              </button>
                            </>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => removeLine(l)}
                              title={t("common.delete", "ລຶບ")}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-mute)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className={tblCls}>
              <thead>
                <tr>
                  <RowBarTh />
                  <SortTh
                    label={t("purchase.colItem", "ລາຍການ")}
                    active={sort.key === "item_name"}
                    dir={sort.dir}
                    onClick={() => toggleSort("item_name")}
                  />
                  <th className={`${thCls} w-20`}>{t("common.unit", "ໜ່ວຍ")}</th>
                  <SortTh
                    label={t("purchase.colDemand", "ຄວາມຕ້ອງການ")}
                    active={sort.key === "demand_qty"}
                    dir={sort.dir}
                    onClick={() => toggleSort("demand_qty")}
                    className="w-32 text-right"
                  />
                  <SortTh
                    label={t("purchase.colStock", "ສະຕັອກຄົງເຫຼືອ")}
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
                  {canCreate && <th className={`${thCls} w-28 text-right`}>{t("common.actions", "ການດຳເນີນ")}</th>}
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={canCreate ? 8 : 7} className="px-4 py-12 text-center text-[var(--text-mute)]">
                      <Loader2 size={20} className="mx-auto animate-spin" />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={canCreate ? 8 : 7} className="px-4 py-12 text-center text-[12.5px] text-[var(--text-mute)]">
                      {tab === "shortfall" ? t("purchase.allCovered", "ສະຕັອກພຽງພໍທຸກລາຍການ") : t("purchase.noItems", "ບໍ່ມີລາຍການ")}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.item_code} className={trHover}>
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
                      <td className={`${tdCls} text-right font-semibold tabular-nums text-[var(--text)]`}>{n(r.demand_qty)}</td>
                      <td
                        className={`${tdCls} text-right font-semibold tabular-nums ${
                          r.stock_qty >= r.demand_qty ? "text-[var(--success)]" : "text-[var(--text-soft)]"
                        }`}
                      >
                        {n(r.stock_qty)}
                      </td>
                      <td className={`${tdCls} text-right tabular-nums ${r.ordered_qty > 0 ? "text-[var(--warning)]" : "text-[var(--text-mute)]"}`}>
                        {n(r.ordered_qty)}
                      </td>
                      <td className={`${tdCls} text-right`}>
                        {r.unit_mismatch ? (
                          <Pill tone="amber">{t("inventory.unitMismatch", "ຫົວໜ່ວຍບໍ່ຕົງ")}</Pill>
                        ) : (r.shortfall_qty ?? 0) > 0 ? (
                          <span className="font-black tabular-nums text-[var(--danger)]">{n(r.shortfall_qty)}</span>
                        ) : (
                          <Pill tone="green">
                            <CheckCircle2 size={11} className="mr-1 inline" />
                            {t("purchase.enough", "ພຽງພໍ")}
                          </Pill>
                        )}
                      </td>
                      {canCreate && (
                        <td className={`${tdCls} text-right`}>
                          <Btn
                            variant="outline"
                            disabled={r.unit_mismatch}
                            title={r.unit_mismatch ? t("inventory.unitMismatchHint", "ແກ້ຫົວໜ່ວຍໃຫ້ຕົງກັບ SML ກ່ອນ") : undefined}
                            onClick={() => setOrder({ row: r, qty: String(Math.ceil(r.shortfall_qty ?? 0) || 1), supplier: "", note: "" })}
                          >
                            <ShoppingCart size={13} /> {t("purchase.order", "ສັ່ງຊື້")}
                          </Btn>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
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
        {t(
          "purchase.footnote",
          "ຄວາມຕ້ອງການ = BOQ ຂອງໂຄງການທີ່ຍັງບໍ່ປິດ − ທີ່ເບີກອອກໄປແລ້ວ · ຕ້ອງຊື້ເພີ່ມ = ຄວາມຕ້ອງການ − ສະຕັອກ − ທີ່ສັ່ງຊື້ໄປແລ້ວ",
        )}
      </p>

      {order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => !saving && setOrder(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" />
          <Card className="relative w-full max-w-md p-5">
            <div className="mb-4 flex items-start justify-between gap-3" onClick={(e) => e.stopPropagation()}>
              <div className="min-w-0">
                <h3 className="text-[15px] font-black text-[var(--text)]">{t("purchase.newOrder", "ບັນທຶກການສັ່ງຊື້")}</h3>
                <p className="mt-1 truncate text-[12px] text-[var(--text-mute)]">{order.row.item_name || order.row.item_code}</p>
              </div>
              <button onClick={() => setOrder(null)} className="text-[var(--text-mute)] hover:text-[var(--text)]">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="grid grid-cols-3 gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] p-3 text-center">
                <Mini label={t("purchase.colDemand", "ຄວາມຕ້ອງການ")} value={n(order.row.demand_qty)} />
                <Mini label={t("purchase.colStock", "ສະຕັອກ")} value={n(order.row.stock_qty)} />
                <Mini label={t("purchase.colShortfall", "ຕ້ອງຊື້")} value={n(order.row.shortfall_qty)} tone="danger" />
              </div>

              <Field label={`${t("purchase.colQty", "ຈຳນວນ")} (${order.row.unit || "-"})`} required>
                <input
                  className={inputCls}
                  type="number"
                  min={0}
                  value={order.qty}
                  onChange={(e) => setOrder({ ...order, qty: e.target.value })}
                  autoFocus
                />
              </Field>
              <Field label={t("purchase.colSupplier", "ຜູ້ສະໜອງ")}>
                <input className={inputCls} value={order.supplier} onChange={(e) => setOrder({ ...order, supplier: e.target.value })} />
              </Field>
              <Field label={t("common.note", "ໝາຍເຫດ")}>
                <input className={inputCls} value={order.note} onChange={(e) => setOrder({ ...order, note: e.target.value })} />
              </Field>

              <div className="flex gap-2 pt-1">
                <Btn variant="outline" className="flex-1" onClick={() => setOrder(null)} disabled={saving}>
                  {t("common.cancel", "ຍົກເລີກ")}
                </Btn>
                <Btn variant="go" className="flex-1" onClick={submitOrder} disabled={saving || !(Number(order.qty) > 0)}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <ShoppingCart size={14} />}
                  {t("purchase.saveOrder", "ບັນທຶກ")}
                </Btn>
              </div>
            </div>
          </Card>
        </div>
      )}
    </Page>
  );
}

function Mini({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "danger" }) {
  return (
    <div>
      <div className="text-[10px] font-bold tracking-wider text-[var(--text-mute)]">{label}</div>
      <div className={`text-[15px] font-black tabular-nums ${tone === "danger" ? "text-[var(--danger)]" : "text-[var(--text)]"}`}>{value}</div>
    </div>
  );
}
