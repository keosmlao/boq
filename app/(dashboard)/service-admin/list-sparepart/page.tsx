"use client";


import AuthGuard from "@/_components/AuthGuard";
import { getBoq } from "@/_actions/boq";
import { useParams,useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import Swal from "sweetalert2";
import {
  ArrowLeft,
  Package,
  RefreshCw,
  Search,
  Hash,
  Filter,
  ArrowUpDown,
  X,
  AlertTriangle,
  CheckCircle,
  TrendingDown,
  Box,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { usePageHeader } from "@/_components/PageHeader";

function _getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

function BOQMaterialList() {
  const router = useRouter();
  const { boqId, projectId } = useParams();

  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("item_code");
  const [boqInfo, setBOQInfo] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Number helpers & derived metrics
  const numVal = (...vals) => {
    for (const v of vals) {
      if (v === null || v === undefined || v === "") continue;
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
    return 0;
  };

  const stockVal = (m) =>
    numVal(
      m.balance_qty,
      m.stock_balance,
      m.qty_balance,
      m.inventory_balance,
      m.onhand,
      m.qty_onhand,
      m.on_hand,
      m.wh_balance
    );

  const deriveMaterial = (m) => {
    const boq = numVal(m.boq_qty, m.qty);
    const stock = stockVal(m);
    const requested = numVal(m.request_qty);
    const pending = numVal(m.request_not_fulfilled);
    const shortage = Math.max(boq - stock, 0);
    const excess = Math.max(stock - boq, 0);
    let status = "enough";
    if (stock <= 0) status = "out";
    else if (shortage > 0) status = "short";
    else if (excess > 0) status = "excess";
    return { boq, stock, requested, pending, shortage, excess, status };
  };

  useEffect(() => {
    fetchBOQMaterials();
    fetchBOQInfo();
  }, [boqId]);

  const fetchBOQMaterials = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/sparepartlist`, { headers: _getAuthHeaders() }).then(r => r.json());
      const data = response?.data || [];
      setMaterials(data);
    } catch (error) {
      console.error("Failed to fetch BOQ materials:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to load BOQ materials. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchBOQInfo = async () => {
    try {
      const response: any = await getBoq(boqId);
      setBOQInfo(response?.success === false ? null : response);
    } catch (error) {
      console.error("Failed to fetch BOQ info:", error);
    }
  };

  const enrichedMaterials = useMemo(
    () => materials.map((m) => ({ ...m, _d: deriveMaterial(m) })),
    [materials]
  );

  const filteredMaterials = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return enrichedMaterials
      .filter((material) => {
        const matchesSearch =
          material.item_name?.toLowerCase().includes(term) ||
          material.item_code?.toLowerCase().includes(term);

        if (!matchesSearch) return false;
        if (filterStatus === "all") return true;

        const d = material._d;
        switch (filterStatus) {
          case "sufficient":
            return d.shortage === 0;
          case "insufficient":
            return d.shortage > 0;
          case "zero_stock":
            return d.stock === 0;
          case "pending_request":
            return numVal(material.request_not_fulfilled) > 0;
          default:
            return true;
        }
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "item_code":
            return a.item_code.localeCompare(b.item_code);
          case "stock_gap": {
            const aGap = a._d.shortage > 0 ? a._d.shortage : -a._d.excess;
            const bGap = b._d.shortage > 0 ? b._d.shortage : -b._d.excess;
            return bGap - aGap;
          }
          case "balance_qty":
            return a._d.stock - b._d.stock;
          case "boq_qty":
            return b._d.boq - a._d.boq;
          default:
            return 0;
        }
      });
  }, [enrichedMaterials, filterStatus, searchTerm, sortBy]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, sortBy, pageSize]);

  // Pagination calculations
  const totalItems = filteredMaterials.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedMaterials = filteredMaterials.slice(startIndex, endIndex);

  // Summary stats
  const summary = useMemo(() => {
    const total = enrichedMaterials.length;
    const sufficient = enrichedMaterials.filter((m) => m._d.shortage === 0 && m._d.stock > 0).length;
    const insufficient = enrichedMaterials.filter((m) => m._d.shortage > 0).length;
    const outOfStock = enrichedMaterials.filter((m) => m._d.stock === 0).length;
    return { total, sufficient, insufficient, outOfStock };
  }, [enrichedMaterials]);

  const getStatusInfo = (material) => {
    const d = material._d || deriveMaterial(material);
    if (d.stock === 0) {
      return { status: "out", bg: "bg-rose-100", text: "text-rose-700", label: "ໝົດສະຕັອກ" };
    } else if (d.shortage > 0) {
      return { status: "short", bg: "bg-amber-100", text: "text-amber-700", label: "ຂາດ" };
    } else if (d.excess > 0) {
      return { status: "excess", bg: "bg-emerald-100", text: "text-emerald-700", label: "ເກີນ" };
    } else {
      return { status: "enough", bg: "bg-emerald-100", text: "text-emerald-700", label: "ພຽງພໍ" };
    }
  };

  // Pagination handlers
  const goToPage = (page) => setCurrentPage(Math.max(1, Math.min(page, totalPages)));

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      }
    }
    return pages;
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
    setSortBy("item_code");
  };

  const hasFilters = searchTerm || filterStatus !== "all" || sortBy !== "item_code";

  // Register page-level header (title, refresh, search, status chips) so the
  // dashboard TopBar control panel can render them Odoo-style.
  usePageHeader({
    title: "ລາຍການອາໄຫຼ່",
    subtitle: `${filteredMaterials.length} ລາຍການ`,
    secondaryActions: [
      {
        label: "ໂຫຼດໃໝ່",
        icon: <RefreshCw size={13} className={loading ? "animate-spin" : ""} />,
        onClick: () => fetchBOQMaterials(),
        disabled: loading,
      },
    ],
    search: {
      value: searchTerm,
      onChange: setSearchTerm,
      placeholder: "ຄົ້ນຫາລະຫັດ ຫຼື ຊື່ອາໄຫຼ່...",
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
        id: "sufficient",
        label: "ພຽງພໍ",
        count: summary.sufficient,
        active: filterStatus === "sufficient",
        onClick: () => setFilterStatus("sufficient"),
      },
      {
        id: "insufficient",
        label: "ບໍ່ພຽງພໍ",
        count: summary.insufficient,
        active: filterStatus === "insufficient",
        onClick: () => setFilterStatus("insufficient"),
      },
      {
        id: "zero_stock",
        label: "ໝົດ",
        count: summary.outOfStock,
        active: filterStatus === "zero_stock",
        onClick: () => setFilterStatus("zero_stock"),
      },
      {
        id: "pending_request",
        label: "ລໍຖ້າອະນຸມັດ",
        count: enrichedMaterials.filter(
          (m) => numVal(m.request_not_fulfilled) > 0
        ).length,
        active: filterStatus === "pending_request",
        onClick: () => setFilterStatus("pending_request"),
      },
    ],
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        
        .boq-material-page {
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

      <div className="boq-material-page min-h-screen bg-[var(--theme-bg-muted)]">
        <div className="fixed inset-0 grain-overlay pointer-events-none" />

        <div className="relative px-6 lg:px-10 py-8 max-w-[1400px] mx-auto space-y-6">
          {/* Back button (title/refresh moved to TopBar) */}
          <header>
            <button
              onClick={() => router.back()}
              className="action-btn h-11 w-11 rounded-md border-2 border-[var(--theme-border-subtle)] bg-white text-stone-600 hover:bg-stone-900 hover:text-white hover:border-stone-900 flex items-center justify-center transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </header>

          {/* Stats */}
          <section>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-md border-2 border-[var(--theme-border-subtle)] bg-white p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Box className="w-4 h-4 text-[var(--theme-text-mute)]" />
                  <span className="text-[10px] font-medium text-stone-500 uppercase tracking-wide">ທັງໝົດ</span>
                </div>
                <div className="mono-text text-2xl font-bold text-stone-900">{summary.total}</div>
              </div>
              <div className="rounded-md border-2 border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span className="text-[10px] font-medium text-emerald-600 uppercase tracking-wide">ພຽງພໍ</span>
                </div>
                <div className="mono-text text-2xl font-bold text-emerald-700">{summary.sufficient}</div>
              </div>
              <div className="rounded-md border-2 border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-4 h-4 text-amber-500" />
                  <span className="text-[10px] font-medium text-amber-600 uppercase tracking-wide">ຂາດ</span>
                </div>
                <div className="mono-text text-2xl font-bold text-amber-700">{summary.insufficient}</div>
              </div>
              <div className="rounded-md border-2 border-rose-200 bg-rose-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  <span className="text-[10px] font-medium text-rose-600 uppercase tracking-wide">ໝົດສະຕັອກ</span>
                </div>
                <div className="mono-text text-2xl font-bold text-rose-700">{summary.outOfStock}</div>
              </div>
            </div>
          </section>

          {/* Sort (search/status moved to TopBar) */}
          <section className="rounded-lg border-2 border-[var(--theme-border-subtle)] bg-white p-4">
            <div className="flex items-center justify-end gap-3 flex-wrap">
              {/* Sort */}
              <div className="relative">
                <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--theme-text-mute)]" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="h-11 pl-10 pr-10 rounded-md border-2 border-[var(--theme-border-subtle)] bg-white text-sm font-medium text-stone-700 focus:outline-none appearance-none cursor-pointer"
                >
                  <option value="item_code">ລຽງຕາມລະຫັດ</option>
                  <option value="stock_gap">ລຽງຕາມຂາດແຄນ</option>
                  <option value="balance_qty">ລຽງຕາມສະຕັອກ</option>
                  <option value="boq_qty">ລຽງຕາມ BOQ</option>
                </select>
                <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--theme-text-mute)] pointer-events-none rotate-90" />
              </div>

              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs font-medium text-stone-500 hover:text-stone-900 px-3 py-2"
                >
                  ລ້າງຕົວກອງ
                </button>
              )}
            </div>
          </section>

          {/* Table */}
          <section className="rounded-lg border-2 border-[var(--theme-border-subtle)] bg-white overflow-hidden">
            {loading ? (
              <div className="px-6 py-24 text-center">
                <div className="inline-flex flex-col items-center gap-4">
                  <div className="relative h-10 w-10">
                    <div className="absolute inset-0 rounded-full border-2 border-[var(--theme-border-subtle)]" />
                    <div className="absolute inset-0 rounded-full border-t-2 border-stone-900 animate-spin" />
                  </div>
                  <span className="text-sm text-stone-500">ກຳລັງໂຫຼດຂໍ້ມູນ...</span>
                </div>
              </div>
            ) : filteredMaterials.length === 0 ? (
              <div className="px-6 py-24 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-16 w-16 rounded-lg border-2 border-dashed border-stone-300 flex items-center justify-center">
                    <Package className="w-7 h-7 text-[var(--theme-text-mute)]" />
                  </div>
                  <div>
                    <div className="font-semibold text-stone-700 mb-1">
                      {hasFilters ? "ບໍ່ພົບຜົນການຊອກຫາ" : "ຍັງບໍ່ມີຂໍ້ມູນອາໄຫຼ່"}
                    </div>
                    <div className="text-sm text-stone-500">
                      {hasFilters ? "ລອງປ່ຽນຄຳຄົ້ນຫາ ຫຼື ຕົວກອງ" : "ຍັງບໍ່ມີອາໄຫຼ່ໃນ BOQ ນີ້"}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b-2 border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)]">
                        <th className="px-6 py-4 text-left text-[10px] font-bold tracking-wide uppercase text-stone-500 w-12">
                          #
                        </th>
                        <th className="px-4 py-4 text-left text-[10px] font-bold tracking-wide uppercase text-stone-500">
                          ລະຫັດ
                        </th>
                        <th className="px-4 py-4 text-left text-[10px] font-bold tracking-wide uppercase text-stone-500">
                          ຊື່ອາໄຫຼ່
                        </th>
                        <th className="px-4 py-4 text-center text-[10px] font-bold tracking-wide uppercase text-stone-500">
                          ຫົວໜ່ວຍ
                        </th>
                        <th className="px-4 py-4 text-right text-[10px] font-bold tracking-wide uppercase text-stone-500">
                          BOQ
                        </th>
                        <th className="px-4 py-4 text-right text-[10px] font-bold tracking-wide uppercase text-stone-500">
                          ສະຕັອກ
                        </th>
                        <th className="px-4 py-4 text-right text-[10px] font-bold tracking-wide uppercase text-stone-500">
                          ຂາດ/ເກີນ
                        </th>
                        <th className="px-6 py-4 text-center text-[10px] font-bold tracking-wide uppercase text-stone-500">
                          ສະຖານະ
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedMaterials.map((material, idx) => {
                        const statusInfo = getStatusInfo(material);
                        const globalIdx = startIndex + idx + 1;

                        return (
                          <tr
                            key={material.item_code}
                            className="border-b border-[var(--theme-border-subtle)] hover:bg-[var(--theme-bg-muted)]/50 transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="mono-text text-xs text-[var(--theme-text-mute)]">
                                {String(globalIdx).padStart(2, "0")}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-lg bg-stone-100 border border-[var(--theme-border-subtle)] flex items-center justify-center">
                                  <Hash className="w-3.5 h-3.5 text-stone-500" />
                                </div>
                                <span className="mono-text text-xs font-semibold text-stone-900">
                                  {material.item_code}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className="text-sm text-stone-700 line-clamp-1">
                                {material.item_name}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-center">
                              <span className="text-xs text-stone-500">
                                {material.unit_code}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-right">
                              <span className="mono-text text-sm font-medium text-stone-900">
                                {material._d.boq.toLocaleString()}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-right">
                              <span className={`mono-text text-sm font-medium ${
                                material._d.stock === 0 ? "text-rose-600" : "text-stone-900"
                              }`}>
                                {material._d.stock.toLocaleString()}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-right">
                              <div className="flex flex-col items-end">
                                <span className={`mono-text text-sm font-semibold ${
                                  material._d.shortage > 0
                                    ? "text-rose-600"
                                    : material._d.excess > 0
                                    ? "text-emerald-600"
                                    : "text-stone-500"
                                }`}>
                                  {material._d.shortage > 0
                                    ? `-${material._d.shortage.toLocaleString()}`
                                    : material._d.excess > 0
                                    ? `+${material._d.excess.toLocaleString()}`
                                    : "0"}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium ${statusInfo.bg} ${statusInfo.text}`}>
                                {statusInfo.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="px-6 py-4 border-t-2 border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-stone-600">
                        ສະແດງ <span className="mono-text font-semibold">{startIndex + 1}</span> - <span className="mono-text font-semibold">{endIndex}</span> ຈາກ <span className="mono-text font-semibold">{totalItems}</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-500">ແຖວ:</span>
                        <select
                          value={pageSize}
                          onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                          className="h-8 px-2 rounded-lg border border-[var(--theme-border-subtle)] bg-white text-xs font-medium text-stone-700"
                        >
                          {PAGE_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => goToPage(1)} disabled={currentPage === 1} className="action-btn h-9 w-9 rounded-lg border border-[var(--theme-border-subtle)] bg-white text-stone-600 hover:bg-stone-900 hover:text-white hover:border-stone-900 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-stone-600 disabled:hover:border-[var(--theme-border-subtle)] flex items-center justify-center">
                        <ChevronsLeft className="w-4 h-4" />
                      </button>
                      <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="action-btn h-9 w-9 rounded-lg border border-[var(--theme-border-subtle)] bg-white text-stone-600 hover:bg-stone-900 hover:text-white hover:border-stone-900 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-stone-600 disabled:hover:border-[var(--theme-border-subtle)] flex items-center justify-center">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <div className="flex items-center gap-1 mx-2">
                        {getPageNumbers().map((page, idx) =>
                          page === "..." ? (
                            <span key={`e-${idx}`} className="px-2 text-[var(--theme-text-mute)]">...</span>
                          ) : (
                            <button
                              key={page}
                              onClick={() => goToPage(page)}
                              className={`action-btn h-9 min-w-[36px] px-3 rounded-lg text-sm font-semibold transition-all ${
                                currentPage === page
                                  ? "bg-stone-900 text-white"
                                  : "border border-[var(--theme-border-subtle)] bg-white text-stone-600 hover:bg-stone-100"
                              }`}
                            >
                              {page}
                            </button>
                          )
                        )}
                      </div>
                      <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} className="action-btn h-9 w-9 rounded-lg border border-[var(--theme-border-subtle)] bg-white text-stone-600 hover:bg-stone-900 hover:text-white hover:border-stone-900 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-stone-600 disabled:hover:border-[var(--theme-border-subtle)] flex items-center justify-center">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages} className="action-btn h-9 w-9 rounded-lg border border-[var(--theme-border-subtle)] bg-white text-stone-600 hover:bg-stone-900 hover:text-white hover:border-stone-900 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-stone-600 disabled:hover:border-[var(--theme-border-subtle)] flex items-center justify-center">
                        <ChevronsRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <AuthGuard roles={["service_admin", "service_manager", "sale_manager", "account_admin", "head_technician"]}>
      <BOQMaterialList />
    </AuthGuard>
  );
}
