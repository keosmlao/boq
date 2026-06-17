"use client";

/**
 * Inventory item detail — remaining stock balance for one item, from the ERP
 * function sml_ic_function_stock_balance_warehouse_location() via getStockBalance().
 * Shows the total on-hand plus a per-warehouse / location breakdown.
 */
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Boxes, Loader2, Package, Layers, Ruler, Warehouse, MapPin } from "lucide-react";
import { Page } from "../../_components/ui";
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

  return (
    <Page max="max-w-[820px]">
      <button
        onClick={() => router.push("/inventory")}
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-bold text-slate-500 transition hover:text-blue-600"
      >
        <ArrowLeft size={15} /> {t("inventory.backToList", "ກັບໄປລາຍການສິນຄ້າ")}
      </button>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-slate-400">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-3xl border border-rose-200 bg-white px-6 text-center text-xs font-semibold text-rose-600">
          <Boxes size={32} className="text-rose-300" />
          <span>{t("inventory.cannotLoadBalance", "ບໍ່ສາມາດໂຫຼດຍອດຄົງເຫຼືອໄດ້")}</span>
          <span className="font-mono text-[11px] font-medium text-rose-400">{error}</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-3xl border border-slate-200 bg-white text-xs font-semibold text-slate-400">
          <Boxes size={32} className="text-slate-300" />
          {t("inventory.noBalanceFor", "ບໍ່ພົບຂໍ້ມູນຄงเหลือ ສຳລับ")} &quot;{code}&quot;
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="mb-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-start gap-4">
              <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Package size={26} />
              </span>
              <div className="min-w-0 flex-1">
                <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[12px] font-bold text-slate-700">{code}</span>
                <h1 className="mt-2 text-lg font-black leading-snug text-slate-900">{summary.name || t("inventory.noName", "(ບໍ່ມີຊື່)")}</h1>
                {summary.unit && (
                  <p className="mt-1 flex items-center gap-1.5 text-[12px] font-semibold text-slate-400">
                    <Ruler size={13} /> {t("inventory.unit", "ໜ່ວຍ")}: <span className="text-slate-600">{summary.unit}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Total balance */}
          <div className="mb-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="mb-4 flex items-center gap-2 text-[13px] font-black text-slate-800">
              <Layers size={16} className="text-emerald-600" /> {t("inventory.totalOnHand", "ສິນຄ້າຄົງເຫຼືອ (ລວມທຸກคลัง)")}
            </div>
            <div className={`flex items-end gap-2 ${negative ? "text-rose-600" : "text-slate-900"}`}>
              <span className="font-display text-5xl font-bold leading-none tabular-nums tracking-tight">{qtyFmt(summary.total)}</span>
              <span className="mb-1 text-base font-bold text-slate-400">{summary.unit}</span>
            </div>
          </div>

          {/* Breakdown by warehouse / location */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="border-b border-slate-100 px-5 py-3.5">
              <h2 className="text-[12.5px] font-black text-slate-800">{t("inventory.breakdownByWarehouse", "ແຍກຕາມຄลัง / ที่เก็บ")}</h2>
            </div>
            {summary.breakdown.length === 0 ? (
              <div className="px-5 py-10 text-center text-xs font-semibold text-slate-400">{t("inventory.noBalanceAnyWarehouse", "ບໍ່ມีຍอดຄงเหลือในคลังใด")}</div>
            ) : (
              <table className="min-w-full border-separate border-spacing-0 text-[12.5px]">
                <thead>
                  <tr>
                    <th className="border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{t("inventory.warehouse", "ຄลัง")}</th>
                    <th className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{t("inventory.location", "ที่เก็บ")}</th>
                    <th className="border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-right text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{t("inventory.balance", "ຄงเหลือ")}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.breakdown.map((r, i) => {
                    const neg = Number(r.balance_qty) < 0;
                    return (
                      <tr key={i} className="transition-colors odd:bg-white even:bg-slate-50/40 hover:bg-blue-50/40">
                        <td className="border-b border-slate-100 px-5 py-2.5 font-semibold text-slate-700">
                          <span className="inline-flex items-center gap-1.5">
                            <Warehouse size={13} className="text-slate-400" /> {r.wherehouse || "-"}
                          </span>
                        </td>
                        <td className="border-b border-slate-100 px-4 py-2.5 text-slate-500">
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin size={12} className="text-slate-300" /> {r.colation || "-"}
                          </span>
                        </td>
                        <td className={`border-b border-slate-100 px-5 py-2.5 text-right font-black tabular-nums ${neg ? "text-rose-600" : "text-slate-900"}`}>
                          {qtyFmt(r.balance_qty)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </Page>
  );
}
