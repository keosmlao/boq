"use client";

/** v2 — Finance overview (read-only). Contract value + approval status, grouped
 *  by customer. (Payment installments / ງວດຈ່າຍ to come later.) */
import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  RefreshCw,
  Loader2,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Wallet,
  FileSignature,
  CheckCircle2,
  Clock,
  Inbox,
} from "lucide-react";
import { getAllContractsForList } from "@/_actions/contracts";
import { Btn, Card, Page, PageHeader, Pill, Segmented, Stat, Toolbar } from "../_components/ui";
import { useT } from "@/_lib/i18n";

const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "0";
};
const d10 = (v: unknown) => (v ? String(v).slice(0, 10) : "-");
const initial = (s: string) => s.replace(/[^\p{L}\p{N}]/u, "").charAt(0).toUpperCase() || "?";
const isFull = (c: any) => !!c.sales_approved && !!c.accounting_approved;

type Contract = Record<string, any>;

function Tag({ done }: { done: boolean }) {
  const t = useT();
  return <Pill tone={done ? "green" : "neutral"}>{done ? t("finance.complete", "ສົມບູນ") : t("finance.pendingApproval", "ລໍຖ້າອະນຸມັດ")}</Pill>;
}

export default function FinanceClient({ initialRows }: { initialRows: Contract[] }) {
  const t = useT();
  const router = useRouter();
  const FILTERS = [
    { value: "all", label: t("common.all", "ທັງໝົດ") },
    { value: "full", label: t("finance.approvedFull", "ອະນຸມັດຄົບ") },
    { value: "pending", label: t("finance.pendingApproval", "ລໍຖ້າອະນຸມັດ") },
  ];
  const [rows, setRows] = useState<Contract[]>(initialRows ?? []);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await getAllContractsForList();
      setRows(res?.success ? res.data || [] : Array.isArray(res) ? res : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const s = { total: rows.length, value: 0, full: 0, pending: 0 };
    rows.forEach((c) => {
      s.value += Number(c.total_amount) || 0;
      if (isFull(c)) s.full++;
      else s.pending++;
    });
    return s;
  }, [rows]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return rows.filter((c) => {
      if (filter === "full" && !isFull(c)) return false;
      if (filter === "pending" && isFull(c)) return false;
      if (!kw) return true;
      return `${c.contract_no ?? ""} ${c.project_name ?? ""} ${c.customer_name ?? ""}`.toLowerCase().includes(kw);
    });
  }, [rows, q, filter]);

  const groups = useMemo(() => {
    const byCustomer: Record<string, Contract[]> = {};
    filtered.forEach((c) => {
      const k = c.customer_name || t("finance.noCustomer", "(ບໍ່ລະບຸລູກຄ້າ)");
      (byCustomer[k] ||= []).push(c);
    });
    return Object.entries(byCustomer)
      .map(([customer, list]) => ({
        customer,
        list,
        value: list.reduce((sum, c) => sum + (Number(c.total_amount) || 0), 0),
      }))
      .sort((a, b) => b.value - a.value);
  }, [filtered, t]);

  const filtering = q.trim() !== "" || filter !== "all";
  const isOpen = (c: string) => filtering || expanded.has(c);
  const toggle = (c: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      return next;
    });
  const allOpen = groups.length > 0 && groups.every((g) => expanded.has(g.customer));
  const toggleAll = () => setExpanded(allOpen ? new Set() : new Set(groups.map((g) => g.customer)));

  const open = (c: Contract) =>
    router.push(c.src === "erp" ? `/contracts/${encodeURIComponent(c.contract_no || "")}` : `/contracts/${c.id}`);

  return (
    <Page max="max-w-none w-full">
      <PageHeader
        title={t("finance.title", "ບັນຊີ / ການເງິນ")}
        subtitle={t("finance.subtitle", "ມູນຄ່າສັນຍາ ແລະ ການອະນຸມັດ ຕາມລູກຄ້າ")}
        actions={
          <Btn variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {t("common.reload", "ໂຫຼດໃໝ່")}
          </Btn>
        }
      />

      {/* ── ສ່ວນທີ 1: ສະຫຼຸບ ─────────────────────────────── */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<FileSignature size={18} />} label={t("finance.totalContracts", "ສັນຍາທັງໝົດ")} value={stats.total} active={filter === "all"} onClick={() => setFilter("all")} />
        <Stat icon={<Wallet size={18} />} label={t("finance.contractValueKip", "ມູນຄ່າສັນຍາ (ບາດ)")} value={money(stats.value)} />
        <Stat icon={<CheckCircle2 size={18} />} label={t("finance.approvedFull", "ອະນຸມັດຄົບ")} value={stats.full} active={filter === "full"} onClick={() => setFilter("full")} />
        <Stat icon={<Clock size={18} />} label={t("finance.pendingApproval", "ລໍຖ້າອະນຸມັດ")} value={stats.pending} active={filter === "pending"} onClick={() => setFilter("pending")} />
      </div>

      {/* ── ສ່ວນທີ 2: ຄົ້ນຫາ / ກັ່ນຕອງ ────────────────────── */}
      <Toolbar>
        <label className="flex h-9 min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3">
          <Search size={15} className="text-[var(--text-mute)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("finance.searchPlaceholder", "ຄົ້ນຫາ ເລກສັນຍາ, ໂຄງການ, ລູກຄ້າ...")}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-mute)]"
          />
        </label>
        <Segmented className="ml-auto" value={filter} onChange={setFilter} options={FILTERS} />
      </Toolbar>

      {/* ── ສ່ວນທີ 3: ມູນຄ່າຕາມລູກຄ້າ ─────────────────────── */}
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-[11px] font-extrabold tracking-wider text-[var(--text-mute)]">{t("finance.valueByCustomer", "ມູນຄ່າສັນຍາ ຕາມລູກຄ້າ")}</h2>
        <span className="h-px flex-1 bg-[var(--border)]" />
        {!filtering && groups.length > 0 && (
          <button
            onClick={toggleAll}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold text-[var(--text-mute)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text)]"
          >
            {allOpen ? <ChevronsDownUp size={13} /> : <ChevronsUpDown size={13} />}
            {allOpen ? t("finance.collapseAll", "ຍຸບທັງໝົດ") : t("finance.expandAll", "ຂະຫຍາຍທັງໝົດ")}
          </button>
        )}
      </div>

      {loading ? (
        <Card className="flex h-56 items-center justify-center gap-2 text-[var(--text-mute)]">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm font-semibold">{t("common.loading", "ກຳລັງໂຫຼດ...")}</span>
        </Card>
      ) : groups.length === 0 ? (
        <Card className="flex h-56 flex-col items-center justify-center gap-2 text-[var(--text-mute)]">
          <Inbox className="h-8 w-8 opacity-40" />
          <span className="text-sm font-semibold">{rows.length ? t("finance.noMatchingContracts", "ບໍ່ພົບສັນຍາທີ່ກົງ") : t("finance.noContracts", "ຍັງບໍ່ມີສັນຍາ")}</span>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {groups.map((g) => {
            const opened = isOpen(g.customer);
            return (
              <Card key={g.customer} className="overflow-hidden">
                <button
                  onClick={() => toggle(g.customer)}
                  className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--brand-tint)] ${opened ? "bg-[var(--surface-sunken)]" : ""}`}
                >
                  <ChevronRight className={`h-4 w-4 flex-shrink-0 text-[var(--text-mute)] transition-transform duration-200 ${opened ? "rotate-90" : ""}`} />
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-sm font-black text-[var(--brand-strong)]">
                    {initial(g.customer)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-extrabold text-[var(--text)]">{g.customer}</div>
                    <div className="text-[11px] font-semibold text-[var(--text-mute)]">{g.list.length} {t("finance.contractsUnit", "ສັນຍາ")}</div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="font-mono text-sm font-black tabular-nums text-[var(--text)]">{money(g.value)}</div>
                    <div className="text-[10px] font-bold tracking-wider text-[var(--text-mute)]">{t("finance.kip", "ບາດ")}</div>
                  </div>
                </button>

                {opened && (
                  <div className="border-t border-[var(--border)]">
                    {g.list.map((c, i) => (
                      <button
                        key={c.id ?? c.contract_no ?? i}
                        onClick={() => open(c)}
                        className="group flex w-full items-center gap-3 border-b border-[var(--border-soft)] px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-[var(--brand-tint)]"
                      >
                        <FileSignature size={15} className="flex-shrink-0 text-[var(--text-mute)] group-hover:text-[var(--brand)]" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-mono text-[12.5px] font-bold text-[var(--text)]">{c.contract_no || t("finance.noContractNo", "(ບໍ່ມີເລກທີ່)")}</div>
                          <div className="truncate text-[11px] font-semibold text-[var(--text-mute)]">{c.project_name || "-"} · {d10(c.created_at)}</div>
                        </div>
                        <Tag done={isFull(c)} />
                        <div className="w-24 flex-shrink-0 text-right font-mono text-[13px] font-black tabular-nums text-[var(--text)] sm:w-28">{money(c.total_amount)}</div>
                        <ChevronRight className="h-4 w-4 flex-shrink-0 text-[var(--text-mute)] transition-transform group-hover:translate-x-0.5" />
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-[11px] font-semibold text-[var(--text-mute)]">
        {t("finance.footerNote", "ໝາຍເຫດ: ມູນຄ່າຄິດໄລ່ຈາກສັນຍາທີ່ມີຂໍ້ມູນມູນຄ່າ. ງວດການຈ່າຍ (installments) ຈະເພີ່ມໃນຂັ້ນຕໍ່ໄປ.")}
      </p>
    </Page>
  );
}
