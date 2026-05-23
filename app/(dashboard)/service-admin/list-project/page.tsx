"use client";


import AuthGuard from "@/_components/AuthGuard";
import { getProjectsBoq } from "@/_actions/projects";
import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, RefreshCw, MapPin, User, Phone,
  FileText, Package, AlertCircle, X,
  CalendarClock, ChevronDown, Building2,
} from 'lucide-react';
import { useRouter } from "next/navigation";
import Swal from 'sweetalert2';
import Modal from 'react-modal';
import { usePageHeader } from "@/_components/PageHeader";
import ViewSwitcher, { type ViewMode } from "@/_components/odoo/ViewSwitcher";
import KanbanBoard, { type KanbanColumn } from "@/_components/odoo/KanbanBoard";

function _getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}


// --- Configuration ---
if (typeof document !== 'undefined') {
  Modal.setAppElement(document.body);
}

const formatNumber = (v) => Number(v || 0).toLocaleString('en-US');
const isContractApproved = (c) =>
  Number(c?.approve_status_1) === 1 &&
  Math.max(Number(c?.approve_status_2 || 0), Number(c?.acc_approve || 0)) === 1;

const STATUS_CONFIG = {
  'ລໍຖ້າດຳເນີນ': { color: 'bg-stone-500', label: 'Pending', step: 1 },
  'ຂັ້ນຕອນອອກແບບ': { color: 'bg-indigo-500', label: 'Design', step: 2 },
  'ຂັ້ນຕອນສະເໜີຂາຍ': { color: 'bg-amber-500', label: 'Quotation', step: 3 },
  'ຂັ້ນຕອນການເຮັດສັນຍາ': { color: 'bg-rose-500', label: 'Contract', step: 4 },
  'ສາມາດເບີກຂອງໃດ້': { color: 'bg-emerald-500', label: 'Active', step: 5 },
  'ລໍຖ້າອະນຸມັດປິດໂຄງການ': { color: 'bg-amber-500', label: 'Closing', step: 6 },
  'ປິດໂຄງການ': { color: 'bg-stone-800', label: 'Closed', step: 7 },
  default: { color: 'bg-stone-400', label: 'Unknown', step: 0 }
};

// --- Sub-Components ---

// Timeline Stepper
const SERVICE_STAGES = [
  { id: 'Contract', label: 'Contract', dot: 'bg-rose-500', text: 'text-rose-700' },
  { id: 'Active', label: 'Active', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  { id: 'Closing', label: 'Closing', dot: 'bg-amber-500', text: 'text-amber-700' },
  { id: 'Closed', label: 'Closed', dot: 'bg-stone-500', text: 'text-stone-700' },
];

const ProjectStatusStepper = ({ currentStatus }) => {
  let activeIndex = 0;
  if (currentStatus === 'ສາມາດເບີກຂອງໃດ້') activeIndex = 1;
  else if (currentStatus === 'ລໍຖ້າອະນຸມັດປິດໂຄງການ') activeIndex = 2;
  else if (currentStatus === 'ປິດໂຄງການ') activeIndex = 3;
  else if (!['ຂັ້ນຕອນການເຮັດສັນຍາ', 'ລໍຖ້າດຳເນີນ', 'ຂັ້ນຕອນອອກແບບ'].includes(currentStatus)) activeIndex = 1;

  return (
    <div className="flex w-full max-w-md items-start">
      {SERVICE_STAGES.map((step, idx) => {
        const isPast = idx < activeIndex;
        const isCurrent = idx === activeIndex;
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-1 flex-col items-center gap-1.5">
              {isCurrent ? (
                <span className={`relative flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-white ${step.dot}`}>
                  <span className={`absolute -inset-1 animate-ping rounded-full opacity-30 ${step.dot}`} />
                </span>
              ) : isPast ? (
                <span className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-[var(--theme-primary)] text-white">
                  <svg viewBox="0 0 8 8" className="h-1.5 w-1.5">
                    <path d="M1.5 4l1.7 1.7L6.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </span>
              ) : (
                <span className="h-2 w-2 rounded-full border border-[var(--theme-border)] bg-white" />
              )}
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider ${
                  isCurrent
                    ? step.text
                    : isPast
                      ? 'text-[var(--theme-text-soft)]'
                      : 'text-[var(--theme-text-mute)]'
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < SERVICE_STAGES.length - 1 && (
              <span
                className={`mt-1.5 h-px flex-1 ${
                  idx < activeIndex
                    ? 'bg-[var(--theme-primary)]'
                    : 'bg-[var(--theme-border-subtle)]'
                }`}
                style={{ minWidth: 16 }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const rowKey = (c) => `${c.project_id}-${c.roworder ?? c.contract_no}`;

// Vertical timeline milestone (filled vs hollow dot + line connecting to next)
const Milestone = ({ done, label, status, action, hasNext = true }: {
  done: boolean;
  label: string;
  status?: React.ReactNode;
  action?: React.ReactNode;
  hasNext?: boolean;
}) => (
  <div className="relative">
    {hasNext && (
      <span
        className={`absolute left-[6px] top-5 bottom-0 w-px ${
          done ? "bg-[var(--theme-primary)]" : "bg-[var(--theme-border-subtle)]"
        }`}
      />
    )}
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
      <span className="text-[12px] font-semibold text-[var(--theme-text)]">{label}</span>
      {status && (
        <span className="text-[11px] text-[var(--theme-text-soft)]">{status}</span>
      )}
      {action && <span className="ml-auto flex items-center gap-1">{action}</span>}
    </div>
  </div>
);

// Tree-row for a single project contract. Slim line by default; expand to
// reveal child nodes (project info, BOQ, schedule, close action).
const ContractTreeRow = ({ contract, isExpanded, onToggle, role, onBoq, onSchedule, onCloseProject }) => {
  const isApproved = isContractApproved(contract);
  const hasBoq = Boolean(contract.has_boq) || contract.boq_status === 'done';
  const canEditBoq = role === 'service_admin' && isApproved;
  const statusConf = STATUS_CONFIG[contract.project_status] || STATUS_CONFIG.default;
  const canCloseProject = contract.project_status === 'ສາມາດເບີກຂອງໃດ້';

  // `contract_no` may come as a single code (PJC.../25) or a comma-joined
  // pair like "PJC0014/25 , QT2025111201" (contract code + originating
  // quotation code). Split so the contract code can lead and the quotation
  // code shows as origin context.
  const codes = String(contract.contract_no || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const pjcCode = codes.find((c) => /^PJC/i.test(c)) || codes.find((c) => !/^QT/i.test(c)) || codes[0] || '—';
  const qtCode = codes.find((c) => /^QT/i.test(c));

  // Compact status word for the row (single signal, not multi pills).
  const status = !isApproved
    ? { label: "ລໍຖ້າອະນຸມັດ", dot: "bg-amber-500", text: "text-amber-700" }
    : !hasBoq
      ? { label: "ລໍຖ້າອອກ BOQ", dot: "bg-orange-500", text: "text-orange-700" }
      : { label: "BOQ ພ້ອມ", dot: "bg-emerald-500", text: "text-emerald-700" };

  return (
    <li>
      {/* Row — slim, table-like */}
      <div
        onClick={onToggle}
        className={[
          "group flex cursor-pointer items-center gap-3 px-3 py-2 text-[12px] transition",
          isExpanded
            ? "bg-[var(--theme-primary-tint)]/40"
            : "hover:bg-[var(--theme-bg-muted)]/60",
        ].join(" ")}
      >
        <ChevronDown
          className={`h-3.5 w-3.5 flex-shrink-0 text-[var(--theme-text-mute)] transition ${isExpanded ? "" : "-rotate-90"}`}
        />
        <span
          className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${status.dot}`}
          title={status.label}
        />
        <span className="w-[110px] flex-shrink-0 truncate font-mono text-[12px] font-semibold text-[var(--theme-primary)]">
          {pjcCode}
        </span>
        <span className="min-w-0 flex-1 truncate text-[var(--theme-text)]">
          {contract.contract_name || 'ບໍ່ລະບຸ'}
        </span>
        <span className="hidden min-w-0 max-w-[260px] truncate text-[11px] text-[var(--theme-text-mute)] lg:inline">
          {contract.project_name}
        </span>
        <span className={`hidden w-[120px] flex-shrink-0 text-[11px] font-medium md:inline ${status.text}`}>
          {status.label}
        </span>
        <span className="w-[110px] flex-shrink-0 text-right font-mono text-[12px] tabular-nums text-[var(--theme-text-soft)]">
          {contract.amount ? formatNumber(contract.amount) : '-'}
        </span>
        <div
          className="flex flex-shrink-0 items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onBoq(contract)}
            disabled={!canEditBoq}
            title={hasBoq ? 'ແກ້ BOQ' : 'ເພີ່ມ BOQ'}
            className={`flex h-7 items-center gap-1 rounded px-2 text-[10px] font-semibold transition ${
              canEditBoq
                ? 'text-[var(--theme-text-soft)] hover:bg-[var(--theme-primary-tint)] hover:text-[var(--theme-primary)]'
                : 'cursor-not-allowed text-[var(--theme-text-mute)]'
            }`}
          >
            <Package className="h-3 w-3" />
            BOQ
          </button>
          <button
            onClick={() => onSchedule(contract)}
            title="ແຜນວຽກ"
            className="flex h-7 items-center gap-1 rounded px-2 text-[10px] font-semibold text-[var(--theme-text-soft)] transition hover:bg-[var(--theme-primary-tint)] hover:text-[var(--theme-primary)]"
          >
            <CalendarClock className="h-3 w-3" />
            ແຜນວຽກ
          </button>
        </div>
      </div>

      {/* Expanded — project info card + vertical workflow timeline */}
      {isExpanded && (
        <div className="bg-[var(--theme-bg-muted)]/40 px-4 py-3 pl-[2.25rem]">
          {/* Project info — compact sub-card */}
          <div className="mb-3 rounded-md border border-[var(--theme-border-subtle)] bg-white px-3 py-2">
            <div className="flex items-center gap-2 text-[12px]">
              <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-[var(--theme-primary)]" />
              <span className="font-semibold text-[var(--theme-text)]">
                {contract.project_name || '-'}
              </span>
              <span className="font-mono text-[10px] text-[var(--theme-text-mute)]">
                #{contract.sml_code || contract.project_id}
              </span>
              <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] text-[var(--theme-text-soft)]">
                <span className={`h-1.5 w-1.5 rounded-full ${statusConf.color}`} />
                {statusConf.label}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-[var(--theme-text-mute)]">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {[contract.village_name, contract.district_name, contract.province_name].filter(Boolean).join(', ') || '-'}
              </span>
              {contract.coordinator && (
                <span className="inline-flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {contract.coordinator}
                </span>
              )}
              {contract.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {contract.phone}
                </span>
              )}
              {qtCode && (
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  ມາຈາກ <span className="font-mono">{qtCode}</span>
                </span>
              )}
            </div>
          </div>

          {/* Workflow timeline */}
          <Milestone
            done={isApproved}
            label="ສັນຍາ"
            status={
              isApproved ? (
                <>· ອະນຸມັດແລ້ວ</>
              ) : (
                <>· ລໍຖ້າອະນຸມັດ</>
              )
            }
          />
          <Milestone
            done={hasBoq}
            label="BOQ"
            status={
              hasBoq ? (
                <>· ອອກແລ້ວ</>
              ) : (
                <>· ຍັງບໍ່ມີ</>
              )
            }
            action={
              <button
                onClick={() => onBoq(contract)}
                disabled={!canEditBoq && !hasBoq}
                className={`inline-flex h-6 items-center gap-1 rounded px-2 text-[10px] font-semibold transition ${
                  hasBoq
                    ? "text-cyan-700 hover:bg-cyan-50"
                    : canEditBoq
                      ? "text-[var(--theme-accent)] hover:bg-[var(--theme-accent-tint)]"
                      : "cursor-not-allowed text-[var(--theme-text-mute)]"
                }`}
              >
                <Package className="h-3 w-3" />
                {hasBoq ? 'ແກ້ BOQ' : 'ສ້າງ'}
              </button>
            }
          />
          <Milestone
            done={false}
            label="ແຜນວຽກ"
            status={<>· ຍັງບໍ່ມີ</>}
            action={
              <button
                onClick={() => onSchedule(contract)}
                className="inline-flex h-6 items-center gap-1 rounded px-2 text-[10px] font-semibold text-[var(--theme-accent)] transition hover:bg-[var(--theme-accent-tint)]"
              >
                <CalendarClock className="h-3 w-3" />
                ສ້າງ
              </button>
            }
          />
          <Milestone
            done={false}
            hasNext={false}
            label="ປິດໂຄງການ"
            status={
              canCloseProject ? (
                <>· ພ້ອມປິດ</>
              ) : (
                <>· ບໍ່ພ້ອມ</>
              )
            }
            action={
              canCloseProject ? (
                <button
                  onClick={() => onCloseProject(contract)}
                  className="inline-flex h-6 items-center gap-1 rounded px-2 text-[10px] font-semibold text-rose-700 transition hover:bg-rose-50"
                >
                  <X className="h-3 w-3" /> ປິດ
                </button>
              ) : undefined
            }
          />
        </div>
      )}
    </li>
  );
};

// --- Main Page ---
const BOQContractList = () => {
  const router = useRouter();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [statusTab, setStatusTab] = useState('waiting_boq');

  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [pendingDoc, setPendingDoc] = useState(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("project-list-view");
      if (saved === "list" || saved === "kanban") setViewMode(saved);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("project-list-view", viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setRole(JSON.parse(u).role || '');
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getProjectsBoq({ contracts: true });
      const data = res?.data || [];
      setContracts(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return contracts.filter(c => {
      const matchSearch =
        !s ||
        c.contract_name?.toLowerCase().includes(s) ||
        c.contract_no?.toLowerCase().includes(s) ||
        c.project_name?.toLowerCase().includes(s) ||
        c.coordinator?.toLowerCase().includes(s);
      const approved = isContractApproved(c);
      const hasBoq = Boolean(c.has_boq) || c.boq_status === 'done';
      let matchStatus = true;
      if (statusTab === 'waiting_contract') matchStatus = !approved;
      else if (statusTab === 'waiting_boq') matchStatus = approved && !hasBoq;
      else if (statusTab === 'boq_done') matchStatus = hasBoq;
      return matchSearch && matchStatus;
    });
  }, [search, contracts, statusTab]);

  const summary = useMemo(() => {
    let waitingContract = 0;
    let waitingBoq = 0;
    let boqDone = 0;
    for (const c of contracts) {
      const approved = isContractApproved(c);
      const hasBoq = Boolean(c.has_boq) || c.boq_status === 'done';
      if (!approved) waitingContract++;
      if (approved && !hasBoq) waitingBoq++;
      if (hasBoq) boqDone++;
    }
    return { total: contracts.length, waitingContract, waitingBoq, boqDone };
  }, [contracts]);

  const handleNavigateBoq = (c) => {
    if (!isContractApproved(c) && role !== 'service_admin') return;
    router.push(`/service-admin/create-boq/${c.cust_code}/${c.project_id}/${c.roworder}`);
  };
  const handleNavigateSchedule = (c) => {
    router.push(`/service-admin/work-schedule/${encodeURIComponent(c.cust_code || c.project_id || "")}/${encodeURIComponent(c.contract_id || c.contract_no || "")}`);
  };

  const handleCloseConfirm = async () => {
    if (!pendingDoc) return;
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      await fetch(`/api/projects/close/${pendingDoc}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ..._getAuthHeaders() },
        body: JSON.stringify({ username: user.username }),
      });
      Swal.fire({ icon: 'success', title: 'ປິດໂຄງການສຳເລັດ', showConfirmButton: false, timer: 1500 });
      setCloseModalOpen(false);
      fetchData();
    } catch {
      Swal.fire('Error', 'ປິດໂຄງການບໍ່ສຳເລັດ', 'error');
    }
  };

  usePageHeader({
    title: "ສັນຍາກຳລັງດຳເນີນການ",
    subtitle: `${filtered.length} ສັນຍາ`,
    primaryAction: {
      label: "ໂຫຼດໃໝ່",
      icon: <RefreshCw size={13} className={loading ? "animate-spin" : ""} />,
      onClick: () => fetchData(),
      disabled: loading,
    },
    search: {
      value: search,
      onChange: setSearch,
      placeholder: "ຄົ້ນຫາສັນຍາ, ໂຄງການ, ຜູ້ປະສານ...",
    },
    filterChips: [
      {
        id: "waiting_contract",
        label: "ລໍຖ້າອະນຸມັດສັນຍາ",
        count: summary.waitingContract,
        active: statusTab === "waiting_contract",
        onClick: () => setStatusTab("waiting_contract"),
      },
      {
        id: "waiting_boq",
        label: "ລໍຖ້າອອກ BOQ",
        count: summary.waitingBoq,
        active: statusTab === "waiting_boq",
        onClick: () => setStatusTab("waiting_boq"),
      },
      {
        id: "boq_done",
        label: "ອອກ BOQ ແລ້ວ",
        count: summary.boqDone,
        active: statusTab === "boq_done",
        onClick: () => setStatusTab("boq_done"),
      },
    ],
  });

  const clearFilters = () => {
    setSearch('');
    setStatusTab('all');
  };

  return (
    <>
      <div className="bg-[var(--theme-page)] px-3 py-3 md:px-4">
        <div className="mx-auto max-w-[1480px]">
          <section className="space-y-3">
            {/* Slim summary bar — single row, dot + label + count */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-[var(--theme-border-subtle)] bg-white px-3 py-2 text-[12px]">
              <span className="inline-flex items-center gap-1.5">
                <span className="font-semibold tabular-nums text-[var(--theme-text)]">
                  {summary.total}
                </span>
                <span className="text-[var(--theme-text-mute)]">ສັນຍາທັງໝົດ</span>
              </span>
              <span className="hidden text-[var(--theme-border)] md:inline">|</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span className="font-semibold tabular-nums text-amber-700">
                  {summary.waitingContract}
                </span>
                <span className="text-[var(--theme-text-mute)]">ລໍຖ້າອະນຸມັດ</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                <span className="font-semibold tabular-nums text-orange-700">
                  {summary.waitingBoq}
                </span>
                <span className="text-[var(--theme-text-mute)]">ລໍຖ້າອອກ BOQ</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="font-semibold tabular-nums text-emerald-700">
                  {summary.boqDone}
                </span>
                <span className="text-[var(--theme-text-mute)]">BOQ ແລ້ວ</span>
              </span>
              <div className="ml-auto">
                <ViewSwitcher value={viewMode} onChange={setViewMode} />
              </div>
            </div>

            {loading ? (
              <div className="flex h-60 items-center justify-center rounded-lg border border-[var(--theme-border-subtle)] bg-white shadow-sm">
                <div className="flex items-center gap-3 text-[var(--theme-text-mute)]">
                  <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--theme-border-subtle)] border-t-[var(--theme-primary)]" />
                  <span className="text-sm">ກຳລັງໂຫຼດຂໍ້ມູນ...</span>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-lg border border-[var(--theme-border-subtle)] bg-white text-[var(--theme-text-mute)] shadow-sm">
                <Search className="h-8 w-8 opacity-40" />
                <div className="text-center">
                  <div className="text-sm font-semibold text-[var(--theme-text-soft)]">ບໍ່ພົບສັນຍາ</div>
                  <div className="mt-1 text-xs">ລອງປັບຄຳຄົ້ນ ຫຼື ຕົວກັ່ນຕອງ</div>
                </div>
                <button
                  onClick={clearFilters}
                  className="text-xs font-medium text-[var(--theme-primary)] hover:underline"
                >
                  ລ້າງຕົວກັ່ນຕອງ
                </button>
              </div>
            ) : viewMode === "kanban" ? (
              <div className="overflow-hidden rounded-lg border border-[var(--theme-border-subtle)] bg-white shadow-sm px-2 pt-3">
                <KanbanBoard<any>
                  columns={[
                    {
                      id: "waiting_contract",
                      title: "ລໍຖ້າອະນຸມັດສັນຍາ",
                      color: "#f59e0b",
                      records: filtered.filter((c) => !isContractApproved(c)),
                    },
                    {
                      id: "waiting_boq",
                      title: "ລໍຖ້າອອກ BOQ",
                      color: "#3b82f6",
                      records: filtered.filter(
                        (c) =>
                          isContractApproved(c) &&
                          !(Boolean(c.has_boq) || c.boq_status === "done"),
                      ),
                    },
                    {
                      id: "boq_done",
                      title: "ອອກ BOQ ແລ້ວ",
                      color: "#10b981",
                      records: filtered.filter(
                        (c) => Boolean(c.has_boq) || c.boq_status === "done",
                      ),
                    },
                  ]}
                  getCardId={(c: any) => rowKey(c)}
                  onCardClick={(c: any) => handleNavigateBoq(c)}
                  renderCard={(c: any) => {
                    const codes = String(c.contract_no || "")
                      .split(",")
                      .map((s: string) => s.trim())
                      .filter(Boolean);
                    const pjcCode =
                      codes.find((x: string) => /^PJC/i.test(x)) ||
                      codes.find((x: string) => !/^QT/i.test(x)) ||
                      codes[0] ||
                      "—";
                    return (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-mono text-[11px] font-semibold text-[var(--theme-primary)]">
                            {pjcCode}
                          </span>
                          <span className="flex-shrink-0 text-[10px] text-[var(--theme-text-mute)] tabular-nums">
                            {c.amount ? formatNumber(c.amount) : "-"}
                          </span>
                        </div>
                        <div className="truncate text-[12px] font-semibold text-[var(--theme-text)]">
                          {c.contract_name || "ບໍ່ລະບຸ"}
                        </div>
                        {c.project_name && (
                          <div className="truncate text-[10px] text-[var(--theme-text-mute)]">
                            {c.project_name}
                          </div>
                        )}
                        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[var(--theme-text-mute)]">
                          <span className="truncate">
                            {c.coordinator || ""}
                          </span>
                          <span className="tabular-nums">
                            {c.project_status || ""}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-[var(--theme-border-subtle)] bg-white shadow-sm">
                {/* Column header */}
                <div className="flex items-center gap-3 border-b border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text-mute)]">
                  <span className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="h-1.5 w-1.5 flex-shrink-0" />
                  <span className="w-[110px] flex-shrink-0">ສັນຍາໂຄງການ</span>
                  <span className="min-w-0 flex-1">ຊື່ສັນຍາ</span>
                  <span className="hidden min-w-0 max-w-[260px] truncate lg:inline">ໂຄງການ</span>
                  <span className="hidden w-[120px] flex-shrink-0 md:inline">ສະຖານະ</span>
                  <span className="w-[110px] flex-shrink-0 text-right">ມູນຄ່າ (₭)</span>
                  <span className="w-[120px] flex-shrink-0 text-right">ດຳເນີນການ</span>
                </div>
                <ul className="divide-y divide-[var(--theme-border-subtle)]">
                  {filtered.map((c) => {
                    const key = rowKey(c);
                    const isExpanded = key === selectedKey;
                    return (
                      <ContractTreeRow
                        key={key}
                        contract={c}
                        isExpanded={isExpanded}
                        onToggle={() => setSelectedKey(isExpanded ? null : key)}
                        role={role}
                        onBoq={handleNavigateBoq}
                        onSchedule={handleNavigateSchedule}
                        onCloseProject={(contract) => {
                          setPendingDoc(contract.project_id);
                          setCloseModalOpen(true);
                        }}
                      />
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        </div>

        {/* Close Project Modal */}
        <Modal
          isOpen={closeModalOpen}
          onRequestClose={() => setCloseModalOpen(false)}
          className="mx-auto mt-[25vh] w-full max-w-sm overflow-hidden rounded-lg border border-[var(--theme-border-subtle)] bg-white shadow-[var(--theme-shadow-lg)] outline-none"
          overlayClassName="fixed inset-0 z-50 flex justify-center bg-black/40 backdrop-blur-sm"
        >
          <div className="px-6 pt-6 pb-4 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-100">
              <AlertCircle size={20} />
            </div>
            <h3 className="text-base font-semibold text-[var(--theme-text)]">ປິດໂຄງການ?</h3>
            <p className="mt-1 text-[12px] text-[var(--theme-text-mute)]">
              ການກະທຳນີ້ບໍ່ສາມາດຍົກເລີກໄດ້ງ່າຍ
            </p>
          </div>
          <div className="flex gap-2 border-t border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] p-3">
            <button
              onClick={() => setCloseModalOpen(false)}
              className="flex-1 rounded-md border border-[var(--theme-border-subtle)] bg-white py-2 text-[12px] font-semibold text-[var(--theme-text-soft)] transition hover:bg-[var(--theme-bg-muted)]"
            >
              ຍົກເລີກ
            </button>
            <button
              onClick={handleCloseConfirm}
              className="flex-1 rounded-md bg-rose-600 py-2 text-[12px] font-semibold text-white transition hover:bg-rose-700"
            >
              ຢືນຢັນປິດ
            </button>
          </div>
        </Modal>
      </div>
    </>
  );
};

export default function Page() {
  return (
    <AuthGuard roles={["service_admin", "service_manager", "sale_manager", "sale_admin", "head_technician"]}>
      <BOQContractList />
    </AuthGuard>
  );
}
