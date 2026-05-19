"use client";


import AuthGuard from "@/_components/AuthGuard";
import { getProjectsWaitingApprove } from "@/_actions/projects";
import { useCallback, useEffect, useMemo, useState } from "react";
import React from "react";
import Swal from "sweetalert2";
import {
  Search,
  RefreshCw,
  ChevronDown,
  FileText,
  CheckCircle2,
  ShieldCheck,
  FolderOpen,
} from "lucide-react";
import { usePageHeader } from "@/_components/PageHeader";

function _getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type ApprovalRole = "sale_manager" | "account_admin" | string;

type AttachmentItem = {
  file_path?: string;
  path?: string;
  file_name?: string;
  name?: string;
  contract_no?: string;
};

type InstallmentItem = {
  installment_no?: number | string;
  total_amount?: number | string;
  total?: number | string;
};

type ProductItem = {
  item_name?: string;
  name?: string;
  amount?: number | string;
  price?: number | string;
};

type WaitingProject = {
  id: number | string;
  project_id?: number | string;
  roworder?: number | string;
  project_name?: string;
  cust_code?: string;
  coordinator?: string;
  village_name?: string;
  district_name?: string;
  province_name?: string;
  total?: number;
  total_amount?: number | string;
  create_date?: string;
  approve_status_1?: number;
  approve_status_2?: number;
  contractlist?: AttachmentItem[];
  attachments?: AttachmentItem[];
  contract_no?: string;
  contract_name?: string;
  contract_date?: string;
  contact_name?: string;
  start_date?: string;
  sales_type?: string;
  product_brand?: string;
  project_description?: string;
  items?: ProductItem[];
  installment_schedule?: InstallmentItem[];
};

const fmt = (v: unknown) => Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
const fmtDate = (v?: string) => { if (!v) return "-"; const d = new Date(v); return Number.isNaN(d.getTime()) ? v : `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`; };

const parseArr = <T,>(v: unknown): T[] => {
  if (Array.isArray(v)) return v as T[];
  try { const p = JSON.parse(String(v || "[]")); return Array.isArray(p) ? p as T[] : []; } catch { return []; }
};

const fileUrl = (item: unknown) => {
  let rel = typeof item === "string" ? item : (item as AttachmentItem)?.file_path || (item as AttachmentItem)?.path || "";
  if (!rel) return "";
  rel = rel.replace(/^\/+/, "");
  if (!rel.startsWith("uploads/")) rel = `uploads/${rel}`;
  return `${(process.env.NEXT_PUBLIC_IMAGE_HOST || "").replace(/\/+$/, "")}/${rel}`;
};

const normalizeRole = (r: unknown): ApprovalRole => typeof r !== "string" ? "" : r.includes(",") ? r.split(",")[0].trim() : r.trim();

type FilterKey = "all" | "pending" | "approved" | "checked";

const FILTERS: { key: FilterKey; label: string; dot: string }[] = [
  { key: "all", label: "ທັງໝົດ", dot: "bg-stone-500" },
  { key: "pending", label: "ລໍຖ້າຂາຍ", dot: "bg-amber-500" },
  { key: "approved", label: "ລໍຖ້າບັນຊີ", dot: "bg-[var(--theme-primary)]" },
  { key: "checked", label: "ສຳເລັດ", dot: "bg-emerald-500" },
];

const getStatus = (p: WaitingProject) => {
  const s1 = Number(p.approve_status_1) === 1;
  const s2 = Number(p.approve_status_2) === 1;
  if (s1 && s2) return { label: "ສຳເລັດ", chip: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" };
  if (s1) return { label: "ລໍຖ້າບັນຊີ", chip: "border-[rgba(15,118,110,0.22)] bg-[var(--theme-primary-tint)] text-[var(--theme-primary)]", dot: "bg-[var(--theme-primary)]" };
  return { label: "ລໍຖ້າຂາຍ", chip: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500" };
};

function WaitingApproveList() {
  const [projects, setProjects] = useState<WaitingProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [expanded, setExpanded] = useState<Set<string | number>>(new Set());
  const [userRole, setUserRole] = useState<ApprovalRole>("");

  const toggle = (id: WaitingProject["id"]) => setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getProjectsWaitingApprove();
      setProjects((res?.data || []).map((item: any) => ({
        ...item,
        id: item.contract_no || `${item.project_id}-${item.roworder || "c"}`,
        approve_status_1: Number(item.approve_status_1 || 0),
        approve_status_2: Number(item.approve_status_2 || 0),
        contractlist: item.att_list || [],
        attachments: parseArr<AttachmentItem>(item.attachments || item.att_list || []),
        items: parseArr<ProductItem>(item.product_items || item.items || item.contract_detail),
        installment_schedule: parseArr<InstallmentItem>(item.installment_schedule),
        total: Number(item.total_amount) || 0,
      })));
    } catch { Swal.fire("ຜິດພາດ", "ໂຫຼດຂໍ້ມູນບໍ່ສຳເລັດ", "error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    try { const u = JSON.parse(localStorage.getItem("user") || "{}"); setUserRole(normalizeRole(u?.role)); } catch {}
    void fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (kw && ![p.project_name, p.contract_no, p.cust_code, p.coordinator, p.contact_name].join(" ").toLowerCase().includes(kw)) return false;
      if (filter === "pending") return Number(p.approve_status_1) === 0;
      if (filter === "approved") return Number(p.approve_status_1) === 1 && Number(p.approve_status_2) !== 1;
      if (filter === "checked") return Number(p.approve_status_1) === 1 && Number(p.approve_status_2) === 1;
      return true;
    });
  }, [projects, search, filter]);

  const counts = useMemo(() => {
    const c = { all: 0, pending: 0, approved: 0, checked: 0 };
    projects.forEach((p) => {
      c.all++;
      const s1 = Number(p.approve_status_1) === 1;
      const s2 = Number(p.approve_status_2) === 1;
      if (!s1) c.pending++; else if (!s2) c.approved++; else c.checked++;
    });
    return c;
  }, [projects]);

  usePageHeader({
    title: "ລາຍການຂໍອະນຸມັດ",
    subtitle: `${filtered.length} ລາຍການ`,
    secondaryActions: [
      {
        label: "ໂຫຼດໃໝ່",
        icon: <RefreshCw size={13} className={loading ? "animate-spin" : ""} />,
        onClick: () => void fetchData(),
        disabled: loading,
      },
    ],
    search: {
      value: search,
      onChange: setSearch,
      placeholder: "ຄົ້ນຫາ...",
    },
    filterChips: [
      { id: "all", label: "ທັງໝົດ", count: counts.all, active: filter === "all", onClick: () => setFilter("all") },
      { id: "pending", label: "ລໍຖ້າ", count: counts.pending, active: filter === "pending", onClick: () => setFilter("pending") },
      { id: "approved", label: "ອະນຸມັດແລ້ວ", count: counts.approved, active: filter === "approved", onClick: () => setFilter("approved") },
      { id: "checked", label: "ກວດແລ້ວ", count: counts.checked, active: filter === "checked", onClick: () => setFilter("checked") },
    ],
  });

  const handleAction = async (p: WaitingProject, type: "approve" | "check") => {
    const isApprove = type === "approve";
    const confirm = await Swal.fire({ title: isApprove ? "ອະນຸມັດ?" : "ກວດສອບບັນຊີ?", text: p.project_name || "", icon: "question", showCancelButton: true, confirmButtonColor: isApprove ? "#f59e0b" : "#2563eb", confirmButtonText: "ຢືນຢັນ", cancelButtonText: "ຍົກເລີກ" });
    if (!confirm.isConfirmed) return;
    const username = JSON.parse(localStorage.getItem("user") || "{}")?.username;
    const pid = String(p.project_id || "");
    const endpoint = isApprove ? `/projects/${pid}/approve` : `/projects/checkacc/${p.contract_no || p.id}`;
    const payload = isApprove ? { approve_status_1: 1, contract_no: p.contract_no, username } : { status: "1", project_id: pid, username };
    try {
      const r = await fetch(`/api${endpoint}`, { method: "PUT", headers: { "Content-Type": "application/json", ..._getAuthHeaders() }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error();
      Swal.fire({ icon: "success", title: "ສຳເລັດ", timer: 1200, showConfirmButton: false });
      await fetchData();
    } catch { Swal.fire("ຜິດພາດ", "ດຳເນີນການລົ້ມເຫຼວ", "error"); }
  };

  return (
    <div className="flex h-full flex-col text-slate-800">
      <div className="mx-auto flex min-h-0 w-full max-w-[1700px] flex-1 gap-4 px-2 py-3 lg:px-4">

        {/* ── Sidebar ── */}
        <aside className="hidden w-[240px] flex-shrink-0 self-start overflow-y-auto rounded-lg border border-[var(--theme-border-subtle)] bg-white shadow-sm xl:flex xl:max-h-full xl:flex-col">
          <div className="rounded-t-2xl bg-slate-800 px-4 py-3 text-white">
            <div className="text-xs font-semibold">ລາຍການຂໍອະນຸມັດ</div>
            <div className="mt-0.5 text-[11px] text-[var(--theme-text-mute)]">{filtered.length} / {projects.length} ລາຍການ</div>
          </div>
          <div className="space-y-1 p-2">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition ${active ? "bg-[var(--theme-bg-muted)] ring-1 ring-slate-200" : "hover:bg-[var(--theme-bg-muted)]"}`}>
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${f.dot}`} />
                    <span className="text-[11px] font-medium text-slate-700">{f.label}</span>
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${active ? "bg-slate-200 text-slate-700" : "text-[var(--theme-text-mute)]"}`}>{counts[f.key]}</span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-[var(--theme-border-subtle)] px-3 py-2">
            <div className={`rounded-lg px-2.5 py-1.5 text-center text-[10px] font-semibold ${
              userRole === "sale_manager" ? "bg-amber-50 text-amber-700" : userRole === "account_admin" ? "bg-[var(--theme-primary-tint)] text-[var(--theme-primary)]" : "bg-[var(--theme-bg-muted)] text-slate-500"
            }`}>
              {userRole === "sale_manager" ? "ຝ່າຍຂາຍ" : userRole === "account_admin" ? "ຝ່າຍບັນຊີ" : "ເບິ່ງຢ່າງດຽວ"}
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--theme-border-subtle)] bg-white shadow-sm">
          {loading ? (
            <div className="flex flex-1 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--theme-border-subtle)] border-t-blue-600" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center"><FolderOpen className="h-8 w-8 text-[var(--theme-text-mute)]" /><p className="mt-2 text-xs text-[var(--theme-text-mute)]">ບໍ່ພົບຂໍ້ມູນ</p></div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text-mute)]">
                    <th className="px-3 py-2 text-left w-8" />
                    <th className="px-3 py-2 text-left">ໂຄງການ / ສັນຍາ</th>
                    <th className="px-3 py-2 text-left">ຜູ້ຕິດຕໍ່</th>
                    <th className="px-3 py-2 text-left">ສະຖານະ</th>
                    <th className="px-3 py-2 text-right">ມູນຄ່າ</th>
                    <th className="px-3 py-2 text-left">ວັນທີ</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="text-[11px]">
                  {filtered.map((p) => {
                    const st = getStatus(p);
                    const isOpen = expanded.has(p.id);
                    const items = parseArr<ProductItem>(p.items);
                    const installments = Array.isArray(p.installment_schedule) ? p.installment_schedule : parseArr<InstallmentItem>(p.installment_schedule);
                    const attachments = parseArr<AttachmentItem>(p.attachments || p.contractlist || []);
                    const canApprove = userRole === "sale_manager" && Number(p.approve_status_1) !== 1;
                    const canCheck = userRole === "account_admin" && Number(p.approve_status_1) === 1 && Number(p.approve_status_2) !== 1;

                    return (
                      <React.Fragment key={p.id}>
                        <tr onClick={() => toggle(p.id)} className="cursor-pointer border-b border-slate-50 transition hover:bg-[var(--theme-primary-tint)]/40">
                          <td className="px-3 py-2"><ChevronDown className={`h-3.5 w-3.5 text-[var(--theme-text-mute)] transition ${isOpen ? "" : "-rotate-90"}`} /></td>
                          <td className="px-3 py-2">
                            <div className="font-semibold text-slate-800">{p.project_name || "-"}</div>
                            <div className="text-[9px] text-[var(--theme-text-mute)]">{p.contract_no || "-"} · {p.cust_code || "-"}</div>
                          </td>
                          <td className="px-3 py-2 text-slate-600">{p.coordinator || p.contact_name || "-"}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${st.chip}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />{st.label}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-800">₭{fmt(p.total)}</td>
                          <td className="px-3 py-2 text-slate-500">{fmtDate(p.create_date)}</td>
                          <td className="px-3 py-2">
                            <div className="flex justify-center gap-1">
                              {canApprove && (
                                <button onClick={(e) => { e.stopPropagation(); void handleAction(p, "approve"); }} className="flex h-7 items-center gap-1 rounded-lg bg-amber-500 px-2 text-[9px] font-medium text-white hover:bg-amber-600">
                                  <CheckCircle2 className="h-3 w-3" /> ອະນຸມັດ
                                </button>
                              )}
                              {canCheck && (
                                <button onClick={(e) => { e.stopPropagation(); void handleAction(p, "check"); }} className="flex h-7 items-center gap-1 rounded-lg bg-[var(--theme-primary)] px-2 text-[9px] font-medium text-white hover:bg-[var(--theme-primary-strong)]">
                                  <ShieldCheck className="h-3 w-3" /> ກວດສອບ
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {isOpen && (
                          <tr>
                            <td colSpan={7} className="border-b border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)]/60 px-4 py-3">
                              <div className="grid gap-3 lg:grid-cols-3">
                                <div className="rounded-md border border-[var(--theme-border-subtle)] bg-white p-3">
                                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text-mute)] mb-2">ຂໍ້ມູນສັນຍາ</div>
                                  <div className="space-y-1 text-xs text-slate-600">
                                    <div className="flex justify-between"><span>ຊື່ສັນຍາ</span><span className="font-medium text-slate-800">{p.contract_name || "-"}</span></div>
                                    <div className="flex justify-between"><span>ປະເພດ</span><span className="font-medium text-slate-800">{p.sales_type || "-"}</span></div>
                                    <div className="flex justify-between"><span>ຍີ່ຫໍ້</span><span className="font-medium text-slate-800">{p.product_brand || "-"}</span></div>
                                    <div className="flex justify-between"><span>ວັນເລີ່ມ</span><span className="font-medium text-slate-800">{fmtDate(p.start_date)}</span></div>
                                  </div>
                                </div>

                                <div className="rounded-md border border-[var(--theme-border-subtle)] bg-white p-3">
                                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text-mute)] mb-2">ລາຍການ ({items.length})</div>
                                  <div className="max-h-32 overflow-y-auto space-y-1">
                                    {items.length === 0 ? <div className="text-xs text-[var(--theme-text-mute)]">ບໍ່ມີ</div> : items.map((item, idx) => (
                                      <div key={idx} className="flex justify-between text-xs">
                                        <span className="text-slate-600">{item.item_name || item.name || "-"}</span>
                                        <span className="font-medium text-slate-800">₭{fmt(item.amount || item.price)}</span>
                                      </div>
                                    ))}
                                  </div>
                                  {installments.length > 0 && (
                                    <>
                                      <div className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text-mute)] mb-1">ງວດຈ່າຍ ({installments.length})</div>
                                      <div className="max-h-24 overflow-y-auto space-y-1">
                                        {installments.map((inst, idx) => (
                                          <div key={idx} className="flex justify-between text-xs">
                                            <span className="text-slate-500">ງວດ {inst.installment_no || idx + 1}</span>
                                            <span className="font-medium text-slate-800">₭{fmt(inst.total_amount || inst.total)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </>
                                  )}
                                </div>

                                <div className="space-y-3">
                                  <div className="rounded-md border border-[var(--theme-border-subtle)] bg-white p-3">
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text-mute)] mb-2">ສະຖານະອະນຸມັດ</div>
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between rounded-lg bg-[var(--theme-bg-muted)] px-2.5 py-1.5 text-xs">
                                        <span className="text-slate-500">ຝ່າຍຂາຍ</span>
                                        <span className={Number(p.approve_status_1) === 1 ? "font-medium text-emerald-700" : "text-amber-600"}>
                                          {Number(p.approve_status_1) === 1 ? "ອະນຸມັດແລ້ວ" : "ລໍຖ້າ"}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between rounded-lg bg-[var(--theme-bg-muted)] px-2.5 py-1.5 text-xs">
                                        <span className="text-slate-500">ຝ່າຍບັນຊີ</span>
                                        <span className={Number(p.approve_status_2) === 1 ? "font-medium text-emerald-700" : Number(p.approve_status_1) === 1 ? "text-[var(--theme-primary)]" : "text-[var(--theme-text-mute)]"}>
                                          {Number(p.approve_status_2) === 1 ? "ກວດສອບແລ້ວ" : Number(p.approve_status_1) === 1 ? "ລໍຖ້າ" : "ຍັງບໍ່ເຖິງ"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="rounded-md border border-[var(--theme-border-subtle)] bg-white p-3">
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text-mute)] mb-2">ໄຟລ໌ ({attachments.length})</div>
                                    {attachments.length === 0 ? <div className="text-xs text-[var(--theme-text-mute)]">ບໍ່ມີ</div> : (
                                      <div className="space-y-1">
                                        {attachments.slice(0, 4).map((att, idx) => (
                                          <a key={idx} href={fileUrl(att)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                                            className="flex items-center gap-1.5 rounded-lg bg-[var(--theme-bg-muted)] px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100">
                                            <FileText className="h-3 w-3 text-[var(--theme-text-mute)]" />
                                            <span className="truncate">{att.file_name || att.name || `ໄຟລ໌ ${idx + 1}`}</span>
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <AuthGuard roles={["sale_admin", "sale_manager", "account_admin"]}>
      <WaitingApproveList />
    </AuthGuard>
  );
}
