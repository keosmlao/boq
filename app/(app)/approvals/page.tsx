"use client";

/** Cross-module approval inbox — every document waiting for approval, grouped. */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, FileSignature, ListChecks, Repeat, CheckCircle2, RefreshCw, ChevronRight } from "lucide-react";
import { getApprovalSummary, type ApprovalSummary, type ApprovalItem } from "@/_actions/approvals";
import { Page } from "../_components/ui";
import { useT } from "@/_lib/i18n";

export default function ApprovalsPage() {
  const t = useT();
  const router = useRouter();
  const [data, setData] = useState<ApprovalSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getApprovalSummary();
      setData(res.success ? res.data : null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const groups: { key: keyof ApprovalSummary; label: string; icon: React.ReactNode; tone: string }[] = [
    { key: "quotations", label: t("approvals.quotations", "ໃບສະເໜີລາຄາ"), icon: <FileText size={15} />, tone: "text-blue-600 bg-blue-50" },
    { key: "contracts", label: t("approvals.contracts", "ສັນຍາ"), icon: <FileSignature size={15} />, tone: "text-violet-600 bg-violet-50" },
    { key: "boq", label: "BOQ", icon: <ListChecks size={15} />, tone: "text-cyan-600 bg-cyan-50" },
    { key: "substitutes", label: t("approvals.substitutes", "ການປ່ຽນສິນຄ້າ (ໃບເບີກ)"), icon: <Repeat size={15} />, tone: "text-amber-600 bg-amber-50" },
  ];

  const total = data?.total ?? 0;

  return (
    <Page max="max-w-none w-full">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 md:text-2xl">{t("approvals.title", "ເອກະສານລໍຖ້າອະນຸມັດ")}</h1>
          <p className="mt-1 text-xs font-medium text-slate-400">{t("approvals.subtitle", "ລວມເອກະສານທີ່ຕ້ອງອະນຸມັດ ຈາກທຸກໂມດູນ")} · {total} {t("approvals.items", "ລາຍການ")}</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-60">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Summary stat row */}
      {!loading && total > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {groups.map((g) => {
            const c = ((data?.[g.key] as ApprovalItem[]) ?? []).length;
            return (
              <div key={`stat-${g.key}`} className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${g.tone}`}>{g.icon}</span>
                <div className="min-w-0">
                  <div className="text-[18px] font-black leading-none text-slate-900">{c}</div>
                  <div className="mt-1 truncate text-[10.5px] font-semibold text-slate-400">{g.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center gap-3 text-slate-400">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
        </div>
      ) : total === 0 ? (
        <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-slate-400">
          <CheckCircle2 className="h-9 w-9 text-emerald-300" />
          <span className="text-sm font-semibold">{t("approvals.allClear", "ບໍ່ມີເອກະສານລໍຖ້າອະນຸມັດ")}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {groups.map((g) => {
            const items = (data?.[g.key] as ApprovalItem[]) ?? [];
            if (!items.length) return null;
            return (
              <div key={g.key} className="flex flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-2xs">
                <div className="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${g.tone}`}>{g.icon}</span>
                  <span className="text-[13px] font-bold text-slate-800">{g.label}</span>
                  <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">{items.length}</span>
                </div>
                <div className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto">
                  {items.map((it) => (
                    <button
                      key={`${it.type}-${it.id}`}
                      onClick={() => router.push(it.href)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50/70"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-[12.5px] font-semibold text-slate-800">{it.title}</span>
                        {it.subtitle && <span className="block truncate text-[11px] text-slate-400">{it.subtitle}</span>}
                      </span>
                      <ChevronRight size={15} className="flex-shrink-0 text-slate-300" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}
