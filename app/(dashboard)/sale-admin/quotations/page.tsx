"use client";


import AuthGuard from "@/_components/AuthGuard";
import { getQuotations, updateQuotation, deleteQuotation } from "@/_actions/quotations";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";
import {
  Plus, ChevronLeft, ChevronRight, Trash,
  FilePlus, Eye, RefreshCw,
  CheckCircle, X, Download,
} from "lucide-react";
import { usePageHeader } from "@/_components/PageHeader";
import ViewSwitcher, { type ViewMode } from "@/_components/odoo/ViewSwitcher";
import KanbanBoard, { type KanbanColumn } from "@/_components/odoo/KanbanBoard";

/* ─── Auth ─── */
function _getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ─── Constants ─── */
// Chip tabs (include ທັງໝົດ as first chip). Kanban columns use only the 4 real statuses.
const STATUS_TABS = [
  "ທັງໝົດ",
  "ລໍຖ້າອະນຸມັດ",
  "ສົ່ງແລ້ວ",
  "ອະນຸມັດແລ້ວ",
  "ຖືກປະຕິເສດ",
];

const KANBAN_STATUSES: { id: string; color: string }[] = [
  { id: "ລໍຖ້າອະນຸມັດ", color: "#f59e0b" },
  { id: "ສົ່ງແລ້ວ", color: "#0ea5e9" },
  { id: "ອະນຸມັດແລ້ວ", color: "#10b981" },
  { id: "ຖືກປະຕິເສດ", color: "#f43f5e" },
];

/* ─── Types (loose to preserve existing behaviour) ─── */
type Quotation = {
  id: number | string;
  quotation_no?: string;
  project_name?: string;
  customer_name?: string;
  total_amount?: number | string;
  created_at?: string;
  status?: string;
  items?: Array<{ description?: string }>;
  [k: string]: any;
};

/* ─── Formatters ─── */
const formatDateLA = (d: any) => {
  if (!d) return "-";
  const dt = new Date(d);
  if (isNaN(dt as unknown as number)) return d;
  return dt.toLocaleDateString("lo-LA");
};

const formatCurrency = (amount: any) => {
  if (!amount && amount !== 0) return "-";
  return new Intl.NumberFormat("lo-LA", {
    style: "currency",
    currency: "LAK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(Number(amount) || 0)
    .replace("LAK", "ກີບ");
};

const statusPillClass = (status?: string) => {
  switch (status) {
    case "ອະນຸມັດແລ້ວ":
      return "bg-emerald-100 text-emerald-700";
    case "ຖືກປະຕິເສດ":
      return "bg-rose-100 text-rose-700";
    case "ສົ່ງແລ້ວ":
      return "bg-sky-100 text-sky-700";
    default:
      return "bg-amber-100 text-amber-800";
  }
};

function QuotationList() {
  const router = useRouter();

  // Data
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>("ທັງໝົດ");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 10;

  // UI — Odoo default = kanban
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");

  // Hydrate viewMode from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("quotationlist-view");
      if (saved === "list" || saved === "kanban") setViewMode(saved);
    } catch {}
  }, []);
  // Persist viewMode
  useEffect(() => {
    try {
      localStorage.setItem("quotationlist-view", viewMode);
    } catch {}
  }, [viewMode]);

  // Role — sale_manager + account_admin + service_manager can approve/reject.
  const [role, setRole] = useState<string>("");
  const canApprove =
    role === "sale_manager" ||
    role === "account_admin" ||
    role === "service_manager";

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      const r =
        typeof u.role === "string" && u.role.includes(",")
          ? u.role.split(",")[0].trim()
          : (u.role as string) || "";
      setRole(r);
    } catch {
      /* ignore */
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res: any = await getQuotations();
      setQuotations(res?.success ? res.data : []);
    } catch (e) {
      Swal.fire({
        icon: "error",
        title: "ຜິດພາດ",
        text: "ບໍ່ສາມາດໂຫຼດຂໍ້ມູນໃບສະເໜີລາຄາໄດ້",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      const matchesSearch =
        !search ||
        q.quotation_no?.toLowerCase().includes(search.toLowerCase()) ||
        q.project_name?.toLowerCase().includes(search.toLowerCase()) ||
        q.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        (q.items &&
          q.items.some((item) =>
            item.description?.toLowerCase().includes(search.toLowerCase()),
          ));

      const matchesStatus =
        selectedStatus === "ທັງໝົດ" || q.status === selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }, [quotations, search, selectedStatus]);

  const paginatedQuotations = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredQuotations.slice(start, start + perPage);
  }, [filteredQuotations, page]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredQuotations.length / perPage),
  );

  // Reset to page 1 if filter shrinks data
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  /* ─── Handlers (preserved) ─── */
  const handleViewQuotation = (id: number | string) => {
    router.push(`/sale-admin/quotation/${id}`);
  };

  const handleSetStatus = async (
    q: Quotation,
    newStatus: string,
    verb: string,
  ) => {
    const result = await Swal.fire({
      title: `ຢືນຢັນ${verb}?`,
      html: `ໃບສະເໜີລາຄາ <b>${q.quotation_no || "—"}</b>`,
      icon: "question",
      showCancelButton: true,
      cancelButtonText: "ຍົກເລີກ",
      confirmButtonText: verb,
      confirmButtonColor: newStatus === "ຖືກປະຕິເສດ" ? "#dc2626" : "#714b67",
    });
    if (!result.isConfirmed) return;
    try {
      await updateQuotation(String(q.id), { ...q, status: newStatus });
      Swal.fire({
        icon: "success",
        title: "ສຳເລັດ",
        timer: 1100,
        showConfirmButton: false,
      });
      loadData();
    } catch {
      Swal.fire("ຜິດພາດ", "ປ່ຽນສະຖານະບໍ່ສຳເລັດ", "error");
    }
  };

  const handleDeleteQuotation = async (id: number | string) => {
    const result = await Swal.fire({
      title: "ທ່ານແນ່ໃຈບໍ?",
      text: "ຂໍ້ມູນຈະບໍ່ສາມາດກູ້ຄືນໄດ້!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ລຶບ",
      cancelButtonText: "ຍົກເລີກ",
    });

    if (result.isConfirmed) {
      try {
        await deleteQuotation(String(id));
        Swal.fire("ສຳເລັດ!", "ລຶບໃບສະເໜີລາຄາແລ້ວ", "success");
        loadData();
      } catch (e) {
        Swal.fire("ຜິດພາດ!", "ບໍ່ສາມາດລຶບໃບສະເໜີລາຄາໄດ້", "error");
      }
    }
  };

  const exportToExcel = () => {
    const dataToExport = filteredQuotations.map((q) => ({
      ລະຫັດໃບສະເໜີລາຄາ: q.quotation_no,
      ຊື່ໂຄງການ: q.project_name,
      ລູກຄ້າ: q.customer_name,
      ມູນຄ່າ: q.total_amount,
      ວັນທີ: formatDateLA(q.created_at),
      ສະຖານະ: q.status,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ໃບສະເໜີລາຄາ");
    XLSX.writeFile(wb, "ລາຍການໃບສະເໜີລາຄາ.xlsx");
  };

  /* ─── TopBar registration (preserved) ─── */
  usePageHeader({
    title: "ໃບສະເໜີລາຄາ",
    subtitle: `${filteredQuotations.length} ລາຍການ`,
    primaryAction: {
      label: "ສ້າງໃບສະເໜີລາຄາ",
      icon: <FilePlus size={13} />,
      onClick: () => router.push("/sale-admin/create-quotation"),
    },
    secondaryActions: [
      {
        label: "ໂຫຼດໃໝ່",
        icon: <RefreshCw size={13} className={loading ? "animate-spin" : ""} />,
        onClick: () => loadData(),
        disabled: loading,
      },
      {
        label: "Excel",
        icon: <Download size={13} />,
        onClick: () => exportToExcel(),
      },
    ],
    search: {
      value: search,
      onChange: setSearch,
      placeholder: "ຄົ້ນຫາໃບສະເໜີລາຄາ...",
    },
    filterChips: STATUS_TABS.map((status) => ({
      id: status,
      label: status,
      count:
        status === "ທັງໝົດ"
          ? quotations.length
          : quotations.filter((q) => q.status === status).length,
      active: selectedStatus === status,
      onClick: () => setSelectedStatus(status),
    })),
  });

  /* ─── Render ─── */
  if (loading) {
    return (
      <div className="bg-white">
        <div className="flex h-60 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--theme-border-subtle)] border-t-[var(--theme-primary)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white">
      {/* Thin right-aligned view switcher strip */}
      <div className="flex items-center justify-end border-b border-[var(--theme-border)] bg-white px-3 py-1.5 md:px-4">
        <ViewSwitcher
          value={viewMode}
          onChange={setViewMode}
          available={["list", "kanban"]}
        />
      </div>

      {/* List view (Odoo dense table) */}
      {viewMode === "list" && (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--theme-border)] bg-[var(--theme-bg-muted)] text-[11px] uppercase tracking-wider text-[var(--theme-text-soft)]">
                  <th className="w-24 px-3 py-2 text-left font-semibold">No</th>
                  <th className="px-3 py-2 text-left font-semibold">ໂຄງການ</th>
                  <th className="px-3 py-2 text-left font-semibold">ລູກຄ້າ</th>
                  <th className="w-32 px-3 py-2 text-left font-semibold">ວັນທີ</th>
                  <th className="w-40 px-3 py-2 text-right font-semibold">ມູນຄ່າ</th>
                  <th className="w-36 px-3 py-2 text-left font-semibold">ສະຖານະ</th>
                  <th className="w-[140px] px-3 py-2 text-right font-semibold">ດຳເນີນການ</th>
                </tr>
              </thead>
              <tbody className="text-[12px] text-[var(--theme-text)]">
                {paginatedQuotations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-16">
                      <div className="flex flex-col items-center justify-center text-[var(--theme-text-soft)]">
                        <FilePlus className="h-12 w-12 text-[var(--theme-text-mute)]" />
                        <p className="mt-2 text-sm">ບໍ່ມີຂໍ້ມູນໃບສະເໜີລາຄາ</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedQuotations.map((q) => {
                    const goView = () => handleViewQuotation(q.id);
                    const cellCls = "cursor-pointer px-3 py-2";
                    return (
                      <tr
                        key={q.id}
                        className="border-b border-[var(--theme-border)] transition-colors hover:bg-[var(--theme-bg-muted)]"
                      >
                        <td onClick={goView} className={`${cellCls} whitespace-nowrap font-mono text-[11px] text-[var(--theme-primary)]`}>
                          {q.quotation_no || "-"}
                        </td>
                        <td onClick={goView} className={cellCls}>
                          <div className="truncate font-medium">{q.project_name || "-"}</div>
                        </td>
                        <td onClick={goView} className={`${cellCls} text-[var(--theme-text-soft)]`}>
                          {q.customer_name || "-"}
                        </td>
                        <td onClick={goView} className={`${cellCls} whitespace-nowrap text-[var(--theme-text-soft)]`}>
                          {formatDateLA(q.created_at)}
                        </td>
                        <td onClick={goView} className={`${cellCls} whitespace-nowrap text-right font-mono`}>
                          {formatCurrency(q.total_amount)}
                        </td>
                        <td onClick={goView} className={`${cellCls} whitespace-nowrap`}>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusPillClass(q.status)}`}>
                            {q.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleViewQuotation(q.id); }}
                              title="ເບິ່ງ"
                              className="flex h-6 w-6 items-center justify-center rounded text-[var(--theme-text-soft)] hover:bg-[var(--theme-primary-tint)] hover:text-[var(--theme-primary)]"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            {canApprove && q.status === "ລໍຖ້າອະນຸມັດ" && (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleSetStatus(q, "ອະນຸມັດແລ້ວ", "ອະນຸມັດ"); }}
                                  title="ອະນຸມັດ"
                                  className="inline-flex h-6 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                                >
                                  <CheckCircle className="h-3 w-3" /> ອະນຸມັດ
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleSetStatus(q, "ຖືກປະຕິເສດ", "ປະຕິເສດ"); }}
                                  title="ປະຕິເສດ"
                                  className="inline-flex h-6 items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                                >
                                  <X className="h-3 w-3" /> ປະຕິເສດ
                                </button>
                              </>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteQuotation(q.id); }}
                              title="ລຶບ"
                              className="flex h-6 w-6 items-center justify-center rounded text-rose-400 hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Dense pagination strip */}
          {filteredQuotations.length > 0 && (
            <div className="flex items-center justify-end gap-2 border-t border-[var(--theme-border)] bg-white px-3 py-1.5 text-[11px] text-[var(--theme-text-soft)] md:px-4">
              <span>
                {(page - 1) * perPage + 1}
                {"–"}
                {Math.min(page * perPage, filteredQuotations.length)} /{" "}
                {filteredQuotations.length}
              </span>
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="flex h-6 w-6 items-center justify-center rounded border border-[var(--theme-border)] bg-white text-[var(--theme-text-soft)] disabled:opacity-40 hover:bg-[var(--theme-bg-muted)]"
                aria-label="Prev"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="flex h-6 w-6 items-center justify-center rounded border border-[var(--theme-border)] bg-white text-[var(--theme-text-soft)] disabled:opacity-40 hover:bg-[var(--theme-bg-muted)]"
                aria-label="Next"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Kanban view */}
      {viewMode === "kanban" && (
        <div className="p-3 md:p-4">
          {filteredQuotations.length === 0 ? (
            <div className="flex h-60 flex-col items-center justify-center text-[var(--theme-text-soft)]">
              <FilePlus className="h-12 w-12 text-[var(--theme-text-mute)]" />
              <p className="mt-2 text-sm">ບໍ່ມີຂໍ້ມູນໃບສະເໜີລາຄາ</p>
            </div>
          ) : (
            (() => {
              const columns: KanbanColumn<Quotation>[] = KANBAN_STATUSES.map(
                (s) => ({
                  id: s.id,
                  title: s.id,
                  color: s.color,
                  records: filteredQuotations.filter((q) => q.status === s.id),
                  onAdd:
                    s.id === "ລໍຖ້າອະນຸມັດ"
                      ? () => router.push("/sale-admin/create-quotation")
                      : undefined,
                }),
              );
              return (
                <KanbanBoard<Quotation>
                  columns={columns}
                  getCardId={(q) => String(q.id)}
                  onCardClick={(q) => handleViewQuotation(q.id)}
                  onCardMove={
                    canApprove
                      ? (q, from, to) => {
                          if (from === to) return;
                          void handleSetStatus(q, to, "ປ່ຽນເປັນ " + to);
                        }
                      : undefined
                  }
                  renderCard={(q) => (
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="truncate text-[12px] font-semibold text-[var(--theme-text)]">
                          {q.project_name || "-"}
                        </div>
                        <span
                          className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusPillClass(
                            q.status,
                          )}`}
                        >
                          {q.status}
                        </span>
                      </div>
                      <div className="truncate font-mono text-[10px] text-[var(--theme-primary)]">
                        {q.quotation_no || "-"}
                      </div>
                      <div className="truncate text-[11px] text-[var(--theme-text-soft)]">
                        {q.customer_name || "-"}
                      </div>
                      <div className="flex items-center justify-between pt-1 text-[11px]">
                        <span className="text-[var(--theme-text-mute)]">
                          {formatDateLA(q.created_at)}
                        </span>
                        <span className="font-mono font-semibold text-[var(--theme-text)]">
                          {formatCurrency(q.total_amount)}
                        </span>
                      </div>
                    </div>
                  )}
                />
              );
            })()
          )}
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <AuthGuard roles={["sale_admin", "sale_manager"]}>
      <QuotationList />
    </AuthGuard>
  );
}
