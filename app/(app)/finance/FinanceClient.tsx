"use client";

/** v2 — Finance overview (read-only). Contract value + approval status, grouped
 *  by customer. Monochrome. (Payment installments / ງວດຈ່າຍ to come later.) */
import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  RefreshCw,
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
import { Page, Card, Stat, SectionTitle } from "../_components/ui";

const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "0";
};
const d10 = (v: unknown) => (v ? String(v).slice(0, 10) : "-");
const initial = (s: string) => s.replace(/[^\p{L}\p{N}]/u, "").charAt(0).toUpperCase() || "?";
const isFull = (c: any) => !!c.sales_approved && !!c.accounting_approved;

const FILTERS = [
  { key: "all", label: "ທັງໝົດ" },
  { key: "full", label: "ອະນຸມັດຄົບ" },
  { key: "pending", label: "ລໍຖ້າອະນຸມັດ" },
];

type Contract = Record<string, any>;

function Tag({ done }: { done: boolean }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-bold ${done ? "bg-slate-800 text-white" : "border border-slate-300 bg-white text-slate-500"}`}>
      {done ? "ສົມບູນ" : "ລໍຖ້າອະນຸມັດ"}
    </span>
  );
}

export default function FinanceClient({ initialRows }: { initialRows: Contract[] }) {
  const router = useRouter();
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
      const k = c.customer_name || "(ບໍ່ລະບຸລູກຄ້າ)";
      (byCustomer[k] ||= []).push(c);
    });
    return Object.entries(byCustomer)
      .map(([customer, list]) => ({
        customer,
        list,
        value: list.reduce((sum, c) => sum + (Number(c.total_amount) || 0), 0),
      }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

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
      {/* Plain monochrome header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black leading-none tracking-tight text-slate-900 md:text-[1.7rem]">ບັນຊີ / ການເງິນ</h1>
          <p className="mt-2.5 text-xs font-semibold text-slate-500">ມູນຄ່າສັນຍາ ແລະ ການອະນຸມັດ ຕາມລູກຄ້າ</p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* ── ສ່ວນທີ 1: ສະຫຼຸບ ─────────────────────────────── */}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<FileSignature size={18} />} label="ສັນຍາທັງໝົດ" value={stats.total} active={filter === "all"} onClick={() => setFilter("all")} />
        <Stat icon={<Wallet size={18} />} label="ມູນຄ່າສັນຍາ (ກີບ)" value={money(stats.value)} />
        <Stat icon={<CheckCircle2 size={18} />} label="ອະນຸມັດຄົບ" value={stats.full} active={filter === "full"} onClick={() => setFilter("full")} />
        <Stat icon={<Clock size={18} />} label="ລໍຖ້າອະນຸມັດ" value={stats.pending} active={filter === "pending"} onClick={() => setFilter("pending")} />
      </div>

      {/* ── ສ່ວນທີ 2: ຄົ້ນຫາ / ກັ່ນຕອງ ────────────────────── */}
      <SectionTitle label="ຄົ້ນຫາ ແລະ ກັ່ນຕອງ" />
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <div className="relative flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 transition-all focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-200 sm:max-w-xs">
          <Search className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ຄົ້ນຫາ ເລກສັນຍາ, ໂຄງການ, ລູກຄ້າ..."
            className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`h-10 rounded-xl px-3.5 text-xs font-bold transition-all active:scale-[0.98] ${
                filter === f.key ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── ສ່ວນທີ 3: ມູນຄ່າຕາມລູກຄ້າ ─────────────────────── */}
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">ມູນຄ່າສັນຍາ ຕາມລູກຄ້າ</h2>
        <span className="h-px flex-1 bg-slate-200" />
        {!filtering && groups.length > 0 && (
          <button
            onClick={toggleAll}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          >
            {allOpen ? <ChevronsDownUp size={13} /> : <ChevronsUpDown size={13} />}
            {allOpen ? "ຍຸບທັງໝົດ" : "ຂະຫຍາຍທັງໝົດ"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex h-56 items-center justify-center gap-3 text-slate-400">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
          <span className="text-sm font-semibold">ກຳລັງໂຫຼດ...</span>
        </div>
      ) : groups.length === 0 ? (
        <Card className="flex h-56 flex-col items-center justify-center gap-2 text-slate-400">
          <Inbox className="h-8 w-8 opacity-40" />
          <span className="text-sm font-semibold">{rows.length ? "ບໍ່ພົບສັນຍາທີ່ກົງ" : "ຍັງບໍ່ມີສັນຍາ"}</span>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {groups.map((g) => {
            const opened = isOpen(g.customer);
            return (
              <Card key={g.customer} className="overflow-hidden">
                <button
                  onClick={() => toggle(g.customer)}
                  className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 ${opened ? "bg-slate-50/70" : ""}`}
                >
                  <ChevronRight className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform duration-200 ${opened ? "rotate-90" : ""}`} />
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-black text-slate-600">{initial(g.customer)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-extrabold text-slate-900">{g.customer}</div>
                    <div className="text-[11px] font-semibold text-slate-400">{g.list.length} ສັນຍາ</div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="font-mono text-sm font-black text-slate-900">{money(g.value)}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ກີບ</div>
                  </div>
                </button>

                {opened && (
                  <div className="divide-y divide-slate-100 border-t border-slate-200">
                    {g.list.map((c, i) => (
                      <button
                        key={c.id ?? c.contract_no ?? i}
                        onClick={() => open(c)}
                        className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50"
                      >
                        <FileSignature size={15} className="flex-shrink-0 text-slate-300 group-hover:text-slate-500" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-mono text-[12.5px] font-bold text-slate-800">{c.contract_no || "(ບໍ່ມີເລກທີ່)"}</div>
                          <div className="truncate text-[11px] font-semibold text-slate-400">{c.project_name || "-"} · {d10(c.created_at)}</div>
                        </div>
                        <Tag done={isFull(c)} />
                        <div className="w-24 flex-shrink-0 text-right font-mono text-[13px] font-black text-slate-900 sm:w-28">{money(c.total_amount)}</div>
                        <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-slate-500" />
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-[11px] font-semibold text-slate-400">
        ໝາຍເຫດ: ມູນຄ່າຄິດໄລ່ຈາກສັນຍາທີ່ມີຂໍ້ມູນມູນຄ່າ. ງວດການຈ່າຍ (installments) ຈະເພີ່ມໃນຂັ້ນຕໍ່ໄປ.
      </p>
    </Page>
  );
}
