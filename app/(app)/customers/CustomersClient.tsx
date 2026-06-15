"use client";

/** v2 — Customers as a workflow drill-down tree (nested, not flat):
 *  ລູກຄ້າ → ໂຄງການ → ໃບສະເໜີລາຄາ → ສັນຍາ → BOQ → ໃບຂໍເບີກ
 *                                          └→ ໜ້າວຽກ → ໃບງານ
 *  Plain / monochrome — no accent colours. Lazy-loads each project's docs.
 *
 *  Initial customers + projects are fetched on the SERVER (see page.tsx) and
 *  seeded via props — this removes the old mount→useEffect→server-action
 *  waterfall. The Refresh button still calls load() to re-fetch client-side,
 *  and each project's documents are still lazy-loaded on expand. */
import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  RefreshCw,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Plus,
  Pencil,
  Trash2,
  Users,
  FolderKanban,
  FileText,
  FileSignature,
  ListChecks,
  CalendarRange,
  Wrench,
  PackageOpen,
  Loader2,
} from "lucide-react";
import { getCustomers, deleteCustomer } from "@/_actions/customers";
import { getProjects, getProjectsBoq } from "@/_actions/projects";
import { getQuotations } from "@/_actions/quotations";
import { getContracts } from "@/_actions/contracts";
import { getProjectTasks } from "@/_actions/tasks-v2";
import { getWorkOrders } from "@/_actions/workorder";
import { getRequests } from "@/_actions/request-v2";
import { Page } from "../_components/ui";

const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "0";
};
const d10 = (v: unknown) => (v ? String(v).slice(0, 10) : "");
const arr = (res: any): any[] => (res?.success ? res.data || [] : Array.isArray(res) ? res : []);

/** Status rendered in grayscale only: solid = done, faint = rejected, outline = pending. */
type Mono = { label: string; kind: "done" | "wait" | "off" } | null;
const quoStatus = (s: any): Mono => {
  const v = String(s || "ລໍຖ້າອະນຸມັດ");
  return { label: v, kind: v === "ອະນຸມັດແລ້ວ" ? "done" : v === "ປະຕິເສດ" ? "off" : "wait" };
};
const boqStatus = (b: any): Mono => {
  const a = Number(b.approve_status);
  return a === 1 ? { label: "ອະນຸມັດແລ້ວ", kind: "done" } : a === 2 ? { label: "ປະຕິເສດ", kind: "off" } : { label: "ລໍຖ້າອະນຸມັດ", kind: "wait" };
};
const contractStatus = (c: any): Mono => {
  const isErp = c.src === "erp";
  const sales = isErp ? Number(c.approve_status_1) === 1 : !!c.sales_approved;
  const acc = isErp ? Math.max(Number(c.approve_status_2) || 0, Number(c.acc_approve) || 0) === 1 : !!c.accounting_approved;
  return sales && acc ? { label: "ສົມບູນ", kind: "done" } : { label: "ລໍຖ້າອະນຸມັດ", kind: "wait" };
};
const reqStatus = (r: any): Mono => {
  const s = String(r.status || "requested");
  return s === "withdrawn" ? { label: "ເບີກແລ້ວ", kind: "done" } : s === "rejected" ? { label: "ປະຕິເສດ", kind: "off" } : { label: "ຮ້ອງຂໍ", kind: "wait" };
};

function Tag({ status }: { status: Mono }) {
  if (!status) return null;
  const cls =
    status.kind === "done"
      ? "bg-slate-800 text-white"
      : status.kind === "off"
        ? "bg-slate-100 text-slate-400"
        : "border border-slate-300 bg-white text-slate-500";
  return <span className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-bold ${cls}`}>{status.label}</span>;
}

/** Per-category leaf rendering + icon. */
type Meta = {
  label: string;
  icon: React.ReactNode;
  primary: (it: any) => string;
  secondary: (it: any) => string;
  status: (it: any) => Mono;
  href: (it: any, pid: string) => string;
};
const META: Record<string, Meta> = {
  quotation: { label: "ໃບສະເໜີລາຄາ", icon: <FileText size={13} />, primary: (q) => q.quotation_no || "(ບໍ່ມີເລກທີ່)", secondary: (q) => [d10(q.quotation_date), q.total_amount ? `${money(q.total_amount)} ກີບ` : ""].filter(Boolean).join(" · "), status: (q) => quoStatus(q.status), href: (q) => `/quotations/${q.id}` },
  contract: { label: "ສັນຍາ", icon: <FileSignature size={13} />, primary: (c) => c.contract_no || "(ບໍ່ມີເລກທີ່)", secondary: (c) => [c.total_amount ? `${money(c.total_amount)} ກີບ` : "", d10(c.sign_date)].filter(Boolean).join(" · "), status: (c) => contractStatus(c), href: (c) => (c.src === "erp" ? `/contracts/${encodeURIComponent(c.contract_no || "")}` : `/contracts/${c.id}`) },
  boq: { label: "BOQ", icon: <ListChecks size={13} />, primary: (b) => b.doc_no || b.boq_no || "(ບໍ່ມີເລກທີ່)", secondary: (b) => d10(b.doc_date), status: (b) => boqStatus(b), href: (b) => `/boq/${encodeURIComponent(b.doc_no || b.boq_no || "")}` },
  request: { label: "ໃບຂໍເບີກ", icon: <PackageOpen size={13} />, primary: (r) => r.request_no || "(ບໍ່ມີເລກທີ່)", secondary: (r) => [d10(r.created_at), Array.isArray(r.items) ? `${r.items.length} ລາຍການ` : ""].filter(Boolean).join(" · "), status: (r) => reqStatus(r), href: (r) => `/requests/${encodeURIComponent(r.id)}` },
  tasks: { label: "ໜ້າວຽກ", icon: <CalendarRange size={13} />, primary: (t) => t.title || "ໜ້າວຽກ", secondary: (t) => [t.phase, t.technician_name].filter(Boolean).join(" · "), status: () => null, href: (_t, pid) => `/projects/${pid}?tab=tasks` },
  workorder: { label: "ໃບງານ", icon: <Wrench size={13} />, primary: (w) => w.work_no || "(ບໍ່ມີເລກທີ່)", secondary: (w) => [d10(w.work_date || w.created_at), w.technician_name].filter(Boolean).join(" · "), status: () => null, href: (w) => `/work-orders/${w.id}` },
};

/** Nested workflow tree of document categories. */
type CatNode = Meta & { key: string; children: CatNode[] };
const node = (key: string, children: CatNode[] = []): CatNode => ({ key, ...META[key], children });
const CAT_TREE: CatNode[] = [
  node("quotation", [
    node("contract", [node("boq", [node("request")])]),
    node("tasks", [node("workorder")]),
  ]),
];
const subtreeCount = (n: CatNode, cats: Record<string, any[]>): number =>
  (cats[n.key]?.length || 0) + n.children.reduce((s, c) => s + subtreeCount(c, cats), 0);
const allCatKeys = (pid: string): string[] => {
  const keys: string[] = [];
  const walk = (nodes: CatNode[]) => nodes.forEach((n) => { keys.push(`k:${pid}:${n.key}`); walk(n.children); });
  walk(CAT_TREE);
  return keys;
};

async function fetchProjectCats(pid: string): Promise<Record<string, any[]>> {
  const [pRes, qRes, cRes, tRes, woRes, rqRes]: any = await Promise.all([
    getProjectsBoq({ projectId: pid }),
    getQuotations({ projectId: pid }),
    getContracts({ projectId: pid }),
    getProjectTasks({ projectId: pid }),
    getWorkOrders({ projectId: pid }),
    getRequests({ projectId: pid }),
  ]);
  const proj = (pRes?.success ? pRes.data?.[0] : null) || null;
  const legacyContracts = (Array.isArray(proj?.contractlist) ? proj.contractlist : []).map((c: any) => ({ ...c, src: "erp" }));
  const legacyBoqs = legacyContracts.flatMap((c: any) =>
    (Array.isArray(c?.boq_list) ? c.boq_list : []).map((b: any) => ({ ...b, src: "erp", contract_no: c.contract_no })),
  );
  return {
    quotation: arr(qRes),
    contract: [...arr(cRes), ...legacyContracts],
    boq: legacyBoqs,
    request: arr(rqRes),
    tasks: arr(tRes),
    workorder: arr(woRes),
  };
}

const FILTERS = [
  { key: "all", label: "ທັງໝົດ" },
  { key: "has", label: "ມີໂຄງການ" },
  { key: "none", label: "ບໍ່ມີໂຄງການ" },
];

type Customer = Record<string, any> & { projects: any[] };
type ProjData = { loading: boolean; cats?: Record<string, any[]>; error?: boolean };

/** Build the sml_code → projects[] map exactly as the old client did. */
const buildProjMap = (projects: any[]): Record<string, any[]> => {
  const map: Record<string, any[]> = {};
  projects.forEach((p: any) => {
    const code = String(p.sml_code ?? "");
    if (!code) return;
    (map[code] ||= []).push(p);
  });
  return map;
};

/** Shared right-hand column atoms so status + count line up vertically across
 *  every depth — gives the tree a tabular feel. */
const RIGHT = "flex w-[120px] flex-shrink-0 items-center justify-end gap-2";
const COUNT = "w-7 text-right text-[10.5px] font-bold tabular-nums";
const ACT = "flex w-16 flex-shrink-0 items-center justify-end gap-0.5";

export default function CustomersClient({
  initialCustomers,
  initialProjects,
}: {
  initialCustomers: any[];
  initialProjects: any[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<any[]>(initialCustomers);
  const [projMap, setProjMap] = useState<Record<string, any[]>>(() => buildProjMap(initialProjects));
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [projData, setProjData] = useState<Record<string, ProjData>>({});

  const load = async () => {
    setLoading(true);
    try {
      const [cRes, pRes]: any = await Promise.all([getCustomers(), getProjects({ summary: true })]);
      setRows(cRes?.success ? cRes.data || [] : []);
      setProjMap(buildProjMap(arr(pRes)));
    } catch {
      setRows([]);
      setProjMap({});
    } finally {
      setLoading(false);
    }
  };

  const customers: Customer[] = useMemo(
    () => rows.map((c) => ({ ...c, projects: projMap[String(c.code)] || [] })),
    [rows, projMap],
  );

  const stats = useMemo(() => {
    let projects = 0,
      withP = 0;
    customers.forEach((c) => {
      projects += c.projects.length;
      if (c.projects.length) withP++;
    });
    return { total: customers.length, projects, withP, withoutP: customers.length - withP };
  }, [customers]);

  const kw = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    return customers
      .filter((c) => {
        if (filter === "has" && c.projects.length === 0) return false;
        if (filter === "none" && c.projects.length > 0) return false;
        if (!kw) return true;
        const inCust = [c.name, c.code, c.phone].some((x) => (x ?? "").toString().toLowerCase().includes(kw));
        const inProj = c.projects.some((p) => (p.project_name ?? "").toString().toLowerCase().includes(kw));
        return inCust || inProj;
      })
      .sort((a, b) => b.projects.length - a.projects.length || String(a.name).localeCompare(String(b.name)));
  }, [customers, kw, filter]);

  const searching = kw !== "";
  const isOpen = (key: string) => open.has(key);
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const custOpen = (code: string) => searching || isOpen(`c:${code}`);

  const openProject = (pid: string) => {
    const key = `p:${pid}`;
    const willOpen = !isOpen(key);
    toggle(key);
    if (willOpen && !projData[pid]) {
      setProjData((d) => ({ ...d, [pid]: { loading: true } }));
      fetchProjectCats(pid)
        .then((cats) => {
          setProjData((d) => ({ ...d, [pid]: { loading: false, cats } }));
          setOpen((prev) => new Set([...prev, ...allCatKeys(pid)]));
        })
        .catch(() => setProjData((d) => ({ ...d, [pid]: { loading: false, error: true } })));
    }
  };

  const allOpen = filtered.length > 0 && filtered.every((c) => isOpen(`c:${c.code}`));
  const toggleAll = () => setOpen(allOpen ? new Set() : new Set(filtered.map((c) => `c:${c.code}`)));

  const del = async (code: string) => {
    if (!window.confirm("ລົບລູກຄ້ານີ້? ກູ້ຄືນບໍ່ໄດ້.")) return;
    const res: any = await deleteCustomer(code);
    if (res?.success) setRows((a) => a.filter((x) => String(x.code) !== String(code)));
    else alert(res?.message || "ລົບບໍ່ສຳເລັດ");
  };

  // Recursive renderer — emits FLAT, full-width table rows (no nested cards or
  // connector rules); hierarchy reads from the left indent + the aligned
  // status/count columns on the right.
  const renderCat = (n: CatNode, pid: string, cats: Record<string, any[]>, depth: number): React.ReactNode => {
    const items = cats[n.key] || [];
    const expandable = subtreeCount(n, cats) > 0;
    const key = `k:${pid}:${n.key}`;
    const cOpen = expandable && isOpen(key);
    const empty = items.length === 0;
    const catPad = 52 + depth * 18;
    return (
      <React.Fragment key={n.key}>
        <div
          onClick={expandable ? () => toggle(key) : undefined}
          style={{ paddingLeft: catPad }}
          className={`flex items-center gap-2.5 py-2 pr-4 ${expandable ? "cursor-pointer hover:bg-slate-50" : "cursor-default"}`}
        >
          <ChevronRight className={`h-3 w-3 flex-shrink-0 text-slate-300 transition-transform duration-200 ${expandable ? "" : "opacity-0"} ${cOpen ? "rotate-90" : ""}`} />
          <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 ${empty ? "text-slate-300" : "text-slate-500"}`}>{n.icon}</span>
          <span className={`flex-1 truncate text-[11.5px] font-semibold ${empty ? "text-slate-400" : "text-slate-600"}`}>{n.label}</span>
          <div className={RIGHT}>
            <span className={`${COUNT} ${empty ? "text-slate-300" : "text-slate-500"}`}>{items.length}</span>
          </div>
          <span className={ACT} />
        </div>
        {cOpen && (
          <>
            {items.map((it, i) => {
              const sec = n.secondary(it);
              return (
                <div
                  key={it.id ?? it.doc_no ?? it.boq_no ?? it.contract_no ?? it.request_no ?? i}
                  onClick={() => router.push(n.href(it, pid))}
                  style={{ paddingLeft: catPad + 18 }}
                  className="group/leaf flex cursor-pointer items-center gap-2.5 py-2 pr-4 transition-colors hover:bg-slate-50"
                >
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-300 transition-colors group-hover/leaf:bg-slate-600" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-[12px] font-semibold text-slate-700">{n.primary(it)}</div>
                    {sec && <div className="truncate text-[10.5px] font-medium text-slate-400">{sec}</div>}
                  </div>
                  <div className={RIGHT}>
                    <Tag status={n.status(it)} />
                  </div>
                  <span className={ACT}>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-300 transition-all group-hover/leaf:translate-x-0.5 group-hover/leaf:text-slate-500" />
                  </span>
                </div>
              );
            })}
            {n.children.map((child) => renderCat(child, pid, cats, depth + 1))}
          </>
        )}
      </React.Fragment>
    );
  };

  return (
    <Page max="max-w-none w-full">
      {/* Monochrome Minimalist Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="min-w-0">
          <h1 className="truncate text-xl md:text-2xl font-bold tracking-tight text-slate-900 leading-none">ລູກຄ້າ</h1>
          <p className="mt-2 text-xs font-medium text-slate-400">
            ລູກຄ້າທັງໝົດ {stats.total} · ມີໂຄງການ {stats.withP} · ບໍ່ມີໂຄງການ {stats.withoutP}
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
          {!searching && filtered.length > 0 && (
            <button
              onClick={toggleAll}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer"
            >
              {allOpen ? <ChevronsDownUp size={13} /> : <ChevronsUpDown size={13} />}
              <span>{allOpen ? "ຍຸບທັງໝົດ" : "ຂະຫຍາຍທັງໝົດ"}</span>
            </button>
          )}
          <button
            onClick={() => router.push("/customers/new")}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-700 active:scale-[0.98] cursor-pointer"
          >
            <Plus size={14} strokeWidth={2.5} /> ສ້າງລູກຄ້າ
          </button>
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
              placeholder="ຄົ້ນຫາ ລະຫັດ, ຊື່ລູກຄ້າ..."
              className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none"
            />
          </div>
          <div className="flex items-center gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`h-8 rounded-lg px-3 text-xs font-semibold transition-all cursor-pointer ${
                  filter === f.key
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
        ) : filtered.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center gap-2 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <Users className="h-8 w-8 opacity-40" />
            <span className="text-sm font-semibold">{rows.length ? "ບໍ່ພົບລູກຄ້າ" : "ຍັງບໍ່ມີລູກຄ້າ"}</span>
          </div>
        ) : (
          <div className="border border-slate-200/80 rounded-xl bg-white overflow-hidden shadow-2xs">
            {/* Table head */}
            <div className="flex items-center border-b border-slate-200 bg-slate-50/70 px-4.5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 select-none">
              <span className="flex-1 pl-[20px]">ລູກຄ້າ</span>
              <span className="hidden sm:block w-24 flex-shrink-0">ລະຫັດ</span>
              <span className="hidden md:block w-32 flex-shrink-0">ເບີໂທ</span>
              <span className="w-[120px] flex-shrink-0 text-right pr-1">ສະຖານະ · ຈຳນວນ</span>
              <span className="w-16 flex-shrink-0 text-right" />
            </div>

            <div className="divide-y divide-slate-100">
              {filtered.map((c) => {
                const code = String(c.code);
                const opened = custOpen(code);
                return (
                  <div key={code} className="group transition-colors">
                    {/* Customer Row */}
                    <div
                      onClick={() => toggle(`c:${code}`)}
                      className={`flex w-full cursor-pointer items-center px-4.5 py-2.5 transition-colors hover:bg-slate-50/50 ${opened ? "bg-slate-50/30" : ""}`}
                    >
                      <ChevronRight className={`h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition-transform duration-200 ${opened ? "rotate-90" : ""}`} />
                      <div className="flex-1 min-w-0 pl-2 pr-4">
                        <div className="truncate text-xs font-semibold text-slate-800 transition-colors group-hover:text-slate-900">{c.name || code}</div>
                      </div>
                      <div className="hidden sm:block w-24 flex-shrink-0 text-[11px] font-mono text-slate-400">
                        {code}
                      </div>
                      <div className="hidden md:block w-32 flex-shrink-0 text-xs text-slate-400">
                        {c.phone || "—"}
                      </div>
                      <div className={RIGHT}>
                        <span className="w-16 flex-shrink-0 text-right text-[10px] text-slate-400 font-medium select-none">
                          {c.projects.length > 0 ? "ມີໂຄງການ" : "ບໍ່ມີໂຄງການ"}
                        </span>
                        <span className={`${COUNT} text-slate-500`}>{c.projects.length}</span>
                      </div>
                      <div className={`${ACT} opacity-0 group-hover:opacity-100 transition-opacity duration-150`} onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => router.push(`/customers/new?edit=${encodeURIComponent(code)}`)}
                          title="ແກ້ໄຂ"
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => del(code)}
                          title="ລົບ"
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Customer Projects & Documents — flat, full-width rows */}
                    {opened && (
                      <div className="divide-y divide-slate-100/70 border-t border-slate-100 bg-slate-50/20">
                        {c.projects.length === 0 ? (
                          <div style={{ paddingLeft: 30 }} className="flex items-center justify-between gap-3 py-2.5 pr-4">
                            <span className="text-[11.5px] font-medium text-slate-400">ຍັງບໍ່ມີໂຄງການ</span>
                            <button
                              onClick={() => router.push(`/projects/new?cust=${encodeURIComponent(code)}&name=${encodeURIComponent(c.name || code)}`)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10.5px] font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800 cursor-pointer"
                            >
                              <Plus size={11} strokeWidth={2.75} /> ລົງທະບຽນໂຄງການ
                            </button>
                          </div>
                        ) : (
                          c.projects.map((p) => {
                            const pid = String(p.id);
                            const pOpen = isOpen(`p:${pid}`);
                            const pd = projData[pid];
                            const total = pd?.cats ? Object.values(pd.cats).reduce((s, a) => s + a.length, 0) : null;
                            return (
                              <React.Fragment key={pid}>
                                <div
                                  onClick={() => openProject(pid)}
                                  style={{ paddingLeft: 28 }}
                                  className="flex cursor-pointer items-center gap-2.5 py-2 pr-4 transition-colors hover:bg-slate-50"
                                >
                                  <ChevronRight className={`h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition-transform duration-200 ${pOpen ? "rotate-90" : ""}`} />
                                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                                    <FolderKanban size={12} />
                                  </span>
                                  <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-slate-700">{p.project_name || "(ບໍ່ມີຊື່)"}</span>
                                  <div className={RIGHT}>
                                    {p.project_status && (
                                      <span className="max-w-[78px] truncate rounded border border-slate-200/80 bg-white px-1.5 py-0.5 text-[9px] font-medium text-slate-500">
                                        {p.project_status}
                                      </span>
                                    )}
                                    {total !== null && <span className={`${COUNT} text-slate-500`}>{total}</span>}
                                  </div>
                                  <span className={ACT} />
                                </div>

                                {pOpen &&
                                  (!pd || pd.loading ? (
                                    <div style={{ paddingLeft: 52 }} className="flex items-center gap-2 py-2 pr-4 text-[11px] font-medium text-slate-400">
                                      <Loader2 size={12} className="animate-spin text-slate-400" /> ກຳລັງໂຫຼດເອກະສານ...
                                    </div>
                                  ) : pd.error ? (
                                    <div style={{ paddingLeft: 52 }} className="py-2 pr-4 text-[11px] font-medium text-slate-500">ໂຫຼດເອກະສານບໍ່ສຳເລັດ</div>
                                  ) : (
                                    CAT_TREE.map((n) => renderCat(n, pid, pd.cats!, 0))
                                  ))}
                              </React.Fragment>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}

/** Clear, minimal divider heading between page sections. */
