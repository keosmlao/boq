"use client";

/**
 * Reports & analytics — aggregates the existing project / revenue / sales stat
 * actions into one overview. Data is fetched on the SERVER in page.tsx and
 * passed in via props, so there is no mount→useEffect→Promise.all waterfall.
 */
import { useMemo, useState } from "react";
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
import { Page, PageHeader, Card, Pill, SectionHeader, SectionTitle, Stat } from "../_components/ui";
import { useT } from "@/_lib/i18n";

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

/** Divider / chip tint that reads correctly on the ink slab in both themes. */
const onInk = (pct: number) => `color-mix(in srgb, var(--ink-text) ${pct}%, transparent)`;

function GrowthPill({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <Pill tone={up ? "green" : "red"}>
      <span className="inline-flex items-center gap-1">
        {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
        {Math.abs(value)}%
      </span>
    </Pill>
  );
}

export default function ReportsClient({
  initialStats,
  initialRevenue,
  initialSales,
}: {
  initialStats: any;
  initialRevenue: any;
  initialSales: any;
}) {
  const t = useT();
  const [dash] = useState<Dash | null>(initialStats ?? null);
  const [rev] = useState<Rev | null>(initialRevenue ?? null);
  const [sales] = useState<Sales | null>(initialSales ?? null);
  const [loading] = useState(false);

  const statusBars = useMemo(() => {
    const entries = Object.entries(dash?.byStatus || {});
    const total = entries.reduce((s, [, v]) => s + v, 0);
    const max = Math.max(1, ...entries.map(([, v]) => v));
    return entries
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({
        label,
        value,
        pct: Math.round((value / max) * 100),
        share: total ? Math.round((value / total) * 100) : 0,
      }));
  }, [dash]);

  return (
    <Page max="max-w-none w-full">
      <PageHeader title={t("reports.title", "ລາຍງານ & ສະຖິຕິ")} subtitle={t("reports.subtitle", "ພາບລວມໂຄງການ, ລາຍຮັບ ແລະ ການຂາຍ")} />

      {/* Project counters */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={<FolderKanban size={18} />} label={t("reports.totalProjects", "ໂຄງການທັງໝົດ")} value={loading ? "—" : dash?.total ?? 0} />
        <Stat icon={<TrendingUp size={18} />} label={t("reports.active", "ກຳລັງດຳເນີນ")} value={loading ? "—" : dash?.active ?? 0} />
        <Stat icon={<CheckCircle size={18} />} label={t("reports.completed", "ປິດແລ້ວ")} value={loading ? "—" : dash?.completed ?? 0} />
        <Stat icon={<Clock size={18} />} label={t("reports.pending", "ລໍຖ້າອະນຸມັດ")} value={loading ? "—" : dash?.pending ?? 0} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Revenue + sales */}
        <div className="space-y-6 xl:col-span-4">
          {/* Revenue hero — ink slab */}
          <div className="overflow-hidden rounded-xl bg-[var(--ink)] p-6 text-[var(--ink-text)] shadow-[var(--shadow-md)]">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: onInk(12) }}>
                <Wallet size={18} />
              </div>
              <span className="text-[12px] font-bold tracking-wider opacity-70">{t("reports.revenueContract", "ລາຍຮັບ (ສັນຍາ)")}</span>
            </div>
            {loading ? (
              <div className="mt-5 h-9 w-40 animate-pulse rounded" style={{ background: onInk(16) }} />
            ) : (
              <h3 className="mt-5 text-4xl font-black leading-none tracking-tight tabular-nums">
                {money(rev?.total)} <span className="text-lg font-bold opacity-60">{t("reports.kip", "ບາດ")}</span>
              </h3>
            )}
            <div className="mt-5 flex items-center justify-between rounded-xl px-4 py-3" style={{ background: onInk(10) }}>
              <span className="text-[12px] font-bold opacity-70">{t("reports.thisMonth", "ເດືອນນີ້")}</span>
              <span className="text-[14px] font-black tabular-nums">{money(rev?.monthly)} {t("reports.kip", "ບາດ")}</span>
            </div>
          </div>

          {/* Sales */}
          <Card className="p-5">
            <SectionHeader icon={<FileSignature size={15} />} title={t("reports.salesContract", "ການຂາຍ (ສັນຍາ)")} tone="brand" />
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                <FileSignature size={18} />
              </div>
              <div className="min-w-0">
                <span className="block text-[11px] font-semibold tracking-wider text-[var(--text-mute)]">{t("finance.totalContracts", "ສັນຍາທັງໝົດ")}</span>
                {loading ? (
                  <div className="mt-1.5 h-6 w-20 animate-pulse rounded bg-[var(--surface-sunken)]" />
                ) : (
                  <h3 className="text-2xl font-black tabular-nums text-[var(--text)]">{sales?.totalSales ?? 0}</h3>
                )}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] px-3.5 py-3">
                <span className="block text-[11px] font-bold text-[var(--text-mute)]">{t("reports.thisMonth", "ເດືອນນີ້")}</span>
                <span className="mt-1 flex items-center gap-2 text-[15px] font-black tabular-nums text-[var(--text)]">
                  {sales?.monthlySales ?? 0}
                  {!loading && sales && <GrowthPill value={sales.salesGrowth} />}
                </span>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] px-3.5 py-3">
                <span className="block text-[11px] font-bold text-[var(--text-mute)]">{t("reports.lastMonth", "ເດືອນກ່ອນ")}</span>
                <span className="mt-1 block text-[15px] font-black tabular-nums text-[var(--text)]">{sales?.lastMonthSales ?? 0}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Status breakdown */}
        <Card className="flex flex-col p-6 xl:col-span-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <SectionTitle label={t("reports.projectsByStatus", "ໂຄງການແຍກຕາມສະຖານະ")} />
            </div>
            {!loading && dash && (
              <Pill tone="neutral">{dash.total} {t("reports.totalProjects", "ໂຄງການທັງໝົດ")}</Pill>
            )}
          </div>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-xl bg-[var(--surface-sunken)]" />
              ))}
            </div>
          ) : statusBars.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-16 text-xs font-semibold text-[var(--text-mute)]">
              <div className="flex flex-col items-center gap-2">
                <BarChart3 size={28} />
                {t("common.noData", "ຍັງບໍ່ມີຂໍ້ມູນ")}
              </div>
            </div>
          ) : (
            <div className="flex-1 space-y-4">
              {statusBars.map((s) => (
                <div key={s.label}>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="truncate text-[13px] font-bold text-[var(--text-soft)]">{s.label}</span>
                    <span className="flex flex-shrink-0 items-baseline gap-1.5">
                      <span className="text-[14px] font-black tabular-nums text-[var(--text)]">{s.value}</span>
                      <span className="text-[11px] font-bold text-[var(--text-mute)]">· {s.share}%</span>
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                    <div
                      className="h-full rounded-full bg-[var(--brand)] transition-all duration-700 ease-out"
                      style={{ width: `${s.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Monthly performance footer */}
          {!loading && dash && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] px-5 py-4">
              <div>
                <span className="block text-[11px] font-semibold tracking-wider text-[var(--text-mute)]">{t("reports.contractsThisVsLast", "ສັນຍາ ເດືອນນີ້ vs ເດືອນກ່ອນ")}</span>
                <span className="text-base font-black tabular-nums text-[var(--text)]">
                  {dash.performance.thisMonth} <span className="text-[var(--text-mute)]">/</span> {dash.performance.lastMonth}
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
