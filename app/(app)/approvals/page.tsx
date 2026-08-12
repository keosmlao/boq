"use client";

/**
 * Cross-module approval inbox (ODIEN SERVICE layout): stat row → toolbar →
 * module tabs → one table. Every document waiting for approval, wherever it
 * came from, in the order it should be worked through.
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, FileSignature, ListChecks, Repeat, PackageOpen, CheckCircle2, RefreshCw, ChevronRight, Loader2, Search } from "lucide-react";
import { getApprovalSummary, type ApprovalSummary, type ApprovalItem } from "@/_actions/approvals";
import {
  Btn,
  Card,
  Page,
  PageHeader,
  Pill,
  RowBar,
  RowBarTh,
  Segmented,
  Stat,
  Toolbar,
  TwoLine,
  tblCls,
  tdCls,
  thCls,
  trHover,
  type PillTone,
} from "../_components/ui";
import { useT } from "@/_lib/i18n";

type GroupTone = "blue" | "indigo" | "cyan" | "amber" | "rose";
type BarTone = "info" | "brand" | "success" | "warning" | "danger";

const GROUP_PILL: Record<GroupTone, PillTone> = {
  blue: "blue",
  indigo: "indigo",
  cyan: "cyan",
  amber: "amber",
  rose: "red",
};

export default function ApprovalsPage() {
  const t = useT();
  const router = useRouter();
  const [data, setData] = useState<ApprovalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [draftQ, setDraftQ] = useState("");
  const [q, setQ] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");

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

  const groups: { key: keyof ApprovalSummary; label: string; icon: React.ReactNode; tone: GroupTone; bar: BarTone }[] = [
    { key: "quotations", label: t("approvals.quotations", "ໃບສະເໜີລາຄາ"), icon: <FileText size={15} />, tone: "blue", bar: "info" },
    { key: "contracts", label: t("approvals.contracts", "ສັນຍາ"), icon: <FileSignature size={15} />, tone: "indigo", bar: "brand" },
    { key: "boq", label: "BOQ", icon: <ListChecks size={15} />, tone: "cyan", bar: "success" },
    { key: "substitutes", label: t("approvals.substitutes", "ການປ່ຽນສິນຄ້າ (ໃບເບີກ)"), icon: <Repeat size={15} />, tone: "amber", bar: "warning" },
    { key: "appRequests", label: t("approvals.appRequests", "ລໍຖ້າອອກໃບຂໍເບີກ"), icon: <PackageOpen size={15} />, tone: "rose", bar: "danger" },
  ];

  const total = data?.total ?? 0;

  /** Every pending document as one flat list, tagged with the group it came from. */
  const allItems = useMemo(
    () =>
      groups.flatMap((g) =>
        ((data?.[g.key] as ApprovalItem[]) ?? []).map((it) => ({ ...it, group: String(g.key), groupLabel: g.label, tone: g.tone, bar: g.bar })),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, t],
  );

  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return allItems.filter((it) => {
      if (activeTab !== "all" && it.group !== activeTab) return false;
      if (!kw) return true;
      return `${it.title} ${it.subtitle ?? ""}`.toLowerCase().includes(kw);
    });
  }, [allItems, activeTab, q]);

  const tabs = [
    { value: "all", label: t("common.all", "ທັງໝົດ"), count: allItems.length },
    ...groups.map((g) => ({ value: String(g.key), label: g.label, count: ((data?.[g.key] as ApprovalItem[]) ?? []).length })),
  ];

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
              active={activeTab === String(g.key)}
              onClick={() => setActiveTab(activeTab === String(g.key) ? "all" : String(g.key))}
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
        <>
          <Toolbar>
            <label className="flex h-9 min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3">
              <Search size={15} className="text-[var(--text-mute)]" />
              <input
                value={draftQ}
                onChange={(e) => setDraftQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setQ(draftQ)}
                placeholder={t("approvals.searchPlaceholder", "ຄົ້ນຫາ ເລກທີ່, ໂຄງການ...")}
                className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-mute)]"
              />
            </label>
            <Btn variant="ink" onClick={() => setQ(draftQ)}>
              <Search size={14} /> {t("common.search", "ຄົ້ນຫາ")}
            </Btn>
          </Toolbar>

          <div className="mb-4 overflow-x-auto">
            <Segmented
              value={activeTab}
              onChange={setActiveTab}
              options={tabs.map((tab) => ({
                value: tab.value,
                label: (
                  <span className="flex items-center gap-1.5">
                    {tab.label}
                    <span className="rounded-full bg-black/10 px-1.5 text-[10px] font-black dark:bg-white/15">{tab.count}</span>
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
                    <th className={thCls}>{t("approvals.colDocument", "ເອກະສານ")}</th>
                    <th className={`${thCls} w-56`}>{t("approvals.colModule", "ໂມດູນ")}</th>
                    <th className={`${thCls} w-12`} />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-[12.5px] text-[var(--text-mute)]">
                        {t("approvals.noneInTab", "ບໍ່ມີເອກະສານໃນໝວດນີ້")}
                      </td>
                    </tr>
                  ) : (
                    rows.map((it) => (
                      <tr
                        key={`${it.type}-${it.id}`}
                        onClick={() => router.push(it.href)}
                        className={`${trHover} cursor-pointer`}
                      >
                        <RowBar tone={it.bar} />
                        <td className={tdCls}>
                          <TwoLine primary={<span className="font-mono">{it.title}</span>} secondary={it.subtitle} />
                        </td>
                        <td className={tdCls}>
                          <Pill tone={GROUP_PILL[it.tone]}>{it.groupLabel}</Pill>
                        </td>
                        <td className={`${tdCls} text-right`}>
                          <ChevronRight size={15} className="inline text-[var(--text-mute)]" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </Page>
  );
}
