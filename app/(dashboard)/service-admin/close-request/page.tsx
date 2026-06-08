"use client";

import AuthGuard from "@/_components/AuthGuard";
import { getProjectsBoqClose } from "@/_actions/projects";
import React, { useCallback, useState, useEffect } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  CheckSquare,
  RefreshCw,
} from "lucide-react";
import Modal from "react-modal";
import Swal from "sweetalert2";
import { usePageHeader } from "@/_components/PageHeader";
import ViewSwitcher, { type ViewMode } from "@/_components/odoo/ViewSwitcher";
import KanbanBoard, { type KanbanColumn } from "@/_components/odoo/KanbanBoard";

function _getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}


// ---- Utils ----
function formatDateDMY(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

// ---- Status Constants ----
const STATUS = {
  ALL: "ທັງໝົດ",
  WAITING: "ລໍຖ້າອະນຸມັດ",
  CLOSED: "ປີດໂຄງການແລ້ວ",
};
const STATUS_TABS = [STATUS.ALL, STATUS.WAITING, STATUS.CLOSED];

const ProjectListClose = () => {
  // State
  const [projects, setProjects] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState([]);
  const [expandedAtt, setExpandedAtt] = useState({});
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [pendingApproveId, setPendingApproveId] = useState(null);
  const [approveLoading, setApproveLoading] = useState(false);

  // Image preview
  const [previewImage, setPreviewImage] = useState(null);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);

  // Role
  const [role, setRole] = useState("");
  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setRole(user.role || "");
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Search / filter
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [selectedStatus, setSelectedStatus] = useState(STATUS.ALL);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("close-request-list-view");
      if (saved === "list" || saved === "kanban") setViewMode(saved);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("close-request-list-view", viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);

  // Toggle
  const toggleExpand = (id) => {
    setExpandedRows((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };
  const toggleAtt = (id) =>
    setExpandedAtt((prev) => ({ ...prev, [id]: !prev[id] }));

  // Fetch
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await getProjectsBoqClose();
      const serverData = Array.isArray(resp)
        ? resp
        : [];
      console.log("Fetched projects (closed):", resp);

      const mapped = serverData.map((p, idx) => {
        let status;
        if (p.approve_status === 1) {
          status = STATUS.CLOSED;
        } else if (p.approve_status === 0) {
          status = STATUS.WAITING;
        } else {
          status = STATUS.WAITING;
        }

        return {
          id: p.id ?? idx + 1,
          project_name: p.project_name ?? "-",
          village_name: p.village_name ?? "-",
          district_name: p.district_name ?? "-",
          province_name: p.province_name ?? "-",
          coordinator: p.coordinator ?? "-",
          phone: p.phone ?? "-",
          status,
          sml_code: p.sml_code ?? "",
          close_date: p.close_date ?? "",
          closer: p.closer ?? "-",
          approve_status: p.approve_status ?? 0,
          created_at: p.created_at ?? "",
          customer_type: p.customer_type ?? "",
          installation_type: p.installation_type ?? "",
          equipment_type: p.equipment_type ?? "",
          priority: p.priority ?? "",
          project_status: p.project_status ?? "",
          sale_name: p.sale_name ?? "",
          image_url: p.image_url ?? "",
          contractlist: Array.isArray(p.contractlist) ? p.contractlist : [],
        };
      });

      setProjects(mapped);
      setExpandedRows([]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter
  useEffect(() => {
    let data = projects;

    // by status
    if (selectedStatus !== STATUS.ALL) {
      data = data.filter((p) => p.status === selectedStatus);
    }

    // text search
    if (search) {
      const s = search.toLowerCase();
      data = data.filter((p) =>
        [
          p.project_name,
          p.coordinator,
          p.phone,
          p.village_name,
          p.district_name,
          p.province_name,
          p.sml_code,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(s)
      );
    }

    // date-only helper
    const toDateOnly = (d) => {
      if (!d) return null;
      const dd = new Date(d);
      if (isNaN(dd.getTime())) return null;
      dd.setHours(0, 0, 0, 0);
      return dd;
    };

    // filter by close_date
    if (fromDate) {
      const fd = toDateOnly(fromDate);
      if (fd) {
        data = data.filter((p) => {
          const pd = toDateOnly(p.close_date);
          return !pd || pd >= fd;
        });
      }
    }
    if (toDate) {
      const td = toDateOnly(toDate);
      if (td) {
        data = data.filter((p) => {
          const pd = toDateOnly(p.close_date);
          return !pd || pd <= td;
        });
      }
    }

    setFiltered(data);
    setPage(1);
  }, [projects, search, fromDate, toDate, selectedStatus]);

  // Pagination
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.ceil(filtered.length / perPage);

  // Register page-level header (title, refresh, search, status chips) so the
  // dashboard TopBar control panel can render them Odoo-style.
  usePageHeader({
    title: "ຂໍປິດໂຄງການ",
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
      placeholder: "ຄົ້ນຫາໂຄງການ, ຜູ້ປະສານງານ, ເບີໂທ...",
    },
    filterChips: [
      {
        id: STATUS.ALL,
        label: "ທັງໝົດ",
        count: projects.length,
        active: selectedStatus === STATUS.ALL,
        onClick: () => setSelectedStatus(STATUS.ALL),
      },
      {
        id: STATUS.WAITING,
        label: "ລໍຖ້າ",
        count: projects.filter((p) => p.status === STATUS.WAITING).length,
        active: selectedStatus === STATUS.WAITING,
        onClick: () => setSelectedStatus(STATUS.WAITING),
      },
      {
        id: STATUS.CLOSED,
        label: "ປິດແລ້ວ",
        count: projects.filter((p) => p.status === STATUS.CLOSED).length,
        active: selectedStatus === STATUS.CLOSED,
        onClick: () => setSelectedStatus(STATUS.CLOSED),
      },
    ],
  });

  return (
    <>
      <div className="bg-[var(--theme-bg-muted)] min-h-screen">
        <div className="px-4 py-6 lg:px-8 lg:py-8">
          {/* Date Range Filter Bar (kept in page; search/status/title moved to TopBar) */}
          <div className="mb-6">
            <div className="bg-white border border-[var(--theme-border-subtle)] rounded-lg shadow-sm px-4 py-4">
              <div className="mb-3 flex items-center gap-2 text-xs">
                <span className="text-slate-500 tabular-nums">{filtered.length} ໂຄງການ</span>
                <div className="ml-auto">
                  <ViewSwitcher value={viewMode} onChange={setViewMode} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* From Date */}
                <div className="relative">
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-[var(--theme-bg-muted)]/80 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400/40 focus:bg-white"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[var(--theme-text-mute)]">
                    ເລີ່ມ
                  </span>
                </div>

                {/* To Date */}
                <div className="relative">
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-[var(--theme-bg-muted)]/80 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400/40 focus:bg-white"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[var(--theme-text-mute)]">
                    ສິ້ນສຸດ
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Loading */}
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border border-[var(--theme-border-subtle)]" />
                  <div className="absolute inset-0 m-auto w-12 h-12 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                </div>
                <div className="text-xs font-medium text-slate-600">
                  ກຳລັງໂຫຼດຂໍ້ມູນໂຄງການ...
                </div>
              </div>
            </div>
          ) : viewMode === "kanban" ? (
            <div className="bg-white border border-[var(--theme-border-subtle)] rounded-lg shadow-sm p-3">
              <KanbanBoard<any>
                columns={[
                  {
                    id: STATUS.WAITING,
                    title: "ລໍຖ້າອະນຸມັດ",
                    color: "#f59e0b",
                    records: filtered.filter(
                      (p: any) => p.status === STATUS.WAITING,
                    ),
                  },
                  {
                    id: STATUS.CLOSED,
                    title: "ປິດໂຄງການແລ້ວ",
                    color: "#10b981",
                    records: filtered.filter(
                      (p: any) => p.status === STATUS.CLOSED,
                    ),
                  },
                ]}
                getCardId={(p: any) => String(p.id)}
                onCardClick={(p: any) => toggleExpand(p.id)}
                renderCard={(p: any) => (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-[11px] font-semibold text-[var(--theme-primary)]">
                        {p.sml_code || `#${p.id}`}
                      </span>
                      <span className="flex-shrink-0 text-[10px] text-[var(--theme-text-mute)] tabular-nums">
                        {formatDateDMY(p.close_date)}
                      </span>
                    </div>
                    <div className="truncate text-[12px] font-semibold text-[var(--theme-text)]">
                      {p.project_name}
                    </div>
                    {p.village_name && (
                      <div className="truncate text-[10px] text-[var(--theme-text-mute)]">
                        {p.village_name}, {p.district_name}
                      </div>
                    )}
                    <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[var(--theme-text-mute)]">
                      <span className="truncate">{p.coordinator || ""}</span>
                      <span className="tabular-nums">
                        {p.contractlist?.length || 0} ສັນຍາ
                      </span>
                    </div>
                  </div>
                )}
              />
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="bg-white border border-[var(--theme-border-subtle)] rounded-lg shadow-sm">
                <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
                  <table className="min-w-full text-xs text-slate-900">
                    <thead className="sticky top-0 z-10 bg-[var(--theme-bg-muted)] border-b border-[var(--theme-border-subtle)]">
                      <tr>
                        <th className="px-3 py-2 text-center font-medium text-slate-500">
                          รูป
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">
                          ໂຄງການ
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">
                          ສະຖານທີ່
                        </th>
                        <th className="px-3 py-2 text-center font-medium text-slate-500">
                          ສະຖານະ
                        </th>
                        <th className="px-3 py-2 text-center font-medium text-slate-500">
                          ວັນເລີ່ມ
                        </th>
                        <th className="px-3 py-2 text-center font-medium text-slate-500">
                          ວັນປິດ
                        </th>
                        <th className="px-3 py-2 text-center font-medium text-slate-500">
                          ຜູ້ປິດ
                        </th>
                        <th className="px-3 py-2 text-center font-medium text-slate-500">
                          ຈັດການ
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {paginated.map((p) => (
                        <React.Fragment key={p.id}>
                          <tr className="hover:bg-[var(--theme-bg-muted)] transition-colors">
                            {/* Image */}
                            <td className="px-3 py-2 text-center align-top">
                              {p.image_url ? (
                                <img
                                  src={`${
                                    process.env.NEXT_PUBLIC_IMAGE_HOST || ""
                                  }${p.image_url}`}
                                  alt="Project"
                                  className="w-8 h-8 rounded-md border border-[var(--theme-border-subtle)] object-cover mx-auto cursor-pointer"
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = "/no-image.svg";
                                  }}
                                  onClick={() => {
                                    setPreviewImage(
                                      `${
                                        process.env.NEXT_PUBLIC_IMAGE_HOST || ""
                                      }${p.image_url}`
                                    );
                                    setImagePreviewOpen(true);
                                  }}
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-md border border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] flex items-center justify-center mx-auto">
                                  <FileText className="w-4 h-4 text-slate-500" />
                                </div>
                              )}
                            </td>

                            {/* Project Name & Contact */}
                            <td className="px-3 py-2 align-top">
                              <div className="space-y-1">
                                <div
                                  className="font-medium text-[13px] text-slate-900 truncate max-w-[220px]"
                                  title={p.project_name}
                                >
                                  {p.project_name}
                                </div>
                                <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-600">
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                    {p.coordinator}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-md border border-[var(--theme-border-subtle)]">
                                    {p.phone}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Location */}
                            <td className="px-3 py-2 align-top">
                              <div className="text-[11px]">
                                <div
                                  className="text-slate-900 font-medium truncate max-w-[150px]"
                                  title={`${p.village_name}, ${p.district_name}, ${p.province_name}`}
                                >
                                  {p.village_name}
                                </div>
                                <div className="text-slate-500 truncate">
                                  {p.district_name}
                                </div>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="px-3 py-2 text-center align-top">
                              <span
                                className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
                                  p.status === STATUS.WAITING
                                    ? "text-amber-700"
                                    : "text-emerald-700"
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    p.status === STATUS.WAITING
                                      ? "bg-amber-500"
                                      : "bg-emerald-500"
                                  }`}
                                />
                                {p.status === STATUS.WAITING
                                  ? "ລໍຖ້າອະນຸມັດ"
                                  : "ປິດໂຄງການແລ້ວ"}
                              </span>
                            </td>

                            {/* Start Date */}
                            <td className="px-3 py-2 text-center align-top">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--theme-bg-muted)] border border-[var(--theme-border-subtle)] text-[11px] text-slate-700">
                                {p.created_at}
                              </span>
                            </td>

                            {/* Close Date */}
                            <td className="px-3 py-2 text-center align-top">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--theme-bg-muted)] border border-[var(--theme-border-subtle)] text-[11px] text-slate-700">
                                {formatDateDMY(p.close_date)}
                              </span>
                            </td>

                            {/* Closed by */}
                            <td className="px-3 py-2 text-center align-top">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--theme-bg-muted)] border border-[var(--theme-border-subtle)] text-[11px] text-slate-700">
                                {p.closer || "-"}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="px-3 py-2 text-center align-top">
                              <div className="flex items-center justify-center gap-1">
                                {p.contractlist?.length > 0 && (
                                  <button
                                    onClick={() => toggleExpand(p.id)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-300 bg-white text-[11px] text-slate-800 hover:bg-[var(--theme-bg-muted)]"
                                    title="ເບິ່ງລາຍການສັນຍາ"
                                  >
                                    <Eye size={12} />
                                    <span>
                                      {expandedRows.includes(p.id)
                                        ? "ປິດ"
                                        : "ເບິ່ງ"}
                                    </span>
                                  </button>
                                )}

                                <button
                                  onClick={() => {
                                    const params = new URLSearchParams();
                                    params.set("projectId", p.id);
                                    if (selectedStatus !== "ທັງໝົດ")
                                      params.set("status", selectedStatus);
                                    if (fromDate)
                                      params.set("dateFrom", fromDate);
                                    if (toDate) params.set("dateTo", toDate);
                                    const queryString = params.toString();
                                    const printUrl = `/service/projects-close-print${
                                      queryString ? "?" + queryString : ""
                                    }`;
                                    window.open(printUrl, "_blank");
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-300 bg-white text-[11px] text-slate-800 hover:bg-[var(--theme-bg-muted)]"
                                  title="ພິມໂຄງການນີ້"
                                >
                                  <span>พิมพ์</span>
                                </button>

                                {p.status === STATUS.WAITING &&
                                  role === "service_manager" && (
                                    <button
                                      onClick={() => {
                                        setPendingApproveId(p.id);
                                        setApproveModalOpen(true);
                                      }}
                                      className="inline-flex items-center gap-1 rounded-md bg-[var(--theme-primary)] px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-[var(--theme-primary-strong)]"
                                      title="ອະນຸມັດປິດໂຄງການ"
                                    >
                                      <CheckSquare size={12} />
                                      <span>ອະນຸມັດ</span>
                                    </button>
                                  )}
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Contracts */}
                          {expandedRows.includes(p.id) &&
                            p.contractlist?.length > 0 && (
                              <tr className="bg-[var(--theme-bg-muted)]/60">
                                <td colSpan={8} className="px-3 py-3">
                                  <div className="space-y-4">
                                    {p.contractlist.map(
                                      (contract, contractIdx) => (
                                        <div
                                          key={contractIdx}
                                          className="bg-white border border-[var(--theme-border-subtle)] rounded-md p-4 shadow-xs"
                                        >
                                          {/* Contract Header */}
                                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
                                            <div className="flex items-center gap-2">
                                              <div className="w-8 h-8 rounded-lg border border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] flex items-center justify-center">
                                                <FileText className="w-4 h-4 text-slate-700" />
                                              </div>
                                              <div>
                                                <div className="text-[13px] font-semibold text-slate-900">
                                                  ສັນຍາ:{" "}
                                                  {contract.contract_name}
                                                </div>
                                                <div className="flex flex-wrap gap-1 mt-1 text-[11px] text-slate-600">
                                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                                    {contract.contract_no}
                                                  </span>
                                                  <span className="px-2 py-0.5 rounded-md border border-[var(--theme-border-subtle)]">
                                                    {contract.cust_code}
                                                  </span>
                                                  <span className="px-2 py-0.5 rounded-md bg-[var(--theme-bg-muted)] border border-[var(--theme-border-subtle)]">
                                                    {formatDateDMY(
                                                      contract.start_date
                                                    )}
                                                  </span>
                                                  {contract.approve_status_1 ===
                                                    1 && (
                                                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                      {contract.approver_1}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          </div>

                                          {/* BOQ Table */}
                                          {contract.boq_list?.length > 0 && (
                                            <div className="overflow-x-auto mt-3">
                                              <div className="text-[11px] font-medium text-slate-700 mb-2">
                                                ລາຍການວັດສະດຸ
                                              </div>
                                              <table className="min-w-full text-[11px] border border-[var(--theme-border-subtle)] rounded-lg overflow-hidden">
                                                <thead className="bg-[var(--theme-bg-muted)] border-b border-[var(--theme-border-subtle)]">
                                                  <tr>
                                                    <th className="px-2 py-1.5 text-center font-medium text-slate-500 border-r border-[var(--theme-border-subtle)]">
                                                      #
                                                    </th>
                                                    <th className="px-2 py-1.5 text-left font-medium text-slate-500 border-r border-[var(--theme-border-subtle)]">
                                                      ລະຫັດ
                                                    </th>
                                                    <th className="px-2 py-1.5 text-left font-medium text-slate-500 border-r border-[var(--theme-border-subtle)]">
                                                      ລາຍການ
                                                    </th>
                                                    <th className="px-2 py-1.5 text-center font-medium text-slate-500 border-r border-[var(--theme-border-subtle)]">
                                                      BOQ
                                                    </th>
                                                    <th className="px-2 py-1.5 text-center font-medium text-slate-500 border-r border-[var(--theme-border-subtle)]">
                                                      ໜ່ວຍ
                                                    </th>
                                                    <th className="px-2 py-1.5 text-center font-medium text-slate-500 border-r border-[var(--theme-border-subtle)]">
                                                      ຂໍເບີກ
                                                    </th>
                                                    <th className="px-2 py-1.5 text-center font-medium text-slate-500 border-r border-[var(--theme-border-subtle)]">
                                                      ເບີກແລ້ວ
                                                    </th>
                                                    <th className="px-2 py-1.5 text-center font-medium text-slate-500">
                                                      ຄົງເຫຼືອ
                                                    </th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {contract.boq_list.map(
                                                    (item, idx) => (
                                                      <tr
                                                        key={idx}
                                                        className="border-t border-[var(--theme-border-subtle)] hover:bg-[var(--theme-bg-muted)]"
                                                      >
                                                        <td className="px-2 py-1.5 text-center font-medium text-slate-700">
                                                          {idx + 1}
                                                        </td>
                                                        <td className="px-2 py-1.5">
                                                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-[var(--theme-border-subtle)]">
                                                            {item.item_code}
                                                          </span>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-slate-800">
                                                          {item.item_name}
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center">
                                                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--theme-bg-muted)] border border-[var(--theme-border-subtle)] font-semibold text-slate-800">
                                                            {Number(
                                                              item.boq_qty ?? 0
                                                            ).toLocaleString()}
                                                          </span>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center">
                                                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--theme-bg-muted)] border border-[var(--theme-border-subtle)] font-medium text-slate-800">
                                                            {item.unit_code}
                                                          </span>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center">
                                                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--theme-bg-muted)] border border-[var(--theme-border-subtle)] font-semibold text-slate-800">
                                                            {Number(
                                                              item.request ?? 0
                                                            ).toLocaleString()}
                                                          </span>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center">
                                                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--theme-bg-muted)] border border-[var(--theme-border-subtle)] font-semibold text-slate-800">
                                                            {Number(
                                                              item.withdraw ??
                                                                0
                                                            ).toLocaleString()}
                                                          </span>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center">
                                                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--theme-bg-muted)] border border-[var(--theme-border-subtle)] font-semibold text-slate-800">
                                                            {Number(
                                                              item.balance ?? 0
                                                            ).toLocaleString()}
                                                          </span>
                                                        </td>
                                                      </tr>
                                                    )
                                                  )}
                                                </tbody>
                                              </table>
                                            </div>
                                          )}

                                          {/* Attachments */}
                                          {contract.att_list?.length > 0 && (
                                            <div className="mt-4">
                                              <div className="text-[11px] font-medium text-slate-700 mb-2">
                                                ໄຟລ໌ແນບ
                                              </div>
                                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                {contract.att_list.map(
                                                  (att, attIdx) => (
                                                    <div
                                                      key={attIdx}
                                                      className="border border-[var(--theme-border-subtle)] rounded-lg px-3 py-2 bg-[var(--theme-bg-muted)]"
                                                    >
                                                      <div className="text-[11px] text-slate-500 mb-1">
                                                        ຊື່ໄຟລ໌
                                                      </div>
                                                      <div
                                                        className="text-[11px] text-slate-800 truncate"
                                                        title={att.file_name}
                                                      >
                                                        {att.file_name}
                                                      </div>
                                                      <a
                                                        href={`${
                                                          process.env
                                                            .NEXT_PUBLIC_IMAGE_HOST ||
                                                          ""
                                                        }/${att.file_path}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="mt-2 inline-flex items-center text-[11px] text-slate-700 hover:text-slate-900"
                                                      >
                                                        ดาวน์โหลด
                                                      </a>
                                                    </div>
                                                  )
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                        </React.Fragment>
                      ))}

                      {paginated.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-4 py-16 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-12 h-12 rounded-md border border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] flex items-center justify-center">
                                <FileText className="w-6 h-6 text-[var(--theme-text-mute)]" />
                              </div>
                              <div className="text-sm font-medium text-slate-700">
                                ບໍ່ມີຂໍ້ມູນໂຄງການທີ່ປິດແລ້ວ
                              </div>
                              <div className="text-xs text-slate-500">
                                ຍັງບໍ່ມີໂຄງການທີ່ສຳເລັດການປິດງານ
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination – App Store Connect style */}
                <div className="border-t border-[var(--theme-border-subtle)] px-4 py-3 flex items-center justify-center gap-3">
                  <button
                    onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                    disabled={page === 1}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-slate-300 bg-white text-xs text-slate-700 disabled:opacity-40 disabled:cursor-default hover:bg-[var(--theme-bg-muted)]"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages || 1 }, (_, i) => {
                      const pageIndex = i + 1;
                      const isCurrent = pageIndex === page;
                      return (
                        <button
                          key={pageIndex}
                          onClick={() => setPage(pageIndex)}
                          className={`min-w-[32px] h-8 px-2 rounded-full text-xs font-medium border ${
                            isCurrent
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-[var(--theme-bg-muted)]"
                          }`}
                        >
                          {pageIndex}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() =>
                      setPage((prev) => Math.min(prev + 1, totalPages || 1))
                    }
                    disabled={page === totalPages || totalPages === 0}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-slate-300 bg-white text-xs text-slate-700 disabled:opacity-40 disabled:cursor-default hover:bg-[var(--theme-bg-muted)]"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Approve Close Modal */}
      <Modal
        isOpen={approveModalOpen}
        onRequestClose={() => {
          setApproveModalOpen(false);
          setPendingApproveId(null);
        }}
        contentLabel="ອະນຸມັດປິດໂຄງການ"
        ariaHideApp={false}
        style={{
          overlay: {
            backgroundColor: "rgba(15,23,42,0.35)",
            zIndex: 1000,
            backdropFilter: "blur(8px)",
          },
          content: {
            maxWidth: 640,
            width: "95vw",
            margin: "auto",
            borderRadius: 24,
            padding: 0,
            border: "1px solid #E5E7EB",
            boxShadow:
              "0 18px 45px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(15,23,42,0.02)",
            height: "fit-content",
            inset: "auto",
          },
        }}
      >
        <div className="bg-white rounded-lg overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-[var(--theme-border-subtle)] flex items-center gap-3 bg-[var(--theme-bg-muted)]">
            <div className="w-9 h-9 rounded-lg border border-slate-300 bg-white flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-slate-800" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                ອະນຸມັດປິດໂຄງການ
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                ກະລຸນາກວດສອບຂໍ້ມູນກ່ອນຢືນຢັນການອະນຸມັດປິດໂຄງການ
              </p>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Project Details */}
            {pendingApproveId && (
              <>
                <div className="bg-[var(--theme-bg-muted)] border border-[var(--theme-border-subtle)] rounded-lg px-4 py-4">
                  <h3 className="text-xs font-semibold text-slate-800 mb-3">
                    ລາຍລະອຽດໂຄງການ
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <div className="text-slate-500 mb-1">ລະຫັດໂຄງການ</div>
                      <input
                        type="text"
                        readOnly
                        value={
                          projects.find((p) => p.id === pendingApproveId)
                            ?.sml_code || "-"
                        }
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-800 text-[11px]"
                      />
                    </div>
                    <div>
                      <div className="text-slate-500 mb-1">
                        ສະຖານະປັດຈຸບັນ
                      </div>
                      <input
                        type="text"
                        readOnly
                        value={
                          projects.find((p) => p.id === pendingApproveId)
                            ?.status || "-"
                        }
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-800 text-[11px]"
                      />
                    </div>
                    <div className="col-span-2">
                      <div className="text-slate-500 mb-1">ຊື່ໂຄງການ</div>
                      <input
                        type="text"
                        readOnly
                        value={
                          projects.find((p) => p.id === pendingApproveId)
                            ?.project_name || "-"
                        }
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-800 text-[11px]"
                      />
                    </div>
                    <div>
                      <div className="text-slate-500 mb-1">ຜູ້ປະສານງານ</div>
                      <input
                        type="text"
                        readOnly
                        value={
                          projects.find((p) => p.id === pendingApproveId)
                            ?.coordinator || "-"
                        }
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-800 text-[11px]"
                      />
                    </div>
                    <div>
                      <div className="text-slate-500 mb-1">ເບີໂທ</div>
                      <input
                        type="text"
                        readOnly
                        value={
                          projects.find((p) => p.id === pendingApproveId)
                            ?.phone || "-"
                        }
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-800 text-[11px]"
                      />
                    </div>
                  </div>
                </div>

                {/* Contract Summary */}
                <div className="bg-[var(--theme-bg-muted)] border border-[var(--theme-border-subtle)] rounded-lg px-4 py-4">
                  <h3 className="text-xs font-semibold text-slate-800 mb-3">
                    ສະຫຼຸບສັນຍາ
                  </h3>
                  <div className="grid grid-cols-3 gap-3 text-[11px]">
                    <div className="rounded-md border border-[var(--theme-border-subtle)] bg-white px-3 py-3">
                      <div className="text-slate-500 mb-1">ຈຳນວນສັນຍາ</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {projects.find((p) => p.id === pendingApproveId)
                          ?.contractlist?.length || 0}
                      </div>
                    </div>
                    <div className="rounded-md border border-[var(--theme-border-subtle)] bg-white px-3 py-3">
                      <div className="text-slate-500 mb-1">ລາຍການ BOQ</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {projects.find((p) => p.id === pendingApproveId)
                          ?.contractlist?.reduce(
                            (sum, contract) =>
                              sum + (contract.boq_list?.length || 0),
                            0
                          ) || 0}
                      </div>
                    </div>
                    <div className="rounded-md border border-[var(--theme-border-subtle)] bg-white px-3 py-3">
                      <div className="text-slate-500 mb-1">
                        ຂໍເບີກທັງໝົດ
                      </div>
                      <div className="text-sm font-semibold text-slate-900">
                        {(
                          projects
                            .find((p) => p.id === pendingApproveId)
                            ?.contractlist?.reduce((sum, contract) => {
                              const itemTotal =
                                contract.boq_list?.reduce(
                                  (itemSum, item) =>
                                    itemSum + (Number(item.request) || 0),
                                  0
                                ) || 0;
                              return sum + itemTotal;
                            }, 0) || 0
                        ).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Buttons */}
            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={() => {
                  setApproveModalOpen(false);
                  setPendingApproveId(null);
                }}
                className="px-4 py-2 rounded-full border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-[var(--theme-bg-muted)] disabled:opacity-50"
                disabled={approveLoading}
              >
                ຍົກເລີກ
              </button>
              <button
                onClick={async () => {
                  if (!pendingApproveId) return;
                  setApproveLoading(true);
                  try {
                    const userStr = localStorage.getItem("user");
                    const user = userStr ? JSON.parse(userStr) : {};
                    const res = await fetch(`/api/projects/approveclose/${pendingApproveId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ..._getAuthHeaders() },
      body: JSON.stringify({
                        username: user.username || "",
                      }),
    }).then(r => r.json());

                    const newClosedAt = res?.closed_at || null;
                    const success = res?.success === true;

                    if (success) {
                      setProjects((prev) =>
                        prev.map((p) =>
                          p.id === pendingApproveId
                            ? {
                                ...p,
                                status: STATUS.CLOSED,
                                approve_status: 1,
                                close_date: newClosedAt ?? p.close_date,
                                closer:
                                  p.closer || user.username || p.closer,
                              }
                            : p
                        )
                      );
                      setApproveModalOpen(false);
                      setPendingApproveId(null);
                      Swal.fire({
                        icon: "success",
                        title: "ອະນຸມັດປິດໂຄງການສຳເລັດ",
                        timer: 1500,
                        showConfirmButton: false,
                      });
                    } else {
                      throw new Error(
                        res?.message || "ເກີດຂໍ້ຜິດພາດ"
                      );
                    }
                  } catch (err) {
                    Swal.fire({
                      icon: "error",
                      title: "ອະນຸມັດບໍ່ສຳເລັດ",
                      text: err.message,
                    });
                  } finally {
                    setApproveLoading(false);
                  }
                }}
                className="px-5 py-2 rounded-full bg-slate-900 text-xs font-medium text-white hover:bg-black inline-flex items-center gap-2 disabled:opacity-50"
                disabled={approveLoading}
              >
                {approveLoading ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>ກຳລັງອະນຸມັດ...</span>
                  </>
                ) : (
                  <>
                    <CheckSquare size={14} />
                    <span>ຢືນຢັນອະນຸມັດ</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Image Preview Modal */}
      <Modal
        isOpen={imagePreviewOpen}
        onRequestClose={() => setImagePreviewOpen(false)}
        contentLabel="Image Preview"
        ariaHideApp={false}
        style={{
          overlay: {
            backgroundColor: "rgba(15,23,42,0.75)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(8px)",
          },
          content: {
            position: "relative",
            background: "transparent",
            border: "none",
            padding: 0,
            width: "auto",
            maxWidth: "90vw",
            maxHeight: "90vh",
            margin: "auto",
            inset: "auto",
          },
        }}
      >
        {previewImage && (
          <div className="relative">
            <button
              onClick={() => setImagePreviewOpen(false)}
              className="absolute -top-4 -right-4 w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-[var(--theme-shadow)] hover:bg-black"
              aria-label="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <div className="relative overflow-hidden rounded-lg shadow-[var(--theme-shadow-lg)] border border-[var(--theme-border-subtle)] bg-black">
              <img
                src={previewImage}
                alt="Preview"
                className="max-w-full max-h-[80vh] object-contain"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/no-image.svg";
                }}
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default function Page() {
  return (
    <AuthGuard roles={["service_admin", "service_manager", "sale_manager", "sale_admin", "account_admin", "head_technician"]}>
      <ProjectListClose />
    </AuthGuard>
  );
}
