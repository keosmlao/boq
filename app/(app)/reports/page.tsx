"use client";

/**
 * Reports & analytics — aggregates the existing project / revenue / sales stat
 * actions into one overview. All data is real (server actions hitting the ERP).
 */
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  FolderKanban,
  TrendingUp,
  Clock,
  CheckCircle,
  Wallet,
  FileSignature,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Page, PageHeader, Card, SectionTitle } from "../_components/ui";
import { getProjectDashboardStats, getProjectRevenueStats } from "@/_actions/projects";
import { getSalesStatsAction } from "@/_actions/auth";

const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "0";
};

type Dash = {
  total: number;
  active: number;
  completed: number;
  pending: number;
  byStatus: Record<string, number>;
  performance: { thisMonth: number; lastMonth: number; growth: number };
};
type Rev = { total: number; monthly: number };
type Sales = { totalSales: number; monthlySales: number; lastMonthSales: number; salesGrowth: number };

function StatTile({
  icon,
  label,
  value,
  tone = "slate",
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: "slate" | "blue" | "emerald" | "amber";
  loading?: boolean;
}) {
  const chip: Record<string, string> = {
    slate: "bg-slate-100 text-slate-500",
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-4">
      <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${chip[tone]}`}>{icon}</div>
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

function GrowthPill({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-extrabold ${
        up ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
      }`}
    >
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {Math.abs(value)}%
    </span>
  );
}

export default function ReportsPage() {
  const [dash, setDash] = useState<Dash | null>(null);
  const [rev, setRev] = useState<Rev | null>(null);
  const [sales, setSales] = useState<Sales | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [d, r, s] = await Promise.all([
          getProjectDashboardStats(),
          getProjectRevenueStats(),
          getSalesStatsAction(),
        ]);
        if ((d as any)?.success) setDash(d as any);
        if ((r as any)?.success) setRev(r as any);
        if ((s as any)?.success) setSales(s as any);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const statusBars = useMemo(() => {
    const entries = Object.entries(dash?.byStatus || {});
    const max = Math.max(1, ...entries.map(([, v]) => v));
    return entries
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value, pct: Math.round((value / max) * 100) }));
  }, [dash]);

  return (
    <Page>
      <PageHeader title="ລາຍງານ & ສະຖິຕິ" subtitle="ພາບລວມໂຄງການ, ລາຍຮັບ ແລະ ການຂາຍ" />

      {/* Project counters */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile loading={loading} tone="blue" icon={<FolderKanban size={18} />} label="ໂຄງການທັງໝົດ" value={dash?.total ?? 0} />
        <StatTile loading={loading} tone="emerald" icon={<TrendingUp size={18} />} label="ກຳລັງດຳເນີນ" value={dash?.active ?? 0} />
        <StatTile loading={loading} tone="slate" icon={<CheckCircle size={18} />} label="ປິດແລ້ວ" value={dash?.completed ?? 0} />
        <StatTile loading={loading} tone="amber" icon={<Clock size={18} />} label="ລໍຖ້າອະນຸມັດ" value={dash?.pending ?? 0} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Revenue + sales */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="p-5">
            <SectionTitle label="ລາຍຮັບ (ສັນຍາ)" />
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Wallet size={18} />
              </div>
              <div className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">ລວມທັງໝົດ</span>
                {loading ? (
                  <div className="mt-1.5 h-6 w-28 animate-pulse rounded bg-slate-200" />
                ) : (
                  <h3 className="truncate text-2xl font-black text-slate-900">
                    {money(rev?.total)} <span className="text-sm font-bold text-slate-400">ກີບ</span>
                  </h3>
                )}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5">
              <span className="text-[12px] font-bold text-slate-500">ເດືອນນີ້</span>
              <span className="text-[13px] font-black text-slate-800">{money(rev?.monthly)} ກີບ</span>
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle label="ການຂາຍ (ສັນຍາ)" />
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <FileSignature size={18} />
              </div>
              <div className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">ສັນຍາທັງໝົດ</span>
                {loading ? (
                  <div className="mt-1.5 h-6 w-20 animate-pulse rounded bg-slate-200" />
                ) : (
                  <h3 className="text-2xl font-black text-slate-900">{sales?.totalSales ?? 0}</h3>
                )}
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5">
                <span className="text-[12px] font-bold text-slate-500">ເດືອນນີ້</span>
                <span className="flex items-center gap-2 text-[13px] font-black text-slate-800">
                  {sales?.monthlySales ?? 0}
                  {!loading && sales && <GrowthPill value={sales.salesGrowth} />}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5">
                <span className="text-[12px] font-bold text-slate-500">ເດືອນກ່ອນ</span>
                <span className="text-[13px] font-black text-slate-800">{sales?.lastMonthSales ?? 0}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Status breakdown */}
        <Card className="p-5 lg:col-span-2">
          <SectionTitle label="ໂຄງການແຍກຕາມສະຖານະ" />
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-9 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : statusBars.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-xs font-semibold text-slate-400">
              <div className="flex flex-col items-center gap-2">
                <BarChart3 size={28} className="text-slate-300" />
                ຍັງບໍ່ມີຂໍ້ມູນ
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {statusBars.map((s) => (
                <div key={s.label}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="truncate text-[12px] font-bold text-slate-600">{s.label}</span>
                    <span className="text-[12px] font-black text-slate-900">{s.value}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
                      style={{ width: `${s.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Monthly performance footer */}
          {!loading && dash && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3.5">
              <div>
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">ສັນຍາ ເດືອນນີ້ vs ເດືອນກ່ອນ</span>
                <span className="text-sm font-black text-slate-800">
                  {dash.performance.thisMonth} <span className="text-slate-400">/</span> {dash.performance.lastMonth}
                </span>
              </div>
              <GrowthPill value={dash.performance.growth} />
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}
