"use client";

import { useEffect, useMemo, useState } from "react";
import {
  User, Users, Wrench, Phone, Plus, Save, RefreshCw,
  Search, Shield, Edit2, CheckCircle2, X, Trash2
} from "lucide-react";
import { usePageHeader } from "@/_components/PageHeader";

function _getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// --- Helpers ---
const getInitials = (name) => name ? name.substring(0, 2).toUpperCase() : "??";
const getRandomColor = (name) => {
  const colors = ["bg-[var(--theme-primary-tint)] text-[var(--theme-primary)]", "bg-indigo-100 text-indigo-600", "bg-emerald-100 text-emerald-600", "bg-amber-100 text-amber-600", "bg-rose-100 text-rose-600"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const ROLE_CONFIG = {
  technician: { label: "Technician", class: "bg-[var(--theme-primary-tint)] text-[var(--theme-primary)] border-[rgba(15,118,110,0.22)]" },
  lead: { label: "Lead Tech", class: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  assistant: { label: "Assistant", class: "bg-[var(--theme-bg-muted)] text-slate-600 border-[var(--theme-border-subtle)]" },
  as_technician: { label: "Assistant", class: "bg-[var(--theme-bg-muted)] text-slate-600 border-[var(--theme-border-subtle)]" }
};

export default function ManageTechnicians() {
  const [techs, setTechs] = useState([]);
  const [helpers, setHelpers] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  
  // UI State
  const [activeTab, setActiveTab] = useState("technicians"); // 'technicians' | 'assistants'
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  // Form State
  const initialForm = { code: "", name_1: "", phone: "", role: "technician", helpers: [], roworder: null };
  const [form, setForm] = useState(initialForm);

  // Load Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [tRes, hRes] = await Promise.all([
        fetch("/api/technicians", { headers: _getAuthHeaders() }).then(r => r.json()),
        fetch("/api/helpers", { headers: _getAuthHeaders() }).then(r => r.json())
      ]);
      setTechs(tRes?.data || []);
      setHelpers(hRes?.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Filter Logic
  useEffect(() => {
    const data = activeTab === "technicians" ? techs : helpers;
    if (!search) {
      setFilteredData(data);
    } else {
      const s = search.toLowerCase();
      setFilteredData(data.filter(d => 
        d.name_1?.toLowerCase().includes(s) || 
        d.code?.toLowerCase().includes(s) ||
        d.phone?.includes(s)
      ));
    }
    // auto set form role to match tab when creating new
    setForm((prev) => ({ ...initialForm, role: activeTab === "assistants" ? "assistant" : "technician" }));
  }, [activeTab, techs, helpers, search]);

  // Submit Logic
  const submit = async () => {
    if (!form.name_1 || !form.role) {
      setMessage("Please fill in required fields (*)");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const payload = { ...form, helpers: form.helpers };
      const endpoint = activeTab === "technicians" ? "/technicians" : "/helpers"; // Adjust endpoint logic if needed
      // Note: Assuming API handles assistants in technicians endpoint or separate logic. 
      // Using original logic:
      const res = await (form.roworder
        ? fetch(`/api/technicians/${form.roworder}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ..._getAuthHeaders() },
      body: JSON.stringify(payload),
    })
        : fetch("/api/technicians", {
      method: "POST",
      headers: { "Content-Type": "application/json", ..._getAuthHeaders() },
      body: JSON.stringify(payload),
    }));

      if (res?.success) {
        setMessage("Saved successfully");
        setForm(initialForm);
        loadData();
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage(res?.message || "Save failed");
      }
    } catch (err) {
      setMessage("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (record) => {
    setForm({
      roworder: record.roworder,
      code: record.code || "",
      name_1: record.name_1 || "",
      phone: record.phone || "",
      role: record.role || (activeTab === 'assistants' ? 'assistant' : 'technician'),
      helpers: record.helpers || []
    });
  };

  const deleteMember = async (record) => {
    if (!record?.roworder) return;
    const confirmDelete = window.confirm(`ຢືນຢັນລົບ ${record.name_1 || record.code || ""}?`);
    if (!confirmDelete) return;
    setDeletingId(record.roworder);
    setMessage("");
    try {
      const res = await fetch(`/api/technicians/${record.roworder}`, { method: "DELETE", headers: _getAuthHeaders() }).then(r => r.json());
      if (res?.success) {
        if (form.roworder === record.roworder) setForm(initialForm);
        setMessage("Deleted successfully");
        loadData();
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage(res?.message || "Delete failed");
      }
    } catch (err) {
      setMessage("An error occurred");
    } finally {
      setDeletingId(null);
    }
  };

  const helperOptions = useMemo(() => helpers.map(h => ({ value: h.code || h.name_1, label: h.name_1 })), [helpers]);
  const helperMap = useMemo(() => {
    const map = {};
    helpers.forEach(h => {
      const key = h.code || h.name_1;
      if (key) map[key] = h.name_1 || h.code;
    });
    return map;
  }, [helpers]);

  usePageHeader({
    title: "ຈັດການຊ່າງ",
    subtitle: `${filteredData.length} ລາຍການ`,
    primaryAction: {
      label: "ເພີ່ມຊ່າງ",
      icon: <Plus size={13} />,
      onClick: () => setForm({ ...initialForm, role: activeTab === "assistants" ? "assistant" : "technician" }),
    },
    secondaryActions: [
      {
        label: "ໂຫຼດໃໝ່",
        icon: <RefreshCw size={13} className={loading ? "animate-spin" : ""} />,
        onClick: () => loadData(),
        disabled: loading,
      },
    ],
    search: {
      value: search,
      onChange: setSearch,
      placeholder: "Search name, code...",
    },
    filterChips: [
      { id: "technicians", label: "ຊ່າງ", count: techs.length, active: activeTab === "technicians", onClick: () => setActiveTab("technicians") },
      { id: "assistants", label: "ຜູ້ຊ່ວຍ", count: helpers.length, active: activeTab === "assistants", onClick: () => setActiveTab("assistants") },
    ],
  });

  return (
      <>
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-20 font-sans">

        <div className=" px-4 py-6 grid lg:grid-cols-[380px_1fr] gap-6 items-start">
          
          {/* Left Panel: Form */}
          <div className="bg-white border border-[var(--theme-border-subtle)] rounded-lg shadow-sm overflow-hidden sticky top-24">
            <div className="px-5 py-4 border-b border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)]/50 flex justify-between items-center">
              <span className="font-bold text-slate-700 text-sm flex items-center gap-2">
                {form.roworder ? <Edit2 size={16} className="text-amber-500"/> : <Plus size={16} className="text-emerald-500"/>}
                {form.roworder ? "Edit Member" : "Add New Member"}
              </span>
              {form.roworder && (
                <button onClick={() => setForm(initialForm)} className="text-[10px] text-[var(--theme-text-mute)] hover:text-rose-500 underline">Cancel</button>
              )}
            </div>
            
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1 space-y-1">
                  <label className="text-[11px] font-bold text-[var(--theme-text-mute)] uppercase">Code</label>
                  <input 
                    className="w-full text-sm bg-[var(--theme-bg-muted)] border border-[var(--theme-border-subtle)] rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all" 
                    placeholder="T-001" 
                    value={form.code} 
                    onChange={e => setForm({ ...form, code: e.target.value })}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                   <label className="text-[11px] font-bold text-[var(--theme-text-mute)] uppercase">Role *</label>
                   <select 
                    className="w-full text-sm bg-[var(--theme-bg-muted)] border border-[var(--theme-border-subtle)] rounded-lg px-3 py-2 outline-none focus:border-indigo-500 transition-all"
                    value={form.role} 
                    onChange={e => setForm({ ...form, role: e.target.value })}
                  >
                    <option value="technician">Technician</option>
                    <option value="lead">Lead Technician</option>
                    <option value="assistant">Assistant</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[var(--theme-text-mute)] uppercase">Full Name *</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-2.5 text-[var(--theme-text-mute)]"/>
                  <input 
                    className="w-full text-sm bg-[var(--theme-bg-muted)] border border-[var(--theme-border-subtle)] rounded-lg pl-9 pr-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all" 
                    placeholder="Ex. Somchai Dee" 
                    value={form.name_1} 
                    onChange={e => setForm({ ...form, name_1: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[var(--theme-text-mute)] uppercase">Phone Number</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-2.5 text-[var(--theme-text-mute)]"/>
                  <input 
                    className="w-full text-sm bg-[var(--theme-bg-muted)] border border-[var(--theme-border-subtle)] rounded-lg pl-9 pr-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all" 
                    placeholder="020 5555 5555" 
                    value={form.phone} 
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>

              {form.role !== "assistant" && (
                <div className="pt-2 border-t border-[var(--theme-border-subtle)]">
                  <label className="text-[11px] font-bold text-[var(--theme-text-mute)] uppercase mb-2 block">Default Assistants</label>
                  <div className="bg-[var(--theme-bg-muted)] rounded-lg border border-[var(--theme-border-subtle)] p-2 max-h-40 overflow-y-auto">
                    <div className="flex flex-wrap gap-2 mb-2">
                       {form.helpers.map((hCode, idx) => (
                         <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-[var(--theme-border-subtle)] text-[10px] font-bold text-slate-700 shadow-sm">
                           {hCode}
                           <button 
                              onClick={() => setForm({...form, helpers: form.helpers.filter(h => h !== hCode)})}
                              className="hover:text-rose-500"
                           ><X size={10}/></button>
                         </span>
                       ))}
                    </div>
                    <select
                      className="w-full text-xs bg-white border border-[var(--theme-border-subtle)] rounded px-2 py-1.5 outline-none"
                      onChange={(e) => {
                        if (e.target.value && !form.helpers.includes(e.target.value)) {
                          setForm({ ...form, helpers: [...form.helpers, e.target.value] });
                        }
                      }}
                      value=""
                    >
                      <option value="">+ Add Assistant</option>
                      {helperOptions.map((h, idx) => (
                        <option key={idx} value={h.value}>{h.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={submit}
                  disabled={saving}
                  className="w-full py-2.5 rounded-md bg-slate-900 text-white font-bold text-sm hover:bg-black disabled:opacity-70 flex items-center justify-center gap-2 shadow-[var(--theme-shadow)] shadow-slate-200 transition-all"
                >
                  {saving ? <RefreshCw className="animate-spin" size={16}/> : <Save size={16}/>} 
                  {form.roworder ? "Update Member" : "Save Member"}
                </button>
                {form.roworder && (
                  <button
                    onClick={() => deleteMember({ roworder: form.roworder, name_1: form.name_1, code: form.code })}
                    disabled={deletingId === form.roworder}
                    className="mt-2 w-full py-2.5 rounded-md border border-rose-200 text-rose-600 font-bold text-sm hover:bg-rose-50 disabled:opacity-60 flex items-center justify-center gap-2 transition-all"
                  >
                    <Trash2 size={16} className={deletingId === form.roworder ? "animate-pulse" : ""} />
                    <span>Delete Member</span>
                  </button>
                )}
                {message && (
                  <div className={`mt-3 text-center text-xs font-bold ${message.includes("success") ? "text-emerald-600" : "text-rose-500"}`}>
                    {message}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel: List */}
          <div className="space-y-4">

            {/* Table Card */}
            <div className="bg-white border border-[var(--theme-border-subtle)] rounded-lg shadow-sm overflow-hidden min-h-[400px]">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--theme-bg-muted)] border-b border-[var(--theme-border-subtle)] text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="px-5 py-3">Profile</th>
                      <th className="px-5 py-3">Contact</th>
                      <th className="px-5 py-3">Role</th>
                      {activeTab === "technicians" && <th className="px-5 py-3">Default Team</th>}
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i}><td colSpan="5" className="px-5 py-4"><div className="h-8 bg-[var(--theme-bg-muted)] rounded animate-pulse"/></td></tr>
                      ))
                    ) : filteredData.length === 0 ? (
                      <tr><td colSpan="5" className="px-5 py-10 text-center text-[var(--theme-text-mute)] text-xs">No members found</td></tr>
                    ) : (
                      filteredData.map((item, idx) => {
                        const badge = ROLE_CONFIG[item.role] || ROLE_CONFIG.technician;
                        const avatarColor = getRandomColor(item.name_1 || "User");
                        return (
                          <tr key={idx} className="hover:bg-[var(--theme-bg-muted)] transition-colors group">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${avatarColor}`}>
                                  {getInitials(item.name_1)}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-700">{item.name_1}</div>
                                  <div className="text-[10px] text-[var(--theme-text-mute)] font-mono">{item.code}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-slate-600 text-xs font-medium">
                              {item.phone ? (
                                <span className="flex items-center gap-1.5"><Phone size={12} className="text-[var(--theme-text-mute)]"/> {item.phone}</span>
                              ) : <span className="text-[var(--theme-text-mute)]">-</span>}
                            </td>
                            <td className="px-5 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${badge.class}`}>
                                {badge.label}
                              </span>
                            </td>
                            {activeTab === "technicians" && (
                              <td className="px-5 py-3">
                                { (item.helpers || []).length === 0 ? (
                                  <span className="text-[var(--theme-text-mute)] text-[10px] italic">No helpers</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {(item.helpers || []).map((h, i) => {
                                      const label = helperMap[h] || h;
                                      return (
                                        <span key={i} className="px-2 py-0.5 rounded-full bg-slate-100 border border-[var(--theme-border-subtle)] text-[10px] text-slate-700">
                                          {label}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                              </td>
                            )}
                            <td className="px-5 py-3 text-right">
                              <button 
                                onClick={() => { setActiveTab(item.role === "assistant" ? "assistants" : "technicians"); startEdit(item); }}
                                className="p-1.5 rounded-md text-[var(--theme-text-mute)] hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                              >
                                <Edit2 size={14}/>
                              </button>
                              <button
                                onClick={() => deleteMember(item)}
                                disabled={deletingId === item.roworder}
                                className="ml-1 p-1.5 rounded-md text-[var(--theme-text-mute)] hover:text-rose-600 hover:bg-rose-50 transition-all disabled:opacity-60"
                                title="Delete"
                              >
                                <Trash2 size={14} className={deletingId === item.roworder ? "animate-pulse" : ""} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </div>
      </>
  );
}