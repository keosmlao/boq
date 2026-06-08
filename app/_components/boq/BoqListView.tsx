"use client";


import { getListBoq, deleteBoq, approveBoq } from "@/_actions/boq";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  Eye,
  FolderOpen,
  Package,
  Plus,
  RefreshCw,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { usePageHeader } from "@/_components/PageHeader";
import ViewSwitcher, { type ViewMode } from "@/_components/odoo/ViewSwitcher";
import KanbanBoard, { type KanbanColumn } from "@/_components/odoo/KanbanBoard";

function _getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type BoqItem = {
  id?: number | string;
  boq_qty?: number | string;
  qty?: number | string;
  request_qty?: number | string;
  withdraw?: number | string;
  withdraw_qty?: number | string;
  balance?: number | string;
  remaining?: number | string;
  stock_balance?: number | string;
  item_code?: string;
  item_name?: string;
  unit?: string;
};

type BoqRow = {
  id: number | string;
  doc_no: string;
  doc_no_lc: string;
  doc_date: string;
  doc_date_ts: number;
  project_id: string;
  project_name: string;
  project_name_lc: string;
  coordinator: string;
  coordinator_lc: string;
  cust_code: string;
  contract_no: string;
  contract_name: string;
  contract_no_lc: string;
  contract_name_lc: string;
  user_created: string;
  approve_status: number;
  approver: any;
  image_url: string | null;
  boq_total_qty: number;
  withdraw_total_qty: number;
  remaining_total_qty: number;
  boq_list: BoqItem[];
  total_items: number;
  detailsLoaded: boolean;
};

const numVal = (...vals: any[]): number => {
  for (const v of vals) {
    if (v === null || v === undefined || v === "") continue;
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
};

const lower = (v: any) => (v ?? "").toString().toLowerCase();

const toIsoDate = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "";
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return "";
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(v).slice(0, 10);
};

const fmtDate = (v?: string | null) => {
  const iso = toIsoDate(v);
  if (!iso) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }
  return iso;
};

const fmtNum = (n: number) => Number(n || 0).toLocaleString("en-US");

const STATUS_META: Record<
  number,
  { label: string; dot: string; text: string }
> = {
  0: { label: "ລໍຖ້າ", dot: "bg-amber-500", text: "text-amber-700" },
  1: { label: "ອະນຸມັດ", dot: "bg-emerald-500", text: "text-emerald-700" },
  2: { label: "ປະຕິເສດ", dot: "bg-rose-500", text: "text-rose-700" },
};

function BOQTable() {
  const router = useRouter();

  const [rows, setRows] = useState<BoqRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "0" | "1" | "2">("all");
  const [itemFilter, setItemFilter] = useState("");
  const [debouncedItemFilter, setDebouncedItemFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [detailLoading, setDetailLoading] = useState<Set<string>>(new Set());
  const [role, setRole] = useState("");
  const [username, setUsername] = useState("");
  const [deleteDocNo, setDeleteDocNo] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("boq-list-view");
      if (saved === "list" || saved === "kanban") setViewMode(saved);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("boq-list-view", viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);

  const requestIdRef = useRef(0);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setRole(user.role || "");
        setUsername(user.username || "");
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedItemFilter(itemFilter), 350);
    return () => clearTimeout(t);
  }, [itemFilter]);

  const loadList = async (itemSearch?: string) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const itemSearchTrim = (itemSearch ?? debouncedItemFilter ?? "").trim();
      const resp = await getListBoq({ includeItems: false, itemSearch: itemSearchTrim || undefined });
      if (requestId !== requestIdRef.current) return;
      const serverData = Array.isArray(resp) ? resp : [];
      const mapped: BoqRow[] = serverData.map((x: any, i: number) => {
        const docNo = x.doc_no ?? "-";
        const docDate = toIsoDate(x.doc_date);
        const boqList = Array.isArray(x.boq_list) ? x.boq_list : [];
        const boqTotalQty = numVal(x.boq_total_qty, x.total_boq_qty);
        const withdrawTotalQty = numVal(x.withdraw_total_qty, x.total_withdraw_qty);
        return {
          id: x.id ?? i + 1,
          doc_no: docNo,
          doc_no_lc: lower(docNo),
          doc_date: docDate,
          doc_date_ts: docDate ? Date.parse(docDate) || 0 : 0,
          project_id: x.project_id ?? "",
          project_name: x.project_name ?? "-",
          project_name_lc: lower(x.project_name),
          coordinator: x.coordinator ?? "-",
          coordinator_lc: lower(x.coordinator),
          cust_code: x.cust_code ?? "",
          contract_no: x.contract_no ?? "",
          contract_name: x.contract_name ?? "",
          contract_no_lc: lower(x.contract_no),
          contract_name_lc: lower(x.contract_name),
          user_created: x.user_created ?? "-",
          approve_status:
            typeof x.approve_status === "number" ? x.approve_status : 0,
          approver: x.approver ?? null,
          image_url: x.image_url ?? null,
          boq_total_qty: boqTotalQty,
          withdraw_total_qty: withdrawTotalQty,
          remaining_total_qty: Math.max(boqTotalQty - withdrawTotalQty, 0),
          boq_list: Array.isArray(x.boq_list) ? boqList : [],
          total_items:
            typeof x.total_items === "number"
              ? x.total_items
              : Array.isArray(x.boq_list)
                ? x.boq_list.length
                : 0,
          detailsLoaded: Array.isArray(x.boq_list),
        };
      });
      setRows(mapped);
      setExpanded(new Set());
    } catch (err) {
      console.error(err);
      if (requestId === requestIdRef.current) setRows([]);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    void loadList(debouncedItemFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedItemFilter]);

  const filtered = useMemo(() => {
    const s = lower(searchTerm);
    return rows
      .filter((r) => {
        const matchSearch =
          !s ||
          r.doc_no_lc.includes(s) ||
          r.project_name_lc.includes(s) ||
          r.coordinator_lc.includes(s) ||
          r.contract_no_lc.includes(s) ||
          r.contract_name_lc.includes(s);
        const matchStatus =
          statusFilter === "all" || r.approve_status.toString() === statusFilter;
        return matchSearch && matchStatus;
      })
      .sort((a, b) => b.doc_date_ts - a.doc_date_ts);
  }, [rows, searchTerm, statusFilter]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      pending: rows.filter((x) => x.approve_status === 0).length,
      approved: rows.filter((x) => x.approve_status === 1).length,
      rejected: rows.filter((x) => x.approve_status === 2).length,
    }),
    [rows],
  );

  usePageHeader({
    title: "ລາຍການ BOQ",
    subtitle: `${filtered.length.toLocaleString()} ລາຍການ`,
    secondaryActions: [
      {
        label: "ໂຫຼດໃໝ່",
        icon: (
          <RefreshCw
            size={13}
            className={loading ? "animate-spin" : ""}
          />
        ),
        onClick: () => void loadList(itemFilter),
        disabled: loading,
      },
    ],
    search: {
      value: searchTerm,
      onChange: setSearchTerm,
      placeholder: "ຄົ້ນຫາ BOQ, ໂຄງການ, ສັນຍາ, ຜູ້ປະສານ...",
    },
    filterChips: [
      {
        id: "all",
        label: "ທັງໝົດ",
        count: counts.all,
        active: statusFilter === "all",
        onClick: () => setStatusFilter("all"),
      },
      {
        id: "0",
        label: "ລໍຖ້າ",
        count: counts.pending,
        active: statusFilter === "0",
        onClick: () => setStatusFilter("0"),
      },
      {
        id: "1",
        label: "ອະນຸມັດ",
        count: counts.approved,
        active: statusFilter === "1",
        onClick: () => setStatusFilter("1"),
      },
      {
        id: "2",
        label: "ປະຕິເສດ",
        count: counts.rejected,
        active: statusFilter === "2",
        onClick: () => setStatusFilter("2"),
      },
    ],
  });

  // --- Detail loader (per-row, on expand) ---
  const ensureDetails = async (docNo: string) => {
    const row = rows.find((r) => r.doc_no === docNo);
    if (!row || row.detailsLoaded) return;
    if (detailLoading.has(docNo)) return;
    setDetailLoading((prev) => {
      const n = new Set(prev);
      n.add(docNo);
      return n;
    });
    try {
      const resp = await fetch(
        `/api/boq/${encodeURIComponent(docNo)}`,
        { headers: _getAuthHeaders() },
      ).then((r) => r.json());
      const boqList = Array.isArray(resp?.boq_list) ? resp.boq_list : [];
      setRows((rs) =>
        rs.map((r) =>
          r.doc_no === docNo
            ? {
                ...r,
                boq_list: boqList,
                detailsLoaded: true,
                total_items:
                  typeof r.total_items === "number"
                    ? r.total_items
                    : boqList.length,
                contract_no: resp?.contract_no ?? r.contract_no,
                contract_name: resp?.contract_name ?? r.contract_name,
              }
            : r,
        ),
      );
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading((prev) => {
        const n = new Set(prev);
        n.delete(docNo);
        return n;
      });
    }
  };

  const toggleExpand = (docNo: string) => {
    const shouldOpen = !expanded.has(docNo);
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(docNo)) n.delete(docNo);
      else n.add(docNo);
      return n;
    });
    if (shouldOpen) void ensureDetails(docNo);
  };

  // --- Handlers ---
  const openEdit = (docNo: string) =>
    router.push(`/boq/${encodeURIComponent(docNo)}/edit`);

  const requestApprove = async (docNo: string, newStatus: 1 | 2) => {
    const label = newStatus === 1 ? "ອະນຸມັດ" : "ປະຕິເສດ";
    if (!window.confirm(`ຢືນຢັນ${label} BOQ ${docNo}?`)) return;
    const prev = rows;
    setRows((rs) =>
      rs.map((r) =>
        r.doc_no === docNo
          ? { ...r, approve_status: newStatus, approver: username }
          : r,
      ),
    );
    try {
      await approveBoq(docNo, { status: newStatus, username });
    } catch (err) {
      console.error(err);
      alert(`${label} ບໍ່ສຳເລັດ`);
      setRows(prev);
    }
  };

  const confirmDelete = async () => {
    if (!deleteDocNo) return;
    const docNo = deleteDocNo;
    const prev = rows;
    setRows((r) => r.filter((x) => x.doc_no !== docNo));
    setDeleteDocNo(null);
    try {
      await deleteBoq(docNo);
    } catch (err) {
      console.error(err);
      alert("ລຶບບໍ່ສຳເລັດ");
      setRows(prev);
    }
  };

  const openRequest = (docNo: string) =>
    router.push(`/service-admin/boq-request/${encodeURIComponent(docNo)}`);

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setItemFilter("");
  };

  const isAdmin = role === "service_admin";
  const isManager = role === "service_manager";

  return (
    <div className="bg-[var(--theme-page)] px-3 py-3 md:px-4">
      <div className="mx-auto max-w-[1480px]">
        <section className="theme-card overflow-hidden">
          {/* Optional item search bar (inline) */}
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--theme-border-subtle)] bg-white px-3 py-2 text-[12px]">
            <div className="flex h-7 min-w-[220px] flex-1 items-center gap-2 rounded-md border border-[var(--theme-border-subtle)] bg-white px-2 focus-within:border-[var(--theme-primary-soft)]">
              <Package className="h-3.5 w-3.5 text-[var(--theme-text-mute)]" />
              <input
                value={itemFilter}
                onChange={(e) => setItemFilter(e.target.value)}
                placeholder="ຄົ້ນຫາສິນຄ້າໃນ BOQ..."
                className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-[var(--theme-text-mute)]"
              />
              {itemFilter && (
                <button
                  type="button"
                  onClick={() => setItemFilter("")}
                  className="text-[var(--theme-text-mute)] hover:text-[var(--theme-text)]"
                  aria-label="ລ້າງ"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            {(searchTerm || statusFilter !== "all" || itemFilter) && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-[11px] font-medium text-[var(--theme-primary)] hover:underline"
              >
                ລ້າງຕົວກັ່ນຕອງ
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden text-[11px] text-[var(--theme-text-mute)] tabular-nums md:inline">
                {filtered.length} / {rows.length}
              </span>
              <ViewSwitcher value={viewMode} onChange={setViewMode} />
            </div>
          </div>

          {/* List / Kanban */}
          {loading ? (
            <div className="flex h-60 items-center justify-center">
              <div className="flex items-center gap-3 text-[var(--theme-text-mute)]">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--theme-border-subtle)] border-t-[var(--theme-primary)]" />
                <span className="text-sm">ກຳລັງໂຫຼດ...</span>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-60 flex-col items-center justify-center gap-3 text-[var(--theme-text-mute)]">
              <FolderOpen className="h-8 w-8 opacity-40" />
              <div className="text-center">
                <div className="text-sm font-semibold text-[var(--theme-text-soft)]">
                  ບໍ່ພົບ BOQ
                </div>
                <div className="mt-1 text-xs">
                  ລອງປັບຄຳຄົ້ນ ຫຼື ຕົວກັ່ນຕອງ
                </div>
              </div>
              {(searchTerm || statusFilter !== "all" || itemFilter) && (
                <button
                  onClick={clearFilters}
                  className="text-xs font-medium text-[var(--theme-primary)] hover:underline"
                >
                  ລ້າງຕົວກັ່ນຕອງ
                </button>
              )}
            </div>
          ) : viewMode === "kanban" ? (
            <div className="px-3 pt-3 md:px-4">
              <KanbanBoard<BoqRow>
                columns={[
                  {
                    id: "0",
                    title: STATUS_META[0].label,
                    color: "#f59e0b",
                    records: filtered.filter((r) => r.approve_status === 0),
                  },
                  {
                    id: "1",
                    title: STATUS_META[1].label,
                    color: "#10b981",
                    records: filtered.filter((r) => r.approve_status === 1),
                  },
                  {
                    id: "2",
                    title: STATUS_META[2].label,
                    color: "#f43f5e",
                    records: filtered.filter((r) => r.approve_status === 2),
                  },
                ]}
                getCardId={(r) => r.doc_no}
                onCardClick={(r) => openEdit(r.doc_no)}
                renderCard={(r) => (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-[11px] font-semibold text-[var(--theme-primary)]">
                        {r.doc_no}
                      </span>
                      <span className="flex-shrink-0 text-[10px] text-[var(--theme-text-mute)] tabular-nums">
                        {fmtDate(r.doc_date)}
                      </span>
                    </div>
                    <div className="truncate text-[12px] font-semibold text-[var(--theme-text)]">
                      {r.project_name}
                    </div>
                    {r.contract_no && (
                      <div className="truncate font-mono text-[10px] text-[var(--theme-text-mute)]">
                        ສັນຍາ {r.contract_no}
                      </div>
                    )}
                    <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[var(--theme-text-mute)]">
                      {r.coordinator && r.coordinator !== "-" ? (
                        <span className="truncate">{r.coordinator}</span>
                      ) : (
                        <span />
                      )}
                      <span className="tabular-nums">
                        {r.total_items} ລາຍ
                      </span>
                    </div>
                  </div>
                )}
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--theme-border-subtle)]">
              {filtered.map((row) => {
                const isOpen = expanded.has(row.doc_no);
                const status =
                  STATUS_META[row.approve_status] || STATUS_META[0];
                const isLoadingDetail = detailLoading.has(row.doc_no);
                return (
                  <li key={row.doc_no} className="bg-white">
                    <div
                      onClick={() => toggleExpand(row.doc_no)}
                      className={[
                        "group flex cursor-pointer items-center gap-3 px-3 py-2.5 transition",
                        isOpen
                          ? "bg-[var(--theme-bg-muted)]"
                          : "hover:bg-[var(--theme-bg-muted)]/60",
                      ].join(" ")}
                    >
                      <ChevronDown
                        className={`h-4 w-4 flex-shrink-0 text-[var(--theme-text-mute)] transition ${isOpen ? "" : "-rotate-90"}`}
                      />
                      <span
                        className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${status.dot}`}
                      />

                      {/* doc_no — leading id */}
                      <span className="w-[150px] flex-shrink-0 truncate font-mono text-[12px] font-semibold text-[var(--theme-primary)]">
                        {row.doc_no}
                      </span>

                      {/* project + contract */}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-[var(--theme-text)]">
                          {row.project_name}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0 text-[10px] text-[var(--theme-text-mute)]">
                          {row.contract_no && (
                            <span className="font-mono">
                              ສັນຍາ {row.contract_no}
                            </span>
                          )}
                          {row.coordinator && row.coordinator !== "-" && (
                            <span>{row.coordinator}</span>
                          )}
                          {row.user_created && row.user_created !== "-" && (
                            <span>ໂດຍ {row.user_created}</span>
                          )}
                        </div>
                      </div>

                      {/* date */}
                      <span className="hidden w-[80px] flex-shrink-0 text-[11px] tabular-nums text-[var(--theme-text-mute)] md:inline">
                        {fmtDate(row.doc_date)}
                      </span>

                      {/* items count */}
                      <span className="hidden w-[60px] flex-shrink-0 text-right md:inline">
                        <span className="text-[11px] tabular-nums text-[var(--theme-text-soft)]">
                          {row.total_items}
                        </span>
                        <span className="ml-1 text-[10px] text-[var(--theme-text-mute)]">
                          ລາຍ
                        </span>
                      </span>

                      {/* status */}
                      <span
                        className={`hidden w-[80px] flex-shrink-0 text-[11px] font-medium md:inline ${status.text}`}
                      >
                        {status.label}
                      </span>

                      {/* actions */}
                      <div
                        className="flex flex-shrink-0 items-center gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => openEdit(row.doc_no)}
                          title="ເບີ່ງ/ແກ້ໄຂ"
                          className="flex h-7 w-7 items-center justify-center rounded text-[var(--theme-text-mute)] transition hover:bg-white hover:text-[var(--theme-primary)]"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {isManager && row.approve_status === 0 && (
                          <>
                            <button
                              onClick={() => requestApprove(row.doc_no, 1)}
                              title="ອະນຸມັດ"
                              className="flex h-7 w-7 items-center justify-center rounded text-emerald-700 transition hover:bg-emerald-50"
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => requestApprove(row.doc_no, 2)}
                              title="ປະຕິເສດ"
                              className="flex h-7 w-7 items-center justify-center rounded text-rose-700 transition hover:bg-rose-50"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        {row.approve_status === 1 && (
                          <button
                            onClick={() => openRequest(row.doc_no)}
                            title="ສ້າງໃບຂໍເບີກ"
                            className="inline-flex h-7 items-center gap-1 rounded-md bg-[var(--theme-primary)] px-2 text-[10px] font-semibold text-white transition hover:bg-[var(--theme-primary-strong)]"
                          >
                            <Plus className="h-3 w-3" />
                            ໃບເບີກ
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => setDeleteDocNo(row.doc_no)}
                            title="ລຶບ"
                            className="flex h-7 w-7 items-center justify-center rounded text-[var(--theme-text-mute)] transition hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded — BOQ items */}
                    {isOpen && (
                      <div className="bg-[var(--theme-bg-muted)]/40 border-t border-[var(--theme-border-subtle)]">
                        {isLoadingDetail ? (
                          <div className="flex items-center justify-center gap-3 py-6 text-[var(--theme-text-mute)]">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--theme-border-subtle)] border-t-[var(--theme-primary)]" />
                            <span className="text-xs">ກຳລັງໂຫຼດລາຍລະອຽດ...</span>
                          </div>
                        ) : row.boq_list.length === 0 ? (
                          <div className="flex items-center gap-2 px-4 py-3 text-[11px] text-[var(--theme-text-mute)]">
                            <span className="h-1.5 w-1.5 rounded-full border border-[var(--theme-border)] bg-white" />
                            ບໍ່ມີລາຍການ
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-[12px]">
                              <thead>
                                <tr className="border-b border-[var(--theme-border-subtle)] text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text-mute)]">
                                  <th className="px-4 py-2 text-left">#</th>
                                  <th className="px-4 py-2 text-left">ສິນຄ້າ</th>
                                  <th className="px-4 py-2 text-right">BOQ</th>
                                  <th className="px-4 py-2 text-right">ຂໍເບີກ</th>
                                  <th className="px-4 py-2 text-right">ເບີກແລ້ວ</th>
                                  <th className="px-4 py-2 text-right">ຍັງເຫຼືອ</th>
                                  <th className="px-4 py-2 text-right">ໃນສາງ</th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.boq_list.map((bi: BoqItem, idx: number) => {
                                  const boqQty = numVal(bi.boq_qty, bi.qty);
                                  const requested = numVal(bi.request_qty);
                                  const withdrawn = numVal(
                                    bi.withdraw,
                                    bi.withdraw_qty,
                                  );
                                  const remaining = numVal(
                                    bi.balance,
                                    bi.remaining,
                                    boqQty - requested - withdrawn,
                                  );
                                  const stock = numVal(bi.stock_balance);
                                  const stockShort = stock > 0 && stock < remaining;
                                  const stockOut = stock === 0 && remaining > 0;
                                  return (
                                    <tr
                                      key={`${bi.item_code || idx}-${idx}`}
                                      className="border-b border-[var(--theme-border-subtle)] last:border-b-0 hover:bg-white"
                                    >
                                      <td className="whitespace-nowrap px-4 py-1.5 font-mono text-[10px] text-[var(--theme-text-mute)]">
                                        {String(idx + 1).padStart(2, "0")}
                                      </td>
                                      <td className="px-4 py-1.5">
                                        <div className="flex items-center gap-1.5">
                                          {stockOut ? (
                                            <AlertCircle className="h-3 w-3 text-rose-500" />
                                          ) : stockShort ? (
                                            <AlertCircle className="h-3 w-3 text-amber-500" />
                                          ) : null}
                                          <span className="text-[var(--theme-text)]">
                                            {bi.item_name || bi.item_code || "-"}
                                          </span>
                                          {bi.unit && (
                                            <span className="text-[10px] text-[var(--theme-text-mute)]">
                                              {bi.unit}
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-1.5 text-right font-mono tabular-nums">
                                        {fmtNum(boqQty)}
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-1.5 text-right font-mono tabular-nums">
                                        <span
                                          className={
                                            requested > 0
                                              ? "text-amber-700 font-semibold"
                                              : "text-[var(--theme-text-mute)]"
                                          }
                                        >
                                          {fmtNum(requested)}
                                        </span>
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-1.5 text-right font-mono tabular-nums">
                                        <span
                                          className={
                                            withdrawn > 0
                                              ? "text-emerald-700 font-semibold"
                                              : "text-[var(--theme-text-mute)]"
                                          }
                                        >
                                          {fmtNum(withdrawn)}
                                        </span>
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-1.5 text-right font-mono tabular-nums">
                                        <span
                                          className={
                                            remaining < 0
                                              ? "text-rose-700 font-semibold"
                                              : "text-[var(--theme-text)]"
                                          }
                                        >
                                          {fmtNum(remaining)}
                                        </span>
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-1.5 text-right font-mono tabular-nums">
                                        <span
                                          className={
                                            stockOut
                                              ? "text-rose-700"
                                              : stockShort
                                                ? "text-amber-700"
                                                : "text-[var(--theme-text-soft)]"
                                          }
                                        >
                                          {fmtNum(stock)}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Delete confirm modal */}
      {deleteDocNo && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm pt-[20vh]"
          onClick={() => setDeleteDocNo(null)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-lg border border-[var(--theme-border-subtle)] bg-white shadow-[var(--theme-shadow-lg)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-100">
                <AlertCircle size={20} />
              </div>
              <h3 className="text-base font-semibold text-[var(--theme-text)]">
                ລຶບ BOQ?
              </h3>
              <p className="mt-1 text-[12px] text-[var(--theme-text-mute)]">
                <span className="font-mono">{deleteDocNo}</span> ຈະຖືກລຶບຢ່າງຖາວອນ
              </p>
            </div>
            <div className="flex gap-2 border-t border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] p-3">
              <button
                onClick={() => setDeleteDocNo(null)}
                className="flex-1 rounded-md border border-[var(--theme-border-subtle)] bg-white py-2 text-[12px] font-semibold text-[var(--theme-text-soft)] transition hover:bg-[var(--theme-bg-muted)]"
              >
                ຍົກເລີກ
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 rounded-md bg-rose-600 py-2 text-[12px] font-semibold text-white transition hover:bg-rose-700"
              >
                ຢືນຢັນລຶບ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BOQTable;
