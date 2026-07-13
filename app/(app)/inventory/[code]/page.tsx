"use client";

/**
 * Inventory item detail — remaining stock balance for one item, from the ERP
 * function sml_ic_function_stock_balance_warehouse_location() via getStockBalance().
 * Shows the total on-hand plus a per-warehouse / location breakdown.
 */
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Boxes, Loader2, Layers, Ruler, Warehouse, MapPin } from "lucide-react";
import { Page, PageHeader, Card, Btn, Pill, SectionHeader, tblCls, thCls, tdCls, trHover } from "../../_components/ui";
import { getStockBalance } from "@/_actions/lookups";
import { useT } from "@/_lib/i18n";

const qtyFmt = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "-";
};

type BalRow = {
  ic_code?: string;
  ic_name?: string;
  wherehouse?: string;
  colation?: string;
  balance_qty?: unknown;
  ic_unit_code?: string;
  [k: string]: unknown;
};

export default function InventoryDetailPage() {
  const t = useT();
  const router = useRouter();
  const params = useParams();
  const code = decodeURIComponent(String(params?.code ?? ""));
  const [rows, setRows] = useState<BalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res: any = await getStockBalance(code);
        if (res?.success) {
          setRows(res.data || []);
        } else if (Array.isArray(res)) {
          setRows(res);
        } else {
          setRows([]);
          setError(res?.message || t("inventory.loadBalanceError", "Unable to load stock balance"));
        }
      } catch (e) {
        setRows([]);
        setError(e instanceof Error ? e.message : t("inventory.loadBalanceError", "Unable to load stock balance"));
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  const summary = useMemo(() => {
    let total = 0;
    for (const r of rows) total += Number(r.balance_qty) || 0;
    const name = rows.find((r) => r.ic_name)?.ic_name || "";
    const unit = rows.find((r) => r.ic_unit_code)?.ic_unit_code || "";
    // Only rows with a non-zero balance are worth listing.
    const breakdown = rows
      .filter((r) => Number(r.balance_qty) !== 0)
      .sort((a, b) => Number(b.balance_qty) - Number(a.balance_qty));
    return { total, name, unit, breakdown };
  }, [rows]);

  const negative = summary.total < 0;
  const inStock = summary.total > 0;
  const subtitle = [code, summary.unit ? `${t("inventory.unit", "ໜ່ວຍ")}: ${summary.unit}` : ""].filter(Boolean).join(" · ");

  return (
    <Page max="max-w-[1100px]">
      <PageHeader
        title={summary.name || code || t("inventory.noName", "(ບໍ່ມີຊື່)")}
        subtitle={subtitle || undefined}
        actions={
          <>
            {!loading && !error && rows.length > 0 && (
              <Pill tone={negative ? "red" : inStock ? "green" : "neutral"}>
                {inStock ? t("inventory.filterInStock", "ມີສະຕັອກ") : t("inventory.filterOutOfStock", "ໝົດສະຕັອກ")}
              </Pill>
            )}
            <Btn variant="outline" onClick={() => router.push("/inventory")}>
              <ArrowLeft size={14} /> {t("inventory.backToList", "ກັບໄປລາຍການສິນຄ້າ")}
            </Btn>
          </>
        }
      />

      {loading ? (
        <Card className="flex h-64 items-center justify-center gap-2.5 text-[var(--text-mute)]">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-[13px] font-semibold">{t("common.loading", "ກຳລັງໂຫຼດ...")}</span>
        </Card>
      ) : error ? (
        <Card className="flex h-64 flex-col items-center justify-center gap-2 px-6 text-center">
          <Boxes size={32} className="text-[var(--danger)]" />
          <span className="text-[12.5px] font-semibold text-[var(--danger)]">{t("inventory.cannotLoadBalance", "ບໍ່ສາມາດໂຫຼດຍອດຄົງເຫຼືອໄດ້")}</span>
          <span className="font-mono text-[11px] text-[var(--text-mute)]">{error}</span>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="flex h-64 flex-col items-center justify-center gap-2 text-[12.5px] font-semibold text-[var(--text-mute)]">
          <Boxes size={32} className="text-[var(--text-mute)]" />
          {t("inventory.noBalanceFor", "ບໍ່ພົບຂໍ້ມູນຄົງເຫຼືອ ສຳລັບ")} &quot;{code}&quot;
        </Card>
      ) : (
        <>
          {/* Total balance */}
          <Card className="mb-4 p-5">
            <SectionHeader icon={<Layers size={14} />} title={t("inventory.totalOnHand", "ສິນຄ້າຄົງເຫຼືອ (ລວມທຸກສາງ)")} tone="emerald" />
            <div className="flex items-end gap-2">
              <span
                className={`text-4xl font-black leading-none tabular-nums tracking-tight ${
                  negative ? "text-[var(--danger)]" : "text-[var(--text)]"
                }`}
              >
                {qtyFmt(summary.total)}
              </span>
              {summary.unit && (
                <span className="mb-1 inline-flex items-center gap-1 text-[12.5px] font-bold text-[var(--text-mute)]">
                  <Ruler size={13} /> {summary.unit}
                </span>
              )}
            </div>
          </Card>

          {/* Breakdown by warehouse / location */}
          <Card className="overflow-hidden">
            <div className="border-b border-[var(--border-soft)] px-5 pt-5">
              <SectionHeader icon={<Warehouse size={14} />} title={t("inventory.breakdownByWarehouse", "ແຍກຕາມສາງ / ທີ່ເກັບ")} tone="brand" />
            </div>
            {summary.breakdown.length === 0 ? (
              <div className="px-5 py-10 text-center text-[12.5px] font-semibold text-[var(--text-mute)]">
                {t("inventory.noBalanceAnyWarehouse", "ບໍ່ມີຍອດຄົງເຫຼືອໃນສາງໃດ")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className={tblCls}>
                  <thead>
                    <tr>
                      <th className={`${thCls} pl-5`}>{t("inventory.warehouse", "ສາງ")}</th>
                      <th className={thCls}>{t("inventory.location", "ທີ່ເກັບ")}</th>
                      <th className={`${thCls} w-36 pr-5 text-right`}>{t("inventory.balance", "ຄົງເຫຼືອ")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.breakdown.map((r, i) => {
                      const neg = Number(r.balance_qty) < 0;
                      return (
                        <tr key={i} className={trHover}>
                          <td className={`${tdCls} pl-5 font-semibold text-[var(--text)]`}>
                            <span className="inline-flex items-center gap-1.5">
                              <Warehouse size={13} className="text-[var(--text-mute)]" /> {r.wherehouse || "-"}
                            </span>
                          </td>
                          <td className={tdCls}>
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin size={12} className="text-[var(--text-mute)]" /> {r.colation || "-"}
                            </span>
                          </td>
                          <td
                            className={`${tdCls} pr-5 text-right font-bold tabular-nums ${
                              neg ? "text-[var(--danger)]" : "text-[var(--text)]"
                            }`}
                          >
                            {qtyFmt(r.balance_qty)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </Page>
  );
}
