"use client";


import AuthGuard from "@/_components/AuthGuard";
import { getWarehouses } from "@/_actions/lookups";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  Edit3,
  FolderOpen,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Trash2,
  User,
  X,
} from "lucide-react";
import { usePageHeader } from "@/_components/PageHeader";

function _getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type RequestItem = {
  item_code?: string;
  item_name?: string;
  unit_code?: string;
  qty?: number | string;
  remark?: string;
};

type RequestRow = {
  id: number | string;
  doc_no: string;
  doc_ref: string;
  creator_code: string;
  requester_name: string;
  doc_date: string;
  doc_date_value: number;
  remark: string;
  doc_success: number;
  withdraw_count: number;
  withdraw_docs: string[];
  withdraw_names: string[];
  withdraw_dates: string[];
  withdraw_wh_labels: string[];
  withdraw_location_labels: string[];
  project_id: string;
  project_name: string;
  list: RequestItem[];
  total_items: number;
  searchText: string;
  statusValue: string;
};

const norm = (v: any, fb = "-") =>
  v === null || v === undefined || v === "" ? fb : String(v);

const STATUS_META: Record<
  string,
  { label: string; dot: string; text: string }
> = {
  "0": { label: "ລໍຖ້າດຳເນີນ", dot: "bg-amber-500", text: "text-amber-700" },
  "1": { label: "ດຳເນີນແລ້ວ", dot: "bg-emerald-500", text: "text-emerald-700" },
};

const fmtDate = (v?: string | null) => {
  if (!v) return "-";
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s.slice(0, 10);
  if (/^\d{2}-\d{2}-\d{4}/.test(s)) {
    const [d, m, y] = s.split("-");
    return `${d}/${m}/${y}`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "-";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const toInputDate = (v?: string) => {
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}/.test(v)) {
    const [d, m, y] = v.split("/");
    return `${y}-${m}-${d}`;
  }
  return "";
};

const fmtNum = (n: any) => Number(n || 0).toLocaleString("en-US");

function ListRequest() {
  const router = useRouter();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "0" | "1">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [deleteDocNo, setDeleteDocNo] = useState<string | null>(null);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editDoc, setEditDoc] = useState<any>(null);
  const [editItems, setEditItems] = useState<RequestItem[]>([]);
  const [editDocDate, setEditDocDate] = useState("");
  const [editRemark, setEditRemark] = useState("");
  const [editWarehouse, setEditWarehouse] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [boqItems, setBoqItems] = useState<any[]>([]);
  const [boqLoading, setBoqLoading] = useState(false);
  const [boqSearch, setBoqSearch] = useState("");

  const loadList = useCallback(
    async (statusValue: string = statusFilter) => {
      const normalizedStatus =
        !statusValue || statusValue === "all" ? "all" : String(statusValue);
      setLoading(true);
      try {
        const params =
          normalizedStatus !== "all" ? { status: normalizedStatus } : undefined;
        const resp = await fetch(
          `/api/requests${params ? `?${new URLSearchParams(params)}` : ""}`,
          { headers: _getAuthHeaders() },
        ).then((r) => r.json());
        const data = Array.isArray(resp) ? resp : [];
        const mapped: RequestRow[] = data.map((r: any, i: number) => {
          const list = Array.isArray(r.list) ? r.list : [];
          const doc_no = norm(r.doc_no);
          const doc_ref = norm(r.doc_ref);
          const creator_code = norm(r.creator_code);
          const requester_name = norm(r.requester_name, "");
          const doc_date = norm(r.doc_date, "");
          const remark = norm(r.remark, "");
          const project_id = r.project_id ?? "";
          const project_name = norm(r.project_name, "ບໍ່ລະບຸໂຄງການ");
          const doc_success =
            typeof r.doc_success === "number"
              ? r.doc_success
              : r.doc_success
                ? 1
                : 0;
          const withdraw_docs = Array.isArray(r.withdraw_docs)
            ? r.withdraw_docs.filter(Boolean)
            : [];
          const withdraw_names = Array.isArray(r.withdraw_names)
            ? r.withdraw_names.filter(Boolean)
            : [];
          const withdraw_dates = Array.isArray(r.withdraw_dates)
            ? r.withdraw_dates.filter(Boolean)
            : [];
          const withdraw_wh_labels = Array.isArray(r.withdraw_wh_labels)
            ? r.withdraw_wh_labels.filter(Boolean)
            : [];
          const withdraw_location_labels = Array.isArray(
            r.withdraw_location_labels,
          )
            ? r.withdraw_location_labels.filter(Boolean)
            : [];
          const docDateValue = doc_date
            ? Date.parse(doc_date) || 0
            : 0;
          return {
            id: r.id ?? i + 1,
            doc_no,
            doc_ref,
            creator_code,
            requester_name,
            doc_date,
            doc_date_value: docDateValue,
            remark,
            doc_success,
            withdraw_count: Number(r.withdraw_count ?? 0),
            withdraw_docs,
            withdraw_names,
            withdraw_dates,
            withdraw_wh_labels,
            withdraw_location_labels,
            project_id,
            project_name,
            list,
            total_items: list.length,
            searchText: [
              doc_no,
              doc_ref,
              creator_code,
              requester_name,
              project_name,
              remark,
              withdraw_names.join(" "),
            ]
              .join(" ")
              .toLowerCase(),
            statusValue: String(doc_success),
          };
        });
        setRows(mapped);
        setExpanded(new Set());
      } catch (e) {
        console.error(e);
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [statusFilter],
  );

  useEffect(() => {
    void loadList(statusFilter);
  }, [statusFilter, loadList]);

  // Warehouses
  useEffect(() => {
    (async () => {
      try {
        const res = await getWarehouses();
        setWarehouses(res?.success && Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // Locations (load when warehouse changes)
  useEffect(() => {
    (async () => {
      if (!editWarehouse) {
        setLocations([]);
        setEditLocation("");
        return;
      }
      try {
        const res = await fetch(
          `/api/locations?warehouse=${encodeURIComponent(editWarehouse)}`,
          { headers: _getAuthHeaders() },
        ).then((r) => r.json());
        setLocations(Array.isArray(res?.data) ? res.data : []);
      } catch (e) {
        console.error(e);
        setLocations([]);
      }
    })();
  }, [editWarehouse]);

  const filtered = useMemo(() => {
    const s = (searchTerm || "").trim().toLowerCase();
    return rows
      .filter((r) => {
        const matchSearch = !s || r.searchText.includes(s);
        const matchStatus =
          statusFilter === "all" || r.statusValue === statusFilter;
        return matchSearch && matchStatus;
      })
      .sort((a, b) => b.doc_date_value - a.doc_date_value);
  }, [rows, searchTerm, statusFilter]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      pending: rows.filter((x) => x.doc_success === 0).length,
      done: rows.filter((x) => x.doc_success === 1).length,
    }),
    [rows],
  );

  usePageHeader({
    title: "ໃບຂໍເບີກ",
    subtitle: `${filtered.length.toLocaleString()} ລາຍການ`,
    secondaryActions: [
      {
        label: "ໂຫຼດໃໝ່",
        icon: <RefreshCw size={13} className={loading ? "animate-spin" : ""} />,
        onClick: () => void loadList(statusFilter),
        disabled: loading,
      },
    ],
    search: {
      value: searchTerm,
      onChange: setSearchTerm,
      placeholder: "ຄົ້ນຫາເລກທີ, ໂຄງການ, ຜູ້ສ້າງ...",
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
        label: "ລໍຖ້າດຳເນີນ",
        count: counts.pending,
        active: statusFilter === "0",
        onClick: () => setStatusFilter("0"),
      },
      {
        id: "1",
        label: "ດຳເນີນແລ້ວ",
        count: counts.done,
        active: statusFilter === "1",
        onClick: () => setStatusFilter("1"),
      },
    ],
  });

  const toggleExpand = (docNo: string) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(docNo)) n.delete(docNo);
      else n.add(docNo);
      return n;
    });

  // ===== Delete =====
  const confirmDelete = async () => {
    if (!deleteDocNo) return;
    try {
      const res = await fetch(
        `/api/requests/${encodeURIComponent(deleteDocNo)}`,
        { method: "DELETE", headers: _getAuthHeaders() },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const code = j?.code || j?.message;
        if (code === "ALREADY_WITHDRAWN" || code === "NOT_EDITABLE") {
          alert("ໃບຂໍເບີກນີ້ຖືກເບີກແລ້ວ ບໍ່ສາມາດລຶບໄດ້");
        } else {
          alert("ລຶບບໍ່ສຳເລັດ");
        }
        return;
      }
      setDeleteDocNo(null);
      await loadList(statusFilter);
    } catch (e) {
      console.error(e);
      alert("ລຶບບໍ່ສຳເລັດ");
    }
  };

  // ===== Edit modal =====
  const openEdit = async (docNo: string) => {
    setEditOpen(true);
    setEditLoading(true);
    try {
      const data = await fetch(
        `/api/requestsparepart/${encodeURIComponent(docNo)}`,
        { headers: _getAuthHeaders() },
      ).then((r) => r.json());
      if (!data) throw new Error("NO_DATA");
      setEditDoc(data);
      setEditDocDate(toInputDate(data.doc_date));
      setEditRemark(data.remark || "");
      setEditWarehouse(data.wh_from || "");
      setEditLocation(data.location_from || "");
      const items = Array.isArray(data.items) ? data.items : [];
      setEditItems(
        items.map((it: any) => ({
          item_code: it.item_code,
          item_name: it.item_name,
          unit_code: it.unit_code,
          qty: Number(it.qty || 0),
          remark: it.remark || "",
        })),
      );
      setBoqSearch("");
      const docRef = data.doc_ref;
      if (docRef && docRef !== "-") {
        setBoqLoading(true);
        try {
          const boqRes = await fetch(
            `/api/boq/${encodeURIComponent(docRef)}`,
            { headers: _getAuthHeaders() },
          ).then((r) => r.json());
          const boqData = boqRes?.data?.data || boqRes?.data || boqRes;
          const list = Array.isArray(boqData?.boq_list) ? boqData.boq_list : [];
          setBoqItems(
            list.map((it: any) => ({
              item_code: it.item_code,
              item_name: it.item_name,
              unit_code: it.unit_code,
              boq_qty: Number(it.boq_qty ?? it.qty ?? 0),
            })),
          );
        } catch (e) {
          console.error(e);
          setBoqItems([]);
        } finally {
          setBoqLoading(false);
        }
      } else {
        setBoqItems([]);
      }
    } catch (e) {
      console.error(e);
      alert("ດຶງຂໍ້ມູນບໍ່ສຳເລັດ");
      setEditOpen(false);
    } finally {
      setEditLoading(false);
    }
  };

  const closeEdit = () => {
    if (editSaving) return;
    setEditOpen(false);
    setEditDoc(null);
    setEditItems([]);
    setEditDocDate("");
    setEditRemark("");
    setEditWarehouse("");
    setEditLocation("");
    setBoqItems([]);
    setBoqSearch("");
  };

  const changeEditQty = (idx: number, val: string) => {
    setEditItems((prev) => {
      const next = [...prev];
      let q = Number(val || 0);
      if (q < 0) q = 0;
      next[idx] = { ...next[idx], qty: q };
      return next;
    });
  };

  const removeEditItem = (idx: number) =>
    setEditItems((prev) => prev.filter((_, i) => i !== idx));

  const addEditItem = (item: any) =>
    setEditItems((prev) => {
      if (prev.some((p) => p.item_code === item.item_code)) return prev;
      return [
        ...prev,
        {
          item_code: item.item_code,
          item_name: item.item_name,
          unit_code: item.unit_code,
          qty: 1,
          remark: "",
        },
      ];
    });

  const filteredBoqItems = useMemo(() => {
    const s = (boqSearch || "").trim().toLowerCase();
    if (!s) return boqItems;
    return boqItems.filter(
      (it) =>
        (it.item_code || "").toLowerCase().includes(s) ||
        (it.item_name || "").toLowerCase().includes(s),
    );
  }, [boqItems, boqSearch]);

  const saveEdit = async () => {
    if (!editDoc?.doc_no) return;
    const items = editItems.filter((it) => Number(it.qty) > 0);
    if (!editDocDate) return alert("ກະລຸນາເລືອກວັນທີ");
    if (!editWarehouse) return alert("ກະລຸນາເລືອກສາງ");
    if (!editLocation) return alert("ກະລຸນາເລືອກທີ່ເກັບ");
    if (items.length === 0) return alert("ກະລຸນາລະບຸຈຳນວນຢ່າງນ້ອຍ 1 ລາຍການ");
    try {
      setEditSaving(true);
      await fetch(
        `/api/requestsparepart/${encodeURIComponent(editDoc.doc_no)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ..._getAuthHeaders(),
          },
          body: JSON.stringify({
            doc_date: editDocDate,
            remark: editRemark,
            warehouse_code: editWarehouse,
            location_code: editLocation,
            items,
          }),
        },
      );
      closeEdit();
      await loadList(statusFilter);
    } catch (e: any) {
      const code = e?.message;
      if (code === "ALREADY_WITHDRAWN" || code === "NOT_EDITABLE") {
        alert("ໃບຂໍເບີກນີ້ຖືກເບີກແລ້ວ ບໍ່ສາມາດແກ້ໄຂໄດ້");
      } else {
        alert("ບັນທຶກບໍ່ສຳເລັດ");
      }
    } finally {
      setEditSaving(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
  };

  return (
    <div className="bg-[var(--theme-page)] px-3 py-3 md:px-4">
      <div className="mx-auto max-w-[1480px]">
        <section className="theme-card overflow-hidden">
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
                  ບໍ່ພົບໃບຂໍເບີກ
                </div>
                <div className="mt-1 text-xs">ລອງປັບຄຳຄົ້ນ ຫຼື ຕົວກັ່ນຕອງ</div>
              </div>
              {(searchTerm || statusFilter !== "all") && (
                <button
                  onClick={clearFilters}
                  className="text-xs font-medium text-[var(--theme-primary)] hover:underline"
                >
                  ລ້າງຕົວກັ່ນຕອງ
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-[var(--theme-border-subtle)]">
              {filtered.map((row) => {
                const isOpen = expanded.has(row.doc_no);
                const status = STATUS_META[row.statusValue] || STATUS_META["0"];
                const isWithdrawn = row.doc_success === 1;
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

                      <span className="w-[150px] flex-shrink-0 truncate font-mono text-[12px] font-semibold text-[var(--theme-primary)]">
                        {row.doc_no}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-[var(--theme-text)]">
                          {row.project_name}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0 text-[10px] text-[var(--theme-text-mute)]">
                          {row.doc_ref && row.doc_ref !== "-" && (
                            <span className="font-mono">
                              ອ້າງອີງ {row.doc_ref}
                            </span>
                          )}
                          {row.requester_name && (
                            <span>
                              <User className="inline h-3 w-3 mr-0.5" />
                              {row.requester_name}
                            </span>
                          )}
                          {row.creator_code !== "-" && (
                            <span>ໂດຍ {row.creator_code}</span>
                          )}
                        </div>
                      </div>

                      <span className="hidden w-[80px] flex-shrink-0 text-[11px] tabular-nums text-[var(--theme-text-mute)] md:inline">
                        {fmtDate(row.doc_date)}
                      </span>

                      <span className="hidden w-[60px] flex-shrink-0 text-right md:inline">
                        <span className="text-[11px] tabular-nums text-[var(--theme-text-soft)]">
                          {row.total_items}
                        </span>
                        <span className="ml-1 text-[10px] text-[var(--theme-text-mute)]">
                          ລາຍ
                        </span>
                      </span>

                      <span
                        className={`hidden w-[100px] flex-shrink-0 text-[11px] font-medium md:inline ${status.text}`}
                      >
                        {status.label}
                      </span>

                      <div
                        className="flex flex-shrink-0 items-center gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {!isWithdrawn && (
                          <button
                            onClick={() => void openEdit(row.doc_no)}
                            title="ແກ້ໄຂ"
                            className="flex h-7 w-7 items-center justify-center rounded text-[var(--theme-text-mute)] transition hover:bg-white hover:text-[var(--theme-primary)]"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {!isWithdrawn && (
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

                    {/* Expanded — items + withdraw history */}
                    {isOpen && (
                      <div className="border-t border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)]/40">
                        {/* Items table */}
                        {row.list.length === 0 ? (
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
                                  <th className="px-4 py-2 text-left">ໜ່ວຍ</th>
                                  <th className="px-4 py-2 text-right">ຈຳນວນ</th>
                                  <th className="px-4 py-2 text-left">ໝາຍເຫດ</th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.list.map((it: any, idx: number) => (
                                  <tr
                                    key={`${it.item_code || idx}-${idx}`}
                                    className="border-b border-[var(--theme-border-subtle)] last:border-b-0 hover:bg-white"
                                  >
                                    <td className="whitespace-nowrap px-4 py-1.5 font-mono text-[10px] text-[var(--theme-text-mute)]">
                                      {String(idx + 1).padStart(2, "0")}
                                    </td>
                                    <td className="px-4 py-1.5">
                                      <span className="text-[var(--theme-text)]">
                                        {it.item_name || it.item_code || "-"}
                                      </span>
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-1.5 text-[var(--theme-text-mute)]">
                                      {it.unit_code || "-"}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-1.5 text-right font-mono tabular-nums">
                                      {fmtNum(it.qty)}
                                    </td>
                                    <td className="px-4 py-1.5 text-[10px] text-[var(--theme-text-mute)]">
                                      {it.remark || ""}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Withdraw history */}
                        {row.withdraw_docs.length > 0 && (
                          <div className="border-t border-[var(--theme-border-subtle)] px-4 py-3">
                            <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text-mute)]">
                              ປະຫວັດການເບີກ ({row.withdraw_docs.length})
                            </h4>
                            <ul className="space-y-1">
                              {row.withdraw_docs.map((d: string, i: number) => (
                                <li
                                  key={`${d}-${i}`}
                                  className="flex flex-wrap items-center gap-x-3 gap-y-0 text-[11px]"
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  <span className="font-mono font-semibold text-[var(--theme-text)]">
                                    {d}
                                  </span>
                                  {row.withdraw_dates[i] && (
                                    <span className="inline-flex items-center gap-1 text-[var(--theme-text-mute)]">
                                      <Calendar className="h-3 w-3" />
                                      {fmtDate(row.withdraw_dates[i])}
                                    </span>
                                  )}
                                  {row.withdraw_names[i] && (
                                    <span className="inline-flex items-center gap-1 text-[var(--theme-text-soft)]">
                                      <User className="h-3 w-3" />
                                      {row.withdraw_names[i]}
                                    </span>
                                  )}
                                  {row.withdraw_wh_labels[i] && (
                                    <span className="inline-flex items-center gap-1 text-[var(--theme-text-mute)]">
                                      <MapPin className="h-3 w-3" />
                                      {row.withdraw_wh_labels[i]}
                                      {row.withdraw_location_labels[i]
                                        ? ` / ${row.withdraw_location_labels[i]}`
                                        : ""}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {row.remark && (
                          <div className="border-t border-[var(--theme-border-subtle)] px-4 py-2 text-[11px] text-[var(--theme-text-soft)]">
                            ໝາຍເຫດ: {row.remark}
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

      {/* Delete modal */}
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
                ລຶບໃບຂໍເບີກ?
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

      {/* Edit modal */}
      {editOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-8"
          onClick={closeEdit}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-lg border border-[var(--theme-border-subtle)] bg-white shadow-[var(--theme-shadow-lg)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--theme-border-subtle)] px-4 py-2.5">
              <div className="min-w-0">
                <h3 className="truncate text-[14px] font-semibold text-[var(--theme-text)]">
                  ແກ້ໄຂໃບຂໍເບີກ
                </h3>
                {editDoc?.doc_no && (
                  <p className="font-mono text-[10px] text-[var(--theme-primary)]">
                    {editDoc.doc_no}
                  </p>
                )}
              </div>
              <button
                onClick={closeEdit}
                className="flex h-7 w-7 items-center justify-center rounded text-[var(--theme-text-mute)] hover:bg-[var(--theme-bg-muted)] hover:text-[var(--theme-text)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {editLoading ? (
              <div className="flex h-40 items-center justify-center text-[var(--theme-text-mute)]">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--theme-border-subtle)] border-t-[var(--theme-primary)]" />
              </div>
            ) : (
              <div className="grid gap-3 px-4 py-3 text-[12px] md:grid-cols-2">
                {/* Date */}
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text-mute)]">
                    ວັນທີ
                  </span>
                  <input
                    type="date"
                    value={editDocDate}
                    onChange={(e) => setEditDocDate(e.target.value)}
                    className="block w-full rounded-md border border-[var(--theme-border-subtle)] bg-white px-2 py-1.5 outline-none focus:border-[var(--theme-primary-soft)]"
                  />
                </label>

                {/* Remark */}
                <label className="space-y-1 md:col-span-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text-mute)]">
                    ໝາຍເຫດ
                  </span>
                  <input
                    type="text"
                    value={editRemark}
                    onChange={(e) => setEditRemark(e.target.value)}
                    placeholder="ໝາຍເຫດ..."
                    className="block w-full rounded-md border border-[var(--theme-border-subtle)] bg-white px-2 py-1.5 outline-none focus:border-[var(--theme-primary-soft)]"
                  />
                </label>

                {/* Warehouse */}
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text-mute)]">
                    ສາງ
                  </span>
                  <select
                    value={editWarehouse}
                    onChange={(e) => setEditWarehouse(e.target.value)}
                    className="block w-full rounded-md border border-[var(--theme-border-subtle)] bg-white px-2 py-1.5 outline-none focus:border-[var(--theme-primary-soft)]"
                  >
                    <option value="">— ເລືອກສາງ —</option>
                    {warehouses.map((w: any) => {
                      const code = w.warehouse_code || w.code || "";
                      const name = w.warehouse_name || w.name || "";
                      return (
                        <option key={code} value={code}>
                          {code}{name ? ` — ${name}` : ""}
                        </option>
                      );
                    })}
                  </select>
                </label>

                {/* Location */}
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text-mute)]">
                    ທີ່ເກັບ
                  </span>
                  <select
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    disabled={!editWarehouse}
                    className="block w-full rounded-md border border-[var(--theme-border-subtle)] bg-white px-2 py-1.5 outline-none focus:border-[var(--theme-primary-soft)] disabled:bg-[var(--theme-bg-muted)] disabled:text-[var(--theme-text-mute)]"
                  >
                    <option value="">— ເລືອກທີ່ເກັບ —</option>
                    {locations.map((l: any) => {
                      const code = l.location_code || l.code || "";
                      const name = l.location_name || l.name || "";
                      return (
                        <option key={code} value={code}>
                          {code}{name ? ` — ${name}` : ""}
                        </option>
                      );
                    })}
                  </select>
                </label>
              </div>
            )}

            {/* Items table */}
            {!editLoading && (
              <div className="border-t border-[var(--theme-border-subtle)]">
                <div className="flex items-center justify-between px-4 py-2">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text-mute)]">
                    ລາຍການທີ່ຂໍເບີກ ({editItems.length})
                  </h4>
                </div>
                {editItems.length === 0 ? (
                  <div className="flex items-center gap-2 px-4 pb-3 text-[11px] text-[var(--theme-text-mute)]">
                    <span className="h-1.5 w-1.5 rounded-full border border-[var(--theme-border)] bg-white" />
                    ຍັງບໍ່ມີລາຍການ
                  </div>
                ) : (
                  <ul className="divide-y divide-[var(--theme-border-subtle)] border-y border-[var(--theme-border-subtle)]">
                    {editItems.map((it, idx) => (
                      <li
                        key={`${it.item_code}-${idx}`}
                        className="flex items-center gap-2 px-4 py-1.5 text-[12px]"
                      >
                        <span className="font-mono text-[10px] text-[var(--theme-text-mute)]">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[var(--theme-text)]">
                          {it.item_name || it.item_code}
                        </span>
                        <span className="text-[10px] text-[var(--theme-text-mute)]">
                          {it.unit_code}
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={Number(it.qty)}
                          onChange={(e) => changeEditQty(idx, e.target.value)}
                          className="w-20 rounded-md border border-[var(--theme-border-subtle)] bg-white px-2 py-1 text-right font-mono text-[11px] outline-none focus:border-[var(--theme-primary-soft)]"
                        />
                        <button
                          onClick={() => removeEditItem(idx)}
                          className="flex h-7 w-7 items-center justify-center rounded text-rose-600 transition hover:bg-rose-50"
                          title="ລຶບ"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* BOQ picker */}
            {!editLoading && boqItems.length > 0 && (
              <div className="border-t border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)]/30">
                <div className="flex items-center gap-2 px-4 py-2">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text-mute)]">
                    ເພີ່ມຈາກ BOQ
                  </h4>
                  <div className="ml-auto flex h-7 min-w-[180px] items-center gap-2 rounded-md border border-[var(--theme-border-subtle)] bg-white px-2">
                    <Package className="h-3 w-3 text-[var(--theme-text-mute)]" />
                    <input
                      value={boqSearch}
                      onChange={(e) => setBoqSearch(e.target.value)}
                      placeholder="ຄົ້ນຫາ..."
                      className="min-w-0 flex-1 bg-transparent text-[11px] outline-none"
                    />
                  </div>
                </div>
                {boqLoading ? (
                  <div className="flex items-center justify-center py-3 text-[var(--theme-text-mute)]">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--theme-border-subtle)] border-t-[var(--theme-primary)]" />
                  </div>
                ) : (
                  <ul className="max-h-44 overflow-y-auto border-t border-[var(--theme-border-subtle)]">
                    {filteredBoqItems.slice(0, 40).map((it: any) => {
                      const added = editItems.some(
                        (p) => p.item_code === it.item_code,
                      );
                      return (
                        <li
                          key={it.item_code}
                          className="flex items-center gap-2 border-b border-[var(--theme-border-subtle)] px-4 py-1.5 text-[12px] last:border-b-0 hover:bg-white"
                        >
                          <span className="min-w-0 flex-1 truncate text-[var(--theme-text)]">
                            {it.item_name || it.item_code}
                          </span>
                          <span className="text-[10px] text-[var(--theme-text-mute)]">
                            {it.unit_code}
                          </span>
                          <span className="font-mono text-[10px] tabular-nums text-[var(--theme-text-soft)]">
                            {fmtNum(it.boq_qty)}
                          </span>
                          <button
                            onClick={() => addEditItem(it)}
                            disabled={added}
                            className={`inline-flex h-6 items-center gap-1 rounded px-2 text-[10px] font-semibold transition ${
                              added
                                ? "cursor-not-allowed text-[var(--theme-text-mute)]"
                                : "text-[var(--theme-accent)] hover:bg-[var(--theme-accent-tint)]"
                            }`}
                          >
                            <Plus className="h-3 w-3" />
                            {added ? "ເພີ່ມແລ້ວ" : "ເພີ່ມ"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex gap-2 border-t border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] p-3">
              <button
                onClick={closeEdit}
                disabled={editSaving}
                className="flex-1 rounded-md border border-[var(--theme-border-subtle)] bg-white py-2 text-[12px] font-semibold text-[var(--theme-text-soft)] transition hover:bg-[var(--theme-bg-muted)] disabled:opacity-50"
              >
                ຍົກເລີກ
              </button>
              <button
                onClick={saveEdit}
                disabled={editSaving || editLoading}
                className="flex-1 rounded-md bg-[var(--theme-primary)] py-2 text-[12px] font-semibold text-white transition hover:bg-[var(--theme-primary-strong)] disabled:opacity-50"
              >
                {editSaving ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <AuthGuard roles={["service_admin", "service_manager", "sale_manager", "sale_admin", "head_technician"]}>
      <ListRequest />
    </AuthGuard>
  );
}
