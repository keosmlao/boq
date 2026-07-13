"use client";

/** Cross-module approval inbox — every document waiting for approval, grouped. */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, FileSignature, ListChecks, Repeat, PackageOpen, CheckCircle2, RefreshCw, ChevronRight, Loader2 } from "lucide-react";
import { getApprovalSummary, type ApprovalSummary, type ApprovalItem } from "@/_actions/approvals";
import { Btn, Card, Page, PageHeader, Pill, SectionHeader, Stat } from "../_components/ui";
import { useT } from "@/_lib/i18n";

type GroupTone = "blue" | "indigo" | "cyan" | "amber" | "rose";

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

  const groups: { key: keyof ApprovalSummary; label: string; icon: React.ReactNode; tone: GroupTone }[] = [
    { key: "quotations", label: t("approvals.quotations", "ໃບສະເໜີລາຄາ"), icon: <FileText size={15} />, tone: "blue" },
    { key: "contracts", label: t("approvals.contracts", "ສັນຍາ"), icon: <FileSignature size={15} />, tone: "indigo" },
    { key: "boq", label: "BOQ", icon: <ListChecks size={15} />, tone: "cyan" },
    { key: "substitutes", label: t("approvals.substitutes", "ການປ່ຽນສິນຄ້າ (ໃບເບີກ)"), icon: <Repeat size={15} />, tone: "amber" },
    { key: "appRequests", label: t("approvals.appRequests", "ລໍຖ້າອອກໃບຂໍເບີກ"), icon: <PackageOpen size={15} />, tone: "rose" },
  ];

  const total = data?.total ?? 0;

  return (
    <Page max="max-w-none w-full">
      <PageHeader
        title={t("approvals.title", "ເອກະສານລໍຖ້າອະນຸມັດ")}
        subtitle={`${t("approvals.subtitle", "ລວມເອກະສານທີ່ຕ້ອງອະນຸມັດ ຈາກທຸກໂມດູນ")} · ${total} ${t("approvals.items", "ລາຍການ")}`}
        actions={
          <Btn variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {t("common.reload", "ໂຫຼດໃໝ່")}
          </Btn>
        }
      />

      {/* Summary stat row */}
      {!loading && total > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {groups.map((g) => (
            <Stat
              key={`stat-${g.key}`}
              icon={g.icon}
              label={g.label}
              value={((data?.[g.key] as ApprovalItem[]) ?? []).length}
            />
          ))}
        </div>
      )}

      {loading ? (
        <Card className="flex h-48 items-center justify-center gap-2 text-[var(--text-mute)]">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm font-semibold">{t("common.loading", "ກຳລັງໂຫຼດ...")}</span>
        </Card>
      ) : total === 0 ? (
        <Card className="flex h-56 flex-col items-center justify-center gap-2 text-[var(--text-mute)]">
          <CheckCircle2 className="h-9 w-9 text-[var(--success)]" />
          <span className="text-sm font-semibold">{t("approvals.allClear", "ບໍ່ມີເອກະສານລໍຖ້າອະນຸມັດ")}</span>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {groups.map((g) => {
            const items = (data?.[g.key] as ApprovalItem[]) ?? [];
            if (!items.length) return null;
            return (
              <Card key={g.key} className="flex flex-col overflow-hidden">
                <div className="flex items-center gap-2 border-b border-[var(--border-soft)] bg-[var(--surface-sunken)] px-4 py-2.5">
                  <SectionHeader icon={g.icon} title={g.label} tone={g.tone} className="mb-0" />
                  <span className="ml-auto"><Pill tone="amber">{items.length}</Pill></span>
                </div>
                <div className="max-h-[420px] overflow-y-auto">
                  {items.map((it) => (
                    <button
                      key={`${it.type}-${it.id}`}
                      onClick={() => router.push(it.href)}
                      className="flex w-full items-center gap-3 border-b border-[var(--border-soft)] px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-[var(--brand-tint)]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-[12.5px] font-semibold text-[var(--text)]">{it.title}</span>
                        {it.subtitle && <span className="block truncate text-[11px] text-[var(--text-mute)]">{it.subtitle}</span>}
                      </span>
                      <ChevronRight size={15} className="flex-shrink-0 text-[var(--text-mute)]" />
                    </button>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Page>
  );
}
