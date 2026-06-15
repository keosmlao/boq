"use client";

/**
 * Inventory / stock browser — read-only list over the ERP `ic_inventory` table
 * via getInventory(). Full-width, searchable. Click a row to open the item and
 * see its remaining stock balance (per warehouse / location).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Boxes, Loader2, Package, Ruler, Layers, ChevronRight } from "lucide-react";
import { Page, PageHeader } from "../_components/ui";
import { getInventory } from "@/_actions/lookups";

type Item = { code?: string; name_1?: string; unit?: string; balance_qty?: unknown; [k: string]: unknown };

const qtyFmt = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "-";
};
const hasQty = (v: unknown) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));

function KpiTile({
  icon,
  label,
  value,
  tone,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone: "blue" | "amber" | "emerald";
  loading?: boolean;
}) {
  const chip: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
  };
  return (
    <div className="flex items-center gap-3.5 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ${chip[tone]}`}>{icon}</span>
      <div className="min-w-0">
        <span className="block truncate text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        {loading ? (
          <div className="mt-1.5 h-5 w-16 animate-pulse rounded bg-slate-200" />
        ) : (
          <h3 className="mt-0.5 truncate text-xl font-black leading-tight text-slate-900">{value}</h3>
        )}
      </div>
    </div>
  );
}

const LIMIT = 100;

export default function InventoryPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLoading(true);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        const res: any = await getInventory({ search: search.trim(), limit: LIMIT });
        setRows(res?.success ? res.data || [] : Array.isArray(res) ? res : []);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [search]);

  const summary = useMemo(() => {
    const s = new Set<string>();
    let totalBal = 0;
    let hasBal = false;
    for (const r of rows) {
      const u = (r.unit as string)?.trim();
      if (u) s.add(u);
      if (hasQty(r.balance_qty)) {
        hasBal = true;
        totalBal += Number(r.balance_qty);
      }
    }
    return { units: s.size, totalBal, hasBal };
  }, [rows]);

  const capped = rows.length >= LIMIT;

  const open = (c: unknown) => router.push(`/inventory/${encodeURIComponent(String(c ?? ""))}`);

  return (
    <Page max="max-w-none">
      <PageHeader
        title="ສິນຄ້າ / ສະຕັອກ"
        subtitle="ຄ້ນຫາສິນຄ້າ — ກົດເຂົ້າແຕ່ລະລາຍການເພື່ອເບິ່ງยอดຄงเหลือ ແຍກຕາມຄลัง"
      />

      {/* KPI summary */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:max-w-2xl">
        <KpiTile loading={loading} tone="blue" icon={<Package size={19} />} label="ລາຍການທີ່ສະແດງ" value={rows.length} />
        <KpiTile loading={loading} tone="emerald" icon={<Layers size={19} />} label="ຄงเหลือรวม (ສະແດງ)" value={summary.hasBal ? qtyFmt(summary.totalBal) : "—"} />
        <KpiTile loading={loading} tone="amber" icon={<Ruler size={19} />} label="ປະເພດໜ່ວຍ" value={summary.units} />
      </div>

      {/* Search + table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 transition-all focus-within:border-blue-500 focus-within:ring-3 focus-within:ring-blue-500/15">
            <Search size={16} className="flex-shrink-0 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ຄ້ນຫາ ລະຫັດ ຫຼື ຊື່ສິນຄ້າ..."
              className="min-w-0 flex-1 bg-transparent py-2.5 text-[13px] font-semibold text-slate-800 placeholder-slate-400 outline-none"
            />
            {loading && <Loader2 size={15} className="flex-shrink-0 animate-spin text-slate-400" />}
            {search && !loading && (
              <button onClick={() => setSearch("")} className="flex-shrink-0 text-[11px] font-bold text-slate-400 hover:text-slate-600">
                ລ້າງ
              </button>
            )}
          </div>
          <span className="flex-shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
            {rows.length}{capped ? "+" : ""} ລາຍການ
          </span>
        </div>

        {loading && rows.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-slate-400">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center gap-2 text-xs font-semibold text-slate-400">
            <Boxes size={32} className="text-slate-300" />
            {search ? "ບໍ່ພົບສິນຄ້າ" : "ຍັງບໍ່ມີສິນຄ້າ"}
          </div>
        ) : (
          <div className="max-h-[calc(100vh-320px)] overflow-auto">
            <table className="min-w-full border-separate border-spacing-0 text-[12.5px]">
              <thead>
                <tr>
                  <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-500">#</th>
                  <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-500">ລະຫັດ</th>
                  <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-500">ຊື່ສິນຄ້າ</th>
                  <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-center text-[10px] font-extrabold uppercase tracking-wider text-slate-500">ໜ່ວຍ</th>
                  <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-right text-[10px] font-extrabold uppercase tracking-wider text-slate-500">ຄงเหลือ</th>
                  <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-2 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={(r.code as string) ?? i}
                    onClick={() => open(r.code)}
                    className="group cursor-pointer transition-colors odd:bg-white even:bg-slate-50/40 hover:bg-blue-50/50"
                  >
                    <td className="border-b border-slate-100 px-4 py-2.5 text-[11px] font-bold text-slate-300">{i + 1}</td>
                    <td className="border-b border-slate-100 px-4 py-2.5">
                      <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11.5px] font-bold text-slate-700 group-hover:bg-blue-100 group-hover:text-blue-700">
                        {r.code || "-"}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-2.5 font-semibold text-slate-700">{r.name_1 || "-"}</td>
                    <td className="border-b border-slate-100 px-4 py-2.5 text-center">
                      <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">{(r.unit as string) || "-"}</span>
                    </td>
                    <td className={`border-b border-slate-100 px-4 py-2.5 text-right font-black tabular-nums ${hasQty(r.balance_qty) && Number(r.balance_qty) < 0 ? "text-rose-600" : "text-slate-900"}`}>
                      {hasQty(r.balance_qty) ? qtyFmt(r.balance_qty) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="border-b border-slate-100 px-2 py-2.5">
                      <ChevronRight size={15} className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {capped && (
          <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2.5 text-center text-[11px] font-semibold text-slate-400">
            ສະແດງສູງສຸດ {LIMIT} ລາຍການ — ພິມຄຳຄ້ນເພື່ອค้นหາສິນຄ້າທີ່ຕ້ອງການ
          </div>
        )}
      </div>
    </Page>
  );
}
