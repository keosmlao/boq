"use client";


import AuthGuard from "@/_components/AuthGuard";
import { getTasks } from "@/_actions/lookups";
import { getWorkSchedule, saveWorkSchedule } from "@/_actions/work-orders";
import { useParams,useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Save,
  Trash2,
  ArrowLeft,
  LayoutGrid,
  Search,
  Plus,
  AlertCircle,
  Clock,
  Briefcase,
  User,
  MessageSquare,
  X,
  Target,
  MoreHorizontal
} from "lucide-react";

function _getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
const STORAGE_PREFIX = "work_schedule_";

function WorkSchedule() {
  const router = useRouter();
  const { id: projectCode, contractNo } = useParams();
  const storageKey = `${STORAGE_PREFIX}${projectCode || "unknown"}_${contractNo || ""}`;

  const [rows, setRows] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [taskOptions, setTaskOptions] = useState([]);
  const [taskSearch, setTaskSearch] = useState("");
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [loadError, setLoadError] = useState("");

  const normalize = (v) => (v || "").toString().trim().toLowerCase();

  const isAlreadyAdded = (task) => {
    const idKey = normalize(task?.id || task?.code);
    return rows.some((r) => normalize(r.master_id || r.id) === idKey);
  };
  const isIssued = (row) => {
    const status = normalize(row?.status);
    return row?.issued === true || status.includes("ອອກແລ້ວ") || status.includes("issued");
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await getWorkSchedule(projectCode || "", contractNo || "");
        const data = (res?.success ? res.data : []) as any[];
        if (Array.isArray(data) && data.length) setRows(data);
        else {
          const saved = localStorage.getItem(storageKey);
          if (saved) setRows(JSON.parse(saved));
        }
      } catch (err) {
        setLoadError("ການເຊື່ອມຕໍ່ຖານຂໍ້ມູນມີບັນຫາ.");
        const saved = localStorage.getItem(storageKey);
        if (saved) setRows(JSON.parse(saved));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [storageKey, projectCode, contractNo]);

  useEffect(() => {
    getTasks().then(res => setTaskOptions(res?.success ? (res.data as any[]) : [])).catch(() => {});
  }, []);

  const saveSchedule = async () => {
    setSaving(true);
    try {
      await saveWorkSchedule({ project_code: projectCode, contract_no: contractNo, tasks: rows });
      localStorage.setItem(storageKey, JSON.stringify(rows));
      setDirty(false);
    } catch (err) {
      alert("ບັນທຶກບໍ່ສຳເລັດ");
    } finally {
      setSaving(false);
    }
  };

  const updateRow = (idx, patch) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
    setDirty(true);
  };

  const removeRow = (idx) => {
    if (isIssued(rows[idx])) {
      alert("ລາຍການນີ້ອອກແລ້ວ ໄມ່ສາມາດລຶບໄດ້");
      return;
    }
    if(window.confirm("ຕ້ອງການລຶບລາຍການນີ້?")) {
      setRows(prev => prev.filter((_, i) => i !== idx));
      setDirty(true);
    }
  };

  const addTaskFromOption = (task) => {
    setRows(prev => [...prev, {
      master_id: task.id || task.code,
      phase: task.phase || "",
      task: task.task || task.name || "",
      owner: task.owner || "",
      start: task.start || "",
      end: task.end || "",
      progress: 0,
      status: "",
    }]);
    setDirty(true);
    setShowTaskModal(false);
  };

  const getPhaseStyle = (p = "") => {
    const phase = p.toLowerCase();
    if (phase.includes("plan")) return "bg-[var(--theme-primary-tint)] text-[var(--theme-primary)] border-[rgba(15,118,110,0.16)]";
    if (phase.includes("exec")) return "bg-amber-50 text-amber-600 border-amber-100";
    if (phase.includes("close")) return "bg-emerald-50 text-emerald-600 border-emerald-100";
    return "bg-[var(--theme-bg-muted)] text-slate-500 border-[var(--theme-border-subtle)]";
  };

  const stats = useMemo(() => {
    const total = rows.length;
    const completed = rows.filter(r => Number(r.progress) >= 100).length;
    const avg = total ? Math.round(rows.reduce((s, r) => s + Number(r.progress || 0), 0) / total) : 0;
    return { total, completed, avg };
  }, [rows]);

  return (
    <>
      <div className="min-h-screen bg-[#F1F5F9]">
        {/* Header Section */}
        <div className="sticky top-0 z-40 bg-white border-b border-[var(--theme-border-subtle)]">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button onClick={() => router.back()} className="p-2 rounded-md bg-[var(--theme-bg-muted)] border border-[var(--theme-border-subtle)] hover:bg-slate-100 transition-all">
                  <ArrowLeft size={20} className="text-slate-600" />
                </button>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none">Work Schedule</h1>
                  <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wider">{projectCode} • {contractNo}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button onClick={() => setShowTaskModal(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-all">
                  <Plus size={16} />
                  ເພີ່ມວຽກ
                </button>
                <button onClick={saveSchedule} disabled={!dirty || saving} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${dirty ? 'bg-emerald-600 text-white shadow-[var(--theme-shadow)] shadow-emerald-200' : 'bg-slate-200 text-[var(--theme-text-mute)] cursor-not-allowed'}`}>
                  {saving ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
                  ບັນທຶກທັງໝົດ
                </button>
              </div>
            </div>
          </div>
        </div>

        <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
          {/* Dashboard Info Area */}
          <div className="flex flex-wrap gap-4 mb-6">
             <div className="bg-white px-4 py-3 rounded-md border border-[var(--theme-border-subtle)] flex items-center gap-3 shadow-sm min-w-[180px]">
                <div className="w-8 h-8 rounded-lg bg-[var(--theme-primary-tint)] flex items-center justify-center text-[var(--theme-primary)]"><LayoutGrid size={18}/></div>
                <div><p className="text-[10px] font-bold text-[var(--theme-text-mute)] uppercase leading-none mb-1">Total Tasks</p><p className="text-lg font-black text-slate-900">{stats.total}</p></div>
             </div>
             <div className="bg-white px-4 py-3 rounded-md border border-[var(--theme-border-subtle)] flex items-center gap-3 shadow-sm min-w-[180px]">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600"><CheckCircle2 size={18}/></div>
                <div><p className="text-[10px] font-bold text-[var(--theme-text-mute)] uppercase leading-none mb-1">Completed</p><p className="text-lg font-black text-slate-900">{stats.completed}</p></div>
             </div>
             <div className="bg-white px-4 py-3 rounded-md border border-[var(--theme-border-subtle)] flex items-center gap-3 shadow-sm min-w-[180px]">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600"><Clock size={18}/></div>
                <div><p className="text-[10px] font-bold text-[var(--theme-text-mute)] uppercase leading-none mb-1">Avg ວັນ</p><p className="text-lg font-black text-slate-900">{stats.avg}</p></div>
             </div>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-lg border border-[var(--theme-border-subtle)] shadow-[var(--theme-shadow-lg)] shadow-slate-200/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--theme-bg-muted)]/80 border-b border-[var(--theme-border-subtle)]">
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest w-16">#</th>
                    <th className="px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">ລາຍລະອຽດວຽກ</th>
                    <th className="px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest w-32 text-center">Phase</th>
                    <th className="px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest w-48 text-center">ໄລຍະເວລາ</th>
                    <th className="px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest w-40 text-center">ຜູ້ຮັບຜິດຊອບ</th>
                    <th className="px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest w-64 text-center">Progress & Status</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest w-16 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan="7" className="py-20 text-center text-[var(--theme-text-mute)] font-medium">ກຳລັງໂຫຼດຂໍ້ມູນ...</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan="7" className="py-20 text-center text-[var(--theme-text-mute)] font-medium italic">ບໍ່ມີຂໍ້ມູນວຽກໃນຕາຕະລາງ</td></tr>
                  ) : (
                    rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-[var(--theme-bg-muted)]/50 transition-colors group">
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-[var(--theme-text-mute)] tracking-tighter">{(idx + 1).toString().padStart(2, '0')}</span>
                        </td>
                        <td className="px-4 py-4">
                          <div>
                            <p className="text-sm font-bold text-slate-800 leading-tight">{row.task}</p>
                            <p className="text-[10px] text-[var(--theme-text-mute)] mt-1 font-mono uppercase tracking-tight">ID: {row.master_id || 'NEW'}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${getPhaseStyle(row.phase)}`}>
                            {row.phase || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="inline-flex flex-col text-[11px] font-bold text-slate-600 gap-1">
                             <span className="flex items-center gap-1"><CalendarClock size={10} className="text-[var(--theme-text-mute)]"/> {row.start || '-'}</span>
                             <span className="text-[var(--theme-text-mute)]">|</span>
                             <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={10}/> {row.end || '-'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                             <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[var(--theme-text-mute)] border border-[var(--theme-border-subtle)]">
                                <User size={14}/>
                             </div>
                             <span className="text-xs font-semibold text-slate-700">{row.owner || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                           <div className="space-y-2 max-w-[240px] mx-auto">
                              <div className="flex items-center justify-between text-[10px] font-bold">
                                 <span className="text-[var(--theme-text-mute)]">ວັນ: {row.progress}</span>
                                <span className={Number(row.progress) >= 100 ? 'text-emerald-500' : 'text-[var(--theme-primary)]'}>{row.progress}</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                 <div 
                                    className={`h-full rounded-full transition-all duration-500 ${Number(row.progress) >= 100 ? 'bg-emerald-500' : 'bg-[var(--theme-primary)]'}`} 
                                    style={{width: `${Math.min(100, Number(row.progress))}%`}}
                                 />
                              </div>
                              <div className="flex gap-1 pt-1">
                                 <div className="relative flex-1">
                                    <Target size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--theme-text-mute)]"/>
                                    <input 
                                      type="number" 
                                      value={row.progress}
                                      disabled={isIssued(row)}
                                      onChange={(e) => updateRow(idx, {progress: e.target.value})}
                                      className={`w-full pl-6 pr-1 py-1 bg-white border border-[var(--theme-border-subtle)] rounded text-[10px] focus:ring-1 focus:ring-emerald-500 outline-none ${isIssued(row) ? "opacity-60 cursor-not-allowed" : ""}`}
                                    />
                                 </div>
                                 <div className="relative flex-[2]">
                                    <MessageSquare size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--theme-text-mute)]"/>
                                    <input 
                                      type="text" 
                                      value={row.status}
                                      placeholder="Note..."
                                      disabled={isIssued(row)}
                                      onChange={(e) => updateRow(idx, {status: e.target.value})}
                                      className={`w-full pl-6 pr-1 py-1 bg-white border border-[var(--theme-border-subtle)] rounded text-[10px] focus:ring-1 focus:ring-emerald-500 outline-none ${isIssued(row) ? "opacity-60 cursor-not-allowed" : ""}`}
                                    />
                                 </div>
                              </div>
                              {isIssued(row) && (
                                <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                                  ອອກແລ້ວ
                                </div>
                              )}
                           </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                           <button 
                             onClick={() => removeRow(idx)}
                             disabled={isIssued(row)}
                             className={`p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${isIssued(row) ? "text-[var(--theme-text-mute)] cursor-not-allowed" : "text-[var(--theme-text-mute)] hover:text-rose-500 hover:bg-rose-50"}`}
                           >
                             <Trash2 size={16}/>
                           </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Task Selection Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowTaskModal(false)} />
          <div className="relative bg-white w-full max-w-xl rounded-lg shadow-[var(--theme-shadow-lg)] flex flex-col max-h-[80vh] overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-[var(--theme-border-subtle)] flex items-center justify-between">
              <h3 className="font-bold text-slate-900">ເລືອກວຽກຈາກ Master List</h3>
              <button onClick={() => setShowTaskModal(false)} className="p-1.5 hover:bg-[var(--theme-bg-muted)] rounded-lg text-[var(--theme-text-mute)]"><X size={18}/></button>
            </div>
            <div className="p-4 bg-[var(--theme-bg-muted)] border-b border-[var(--theme-border-subtle)]">
               <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-text-mute)]"/>
                  <input 
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    placeholder="ຄົ້ນຫາວຽກ..." 
                    className="w-full pl-10 pr-4 py-2 bg-white border border-[var(--theme-border-subtle)] rounded-md text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
               </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
               {taskOptions
                .filter(t => !isAlreadyAdded(t))
                .filter(t => !taskSearch || (t.task || t.name || "").toLowerCase().includes(taskSearch.toLowerCase()))
                .map((t, i) => (
                  <button 
                    key={i} 
                    onClick={() => addTaskFromOption(t)}
                    className="w-full flex items-center justify-between p-3 rounded-md hover:bg-emerald-50 group transition-all border border-transparent hover:border-emerald-100"
                  >
                     <div className="text-left">
                        <p className="text-sm font-bold text-slate-800 group-hover:text-emerald-700">{t.task || t.name}</p>
                        <p className="text-[10px] text-[var(--theme-text-mute)] font-medium uppercase mt-0.5">{t.phase} • {t.owner || 'No Owner'}</p>
                     </div>
                     <Plus size={16} className="text-[var(--theme-text-mute)] group-hover:text-emerald-500"/>
                  </button>
               ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function Page() {
  return (
    <AuthGuard roles={["service_admin", "service_manager", "sale_manager", "sale_admin", "account_admin", "head_technician"]}>
      <WorkSchedule />
    </AuthGuard>
  );
}
