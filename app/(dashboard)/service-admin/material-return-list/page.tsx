"use client";


import AuthGuard from "@/_components/AuthGuard";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Plus,
  RefreshCw,
  Calendar,
  Hash,
  User,
  Package,
  Search,
  Download,
  Eye,
  Clock,
  CheckCircle,
  List,
  Grid3X3,
  X,
  RotateCcw,
  Trash2,
} from "lucide-react";
import Swal from "sweetalert2";
import { usePageHeader } from "@/_components/PageHeader";

function _getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}


function MaterialReturnList() {
  const router = useRouter();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewMode, setViewMode] = useState("table");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailReturn, setDetailReturn] = useState(null);

  useEffect(() => {
    fetchReturns();
  }, []);

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/materials/returns", { headers: _getAuthHeaders() }).then(r => r.json());
      setReturns(res?.data || []);
    } catch (err) {
      setReturns([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredReturns = returns.filter((ret) => {
    const matchesSearch =
      ret.projectName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ret.returnedBy?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ret.doc_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ret.id?.toString().includes(searchTerm);

    if (filterStatus === "all") return matchesSearch;
    return matchesSearch && ret.status === filterStatus;
  });

  const getStatusBadge = (status) => {
    const badges = {
      completed: {
        bg: "bg-emerald-100",
        text: "text-emerald-700",
        icon: CheckCircle,
        label: "ສຳເລັດ",
      },
      pending: {
        bg: "bg-amber-100",
        text: "text-amber-700",
        icon: Clock,
        label: "ລໍຖ້າ",
      },
      processing: {
        bg: "bg-sky-100",
        text: "text-sky-700",
        icon: RefreshCw,
        label: "ກຳລັງດຳເນີນ",
      },
    };
    const badge = badges[status] || badges.completed;
    const Icon = badge.icon;
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${badge.bg} ${badge.text}`}
      >
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  const openDetail = (ret) => {
    setDetailReturn(ret);
    setDetailOpen(true);
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailReturn(null);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
  };

  const hasFilters = searchTerm || filterStatus !== "all";

  const summary = {
    total: returns.length,
    completed: returns.filter((r) => r.status === "completed").length,
    pending: returns.filter((r) => r.status === "pending").length,
    processing: returns.filter((r) => r.status === "processing").length,
  };

  const detailItems = Array.isArray(detailReturn?.items)
    ? detailReturn.items
    : [];

  const deleteReturn = async (ret) => {
    if (!ret?.doc_no) {
      Swal.fire({
        icon: "warning",
        title: "ລົບບໍ່ໄດ້",
        text: "ບໍ່ພົບເລກທີໃບຂໍຄືນ",
      });
      return;
    }

    const result = await Swal.fire({
      icon: "warning",
      title: "ຢືນຢັນການລົບ",
      text: `ຕ້ອງການລົບໃບຂໍຄືນ ${ret.doc_no} ຫຼື ບໍ່?`,
      showCancelButton: true,
      confirmButtonText: "ລົບ",
      cancelButtonText: "ຍົກເລີກ",
      confirmButtonColor: "#991b1b",
    });

    if (!result.isConfirmed) return;

    try {
      await fetch(`/api/materials/returns/${encodeURIComponent(ret.doc_no)}`, { method: "DELETE", headers: _getAuthHeaders() });
      setReturns((prev) => prev.filter((r) => r.doc_no !== ret.doc_no));
      if (detailReturn?.doc_no === ret.doc_no) {
        closeDetail();
      }
      Swal.fire({
        icon: "success",
        title: "ສຳເລັດ",
        text: "ລົບໃບຂໍຄືນແລ້ວ",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "ລົບບໍ່ສຳເລັດ",
        text: err?.message || "ກະລຸນາລອງໃໝ່",
      });
    }
  };

  // Register page-level header (title, primary action, search, status chips)
  // so the dashboard TopBar control panel can render them Odoo-style.
  usePageHeader({
    title: "ຂໍຄືນອາໄຫຼ່",
    subtitle: `${filteredReturns.length} ລາຍການ`,
    primaryAction: {
      label: "ສ້າງໃບຄືນໃໝ່",
      icon: <Plus size={13} />,
      onClick: () => router.push("/service-admin/material-return"),
    },
    secondaryActions: [
      {
        label: "ໂຫຼດໃໝ່",
        icon: <RefreshCw size={13} className={loading ? "animate-spin" : ""} />,
        onClick: () => fetchReturns(),
        disabled: loading,
      },
    ],
    search: {
      value: searchTerm,
      onChange: setSearchTerm,
      placeholder: "ຊອກຫາໂຄງການ, ຜູ້ຄືນ ຫຼື ເລກທີ່...",
    },
    filterChips: [
      {
        id: "all",
        label: "ທັງໝົດ",
        count: summary.total,
        active: filterStatus === "all",
        onClick: () => setFilterStatus("all"),
      },
      {
        id: "pending",
        label: "ລໍຖ້າ",
        count: summary.pending,
        active: filterStatus === "pending",
        onClick: () => setFilterStatus("pending"),
      },
      {
        id: "processing",
        label: "ກຳລັງດຳເນີນ",
        count: summary.processing,
        active: filterStatus === "processing",
        onClick: () => setFilterStatus("processing"),
      },
      {
        id: "completed",
        label: "ສຳເລັດ",
        count: summary.completed,
        active: filterStatus === "completed",
        onClick: () => setFilterStatus("completed"),
      },
    ],
  });

  return (
    <>
      {/* Custom Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        
        .return-page {
          font-family: var(--font-lao), 'IBM Plex Sans', system-ui, sans-serif;
        }
        
        .mono-text {
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
        }
        
        .grain-overlay {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
          opacity: 0.03;
        }
        
        .action-btn {
          transition: all 0.15s ease;
        }
        
        .action-btn:hover:not(:disabled) {
          transform: translateY(-1px);
        }
        
        .action-btn:active:not(:disabled) {
          transform: translateY(0);
        }
      `}</style>

      <div className="return-page min-h-screen bg-[var(--theme-bg-muted)]">
        <div className="fixed inset-0 grain-overlay pointer-events-none" />

        <div className="relative px-6 lg:px-10 py-8 max-w-[1600px] mx-auto space-y-6">
          {/* Stats */}
          <section>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "ທັງໝົດ", value: summary.total, color: "stone" },
                { label: "ສຳເລັດ", value: summary.completed, color: "emerald" },
                { label: "ລໍຖ້າ", value: summary.pending, color: "amber" },
                { label: "ກຳລັງດຳເນີນ", value: summary.processing, color: "sky" },
              ].map((stat, idx) => {
                const colorStyles = {
                  stone: "border-[var(--theme-border-subtle)] bg-white",
                  emerald: "border-emerald-200 bg-emerald-50/50",
                  amber: "border-amber-200 bg-amber-50/50",
                  sky: "border-sky-200 bg-sky-50/50",
                }[stat.color];
                const textColor = {
                  stone: "text-stone-900",
                  emerald: "text-emerald-700",
                  amber: "text-amber-700",
                  sky: "text-sky-700",
                }[stat.color];

                return (
                  <div key={idx} className={`rounded-lg border-2 ${colorStyles} p-5`}>
                    <div className="text-xs font-medium text-stone-500 mb-1">{stat.label}</div>
                    <div className={`mono-text text-3xl font-bold ${textColor}`}>
                      {stat.value.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* View Mode (search/status moved to TopBar) */}
          <section className="rounded-lg border-2 border-[var(--theme-border-subtle)] bg-white p-4">
            <div className="flex items-center justify-end gap-3">
              <div className="flex items-center gap-1 rounded-md bg-stone-100 p-1">
                <button
                  onClick={() => setViewMode("cards")}
                  className={`action-btn h-9 w-9 rounded-lg flex items-center justify-center transition-all ${
                    viewMode === "cards"
                      ? "bg-stone-900 text-white"
                      : "text-stone-600 hover:text-stone-900 hover:bg-white"
                  }`}
                  title="Card view"
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`action-btn h-9 w-9 rounded-lg flex items-center justify-center transition-all ${
                    viewMode === "table"
                      ? "bg-stone-900 text-white"
                      : "text-stone-600 hover:text-stone-900 hover:bg-white"
                  }`}
                  title="Table view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs font-medium text-stone-500 hover:text-stone-900"
                >
                  ລ້າງ
                </button>
              )}
            </div>
          </section>

          {/* Content */}
          <section>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24">
                <div className="relative h-10 w-10 mb-4">
                  <div className="absolute inset-0 rounded-full border-2 border-[var(--theme-border-subtle)]" />
                  <div className="absolute inset-0 rounded-full border-t-2 border-stone-900 animate-spin" />
                </div>
                <p className="text-sm text-stone-500">ກຳລັງໂຫຼດຂໍ້ມູນ...</p>
              </div>
            ) : filteredReturns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24">
                <div className="h-16 w-16 rounded-lg border-2 border-dashed border-stone-300 flex items-center justify-center mb-4">
                  <RotateCcw className="w-7 h-7 text-[var(--theme-text-mute)]" />
                </div>
                <h2 className="font-semibold text-stone-700 mb-1">
                  {hasFilters ? "ບໍ່ພົບຜົນການຊອກຫາ" : "ຍັງບໍ່ມີຂໍ້ມູນການຄືນ"}
                </h2>
                <p className="text-sm text-stone-500 mb-4">
                  {hasFilters
                    ? "ລອງປ່ຽນຄຳສັບຊອກຫາ ຫຼື ປັບຕົວກອງ"
                    : "ເລີ່ມສ້າງໃບຄືນອາໄຫຼ່ຄັ້ງທຳອິດ"}
                </p>
                {hasFilters ? (
                  <button
                    onClick={clearFilters}
                    className="text-sm font-medium text-stone-900 hover:underline"
                  >
                    ລ້າງຕົວກັ່ນຕອງ
                  </button>
                ) : (
                  <button
                    onClick={() => router.push("/service-admin/material-return")}
                    className="action-btn inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-stone-900 text-white font-medium text-sm hover:bg-stone-800"
                  >
                    <Plus className="w-4 h-4" />
                    <span>ສ້າງໃບຄືນທຳອິດ</span>
                  </button>
                )}
              </div>
            ) : viewMode === "cards" ? (
              // Cards View
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredReturns.map((ret) => (
                  <div
                    key={ret.id}
                    className="rounded-lg border-2 border-[var(--theme-border-subtle)] bg-white p-5 hover:border-stone-300 transition-colors"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-md border-2 border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] flex items-center justify-center">
                          <Hash className="w-5 h-5 text-stone-600" />
                        </div>
                        <div>
                          <div className="mono-text text-sm font-bold text-stone-900">
                            {ret.doc_no || `#${ret.id}`}
                          </div>
                          <div className="text-[10px] text-stone-500 uppercase tracking-wide">
                            ເລກທີໃບຂໍຄືນ
                          </div>
                        </div>
                      </div>
                      {getStatusBadge(ret.status || "completed")}
                    </div>

                    {/* Info Rows */}
                    <div className="space-y-3 mb-4">
                      <div className="flex items-center gap-3">
                        <Package className="w-4 h-4 text-[var(--theme-text-mute)] flex-shrink-0" />
                        <div>
                          <div className="text-sm font-medium text-stone-900">
                            {ret.projectName || `Project ${ret.project_id}`}
                          </div>
                          <div className="text-[10px] text-stone-500">ໂຄງການ</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <User className="w-4 h-4 text-[var(--theme-text-mute)] flex-shrink-0" />
                        <div>
                          <div className="text-sm font-medium text-stone-900">
                            {ret.returnedBy || "ບໍ່ລະບຸ"}
                          </div>
                          <div className="text-[10px] text-stone-500">ຜູ້ຂໍຄືນ</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-[var(--theme-text-mute)] flex-shrink-0" />
                        <div>
                          <div className="mono-text text-sm font-medium text-stone-900">
                            {ret.returnDate
                              ? new Date(ret.returnDate).toLocaleDateString("lo-LA")
                              : "-"}
                          </div>
                          <div className="text-[10px] text-stone-500">ວັນທີຄືນ</div>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                      <div className="flex items-center justify-between pt-4 border-t border-[var(--theme-border-subtle)]">
                        <div className="flex items-center gap-2 text-sm text-stone-700">
                          <Package className="w-4 h-4 text-[var(--theme-text-mute)]" />
                          <span className="mono-text font-medium">
                            {ret.items?.length || 0}
                          </span>
                          <span className="text-stone-500">ລາຍການ</span>
                        </div>
                      <button
                        onClick={() => openDetail(ret)}
                        className="action-btn inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700 hover:text-stone-900 px-3 py-1.5 rounded-lg border border-[var(--theme-border-subtle)] hover:bg-stone-900 hover:text-white hover:border-stone-900 transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>ເບິ່ງ</span>
                      </button>
                      <button
                        onClick={() => deleteReturn(ret)}
                        className="action-btn inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:text-white px-3 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-600 hover:border-rose-600 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>ລົບ</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Table View
              <div className="rounded-lg border-2 border-[var(--theme-border-subtle)] bg-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b-2 border-[var(--theme-border-subtle)]">
                        <th className="px-6 py-4 text-left text-xs font-bold tracking-wide uppercase text-stone-500">
                          ເລກທີ່
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-bold tracking-wide uppercase text-stone-500">
                          ໂຄງການ
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-bold tracking-wide uppercase text-stone-500">
                          ຜູ້ຂໍຄືນ
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-bold tracking-wide uppercase text-stone-500">
                          ວັນທີ
                        </th>
                        <th className="px-4 py-4 text-center text-xs font-bold tracking-wide uppercase text-stone-500">
                          ລາຍການ
                        </th>
                        <th className="px-4 py-4 text-center text-xs font-bold tracking-wide uppercase text-stone-500">
                          ສະຖານະ
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-bold tracking-wide uppercase text-stone-500">
                          ດຳເນີນການ
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReturns.map((ret) => (
                        <tr
                          key={ret.id}
                          className="border-b border-[var(--theme-border-subtle)] hover:bg-[var(--theme-bg-muted)]/50 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-lg border border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] flex items-center justify-center">
                                <Hash className="w-4 h-4 text-stone-600" />
                              </div>
                              <span className="mono-text text-sm font-semibold text-stone-900">
                                {ret.doc_no || `#${ret.id}`}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-stone-900">
                                {ret.projectName || `Project ${ret.project_id}`}
                              </div>
                              <div className="mono-text text-[10px] text-stone-500">
                                ID: {ret.project_id}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-stone-200 flex items-center justify-center">
                                <User className="w-3.5 h-3.5 text-stone-600" />
                              </div>
                              <span className="text-sm text-stone-700">
                                {ret.returnedBy || "ບໍ່ລະບຸ"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="mono-text text-sm text-stone-600">
                              {ret.returnDate
                                ? new Date(ret.returnDate).toLocaleDateString("lo-LA")
                                : "-"}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            <span className="mono-text text-sm font-medium text-stone-700">
                              {ret.items?.length || 0}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            {getStatusBadge(ret.status || "completed")}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openDetail(ret)}
                                className="action-btn h-9 w-9 rounded-lg border border-[var(--theme-border-subtle)] bg-white text-stone-600 hover:bg-stone-900 hover:text-white hover:border-stone-900 flex items-center justify-center transition-all"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteReturn(ret)}
                                className="action-btn h-9 w-9 rounded-lg border border-rose-200 bg-white text-rose-600 hover:bg-rose-600 hover:text-white hover:border-rose-600 flex items-center justify-center transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <button className="action-btn h-9 w-9 rounded-lg border border-[var(--theme-border-subtle)] bg-white text-stone-600 hover:bg-stone-900 hover:text-white hover:border-stone-900 flex items-center justify-center transition-all">
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {detailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-stone-950/40 backdrop-blur-sm"
            onClick={closeDetail}
          />
          <div className="relative w-full max-w-5xl rounded-lg border-2 border-[var(--theme-border-subtle)] bg-white shadow-[var(--theme-shadow-lg)] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--theme-border-subtle)] bg-stone-900 text-white">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-[var(--theme-text-mute)]">
                  ລາຍລະອຽດ ລາຍການຂໍຄືນ
                </div>
                <div className="mono-text text-lg font-semibold">
                  {detailReturn?.doc_no || "-"}
                </div>
              </div>
              <button
                onClick={closeDetail}
                className="action-btn h-9 w-9 rounded-lg border border-white/20 text-white hover:bg-white/10 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 border-b border-[var(--theme-border-subtle)] grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-xs text-stone-500 mb-1">ໂຄງການ</div>
                <div className="font-semibold text-stone-900">
                  {detailReturn?.projectName || `Project ${detailReturn?.project_id || "-"}`}
                </div>
              </div>
              <div>
                <div className="text-xs text-stone-500 mb-1">ຜູ້ຂໍຄືນ</div>
                <div className="font-semibold text-stone-900">
                  {detailReturn?.returnedBy || "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-stone-500 mb-1">ວັນທີຄືນ</div>
                <div className="mono-text font-semibold text-stone-900">
                  {detailReturn?.returnDate
                    ? new Date(detailReturn.returnDate).toLocaleDateString("lo-LA")
                    : "-"}
                </div>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)]">
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wide text-stone-500">
                      ລະຫັດ
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-stone-500">
                      ຊື່ລາຍການ
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-stone-500">
                      ຫົວໜ່ວຍ
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wide text-stone-500">
                      ຈຳນວນ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detailItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-sm text-stone-500">
                        ບໍ່ພົບລາຍການຂໍຄືນ
                      </td>
                    </tr>
                  ) : (
                    detailItems.map((item, idx) => (
                      <tr key={`${item.item_code || "item"}-${idx}`} className="border-b border-[var(--theme-border-subtle)]">
                        <td className="px-6 py-3 whitespace-nowrap mono-text text-sm text-stone-800">
                          {item.item_code || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-stone-800">
                          {item.item_name || "-"}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-stone-600">
                          {item.unit_code || "-"}
                        </td>
                        <td className="px-6 py-3 text-right mono-text text-sm font-semibold text-stone-900">
                          {Number(item.qty || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function Page() {
  return (
    <AuthGuard roles={["service_admin", "service_manager", "account_admin", "head_technician"]}>
      <MaterialReturnList />
    </AuthGuard>
  );
}
