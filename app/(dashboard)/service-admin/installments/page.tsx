"use client";


import AuthGuard from "@/_components/AuthGuard";
import { getProjectInstallments } from "@/_actions/projects";
import React, { useEffect, useMemo, useState } from "react";
import {
  Search, MapPin, Calendar, User, Layers,
  FileText, DollarSign, CheckCircle, Clock,
  ChevronRight, Printer, CreditCard, LayoutGrid,
  TrendingUp, Building2, Phone, FileCheck, RefreshCw
} from "lucide-react";
import { usePageHeader } from "@/_components/PageHeader";
import ViewSwitcher, { type ViewMode } from "@/_components/odoo/ViewSwitcher";
import KanbanBoard, { type KanbanColumn } from "@/_components/odoo/KanbanBoard";

function _getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
// --- Helper Functions ---
const parseArraySafe = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value) || []; } catch { return []; }
};

const formatMoney = (num) => {
  const n = Number(num);
  if (!isFinite(n)) return "-";
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
};

const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "-" : `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
};

// --- Main Component ---
function ProjectInstallments() {
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("installments-list-view");
      if (saved === "list" || saved === "kanban") setViewMode(saved);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("installments-list-view", viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Mock data structure compatibility based on original code
      const res = await getProjectInstallments();
      const raw = Array.isArray(res?.data) ? res.data : [];

      const mapped = raw.map((item) => {
        const contracts = item.contractlist || [];
        const firstContract = contracts[0] || {};
        const schedule = contracts.flatMap((c) =>
          parseArraySafe(c.installment_schedule || c.installment || [])
        ).sort((a, b) => (Number(a.installment_no) - Number(b.installment_no)));

        return {
          id: item.project_id || item.id,
          project_name: item.project_name,
          contract_no: firstContract.contract_no || item.contract_no,
          contract_name: firstContract.contract_name || item.contract_name,
          province_name: item.province_name,
          district_name: item.district_name,
          village_name: item.village_name || item.village,
          coordinator: item.coordinator || item.contract_name,
          cust_code: item.cust_code || firstContract.cust_code,
          start_date: item.start_date || firstContract.contract_date,
          approve_status_1: firstContract.approve_status_1 ?? item.approve_status_1,
          approve_status_2: firstContract.acc_approve ?? item.approve_status_2,
          contract_count: contracts.length,
          installment_schedule: schedule,
          total_amount: schedule.reduce((sum, s) => sum + (Number(s.total_amount||s.total)||0), 0)
        };
      });
      setProjects(mapped);
      if (mapped.length > 0) setSelectedId((prev) => prev ?? mapped[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    if (!search) return projects;
    const s = search.toLowerCase();
    return projects.filter((p) =>
      [p.project_name, p.contract_no, p.cust_code].filter(Boolean).join(" ").toLowerCase().includes(s)
    );
  }, [projects, search]);

  const selectedProject = useMemo(() => projects.find(p => p.id === selectedId), [projects, selectedId]);

  usePageHeader({
    title: "ງວດຈ່າຍ",
    subtitle: `${filtered.length} ລາຍການ`,
    secondaryActions: [
      {
        label: "ໂຫຼດໃໝ່",
        icon: <RefreshCw size={13} className={loading ? "animate-spin" : ""} />,
        onClick: () => fetchData(),
        disabled: loading,
      },
    ],
    search: {
      value: search,
      onChange: setSearch,
      placeholder: "ຄົ້ນຫາໂຄງການ, ເລກສັນຍາ...",
    },
  });

  return (
      <>
      <div className="h-screen flex flex-col bg-gray-50 font-sans overflow-hidden">
        <div className="flex items-center gap-2 border-b border-gray-100 bg-white px-4 py-2 text-xs">
          <span className="text-gray-500 tabular-nums">{filtered.length} ໂຄງການ</span>
          <div className="ml-auto">
            <ViewSwitcher value={viewMode} onChange={setViewMode} />
          </div>
        </div>

        {viewMode === "kanban" ? (
          <div className="flex-1 overflow-y-auto bg-gray-50 px-3 py-3 md:px-4">
            <KanbanBoard<any>
              columns={[
                {
                  id: "unpaid",
                  title: "ລໍຖ້າຊຳລະ",
                  color: "#f59e0b",
                  records: filtered.filter(
                    (p: any) =>
                      !(
                        Number(p.approve_status_1) === 1 &&
                        Number(p.approve_status_2) === 1
                      ),
                  ),
                },
                {
                  id: "paid",
                  title: "ຊຳລະແລ້ວ",
                  color: "#10b981",
                  records: filtered.filter(
                    (p: any) =>
                      Number(p.approve_status_1) === 1 &&
                      Number(p.approve_status_2) === 1,
                  ),
                },
              ]}
              getCardId={(p: any) => String(p.id)}
              onCardClick={(p: any) => setSelectedId(p.id)}
              renderCard={(p: any) => (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[11px] font-semibold text-[var(--theme-primary)]">
                      {p.cust_code || "N/A"}
                    </span>
                    <span className="flex-shrink-0 text-[10px] text-[var(--theme-text-mute)] tabular-nums">
                      {formatDate(p.start_date)}
                    </span>
                  </div>
                  <div className="truncate text-[12px] font-semibold text-[var(--theme-text)]">
                    {p.project_name}
                  </div>
                  {p.contract_no && (
                    <div className="truncate font-mono text-[10px] text-[var(--theme-text-mute)]">
                      ສັນຍາ {p.contract_no}
                    </div>
                  )}
                  <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[var(--theme-text-mute)]">
                    <span className="truncate">{p.coordinator || ""}</span>
                    <span className="tabular-nums">
                      ₭{formatMoney(p.total_amount)}
                    </span>
                  </div>
                </div>
              )}
            />
          </div>
        ) : (
        <div className="flex-1 flex overflow-hidden">
          
          {/* Sidebar List */}
          <aside className="w-[380px] bg-white border-r border-gray-100 flex flex-col z-20 shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">ລາຍການໂຄງການ ({filtered.length})</span>
              <button className="text-gray-400 hover:text-indigo-600 transition-colors"><LayoutGrid size={16}/></button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs text-gray-400">ກຳລັງໂຫຼດຂໍ້ມູນ...</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm bg-gray-50 rounded-lg border border-dashed border-gray-200 m-2">
                  ບໍ່ພົບຂໍ້ມູນ
                </div>
              ) : (
                filtered.map((p) => {
                  const isActive = p.id === selectedId;
                  const isApproved = Number(p.approve_status_1) === 1 && Number(p.approve_status_2) === 1;

                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedId(p.id)}
                      className={`
                        relative p-4 rounded-md cursor-pointer border transition-all duration-200 group
                        ${isActive 
                          ? "bg-indigo-50/80 border-indigo-200 shadow-sm" 
                          : "bg-white border-transparent hover:bg-gray-50 hover:border-gray-200"
                        }
                      `}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isActive ? 'bg-white text-indigo-600 border-indigo-100' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                          {p.cust_code || "N/A"}
                        </span>
                        {isApproved && <div className="text-emerald-500" title="Approved"><CheckCircle size={14} fill="currentColor" className="text-emerald-100" /></div>}
                      </div>
                      
                      <h3 className={`text-sm font-bold leading-snug mb-3 line-clamp-2 ${isActive ? "text-indigo-900" : "text-gray-700"}`}>
                        {p.project_name}
                      </h3>

                      <div className="flex justify-between items-end border-t border-dashed border-gray-200 pt-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                             <User size={12} /> <span className="truncate max-w-[100px]">{p.coordinator}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400 uppercase font-semibold">ຍອດລວມ</p>
                          <p className={`text-sm font-bold ${isActive ? "text-indigo-600" : "text-gray-800"}`}>
                            ₭{formatMoney(p.total_amount)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* Main Detail Area */}
          <main className="flex-1 overflow-y-auto bg-gray-50/50 p-4 lg:p-8 custom-scrollbar">
            {selectedProject ? (
              <div className="max-w-5xl mx-auto space-y-6">
                
                {/* 1. Header Card */}
                <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                        <Building2 size={120} />
                    </div>
                    
                    <div className="relative z-10 flex flex-col md:flex-row justify-between gap-6">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-md border border-indigo-100">
                                    ສັນຍາເລກທີ: {selectedProject.contract_no}
                                </span>
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-md flex items-center gap-1">
                                    <Calendar size={12}/> {formatDate(selectedProject.start_date)}
                                </span>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2 leading-tight">{selectedProject.project_name}</h2>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                                <span className="flex items-center gap-1"><MapPin size={14}/> {selectedProject.village_name}, {selectedProject.district_name}</span>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
                            <div className="text-right">
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">ມູນຄ່າໂຄງການລວມ</p>
                                <p className="text-3xl font-extrabold text-indigo-600 tracking-tight">₭{formatMoney(selectedProject.total_amount)}</p>
                            </div>
                            <div className="h-10 w-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
                                <DollarSign size={20} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 2. Info Sidebar within Detail */}
                    <div className="space-y-4">
                        <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
                            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <User size={16} className="text-indigo-500"/> ຂໍ້ມູນລູກຄ້າ
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-xs text-gray-400 mb-0.5">ຊື່ຜູ້ຕິດຕໍ່ / ໂຄງການ</p>
                                    <p className="text-sm font-medium text-gray-700">{selectedProject.coordinator}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400 mb-0.5">ລະຫັດລູກຄ້າ</p>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-gray-700">{selectedProject.cust_code}</p>
                                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">Verified</span>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400 mb-0.5">ເບີໂທລະສັບ</p>
                                    <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                        <Phone size={12}/> -
                                    </p>
                                </div>
                            </div>
                        </div>

                         <div className="bg-gradient-to-br from-[var(--theme-primary)] to-[var(--theme-primary-strong)] rounded-lg p-5 shadow-[var(--theme-shadow)] text-white">
                            <h3 className="text-sm font-bold mb-4 opacity-90 flex items-center gap-2">
                                <FileCheck size={16}/> ສະຖານະອະນຸມັດ
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center bg-white/10 p-2 rounded-lg backdrop-blur-sm">
                                    <span className="text-xs opacity-80">ອະນຸມັດທົ່ວໄປ</span>
                                    {Number(selectedProject.approve_status_1) === 1 ? <CheckCircle size={16} className="text-emerald-300"/> : <div className="w-3 h-3 bg-white/20 rounded-full"></div>}
                                </div>
                                <div className="flex justify-between items-center bg-white/10 p-2 rounded-lg backdrop-blur-sm">
                                    <span className="text-xs opacity-80">ອະນຸມັດບັນຊີ</span>
                                    {Number(selectedProject.approve_status_2) === 1 ? <CheckCircle size={16} className="text-emerald-300"/> : <div className="w-3 h-3 bg-white/20 rounded-full"></div>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Installment Timeline (Redesigned) */}
                    <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-100 flex flex-col">
                         <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/30">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <TrendingUp size={18} className="text-indigo-500"/> 
                                ຕາຕະລາງການຊຳລະເງິນ
                                <span className="text-xs font-normal text-gray-400 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                                    {selectedProject.installment_schedule.length} ງວດ
                                </span>
                            </h3>
                            <button className="text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-all" title="Print Schedule">
                                <Printer size={18}/>
                            </button>
                        </div>

                        <div className="p-6 relative">
                            {/* Vertical Line */}
                            <div className="absolute left-[39px] top-6 bottom-6 w-0.5 bg-gray-100"></div>

                            {selectedProject.installment_schedule.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-50 mb-3 text-gray-300">
                                        <Layers size={24}/>
                                    </div>
                                    <p className="text-gray-400 text-sm">ຍັງບໍ່ມີຂໍ້ມູນຕາຕະລາງການຊຳລະ</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {selectedProject.installment_schedule.map((ins, idx) => (
                                        <div key={idx} className="relative pl-10 group">
                                            {/* Dot on Timeline */}
                                            <div className="absolute left-0 top-1 w-8 h-8 rounded-full border-2 border-white shadow-sm bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs z-10 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                {ins.installment_no}
                                            </div>

                                            {/* Card Content */}
                                            <div className="bg-white border border-gray-100 rounded-md p-4 hover:shadow-md hover:border-indigo-200 transition-all cursor-default">
                                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold text-gray-700">ງວດທີ {ins.installment_no}</span>
                                                        <span className="px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500 font-medium">WAITING</span>
                                                    </div>
                                                    <span className="text-lg font-bold text-indigo-600">₭{formatMoney(ins.total_amount || ins.total)}</span>
                                                </div>

                                                <div className="space-y-1.5 bg-gray-50/50 rounded-lg p-3">
                                                    {parseArraySafe(ins.items).map((sub, i) => (
                                                        <div key={i} className="flex justify-between items-center text-xs">
                                                            <div className="flex items-center gap-2 text-gray-600">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                                                                {sub.category_label || sub.category}
                                                            </div>
                                                            <span className="font-medium text-gray-800">₭{formatMoney(sub.amount)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-300 select-none">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6 text-gray-300">
                    <CreditCard size={40} />
                </div>
                <h3 className="text-lg font-bold text-gray-400 mb-2">ກະລຸນາເລືອກໂຄງການ</h3>
                <p className="text-sm text-gray-400 max-w-xs text-center">ເລືອກລາຍການໂຄງການຈາກທາງຊ້າຍມື ເພື່ອເບິ່ງລາຍລະອຽດ ແລະ ຕາຕະລາງການຊຳລະເງິນ</p>
              </div>
            )}
          </main>
        </div>
        )}
      </div>
      </>
  );
}

export default function Page() {
  return (
    <AuthGuard roles={["service_admin", "service_manager", "sale_manager", "sale_admin", "account_admin", "head_technician"]}>
      <ProjectInstallments />
    </AuthGuard>
  );
}
