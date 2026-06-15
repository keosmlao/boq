"use client";

/** v2 — Quotation list. Clean monochrome accordion: customer → project → quotation. */
import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  RefreshCw,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  FileText,
  Wallet,
  Clock,
  CheckCircle2,
  Inbox,
  FolderKanban,
} from "lucide-react";
import { getQuotations } from "@/_actions/quotations";
import { Page, Card } from "../_components/ui";

const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "0";
};
const d10 = (v: unknown) => (v ? String(v).slice(0, 10) : "-");
const norm = (s: unknown) => String(s || "ລໍຖ້າອະນຸມັດ");
const statusKind = (s: string): "done" | "off" | "wait" =>
  s === "ອະນຸມັດແລ້ວ" ? "done" : s === "ປະຕິເສດ" ? "off" : "wait";
const initial = (s: string) => s.replace(/[^\p{L}\p{N}]/u, "").charAt(0).toUpperCase() || "?";

const FILTERS = [
  { key: "all", label: "ທັງໝົດ" },
  { key: "ລໍຖ້າອະນຸມັດ", label: "ລໍຖ້າອະນຸມັດ" },
  { key: "ອະນຸມັດແລ້ວ", label: "ອະນຸມັດແລ້ວ" },
  { key: "ປະຕິເສດ", label: "ປະຕິເສດ" },
];

type Quote = Record<string, any>;

/** Status in grayscale only: solid = done, faint = rejected, outline = pending. */
function Tag({ status }: { status: string }) {
  const k = statusKind(status);
  const cls = k === "done" ? "bg-slate-800 text-white" : k === "off" ? "bg-slate-100 text-slate-400" : "border border-slate-300 bg-white text-slate-500";
  return <span className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-bold ${cls}`}>{status}</span>;
}

export default function QuotationsClient({ initialRows }: { initialRows: Quote[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Quote[]>(initialRows ?? []);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await getQuotations({});
      setRows(res?.success ? res.data || [] : Array.isArray(res) ? res : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && norm(r.status) !== status) return false;
      if (!kw) return true;
      return `${r.quotation_no ?? ""} ${r.project_name ?? ""} ${r.customer_name ?? ""}`.toLowerCase().includes(kw);
    });
  }, [rows, q, status]);

  const stats = useMemo(() => {
    const s = { total: rows.length, pending: 0, approved: 0, value: 0 };
    rows.forEach((r) => {
      const st = norm(r.status);
      if (st === "ອະນຸມັດແລ້ວ") s.approved++;
      else if (st !== "ປະຕິເສດ") s.pending++;
      s.value += Number(r.total_amount) || 0;
    });
    return s;
  }, [rows]);

  // Two-level grouping: customer → project, customers sorted by total value.
  const groups = useMemo(() => {
    const byCustomer: Record<string, Quote[]> = {};
    filtered.forEach((r) => {
      const c = r.customer_name || "(ບໍ່ລະບຸລູກຄ້າ)";
      (byCustomer[c] ||= []).push(r);
    });
    return Object.entries(byCustomer)
      .map(([customer, list]) => {
        const byProject: Record<string, Quote[]> = {};
        list.forEach((r) => {
          const p = r.project_name || "(ບໍ່ລະບຸໂຄງການ)";
          (byProject[p] ||= []).push(r);
        });
        const projects = Object.entries(byProject).map(([project, quotes]) => ({
          project,
          quotes,
          value: quotes.reduce((sum, x) => sum + (Number(x.total_amount) || 0), 0),
        }));
        return { customer, projects, count: list.length, value: projects.reduce((sum, p) => sum + p.value, 0) };
      })
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const open = (id: unknown) => router.push(`/quotations/${id}`);

  const filtering = q.trim() !== "" || status !== "all";
  const isOpen = (c: string) => filtering || expanded.has(c);
  const toggle = (c: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      return next;
    });
  const allOpen = groups.length > 0 && groups.every((g) => expanded.has(g.customer));
  const toggleAll = () => setExpanded(allOpen ? new Set() : new Set(groups.map((g) => g.customer)));

  return (
    <Page max="max-w-none w-full">
      {/* Monochrome Minimalist Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="min-w-0">
          <h1 className="truncate text-xl md:text-2xl font-bold tracking-tight text-slate-900 leading-none">ໃບສະເໜີລາຄາ</h1>
          <p className="mt-2 text-xs font-medium text-slate-400">
            ໃບສະເໜີທັງໝົດ {stats.total} · ມູນຄ່າລວມ {money(stats.value)} ກີບ · ລໍຖ້າອະນຸມັດ {stats.pending} · ອະນຸມັດແລ້ວ {stats.approved}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          {!filtering && groups.length > 0 && (
            <button
              onClick={toggleAll}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer"
            >
              {allOpen ? <ChevronsDownUp size={13} /> : <ChevronsUpDown size={13} />}
              <span>{allOpen ? "ຍຸບທັງໝົດ" : "ຂະຫຍາຍທັງໝົດ"}</span>
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Search & Filter Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="relative flex h-9 w-full max-w-xs items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100 transition-all">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ຄົ້ນຫາ ເລກທີ, ໂຄງການ, ລູກຄ້າ..."
              className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none"
            />
          </div>
          <div className="flex items-center gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setStatus(f.key)}
                className={`h-8 rounded-lg px-3 text-xs font-semibold transition-all cursor-pointer ${
                  status === f.key
                    ? "bg-blue-600 text-white"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex h-56 items-center justify-center gap-3 text-slate-400">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
            <span className="text-sm font-semibold">ກຳລັງໂຫຼດ...</span>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center gap-2 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <Inbox className="h-8 w-8 opacity-40" />
            <span className="text-sm font-semibold">{rows.length ? "ບໍ່ພົບໃບສະເໜີທີ່ກົງ" : "ຍັງບໍ່ມີໃບສະເໜີລາຄາ"}</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl bg-white overflow-hidden shadow-2xs">
            {groups.map((g) => {
              const opened = isOpen(g.customer);
              return (
                <div key={g.customer} className="group transition-colors">
                  {/* Customer Group Row (Accordion Toggle) */}
                  <div
                    onClick={() => toggle(g.customer)}
                    className={`flex w-full cursor-pointer items-center gap-3.5 px-4.5 py-3 transition-colors hover:bg-slate-50/50 ${opened ? "bg-slate-50/30" : ""}`}
                  >
                    <ChevronRight className={`h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition-transform duration-200 ${opened ? "rotate-90" : ""}`} />
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50 border border-slate-100 text-xs font-bold text-slate-600">
                      {initial(g.customer)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-800 transition-colors group-hover:text-slate-900">{g.customer}</div>
                      <div className="mt-0.5 text-[10.5px] font-medium text-slate-400">
                        {g.projects.length} ໂຄງການ · {g.count} ໃບສະເໜີ
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right pr-2">
                      <div className="font-mono text-xs font-bold text-slate-700">{money(g.value)}</div>
                      <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">ກີບ</div>
                    </div>
                  </div>

                  {/* Customer Projects & Quotations */}
                  {opened && (
                    <div className="bg-slate-50/15 border-t border-slate-100/70 px-4.5 py-2.5">
                      <div className="ml-[17px] border-l border-slate-200 pl-3.5 space-y-3">
                        {g.projects.map((p) => (
                          <div key={p.project} className="space-y-1">
                            <div className="flex items-center gap-2 rounded-lg px-2 py-1 bg-white border border-slate-100 shadow-2xs">
                              <FolderKanban size={11} className="flex-shrink-0 text-slate-400" />
                              <span className="truncate text-[11.5px] font-semibold text-slate-600">{p.project}</span>
                              <span className="ml-auto flex-shrink-0 font-mono text-[10px] font-semibold text-slate-400">{money(p.value)} ກີບ</span>
                            </div>
                            <div className="ml-3 border-l border-slate-200/50 pl-3 space-y-0.5">
                              {p.quotes.map((qt) => (
                                <button
                                  key={qt.id}
                                  onClick={() => open(qt.id)}
                                  className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-white cursor-pointer"
                                >
                                  <FileText size={12} className="flex-shrink-0 text-slate-400 group-hover:text-slate-600" />
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate font-mono text-[11.5px] font-semibold text-slate-700">{qt.quotation_no || "(ບໍ່ມີເລກທີ່)"}</div>
                                    <div className="text-[10px] font-medium text-slate-400">{d10(qt.quotation_date)}</div>
                                  </div>
                                  <Tag status={norm(qt.status)} />
                                  <div className="w-24 flex-shrink-0 text-right font-mono text-xs font-semibold text-slate-700 sm:w-28">{money(qt.total_amount)}</div>
                                  <ChevronRight className="h-3 w-3 flex-shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-slate-500" />
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Page>
  );
}
