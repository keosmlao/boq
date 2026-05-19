"use client";

import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  MapPin,
  Phone,
  X,
  RefreshCw,
  Building2,
  FolderOpen,
  ClipboardList,
  PackageCheck,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { usePageHeader } from "@/_components/PageHeader";
import ViewSwitcher, {
  type ViewMode,
} from "@/_components/odoo/ViewSwitcher";
import KanbanBoard, {
  type KanbanColumn,
} from "@/_components/odoo/KanbanBoard";

/* ─── Types ─── */

type StatusId = (typeof STATUSES)[number]["id"];

type ContractItem = {
  id?: number | string;
  cust_code?: string;
  quotation_id?: number | string | null;
  contract_name?: string;
  name?: string;
  contract_code?: string;
  contract_no?: string;
  start_date?: string;
  end_date?: string;
  approve_status_1?: number | string | null;
  approve_status_2?: number | string | null;
  acc_approve?: number | string | null;
  has_boq?: boolean | number | null;
  boq_status?: string | null;
  boq_count?: number | string | null;
  boq_list?: Array<{
    doc_no?: string;
    doc_date?: string;
    approve_status?: number | string | null;
  }>;
  request_count?: number | string | null;
};

type StatusDurationItem = {
  status?: string;
  minutes?: number;
  label?: string;
  entries?: number;
  is_current?: boolean;
  current_started_at?: string | null;
  last_ended_at?: string | null;
};

type ProjectItem = {
  id: number | string;
  project_name?: string;
  customer_name?: string;
  coordinator?: string;
  phone?: string;
  project_code?: string;
  project_status?: string;
  village_name?: string;
  district_name?: string;
  province_name?: string;
  image_gallery?: string[];
  image_url?: string;
  date_register?: string;
  created_at?: string;
  close_date?: string;
  bussiness_type?: string;
  project_type?: string;
  contractlist?: ContractItem[];
  contract_count?: number | string | null;
  approved_contract_count?: number | string | null;
  pending_contract_count?: number | string | null;
  acc_approved_contract_count?: number | string | null;
  boq_contract_count?: number | string | null;
  boq_count?: number | string | null;
  project_elapsed_label?: string;
  current_status_elapsed_label?: string;
  current_status_since?: string | null;
  status_durations?: StatusDurationItem[];
  // hierarchy aggregates used by resolveStatus (optional — API may or may not
  // provide each one; resolveStatus falls back gracefully when missing)
  quotation_count?: number | string | null;
  approved_quotation_count?: number | string | null;
  request_count?: number | string | null;
  __q?: string;
  [key: string]: unknown;
};

/* ─── Constants ─── */

// Simplified workflow — 7 stages. Most stages are DERIVED from the data
// hierarchy (Project → Quotation → Contract → BOQ → MaterialRequest). Manual
// stages are #1, #2 and #7 only.
const STATUSES = [
  { id: "ລົງທະບຽນໂຄງການ",     short: "ລົງທະບຽນ",       color: "teal"    }, // manual
  { id: "ສຳຫຼວດ ແລະ ອອກແບບ",   short: "ສຳຫຼວດ",        color: "sky"     }, // manual
  { id: "ສະເໜີລາຄາ",          short: "ສະເໜີລາຄາ",     color: "amber"   }, // derived: has quotation
  { id: "ເຊັນສັນຍາ",          short: "ເຊັນສັນຍາ",     color: "rose"    }, // derived: approved quotation, contract may or may not exist yet
  { id: "ດຳເນີນສັນຍາ",        short: "ດຳເນີນສັນຍາ",   color: "emerald" }, // derived: contract has BOQ
  { id: "ກຳລັງເບີກວັດສະດຸ",   short: "ກຳລັງເບີກ",      color: "cyan"    }, // derived: has material requests
  { id: "ສຳເລັດ",            short: "ສຳເລັດ",        color: "stone"   }, // manual close
] as const;

// Old statuses (incl. stages removed in this redesign) map to the closest
// stage in the new 7-stage workflow so existing rows stay queryable.
const MIGRATION: Record<string, StatusId> = {
  ລໍຖ້າດຳເນີນ: "ລົງທະບຽນໂຄງການ",
  ຂັ້ນຕອນອອກແບບ: "ສຳຫຼວດ ແລະ ອອກແບບ",
  ຂັ້ນຕອນສະເໜີຂາຍ: "ສະເໜີລາຄາ",
  ຂັ້ນຕອນການເຮັດສັນຍາ: "ເຊັນສັນຍາ",
  // removed sub-stages → all collapse to ດຳເນີນສັນຍາ
  ອະນຸມັດສັນຍາ: "ເຊັນສັນຍາ",
  ລໍຖ້າບັນຊີກວດສອບ: "ເຊັນສັນຍາ",
  "ລໍຖ້າກຳນົດ BOQ": "ເຊັນສັນຍາ",
  ດຳເນີນການຕິດຕັ້ງ: "ດຳເນີນສັນຍາ",
  ຂັ້ນຕອນດຳເນີນໂຄງການ: "ດຳເນີນສັນຍາ",
  ສາມາດເບີກຂອງໃດ້: "ກຳລັງເບີກວັດສະດຸ",
  ຢູດຊົ່ວຄາວ: "ດຳເນີນສັນຍາ",
  ລໍຖ້າອະນຸມັດປິດໂຄງການ: "ສຳເລັດ",
  ປິດໂຄງການ: "ສຳເລັດ",
};

const COLOR = {
  teal: {
    dot: "bg-teal-500",
    chip: "border-teal-200 bg-teal-50 text-teal-700",
    soft: "bg-teal-100 text-teal-700",
  },
  sky: {
    dot: "bg-sky-500",
    chip: "border-sky-200 bg-sky-50 text-sky-700",
    soft: "bg-sky-100 text-sky-700",
  },
  amber: {
    dot: "bg-amber-500",
    chip: "border-amber-200 bg-amber-50 text-amber-700",
    soft: "bg-amber-100 text-amber-700",
  },
  rose: {
    dot: "bg-rose-500",
    chip: "border-rose-200 bg-rose-50 text-rose-700",
    soft: "bg-rose-100 text-rose-700",
  },
  violet: {
    dot: "bg-violet-500",
    chip: "border-violet-200 bg-violet-50 text-violet-700",
    soft: "bg-violet-100 text-violet-700",
  },
  indigo: {
    dot: "bg-indigo-500",
    chip: "border-indigo-200 bg-indigo-50 text-indigo-700",
    soft: "bg-indigo-100 text-indigo-700",
  },
  cyan: {
    dot: "bg-cyan-500",
    chip: "border-cyan-200 bg-cyan-50 text-cyan-700",
    soft: "bg-cyan-100 text-cyan-700",
  },
  emerald: {
    dot: "bg-emerald-500",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-700",
    soft: "bg-emerald-100 text-emerald-700",
  },
  orange: {
    dot: "bg-orange-500",
    chip: "border-orange-200 bg-orange-50 text-orange-700",
    soft: "bg-orange-100 text-orange-700",
  },
  stone: {
    dot: "bg-stone-500",
    chip: "border-[var(--theme-border-subtle)] bg-stone-100 text-stone-700",
    soft: "bg-stone-200 text-stone-700",
  },
} as const;

/* ─── Helpers ─── */

const lower = (v: unknown) => String(v ?? "").toLowerCase();
const toNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const isAccApproved = (approve2: unknown, accApprove?: unknown) =>
  Math.max(toNum(approve2), toNum(accApprove)) === 1;
const normalizeStatus = (v?: string | null): StatusId => {
  if (!v) return STATUSES[0].id;
  if (STATUSES.some((s) => s.id === v)) return v as StatusId;
  return MIGRATION[v] || STATUSES[0].id;
};

/**
 * Derive a project's current stage from the data hierarchy
 *   Project → Quotation → Contract → BOQ → MaterialRequest
 *
 * Manual stages: "ລົງທະບຽນໂຄງການ", "ສຳຫຼວດ ແລະ ອອກແບບ", "ສຳເລັດ".
 * Everything else is derived from counts so the kanban auto-reflects work
 * happening at lower layers.
 *
 * Expected aggregate fields on `p` (populated by the project list API):
 *   quotation_count          number of quotations
 *   approved_quotation_count number of quotations with status approved
 *   contract_count           number of contracts
 *   boq_contract_count       contracts that have at least one BOQ
 *   request_count            material requests issued
 */
const resolveStatus = (p?: ProjectItem | null): StatusId => {
  const base = normalizeStatus(p?.project_status);
  if (!p || base === "ສຳເລັດ") return base;

  // Walk the hierarchy from bottom (most progressed) to top — the first
  // condition that matches wins.
  if (toNum(p.request_count) > 0) return "ກຳລັງເບີກວັດສະດຸ";
  if (toNum(p.boq_contract_count) > 0) return "ດຳເນີນສັນຍາ";
  if (toNum(p.contract_count) > 0) return "ເຊັນສັນຍາ";

  if (Array.isArray(p.contractlist) && p.contractlist.length > 0) {
    // Same as contract_count > 0 — covers the case where aggregates aren't
    // populated but the list IS attached.
    const hasBoq = p.contractlist.some(
      (c) => Boolean(c.has_boq) || c.boq_status === "done",
    );
    return hasBoq ? "ດຳເນີນສັນຍາ" : "ເຊັນສັນຍາ";
  }

  if (toNum(p.approved_quotation_count) > 0) return "ເຊັນສັນຍາ";
  if (toNum(p.quotation_count) > 0) return "ສະເໜີລາຄາ";

  return base; // ລົງທະບຽນໂຄງການ or ສຳຫຼວດ
};

// Legacy helper — still referenced by contract sub-status UI. Maps the per-
// contract approval state to the closest stage in the new workflow.
const resolveContractStatus = (c: ContractItem): StatusId => {
  const s1 = toNum(c.approve_status_1) === 1;
  const s2 = isAccApproved(c.approve_status_2, c.acc_approve);
  if (!s1 || !s2) return "ເຊັນສັນຍາ";
  if (c.has_boq || c.boq_status === "done") return "ດຳເນີນສັນຍາ";
  return "ເຊັນສັນຍາ";
};

const CONTRACT_SUB_STATUS = [
  {
    key: "wait_sale",
    label: "ລໍຖ້າຝ່າຍຂາຍອະນຸມັດ",
    dot: "bg-amber-500",
    text: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
  },
  {
    key: "wait_acc",
    label: "ລໍຖ້າບັນຊີ ອະນຸມັດ",
    dot: "bg-[var(--theme-primary)]",
    text: "text-[var(--theme-primary)]",
    bg: "bg-[var(--theme-primary-tint)] border-[rgba(113,75,103,0.22)]",
  },
  {
    key: "wait_boq",
    label: "ລໍຖ້າ ອອກ BOQ",
    dot: "bg-cyan-500",
    text: "text-cyan-700",
    bg: "bg-cyan-50 border-cyan-200",
  },
  {
    key: "active",
    label: "ກຳລັງດຳເນີນຕາມສັນຍາ",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-200",
  },
] as const;

const getContractSubStatus = (c: ContractItem) => {
  const s1 = toNum(c.approve_status_1) === 1;
  const s2 = isAccApproved(c.approve_status_2, c.acc_approve);
  if (!s1) return CONTRACT_SUB_STATUS[0]; // ລໍຖ້າຝ່າຍຂາຍ
  if (!s2) return CONTRACT_SUB_STATUS[1]; // ລໍຖ້າບັນຊີ
  if (c.has_boq || c.boq_status === "done") return CONTRACT_SUB_STATUS[3]; // ກຳລັງດຳເນີນ
  return CONTRACT_SUB_STATUS[2]; // ລໍຖ້າອອກ BOQ
};

const shouldUseIssuedContractStatus = (p?: ProjectItem | null) =>
  !!p &&
  resolveStatus(p) !== "ສຳເລັດ" &&
  (toNum(p.contract_count) > 0 ||
    (Array.isArray(p.contractlist) && p.contractlist.length > 0));

const getProjectSubStatus = (p?: ProjectItem | null) => {
  if (!p || !shouldUseIssuedContractStatus(p)) return null;

  if (Array.isArray(p.contractlist) && p.contractlist.length > 0) {
    const statuses = p.contractlist.map(getContractSubStatus);
    if (statuses.some((status) => status.key === "wait_sale"))
      return CONTRACT_SUB_STATUS[0];
    if (statuses.some((status) => status.key === "wait_acc"))
      return CONTRACT_SUB_STATUS[1];
    if (statuses.some((status) => status.key === "wait_boq"))
      return CONTRACT_SUB_STATUS[2];
    if (statuses.some((status) => status.key === "active"))
      return CONTRACT_SUB_STATUS[3];
  }

  const total = toNum(p.contract_count);
  const saleApproved = toNum(p.approved_contract_count);
  const accApproved = toNum(p.acc_approved_contract_count);
  const boqCount = toNum(p.boq_contract_count);

  if (saleApproved < total) return CONTRACT_SUB_STATUS[0];
  if (accApproved < total) return CONTRACT_SUB_STATUS[1];
  if (boqCount < accApproved) return CONTRACT_SUB_STATUS[2];
  return CONTRACT_SUB_STATUS[3];
};

const getDisplayStatusView = (p?: ProjectItem | null) => {
  const workflowStatus = resolveStatus(p);
  if (shouldUseIssuedContractStatus(p)) {
    return {
      id: "ອອກສັນຍາ",
      short: "ອອກສັນຍາ",
      chip: "border-[rgba(113,75,103,0.22)] bg-[var(--theme-primary-tint)] text-[var(--theme-primary)]",
      dot: "bg-[var(--theme-primary)]",
    };
  }

  const m = meta(workflowStatus);
  const c = color(workflowStatus);
  return {
    id: m.id,
    short: m.short,
    chip: c.chip,
    dot: c.dot,
  };
};

const meta = (v?: string | null) => {
  const n = normalizeStatus(v);
  return STATUSES.find((s) => s.id === n) || STATUSES[0];
};
const color = (v?: string | null) => COLOR[meta(v).color] || COLOR.teal;

const searchOf = (p: ProjectItem) =>
  [
    p.project_name,
    p.customer_name,
    p.coordinator,
    p.phone,
    p.project_code,
    p.project_status,
    p.village_name,
    p.district_name,
    p.province_name,
    p.project_type,
    p.bussiness_type,
  ]
    .map(lower)
    .join(" ");

const fmtDate = (v?: string | null) => {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? v
    : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};
const fmtDT = (v?: string | null) => {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? v
    : `${fmtDate(v)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const imgOf = (p?: ProjectItem | null) =>
  p?.image_gallery?.[0] || p?.image_url || "";
const url = (host: string, path?: string) => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${host.replace(/\/+$/, "")}/${encodeURI(path.replace(/^\/+/, ""))}`;
};
const loc = (p?: ProjectItem | null) =>
  [p?.village_name, p?.district_name, p?.province_name]
    .filter(Boolean)
    .join(", ") || "-";
const code = (p?: ProjectItem | null) =>
  p?.project_code || `PRJ-${p?.id || "-"}`;

const relationCounts = (p?: ProjectItem | null, quotationsOverride?: unknown[]) => {
  const quotationCount =
    quotationsOverride !== undefined
      ? quotationsOverride.length
      : toNum(p?.quotation_count);
  const approvedQuotationCount = Math.max(
    toNum(p?.approved_quotation_count),
    quotationCount === 1 ? quotationCount : 0,
  );
  const contractCount =
    Array.isArray(p?.contractlist) && p.contractlist.length > 0
      ? p.contractlist.length
      : toNum(p?.contract_count);
  const boqCount = Math.max(
    toNum(p?.boq_count),
    toNum(p?.boq_contract_count),
    Array.isArray(p?.contractlist)
      ? p.contractlist.filter((c) => Boolean(c.has_boq) || c.boq_status === "done").length
      : 0,
  );
  const requestCount = Math.max(
    toNum(p?.request_count),
    Array.isArray(p?.contractlist)
      ? p.contractlist.reduce((sum, c) => sum + toNum(c.request_count), 0)
      : 0,
  );

  return {
    projects: p ? 1 : 0,
    quotations: quotationCount,
    approvedQuotations: approvedQuotationCount,
    contracts: contractCount,
    boqs: boqCount,
    requests: requestCount,
  };
};

function Milestone({
  done,
  label,
  count,
  onAdd,
  hasNext = true,
  children,
}: {
  done: boolean;
  label: string;
  count: number;
  onAdd?: () => void;
  hasNext?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative">
      {hasNext && (
        <span
          className={`absolute left-[6px] top-5 bottom-0 w-px ${
            done
              ? "bg-[var(--theme-primary)]"
              : "bg-[var(--theme-border-subtle)]"
          }`}
        />
      )}
      {/* Milestone row */}
      <div className="flex items-center gap-2.5 py-1">
        <span
          className={`relative z-10 flex h-3 w-3 flex-shrink-0 items-center justify-center rounded-full ${
            done
              ? "bg-[var(--theme-primary)] text-white"
              : "border border-[var(--theme-border-strong)] bg-white"
          }`}
        >
          {done && (
            <svg viewBox="0 0 8 8" className="h-2 w-2">
              <path
                d="M1.5 4l1.7 1.7L6.5 2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          )}
        </span>
        <span className="text-[12px] font-semibold text-[var(--theme-text)]">
          {label}
        </span>
        <span className="text-[10px] font-medium text-[var(--theme-text-mute)]">
          {count > 0 ? `(${count})` : "ຍັງບໍ່ມີ"}
        </span>
        {onAdd && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            className="ml-auto inline-flex h-6 items-center gap-1 rounded px-2 text-[10px] font-semibold text-[var(--theme-accent)] transition hover:bg-[var(--theme-accent-tint)]"
          >
            <Plus className="h-3 w-3" />
            ສ້າງ
          </button>
        )}
      </div>
      {/* Items below the milestone */}
      {children && (
        <div className="ml-[6px] border-l border-[var(--theme-border-subtle)] pl-4 py-1">
          {children}
        </div>
      )}
    </div>
  );
}

function DocumentTree({
  project,
  quotations,
  onCreateQuotation,
  onCreateContract,
  onCreateBoq,
  onOpenBoqDoc,
  onDeleteContract,
  onOpenQuotation,
  userRole,
  onApproveContract,
}: {
  project: ProjectItem;
  quotations: any[];
  onCreateQuotation?: (project: ProjectItem) => void;
  onCreateContract?: (project: ProjectItem, quotation?: any) => void;
  onCreateBoq?: (project: ProjectItem, contract: ContractItem) => void;
  onOpenBoqDoc?: (docNo: string) => void;
  onDeleteContract?: (project: ProjectItem, contract: ContractItem) => void;
  onOpenQuotation?: (quotation: any) => void;
  userRole?: string;
  onApproveContract?: (project: ProjectItem, contract: ContractItem, type: "approve" | "check") => void;
}) {
  const counts = relationCounts(project, quotations);
  const contracts = Array.isArray(project.contractlist)
    ? project.contractlist
    : [];
  // Flatten BOQ docs across all contracts so the BOQ section is one flat list
  // (each row = one BOQ doc) rather than nested per contract.
  const allBoqs = contracts.flatMap((c) =>
    Array.isArray(c.boq_list)
      ? c.boq_list.map((b) => ({ ...b, contract: c }))
      : [],
  );

  // Approved-quotation contract pairing: contract may be linked to a specific
  // quotation. For each contract that has a `quotation_id`, mark it as "owned"
  // by that quotation so we can group it visually in the timeline.
  const contractsByQuotation = new Map<string, ContractItem[]>();
  const orphanContracts: ContractItem[] = [];
  for (const c of contracts) {
    const qid = c.quotation_id ? String(c.quotation_id) : "";
    if (qid) {
      const list = contractsByQuotation.get(qid) || [];
      list.push(c);
      contractsByQuotation.set(qid, list);
    } else {
      orphanContracts.push(c);
    }
  }

  const renderContractRow = (c: ContractItem) => {
    const saleApproved = toNum(c.approve_status_1) === 1;
    const accApproved = isAccApproved(c.approve_status_2, c.acc_approve);
    const canApprove = userRole === "sale_manager" && !saleApproved;
    const canCheck =
      userRole === "account_admin" && saleApproved && !accApproved;
    const dotColor = !saleApproved
      ? "bg-amber-500"
      : !accApproved
        ? "bg-[var(--theme-primary)]"
        : "bg-emerald-500";
    const statusLabel = !saleApproved
      ? "ລໍຖ້າຂາຍ"
      : !accApproved
        ? "ລໍຖ້າບັນຊີ"
        : "ອະນຸມັດຄົບ";
    return (
      <div
        key={c.id || c.contract_no}
        className="flex items-center gap-2 py-1 text-[12px]"
      >
        <span
          className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${dotColor}`}
        />
        <span className="font-mono text-[11px] font-semibold text-[var(--theme-text)]">
          {c.contract_no || c.contract_code || "ສັນຍາ"}
        </span>
        {c.contract_name && (
          <span className="truncate text-[10px] text-[var(--theme-text-mute)]">
            · {c.contract_name}
          </span>
        )}
        <span className="ml-auto inline-flex items-center text-[10px] font-medium text-[var(--theme-text-soft)]">
          {statusLabel}
        </span>
        {canApprove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onApproveContract?.(project, c, "approve");
            }}
            className="rounded px-2 py-0.5 text-[10px] font-semibold text-amber-700 transition hover:bg-amber-50"
          >
            ອະນຸມັດ
          </button>
        )}
        {canCheck && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onApproveContract?.(project, c, "check");
            }}
            className="rounded px-2 py-0.5 text-[10px] font-semibold text-[var(--theme-primary)] transition hover:bg-[var(--theme-primary-tint)]"
          >
            ກວດສອບ
          </button>
        )}
        {onCreateBoq && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCreateBoq(project, c);
            }}
            className="rounded px-2 py-0.5 text-[10px] font-semibold text-cyan-700 transition hover:bg-cyan-50"
          >
            + BOQ
          </button>
        )}
        {onDeleteContract && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteContract(project, c);
            }}
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 transition hover:bg-rose-50"
          >
            ລົບ
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="overflow-hidden rounded-md border border-[var(--theme-border-subtle)] bg-white">
      {/* Slim project header */}
      <div className="flex items-center gap-2 bg-[var(--theme-bg-muted)] px-3 py-1.5">
        <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-[var(--theme-primary)]" />
        <div className="min-w-0 flex-1 truncate text-[11px]">
          <span className="font-semibold text-[var(--theme-text)]">
            {project.project_name || code(project)}
          </span>
          <span className="ml-2 text-[var(--theme-text-mute)]">
            {counts.quotations} ສະເໜີ · {counts.contracts} ສັນຍາ ·{" "}
            {counts.boqs} BOQ · {counts.requests} ໃບເບີກ
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="px-3 py-2">
        {/* ── ໃບສະເໜີລາຄາ ── */}
        <Milestone
          done={quotations.length > 0}
          label="ໃບສະເໜີລາຄາ"
          count={quotations.length}
          onAdd={onCreateQuotation ? () => onCreateQuotation(project) : undefined}
        >
          {quotations.length > 0 &&
            quotations.map((q) => {
              const approved = q.status === "ອະນຸມັດແລ້ວ";
              const rejected = q.status === "ຖືກປະຕິເສດ";
              const dotColor = approved
                ? "bg-emerald-500"
                : rejected
                  ? "bg-rose-500"
                  : "bg-amber-500";
              const qid = String(q.id || "");
              const linkedContracts = contractsByQuotation.get(qid) || [];
              return (
                <div key={q.id || q.quotation_no}>
                  <div className="flex items-center gap-2 py-1 text-[12px]">
                    <span
                      className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${dotColor}`}
                    />
                    <span className="font-mono text-[11px] font-semibold text-[var(--theme-text)]">
                      {q.quotation_no || `#${q.id}`}
                    </span>
                    <span className="truncate text-[10px] text-[var(--theme-text-mute)]">
                      · {q.status || "ລໍຖ້າອະນຸມັດ"} ·{" "}
                      {Number(q.total_amount || 0).toLocaleString()} ₭
                    </span>
                    {onOpenQuotation && q.id && !String(q.id).startsWith("q-") && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenQuotation(q);
                        }}
                        className="ml-auto rounded px-2 py-0.5 text-[10px] font-semibold text-amber-700 transition hover:bg-amber-50"
                      >
                        ເປີດ
                      </button>
                    )}
                  </div>
                  {/* Contracts linked to this quotation — sub-indented */}
                  {linkedContracts.length > 0 && (
                    <div className="ml-2 border-l border-dashed border-[var(--theme-border-subtle)] pl-3">
                      <div className="text-[10px] text-[var(--theme-text-mute)] py-0.5">
                        → ສັນຍາ
                      </div>
                      {linkedContracts.map(renderContractRow)}
                    </div>
                  )}
                </div>
              );
            })}
        </Milestone>

        {/* ── ສັນຍາ (orphan = no linked quotation) ── */}
        <Milestone
          done={contracts.length > 0}
          label={
            orphanContracts.length > 0 && contractsByQuotation.size > 0
              ? "ສັນຍາໂດຍກົງ"
              : "ສັນຍາ"
          }
          count={
            orphanContracts.length > 0 || contractsByQuotation.size === 0
              ? orphanContracts.length
              : contracts.length
          }
          onAdd={onCreateContract ? () => onCreateContract(project) : undefined}
        >
          {orphanContracts.length > 0 && orphanContracts.map(renderContractRow)}
          {contractsByQuotation.size > 0 && orphanContracts.length === 0 && (
            <div className="text-[10px] text-[var(--theme-text-mute)] py-0.5">
              {contracts.length} ສັນຍາ ຈັດໃຫ້ໃບສະເໜີລາຄາແລ້ວ (ເບີ່ງດ້ານເທິງ)
            </div>
          )}
        </Milestone>

        {/* ── BOQ ── */}
        <Milestone
          done={allBoqs.length > 0}
          label="BOQ"
          count={allBoqs.length}
        >
          {allBoqs.length > 0 &&
            allBoqs.map((b, idx) => {
              const approved = toNum(b.approve_status) === 1;
              return (
                <div
                  key={`${b.doc_no || idx}-${idx}`}
                  className="flex items-center gap-2 py-1 text-[12px]"
                >
                  <span
                    className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                      approved ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  <span className="font-mono text-[11px] font-semibold text-[var(--theme-text)]">
                    {b.doc_no || `BOQ ${idx + 1}`}
                  </span>
                  <span className="truncate text-[10px] text-[var(--theme-text-mute)]">
                    · {b.doc_date || "-"} ·{" "}
                    {approved ? "ອະນຸມັດແລ້ວ" : "ລໍຖ້າອະນຸມັດ"}
                    {b.contract?.contract_no
                      ? ` · ສັນຍາ ${b.contract.contract_no}`
                      : ""}
                  </span>
                  {b.doc_no && onOpenBoqDoc && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenBoqDoc(b.doc_no!);
                      }}
                      className="ml-auto rounded px-2 py-0.5 text-[10px] font-semibold text-cyan-700 transition hover:bg-cyan-50"
                    >
                      ເບີ່ງ
                    </button>
                  )}
                </div>
              );
            })}
        </Milestone>

        {/* ── ໃບເບີກ ── */}
        <Milestone
          done={counts.requests > 0}
          label="ໃບເບີກ"
          count={counts.requests}
          hasNext={false}
        >
          {counts.requests > 0 && (
            <div className="flex items-center gap-2 py-1 text-[12px]">
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
              <span className="text-[var(--theme-text)]">
                {counts.requests} ໃບເບີກ
              </span>
            </div>
          )}
        </Milestone>
      </div>
    </div>
  );
}

function StageProgress({ project }: { project: ProjectItem }) {
  const currentStatus = resolveStatus(project);
  const currentIdx = STATUSES.findIndex((s) => s.id === currentStatus);
  const currentMeta = meta(currentStatus);
  const currentColor = COLOR[currentMeta.color];
  const sub = getProjectSubStatus(project);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center">
        {STATUSES.map((s, idx) => {
          const isPast = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const sColor = COLOR[s.color];

          let dot: React.ReactNode;
          if (isCurrent) {
            dot = (
              <span
                className={`relative flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-white ${sColor.dot}`}
              >
                <span className={`absolute -inset-1 animate-ping rounded-full opacity-30 ${sColor.dot}`} />
              </span>
            );
          } else if (isPast) {
            dot = (
              <span className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-[var(--theme-primary)] text-white">
                <svg viewBox="0 0 8 8" className="h-1.5 w-1.5">
                  <path d="M1.5 4l1.7 1.7L6.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              </span>
            );
          } else {
            dot = (
              <span className="h-2 w-2 rounded-full border border-[var(--theme-border)] bg-white" />
            );
          }

          const barClass = isPast || (isCurrent && idx > 0)
            ? "bg-[var(--theme-primary)]"
            : "bg-[var(--theme-border-subtle)]";

          return (
            <React.Fragment key={s.id}>
              <span
                className="flex flex-shrink-0 items-center justify-center"
                title={s.short}
                style={{ minWidth: 12 }}
              >
                {dot}
              </span>
              {idx < STATUSES.length - 1 && (
                <span className={`h-px flex-1 ${barClass}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${currentColor.chip}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${currentColor.dot}`} />
          {currentMeta.id}
        </span>
        {sub && (
          <span className="text-[10px] text-[var(--theme-text-mute)]">
            · {sub.label}
          </span>
        )}
        {project.current_status_elapsed_label && (
          <span className="text-[10px] text-[var(--theme-text-mute)]">
            · ໃນສະຖານະ {project.current_status_elapsed_label}
          </span>
        )}
        {project.project_elapsed_label && (
          <span className="text-[10px] text-[var(--theme-text-mute)]">
            · ລວມ {project.project_elapsed_label}
          </span>
        )}
      </div>
    </div>
  );
}

function Badge({
  status,
  project,
  full = false,
}: {
  status?: string | null;
  project?: ProjectItem | null;
  full?: boolean;
}) {
  const display = project ? getDisplayStatusView(project) : null;
  const m = display || meta(status);
  const c = display || color(status);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${c.chip}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {full ? m.id : m.short}
    </span>
  );
}

/* ─── Component ─── */

export default function ProjectList() {
  const router = useRouter();
  const host = process.env.NEXT_PUBLIC_IMAGE_HOST || "";

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [tab, setTab] = useState<StatusId | "all">("all");
  const [drawerProject, setDrawerProject] = useState<ProjectItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerQuotations, setDrawerQuotations] = useState<any[]>([]);
  const [projectQuotations, setProjectQuotations] = useState<Record<string, any[]>>({});
  const [userRole, setUserRole] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [expandedProjects, setExpandedProjects] = useState<
    Set<number | string>
  >(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Hydrate viewMode from localStorage. v2 intentionally starts on list tree
  // instead of the previous kanban default.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("projectlist-view-v2");
      if (saved === "list" || saved === "kanban") setViewMode(saved);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("projectlist-view-v2", viewMode);
    } catch {}
  }, [viewMode]);

  const toggleExpand = async (project: ProjectItem) => {
    const id = project.id;
    if (expandedProjects.has(id)) {
      setExpandedProjects((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      return;
    }

    try {
      const tasks: Promise<void>[] = [];

      const contractsStale =
        !project.contractlist ||
        project.contractlist.length === 0 ||
        project.contractlist.some(
          (c) => Boolean(c.has_boq) && !Array.isArray(c.boq_list),
        );
      if (contractsStale) {
        tasks.push((async () => {
        const r = await fetch(`/api/projects/${id}?include_contracts=1`);
        const j = await r.json();
        const data = j?.data;
        if (data && Array.isArray(data.contractlist)) {
          setProjects((cur) =>
            cur.map((p) =>
              p.id === id ? { ...p, contractlist: data.contractlist } : p,
            ),
          );
        }
        })());
      }

      if (!projectQuotations[String(id)]) {
        tasks.push((async () => {
          const qr = await fetch(`/api/quotations?project_id=${encodeURIComponent(String(id))}`);
          const qj = await qr.json();
          setProjectQuotations((cur) => ({
            ...cur,
            [String(id)]: Array.isArray(qj?.data) ? qj.data : [],
          }));
        })());
      }

      await Promise.all(tasks);
    } catch (e) {
      console.warn("fetch tree data", e);
    }

    setExpandedProjects((prev) => {
      const n = new Set(prev);
      n.add(id);
      return n;
    });
  };

  /* ── Effects ── */
  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const role = typeof user.role === "string" && user.role.includes(",")
        ? user.role.split(",")[0].trim()
        : String(user.role || "");
      setUserRole(role);
    } catch {}
    void load();
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  /* ── Data ── */
  const load = async () => {
    try {
      setLoading(true);
      const r = await fetch("/api/projects?summary=1");
      const j = await r.json();
      setProjects(
        (Array.isArray(j?.data) ? j.data : []).map((p: ProjectItem) => ({
          ...p,
          __q: searchOf(p),
        })),
      );
    } catch {
      Swal.fire("ຜິດພາດ", "ໂຫຼດຂໍ້ມູນບໍ່ສຳເລັດ", "error");
    } finally {
      setLoading(false);
    }
  };

  const counts = useMemo(
    () =>
      STATUSES.map((s) => ({
        ...s,
        count: projects.filter((p) => resolveStatus(p) === s.id).length,
      })),
    [projects],
  );

  const filtered = useMemo(() => {
    let list = projects;
    if (tab !== "all") list = list.filter((p) => resolveStatus(p) === tab);
    if (debounced.trim()) {
      const kw = lower(debounced);
      list = list.filter((p) => lower(p.__q || searchOf(p)).includes(kw));
    }
    return list;
  }, [projects, debounced, tab]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [tab, debounced]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = useMemo(
    () => filtered.slice((page - 1) * perPage, page * perPage),
    [filtered, page, perPage],
  );

  // Register only the essential page-level controls. Status filtering remains
  // internal so the top area stays clean.
  usePageHeader({
    title:
      tab === "all"
        ? "ໂຄງການທັງໝົດ"
        : (counts.find((s) => s.id === tab) || counts[0])?.short || "ໂຄງການ",
    subtitle: `${filtered.length} ລາຍການ`,
    primaryAction: {
      label: "ສ້າງໂຄງການ",
      icon: <Plus size={13} />,
      onClick: () => router.push("/sale-admin/create-project"),
    },
    secondaryActions: [
      {
        label: "ໂຫຼດໃໝ່",
        icon: <RefreshCw size={13} className={loading ? "animate-spin" : ""} />,
        onClick: () => void load(),
        disabled: loading,
      },
    ],
    search: {
      value: search,
      onChange: setSearch,
      placeholder: "ຄົ້ນຫາໂຄງການ, ລູກຄ້າ, ຜູ້ປະສານ...",
    },
  });

  /* ── Actions ── */
  const openDrawer = async (p: ProjectItem) => {
    if (drawerOpen && drawerProject?.id === p.id) {
      setDrawerOpen(false);
      setDrawerProject(null);
      setDrawerQuotations([]);
      return;
    }
    const preview = drawerProject?.id === p.id ? drawerProject : p;
    setDrawerProject(preview);
    setDrawerOpen(true);
    setDrawerQuotations([]);

    // Fetch project details + quotations in parallel.
    const fetchQuotations = (async () => {
      try {
        const qr = await fetch(`/api/quotations?project_id=${encodeURIComponent(String(p.id))}`);
        const qj = await qr.json();
        const list = Array.isArray(qj?.data) ? qj.data : [];
        // Only apply if drawer still shows the same project (user may have switched).
        setDrawerProject((cur) => {
          if (cur && cur.id === p.id) setDrawerQuotations(list);
          return cur;
        });
      } catch {
        /* ignore — quotation list is non-critical */
      }
    })();

    const contractsStale =
      !Array.isArray(preview?.contractlist) ||
      preview.contractlist.some(
        (c) => Boolean(c.has_boq) && !Array.isArray(c.boq_list),
      );
    if ((preview?.status_durations || []).length > 0 && !contractsStale) {
      await fetchQuotations;
      return;
    }
    try {
      setDrawerLoading(true);
      const r = await fetch(`/api/projects/${p.id}?include_contracts=1`);
      const j = await r.json();
      const d = j?.data;
      if (d)
        setDrawerProject((c) =>
          c && c.id === p.id
            ? {
                ...c,
                ...d,
                contractlist: Array.isArray(d.contractlist)
                  ? d.contractlist
                  : c.contractlist,
              }
            : c,
        );
    } catch {
    } finally {
      setDrawerLoading(false);
      await fetchQuotations;
    }
  };

  const applyStatus = async (p: ProjectItem, newStatus: StatusId) => {
    const currentStatus = resolveStatus(p);
    // Block manual drag into stages that must be derived from the data
    // hierarchy (Project → Quotation → Contract → BOQ → MaterialRequest).
    const derivedOnly: StatusId[] = ["ສະເໜີລາຄາ", "ເຊັນສັນຍາ", "ດຳເນີນສັນຍາ", "ກຳລັງເບີກວັດສະດຸ"];
    if (derivedOnly.includes(newStatus)) {
      await Swal.fire({
        icon: "info",
        title: "ສະຖານະນີ້ຄຳນວນເອງ",
        text: "ສະຖານະນີ້ປ່ຽນອັດຕະໂນມັດຕາມຂໍ້ມູນ Quotation / Contract / BOQ / ໃບຂໍເບີກ. ໃຫ້ສ້າງເອກະສານທີ່ກ່ຽວຂ້ອງແທນ.",
        confirmButtonColor: "#714b67",
      });
      return;
    }
    if (currentStatus === newStatus) return;

    const result = await Swal.fire({
      title: "ຢືນຢັນປ່ຽນສະຖານະ",
      html: `<b>${currentStatus}</b> → <b>${newStatus}</b>`,
      icon: "question",
      showCancelButton: true,
      cancelButtonText: "ຍົກເລີກ",
      confirmButtonText: "ຢືນຢັນ",
      confirmButtonColor: "#714b67",
    });
    if (!result.isConfirmed) return;
    try {
      const r = await fetch(`/api/projects/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_status: newStatus }),
      });
      if (!r.ok) throw new Error();
      setProjects((c) =>
        c.map((x) =>
          x.id === p.id
            ? {
                ...x,
                project_status: newStatus,
                __q: searchOf({ ...x, project_status: newStatus }),
              }
            : x,
        ),
      );

      if (drawerProject?.id === p.id)
        setDrawerProject((c) => (c ? { ...c, project_status: newStatus } : c));
      Swal.fire({
        icon: "success",
        title: "ສຳເລັດ",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch {
      Swal.fire("ຜິດພາດ", "ປ່ຽນບໍ່ສຳເລັດ", "error");
    }
  };

  const openContractCreation = (p: ProjectItem, quotation?: any) => {
    const query = quotation?.id
      ? `?quotationId=${encodeURIComponent(String(quotation.id))}`
      : "";
    router.push(`/sale-admin/request-project-creation/${p.id}${query}`);
  };

  const openBoqCreation = (p: ProjectItem, contract: ContractItem) => {
    const cust = contract.cust_code || p.sml_code || p.id;
    const contractNo = contract.contract_no || contract.contract_code || contract.id;
    if (!cust || !contractNo) {
      Swal.fire("ຜິດພາດ", "ບໍ່ພົບຂໍ້ມູນສັນຍາສຳລັບສ້າງ BOQ", "error");
      return;
    }
    router.push(
      `/service-admin/create-boq/${encodeURIComponent(String(cust))}/${encodeURIComponent(
        String(p.id),
      )}/${encodeURIComponent(String(contractNo))}`,
    );
  };

  const openQuotationCreation = (p: ProjectItem) => {
    router.push(`/sale-admin/create-quotation?projectId=${encodeURIComponent(String(p.id))}`);
  };

  const openQuotation = (quotation: any) => {
    if (!quotation?.id) return;
    router.push(`/sale-admin/quotation/${quotation.id}`);
  };

  const openBoqDoc = (docNo: string) => {
    if (!docNo) return;
    router.push(`/boq/${encodeURIComponent(docNo)}/edit`);
  };

  const deleteContractInTree = async (project: ProjectItem, contract: ContractItem) => {
    const contractNo = contract.contract_no || contract.contract_code;
    if (!contractNo) {
      Swal.fire("ຜິດພາດ", "ບໍ່ພົບເລກສັນຍາ", "error");
      return;
    }

    const confirm = await Swal.fire({
      title: "ລົບສັນຍານີ້?",
      html: `<b>${contract.contract_name || contractNo}</b><br/>BOQ, ງວດ, detail ແລະໄຟລ໌ແນບທີ່ຜູກກັບສັນຍານີ້ຈະຖືກລົບນຳ.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ລົບ",
      cancelButtonText: "ຍົກເລີກ",
      confirmButtonColor: "#dc2626",
    });
    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(String(project.id))}/contracts/${encodeURIComponent(String(contractNo))}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error();

      const removeFromProject = (p: ProjectItem) => ({
        ...p,
        contractlist: (p.contractlist || []).filter(
          (c) => (c.contract_no || c.contract_code) !== contractNo,
        ),
        contract_count: Math.max(0, toNum(p.contract_count) - 1),
      });

      setProjects((cur) =>
        cur.map((p) => (p.id === project.id ? removeFromProject(p) : p)),
      );
      setDrawerProject((cur) =>
        cur && cur.id === project.id ? removeFromProject(cur) : cur,
      );

      Swal.fire({
        icon: "success",
        title: "ລົບສັນຍາແລ້ວ",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch {
      Swal.fire("ຜິດພາດ", "ລົບສັນຍາບໍ່ສຳເລັດ", "error");
    }
  };

  const approveContractInTree = async (
    project: ProjectItem,
    contract: ContractItem,
    type: "approve" | "check",
  ) => {
    const isApprove = type === "approve";
    const contractNo = contract.contract_no || contract.contract_code;
    if (!contractNo) {
      Swal.fire("ຜິດພາດ", "ບໍ່ພົບເລກສັນຍາ", "error");
      return;
    }

    const confirm = await Swal.fire({
      title: isApprove ? "ອະນຸມັດສັນຍາ?" : "ກວດສອບບັນຊີ?",
      text: `${contract.contract_name || contract.name || contractNo}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "ຢືນຢັນ",
      cancelButtonText: "ຍົກເລີກ",
      confirmButtonColor: isApprove ? "#f59e0b" : "#714b67",
    });
    if (!confirm.isConfirmed) return;

    try {
      const username = JSON.parse(localStorage.getItem("user") || "{}")?.username;
      const endpoint = isApprove
        ? `/api/projects/${project.id}/approve`
        : `/api/projects/checkacc/${encodeURIComponent(String(contractNo))}`;
      const payload = isApprove
        ? { approve_status_1: 1, contract_no: contractNo, username }
        : { status: "1", project_id: project.id, username };
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();

      setProjects((cur) =>
        cur.map((p) => {
          if (p.id !== project.id) return p;
          const updatedContracts = (p.contractlist || []).map((c) => {
            const same = (c.contract_no || c.contract_code) === contractNo;
            if (!same) return c;
            return isApprove
              ? { ...c, approve_status_1: 1 }
              : { ...c, approve_status_2: 1, acc_approve: 1 };
          });
          return { ...p, contractlist: updatedContracts };
        }),
      );
      Swal.fire({ icon: "success", title: "ສຳເລັດ", timer: 1200, showConfirmButton: false });
    } catch {
      Swal.fire("ຜິດພາດ", "ດຳເນີນການບໍ່ສຳເລັດ", "error");
    }
  };

  const edit = (p: ProjectItem) => {
    try {
      localStorage.setItem("project_edit_prefill", JSON.stringify(p));
    } catch {}
    router.push(`/sale-admin/create-project/${p.id}`);
  };

  const remove = (id: ProjectItem["id"]) => {
    Swal.fire({
      title: "ທ່ານແນ່ໃຈບໍ?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonText: "ຍົກເລີກ",
      confirmButtonText: "ລຶບ",
    }).then(async (r) => {
      if (!r.isConfirmed) return;
      try {
        const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        setProjects((c) => c.filter((x) => x.id !== id));
        if (drawerProject?.id === id) {
          setDrawerOpen(false);
          setDrawerProject(null);
        }
        Swal.fire({
          icon: "success",
          title: "ລຶບແລ້ວ",
          timer: 1200,
          showConfirmButton: false,
        });
      } catch {
        Swal.fire("ຜິດພາດ", "ລຶບບໍ່ສຳເລັດ", "error");
      }
    });
  };

  /* ─── Render ─── */
  return (
    <>
      <div className="flex h-full flex-col text-slate-800">
        <div className="flex min-h-0 w-full flex-1">
          {/* Main */}
          <section className="theme-card flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {/* Toolbar — status filter pills + view switcher */}
            <div className="flex flex-shrink-0 items-center gap-3 border-b border-[var(--theme-border-subtle)] bg-white px-4 py-3">
              <div className="theme-scrollbar -mx-1 flex flex-1 items-center gap-1.5 overflow-x-auto px-1">
                {[
                  {
                    id: "all" as const,
                    short: "ທັງໝົດ",
                    count: projects.length,
                  },
                  ...counts,
                ].map((s) => {
                  const active = tab === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setTab(s.id as StatusId | "all")}
                      className={[
                        "inline-flex h-7 flex-shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition",
                        active
                          ? "border-[var(--theme-primary)] bg-[var(--theme-primary)] text-white"
                          : "border-[var(--theme-border-subtle)] bg-white text-[var(--theme-text-soft)] hover:border-[var(--theme-border)] hover:text-[var(--theme-text)]",
                      ].join(" ")}
                    >
                      <span className="truncate">{s.short}</span>
                      <span
                        className={[
                          "inline-flex h-4 min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
                          active
                            ? "bg-white/20 text-white"
                            : "bg-[var(--theme-bg-muted)] text-[var(--theme-text-mute)]",
                        ].join(" ")}
                      >
                        {s.count}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <span className="hidden text-[11px] text-[var(--theme-text-mute)] tabular-nums md:inline">
                  {filtered.length} / {projects.length}
                </span>
                <ViewSwitcher value={viewMode} onChange={setViewMode} />
              </div>
            </div>

            {/* Table */}
            {viewMode === "list" && loading ? (
              <div className="flex h-60 items-center justify-center">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--theme-border-subtle)] border-t-[var(--theme-primary)]" />
              </div>
            ) : viewMode === "list" && filtered.length === 0 ? (
              <div className="flex h-60 flex-col items-center justify-center gap-2 text-[var(--theme-text-mute)]">
                <FolderOpen className="h-8 w-8 opacity-50" />
                <p className="text-xs">ບໍ່ພົບໂຄງການ</p>
              </div>
            ) : viewMode === "list" ? (
              <div className="min-h-0 flex-1 overflow-auto">
                <ul className="divide-y divide-[var(--theme-border-subtle)]">
                  {paginated.map((p) => {
                    const img = imgOf(p);
                    const currentStatus = resolveStatus(p);
                    const isExpanded = expandedProjects.has(p.id);
                    const treeQuotations = projectQuotations[String(p.id)] || [];

                    let primaryCta: React.ReactNode = null;
                    if (currentStatus === "ສະເໜີລາຄາ") {
                      primaryCta = (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openQuotationCreation(p);
                          }}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--theme-accent)] px-3 text-[11px] font-semibold text-white transition hover:bg-[var(--theme-accent-strong)]"
                        >
                          <Plus className="h-3 w-3" /> ໃບສະເໜີລາຄາ
                        </button>
                      );
                    } else if (
                      currentStatus === "ລົງທະບຽນໂຄງການ" ||
                      currentStatus === "ສຳຫຼວດ ແລະ ອອກແບບ" ||
                      currentStatus === "ສຳເລັດ"
                    ) {
                      const idx = STATUSES.findIndex((s) => s.id === currentStatus);
                      primaryCta =
                        idx < STATUSES.length - 1 ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void applyStatus(p, STATUSES[idx + 1].id);
                            }}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--theme-border)] bg-white px-3 text-[11px] font-medium text-[var(--theme-primary)] transition hover:border-[var(--theme-primary-soft)] hover:bg-[var(--theme-primary-tint)]"
                          >
                            {STATUSES[idx + 1].short}
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        ) : null;
                    }

                    return (
                      <li key={p.id} className="bg-white">
                        <div
                          onClick={() => void toggleExpand(p)}
                          className={[
                            "group cursor-pointer px-3 py-2.5 transition",
                            isExpanded
                              ? "bg-[var(--theme-bg-muted)]"
                              : "hover:bg-[var(--theme-bg-muted)]/60",
                          ].join(" ")}
                        >
                          <div className="flex items-center gap-3">
                            {/* Expand chevron */}
                            <ChevronDown
                              className={`h-4 w-4 flex-shrink-0 text-[var(--theme-text-mute)] transition ${isExpanded ? "" : "-rotate-90"}`}
                            />

                            {/* Cover */}
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--theme-bg-muted)] text-[var(--theme-text-mute)] ring-1 ring-[var(--theme-border-subtle)]">
                              {img ? (
                                <img
                                  src={url(host, img)}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                              ) : (
                                <Building2 className="h-4 w-4 opacity-60" />
                              )}
                            </div>

                            {/* Project info */}
                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 items-baseline gap-2">
                                <span className="truncate text-[13px] font-semibold text-[var(--theme-text)]">
                                  {p.project_name || "-"}
                                </span>
                                <span className="flex-shrink-0 font-mono text-[10px] font-semibold text-[var(--theme-primary)]">
                                  {code(p)}
                                </span>
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0 text-[11px] text-[var(--theme-text-mute)]">
                                {p.customer_name && (
                                  <span className="truncate">{p.customer_name}</span>
                                )}
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {loc(p)}
                                </span>
                                {p.coordinator && (
                                  <span className="inline-flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {p.coordinator}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Stage progress — slim */}
                            <div className="hidden w-[240px] flex-shrink-0 lg:block">
                              <StageProgress project={p} />
                            </div>

                            {/* Actions */}
                            <div
                              className="flex flex-shrink-0 items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {primaryCta}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  edit(p);
                                }}
                                title="ແກ້ໄຂ"
                                className="flex h-7 w-7 items-center justify-center rounded text-[var(--theme-text-mute)] transition hover:bg-white hover:text-[var(--theme-text)]"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  remove(p.id);
                                }}
                                title="ລຶບ"
                                className="flex h-7 w-7 items-center justify-center rounded text-[var(--theme-text-mute)] transition hover:bg-rose-50 hover:text-rose-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Document tree */}
                        {isExpanded && (
                          <div className="bg-[var(--theme-bg-muted)] px-3 pb-3 pl-[3.25rem]">
                            <DocumentTree
                              project={p}
                              quotations={treeQuotations}
                              onCreateQuotation={openQuotationCreation}
                              onCreateContract={openContractCreation}
                              onCreateBoq={openBoqCreation}
                              onOpenBoqDoc={openBoqDoc}
                              onOpenQuotation={openQuotation}
                              userRole={userRole}
                              onApproveContract={approveContractInTree}
                              onDeleteContract={deleteContractInTree}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {/* Kanban view (Odoo Project default) */}
            {viewMode === "kanban" && (
              <div className="min-h-0 flex-1 overflow-hidden p-3 md:p-4">
                {loading ? (
                  <div className="flex h-60 items-center justify-center">
                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--theme-border-subtle)] border-t-[var(--theme-primary)]" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex h-60 flex-col items-center justify-center">
                    <FolderOpen className="h-8 w-8 text-[var(--theme-text-mute)]" />
                    <p className="mt-2 text-xs text-[var(--theme-text-mute)]">ບໍ່ພົບໂຄງການ</p>
                  </div>
                ) : (
                  (() => {
                    const columns: KanbanColumn<ProjectItem>[] = STATUSES.map(
                      (s) => {
                        const records = filtered.filter(
                          (p) => resolveStatus(p) === s.id,
                        );
                        const accent =
                          COLOR[s.color]?.dot?.replace("bg-", "") || "";
                        // map tailwind color name to a CSS variable-ish accent; fall back to theme primary
                        const accentMap: Record<string, string> = {
                          "teal-500": "#14b8a6",
                          "sky-500": "#0ea5e9",
                          "amber-500": "#f59e0b",
                          "rose-500": "#f43f5e",
                          "violet-500": "#8b5cf6",
                          "indigo-500": "#6366f1",
                          "cyan-500": "#06b6d4",
                          "emerald-500": "#10b981",
                          "stone-500": "#78716c",
                        };
                        return {
                          id: s.id,
                          title: s.short,
                          records,
                          color: accentMap[accent],
                        };
                      },
                    );
                    return (
                      <KanbanBoard<ProjectItem>
                        columns={columns}
                        getCardId={(p) => p.id}
                        onCardClick={(p) => void openDrawer(p)}
                        renderCard={(p) => {
                          const img = imgOf(p);
                          const sub = getProjectSubStatus(p);
                          const c = relationCounts(p);
                          const display = getDisplayStatusView(p);
                          const countParts = [
                            { n: c.quotations, l: "ສະເໜີ" },
                            { n: c.contracts, l: "ສັນຍາ" },
                            { n: c.boqs, l: "BOQ" },
                            { n: c.requests, l: "ໃບເບີກ" },
                          ].filter((m) => m.n > 0);
                          return (
                            <div className="space-y-2">
                              {/* Top: code + status dot */}
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate font-mono text-[10px] font-semibold text-[var(--theme-primary)]">
                                  {code(p)}
                                </span>
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--theme-text-soft)]">
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${display.dot}`}
                                  />
                                  {display.short || display.id}
                                </span>
                              </div>

                              {/* Body: image + name + customer */}
                              <div className="flex gap-2">
                                {img ? (
                                  <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded bg-[var(--theme-bg-muted)] ring-1 ring-[var(--theme-border-subtle)]">
                                    <img
                                      src={url(host, img)}
                                      alt=""
                                      className="h-full w-full object-cover"
                                      loading="lazy"
                                      onError={(e) => {
                                        e.currentTarget.style.display = "none";
                                      }}
                                    />
                                  </div>
                                ) : null}
                                <div className="min-w-0 flex-1">
                                  <div className="line-clamp-2 text-[13px] font-semibold leading-snug text-[var(--theme-text)]">
                                    {p.project_name || "-"}
                                  </div>
                                  <div className="truncate text-[11px] text-[var(--theme-text-mute)]">
                                    {p.customer_name || "-"}
                                  </div>
                                </div>
                              </div>

                              {/* Inline meta (counts + sub-status) */}
                              {(countParts.length > 0 || sub) && (
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[var(--theme-text-mute)]">
                                  {countParts.map((m, i) => (
                                    <React.Fragment key={m.l}>
                                      {i > 0 && <span>·</span>}
                                      <span>
                                        <span className="font-semibold text-[var(--theme-text-soft)] tabular-nums">
                                          {m.n}
                                        </span>{" "}
                                        {m.l}
                                      </span>
                                    </React.Fragment>
                                  ))}
                                  {sub && (
                                    <>
                                      {countParts.length > 0 && <span>·</span>}
                                      <span className="inline-flex items-center gap-1 font-medium text-[var(--theme-primary)]">
                                        <span className="h-1 w-1 rounded-full bg-[var(--theme-primary)]" />
                                        {sub.label}
                                      </span>
                                    </>
                                  )}
                                </div>
                              )}

                              {/* Time footer */}
                              {p.current_status_elapsed_label && (
                                <div className="text-[10px] text-[var(--theme-text-mute)]">
                                  ໃນສະຖານະນີ້ {p.current_status_elapsed_label}
                                </div>
                              )}
                            </div>
                          );
                        }}
                      />
                    );
                  })()
                )}
              </div>
            )}

            {/* Pagination */}
            {viewMode === "list" && !loading && filtered.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--theme-border-subtle)] bg-white px-4 py-2.5">
                <div className="flex items-center gap-2 text-[11px] text-[var(--theme-text-mute)]">
                  <span>ສະແດງ</span>
                  <select
                    value={perPage}
                    onChange={(e) => {
                      setPerPage(Number(e.target.value));
                      setPage(1);
                    }}
                    className="rounded-md border border-[var(--theme-border-subtle)] bg-white px-2 py-1 text-[11px] text-[var(--theme-text)] outline-none focus:border-[var(--theme-primary-soft)]"
                  >
                    {[10, 20, 50, 100].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <span className="tabular-nums">
                    {(page - 1) * perPage + 1}–
                    {Math.min(page * perPage, filtered.length)} / {filtered.length}
                  </span>
                </div>

                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--theme-text-soft)] transition hover:bg-[var(--theme-bg-muted)] disabled:opacity-30 disabled:hover:bg-transparent"
                    aria-label="ໜ້າກ່ອນ"
                  >
                    <ChevronDown className="h-3.5 w-3.5 rotate-90" />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (n) =>
                        n === 1 || n === totalPages || Math.abs(n - page) <= 1,
                    )
                    .reduce<(number | "...")[]>((acc, n, idx, arr) => {
                      if (idx > 0 && n - arr[idx - 1] > 1) acc.push("...");
                      acc.push(n);
                      return acc;
                    }, [])
                    .map((n, idx) =>
                      n === "..." ? (
                        <span
                          key={`dot-${idx}`}
                          className="px-1 text-[11px] text-[var(--theme-text-mute)]"
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={n}
                          onClick={() => setPage(n as number)}
                          className={`flex h-7 min-w-[28px] items-center justify-center rounded-md px-2 text-[11px] font-medium tabular-nums transition ${
                            page === n
                              ? "bg-[var(--theme-primary)] text-white"
                              : "text-[var(--theme-text-soft)] hover:bg-[var(--theme-bg-muted)]"
                          }`}
                        >
                          {n}
                        </button>
                      ),
                    )}

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--theme-text-soft)] transition hover:bg-[var(--theme-bg-muted)] disabled:opacity-30 disabled:hover:bg-transparent"
                    aria-label="ໜ້າຕໍ່"
                  >
                    <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ── History drawer ── */}
      {drawerOpen && drawerProject && (
        <div
          className="fixed inset-0 z-[990]"
          onClick={() => {
            setDrawerOpen(false);
            setDrawerProject(null);
          }}
        >
          <div className="absolute inset-0 bg-black/20" />
          <aside
            className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-[var(--theme-border-subtle)] bg-white shadow-[var(--theme-shadow-lg)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header — light, slim */}
            <div className="flex-shrink-0 border-b border-[var(--theme-border-subtle)] bg-white px-5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-[15px] font-semibold text-[var(--theme-text)]">
                      {drawerProject.project_name || "-"}
                    </h2>
                    <span className="font-mono text-[10px] font-semibold text-[var(--theme-primary)]">
                      {code(drawerProject)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--theme-text-mute)]">
                    <Badge project={drawerProject} full />
                    <span>ເລີ່ມ {fmtDate(drawerProject.date_register)}</span>
                    {drawerProject.current_status_elapsed_label && (
                      <span>
                        ໃນສະຖານະນີ້ {drawerProject.current_status_elapsed_label}
                      </span>
                    )}
                    {drawerProject.project_elapsed_label && (
                      <span>ລວມ {drawerProject.project_elapsed_label}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    setDrawerProject(null);
                  }}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-[var(--theme-text-mute)] transition hover:bg-[var(--theme-bg-muted)] hover:text-[var(--theme-text)]"
                  aria-label="ປິດ"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Document tree (workflow) */}
            <div className="px-4 pt-3">
              <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text-mute)]">
                Workflow
              </h3>
              <DocumentTree
                project={drawerProject}
                quotations={drawerQuotations}
                onCreateQuotation={openQuotationCreation}
                onCreateContract={openContractCreation}
                onCreateBoq={openBoqCreation}
                onOpenQuotation={openQuotation}
                userRole={userRole}
                onApproveContract={approveContractInTree}
                onDeleteContract={deleteContractInTree}
              />
            </div>

            {/* Status history — slim timeline */}
            <div className="flex-1 px-4 pt-4 pb-4">
              <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text-mute)]">
                ປະຫວັດການເຄື່ອນໄຫວ
              </h3>
              {drawerLoading ? (
                <div className="flex h-20 items-center justify-center">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--theme-border-subtle)] border-t-[var(--theme-primary)]" />
                </div>
              ) : (drawerProject.status_durations || []).length > 0 ? (
                <div className="overflow-hidden rounded-md border border-[var(--theme-border-subtle)] bg-white">
                  <ul className="divide-y divide-[var(--theme-border-subtle)]">
                    {(drawerProject.status_durations || []).map((item, idx) => {
                      const c = color(item.status);
                      return (
                        <li
                          key={`${item.status}-${idx}`}
                          className="flex items-center gap-2 px-3 py-1.5 text-[12px]"
                        >
                          <span
                            className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${c.dot}`}
                          />
                          <span className="font-medium text-[var(--theme-text)]">
                            {meta(item.status).short}
                          </span>
                          {item.is_current && (
                            <span className="text-[10px] font-semibold text-emerald-700">
                              · ປັດຈຸບັນ
                            </span>
                          )}
                          <span className="ml-auto font-mono text-[11px] font-semibold tabular-nums text-[var(--theme-text)]">
                            {item.label || "0 ນາທີ"}
                          </span>
                          <span className="hidden text-[10px] text-[var(--theme-text-mute)] md:inline">
                            {item.is_current
                              ? fmtDT(item.current_started_at)
                              : item.last_ended_at
                                ? fmtDT(item.last_ended_at)
                                : `${item.entries || 1} ຄັ້ງ`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-[var(--theme-text-mute)]">
                  <span className="h-1.5 w-1.5 rounded-full border border-[var(--theme-border)] bg-white" />
                  ຍັງບໍ່ມີປະຫວັດ
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 border-t border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] px-4 py-2.5">
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  openQuotationCreation(drawerProject);
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--theme-accent)] px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-[var(--theme-accent-strong)]"
              >
                <Plus className="h-3.5 w-3.5" />
                ສ້າງໃບສະເໜີລາຄາ
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
