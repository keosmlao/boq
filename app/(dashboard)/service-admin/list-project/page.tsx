"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  ExternalLink,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Search as SearchIcon,
  User,
  X,
} from "lucide-react";
import Swal from "sweetalert2";

import AuthGuard from "@/_components/AuthGuard";
import { usePageHeader } from "@/_components/PageHeader";
import ViewSwitcher, { type ViewMode } from "@/_components/odoo/ViewSwitcher";
import KanbanBoard from "@/_components/odoo/KanbanBoard";
import { getProjectsBoq } from "@/_actions/projects";

/* ─────────────────────────────────────────────────────────────────────────
   Types + helpers
   ───────────────────────────────────────────────────────────────────────── */

type Contract = {
  contract_no?: string;
  contract_name?: string;
  contract_id?: number | string;
  roworder?: number | string;
  project_id?: number | string;
  project_name?: string;
  project_status?: string;
  cust_code?: string;
  sml_code?: string;
  coordinator?: string;
  phone?: string;
  amount?: number | string;
  approve_status_1?: number | string | null;
  approve_status_2?: number | string | null;
  acc_approve?: number | string | null;
  has_boq?: boolean | number | null;
  boq_status?: string | null;
  village_name?: string;
  district_name?: string;
  province_name?: string;
  contract_created_at?: string;
};

type StatusTab = "all" | "waiting_contract" | "waiting_boq" | "boq_done";

const fmtMoney = (v: unknown) => Number(v || 0).toLocaleString("en-US");
const toNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const isApproved = (c: Contract) =>
  toNum(c.approve_status_1) === 1 &&
  Math.max(toNum(c.approve_status_2), toNum(c.acc_approve)) === 1;
const hasBoqDoc = (c: Contract) => Boolean(c.has_boq) || c.boq_status === "done";

const rowKey = (c: Contract) =>
  `${c.project_id || "-"}-${c.roworder ?? c.contract_id ?? c.contract_no ?? "-"}`;

const splitCodes = (raw?: string) => {
  const codes = String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const pjc =
    codes.find((c) => /^PJC/i.test(c)) ||
    codes.find((c) => !/^QT/i.test(c)) ||
    codes[0] ||
    "—";
  const qt = codes.find((c) => /^QT/i.test(c));
  return { pjc, qt };
};

const statusOf = (c: Contract) => {
  if (!isApproved(c)) {
    return {
      key: "waiting_contract" as const,
      label: "ລໍຖ້າອະນຸມັດສັນຍາ",
      dot: "bg-[var(--warning)]",
      text: "text-[var(--warning)]",
      soft: "bg-[var(--warning-soft)]",
    };
  }
  if (!hasBoqDoc(c)) {
    return {
      key: "waiting_boq" as const,
      label: "ລໍຖ້າອອກ BOQ",
      dot: "bg-[var(--info)]",
      text: "text-[var(--info)]",
      soft: "bg-[var(--info-soft)]",
    };
  }
  return {
    key: "boq_done" as const,
    label: "ອອກ BOQ ແລ້ວ",
    dot: "bg-[var(--success)]",
    text: "text-[var(--success)]",
    soft: "bg-[var(--success-soft)]",
  };
};

/* ─────────────────────────────────────────────────────────────────────────
   Skeleton (shown during initial fetch)
   ───────────────────────────────────────────────────────────────────────── */

function ListSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center gap-3 border-b border-[var(--border-soft)] bg-[var(--surface-sunken)] px-4 py-2.5">
        {[110, 200, 120, 80, 80].map((w, i) => (
          <div key={i} className="h-3 animate-pulse rounded bg-[var(--bg-subtle)]" style={{ width: w }} />
        ))}
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-[var(--border-soft)] px-4 py-3 last:border-0">
          <div className="h-3 w-[110px] animate-pulse rounded bg-[var(--bg-subtle)]" />
          <div className="h-3 w-[220px] animate-pulse rounded bg-[var(--bg-subtle)]" />
          <div className="h-3 w-[140px] animate-pulse rounded bg-[var(--bg-subtle)]" />
          <div className="ml-auto h-3 w-[80px] animate-pulse rounded bg-[var(--bg-subtle)]" />
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Workflow milestone (used inside side panel)
   ───────────────────────────────────────────────────────────────────────── */

function Milestone({
  done,
  label,
  status,
  action,
  hasNext = true,
}: {
  done: boolean;
  label: string;
  status?: React.ReactNode;
  action?: React.ReactNode;
  hasNext?: boolean;
}) {
  return (
    <div className="relative">
      {hasNext && (
        <span
          className={[
            "absolute left-[7px] top-5 bottom-0 w-px",
            done ? "bg-[var(--brand)]" : "bg-[var(--border)]",
          ].join(" ")}
        />
      )}
      <div className="flex items-center gap-3 py-1.5">
        <span
          className={[
            "relative z-10 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full",
            done
              ? "bg-[var(--brand)] text-white"
              : "border border-[var(--border-strong)] bg-[var(--surface)]",
          ].join(" ")}
        >
          {done && (
            <svg viewBox="0 0 8 8" className="h-2 w-2" fill="none">
              <path
                d="M1.5 4l1.7 1.7L6.5 2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
        <span className="text-[12.5px] font-medium text-[var(--text)]">{label}</span>
        {status && (
          <span className="text-[11.5px] text-[var(--text-soft)]">{status}</span>
        )}
        {action && <span className="ml-auto">{action}</span>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Side panel
   ───────────────────────────────────────────────────────────────────────── */

function SidePanel({
  contract,
  onClose,
  role,
  onBoq,
  onSchedule,
  onCloseProject,
}: {
  contract: Contract | null;
  onClose: () => void;
  role: string;
  onBoq: (c: Contract) => void;
  onSchedule: (c: Contract) => void;
  onCloseProject: (c: Contract) => void;
}) {
  if (!contract) return null;
  const approved = isApproved(contract);
  const hasBoq = hasBoqDoc(contract);
  const canEditBoq = role === "service_admin" && approved;
  const canClose = contract.project_status === "ສາມາດເບີກຂອງໃດ້";
  const { pjc, qt } = splitCodes(contract.contract_no);
  const status = statusOf(contract);
  const loc = [contract.village_name, contract.district_name, contract.province_name]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="fixed inset-0 z-[80]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 animate-fade-in" />
      <aside
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 flex h-full w-full max-w-[480px] flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)]"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-[12px] font-semibold text-[var(--brand)]">
                {pjc}
              </span>
              <span
                className={[
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                  status.soft,
                  status.text,
                ].join(" ")}
              >
                <span className={["h-1.5 w-1.5 rounded-full", status.dot].join(" ")} />
                {status.label}
              </span>
            </div>
            <h2 className="mt-1 truncate text-[15px] font-semibold text-[var(--text)]">
              {contract.contract_name || "ບໍ່ລະບຸ"}
            </h2>
            <div className="mt-1 text-[12px] text-[var(--text-soft)] truncate">
              {contract.project_name || "-"}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="ປິດ"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-mute)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="theme-scrollbar flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Project info */}
          <section>
            <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-mute)]">
              ໂຄງການ
            </h3>
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-soft)] p-3 space-y-1.5 text-[12.5px]">
              <div className="flex items-center gap-2 text-[var(--text)]">
                <Building2 size={13} className="flex-shrink-0 text-[var(--text-mute)]" />
                <span className="font-medium truncate">{contract.project_name || "-"}</span>
                <span className="ml-auto font-mono text-[10.5px] text-[var(--text-mute)]">
                  #{contract.sml_code || contract.project_id}
                </span>
              </div>
              {loc && (
                <div className="flex items-center gap-2 text-[var(--text-soft)]">
                  <MapPin size={12} className="flex-shrink-0 text-[var(--text-mute)]" />
                  <span className="truncate">{loc}</span>
                </div>
              )}
              {contract.coordinator && (
                <div className="flex items-center gap-2 text-[var(--text-soft)]">
                  <User size={12} className="flex-shrink-0 text-[var(--text-mute)]" />
                  <span className="truncate">{contract.coordinator}</span>
                </div>
              )}
              {contract.phone && (
                <div className="flex items-center gap-2 text-[var(--text-soft)]">
                  <Phone size={12} className="flex-shrink-0 text-[var(--text-mute)]" />
                  <span className="truncate">{contract.phone}</span>
                </div>
              )}
              {qt && (
                <div className="flex items-center gap-2 text-[var(--text-soft)]">
                  <ExternalLink size={12} className="flex-shrink-0 text-[var(--text-mute)]" />
                  <span className="truncate">
                    ມາຈາກ <span className="font-mono">{qt}</span>
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Amount */}
          <section>
            <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-mute)]">
              ມູນຄ່າສັນຍາ
            </h3>
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <div className="font-mono text-[22px] font-bold tracking-tight text-[var(--text)]">
                {contract.amount ? fmtMoney(contract.amount) : "0"}{" "}
                <span className="text-[12px] font-medium text-[var(--text-mute)]">₭</span>
              </div>
            </div>
          </section>

          {/* Workflow */}
          <section>
            <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-mute)]">
              ຂັ້ນຕອນວຽກ
            </h3>
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3">
              <Milestone
                done={approved}
                label="ສັນຍາ"
                status={approved ? "ອະນຸມັດແລ້ວ" : "ລໍຖ້າອະນຸມັດ"}
              />
              <Milestone
                done={hasBoq}
                label="BOQ"
                status={hasBoq ? "ອອກແລ້ວ" : "ຍັງບໍ່ມີ"}
                action={
                  (canEditBoq || hasBoq) && (
                    <button
                      onClick={() => onBoq(contract)}
                      className={[
                        "inline-flex h-7 items-center gap-1 rounded-[var(--radius-sm)] px-2.5 text-[11px] font-medium transition-colors",
                        hasBoq
                          ? "text-[var(--info)] hover:bg-[var(--info-soft)]"
                          : "bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)]",
                      ].join(" ")}
                    >
                      <Package size={11} />
                      {hasBoq ? "ແກ້" : "ສ້າງ"}
                    </button>
                  )
                }
              />
              <Milestone
                done={false}
                label="ແຜນວຽກ"
                status="ຈັດແຜນຊ່າງ"
                action={
                  <button
                    onClick={() => onSchedule(contract)}
                    className="inline-flex h-7 items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[11px] font-medium text-[var(--text)] hover:bg-[var(--bg-subtle)] transition-colors"
                  >
                    <CalendarClock size={11} />
                    ເປີດ
                  </button>
                }
              />
              <Milestone
                done={false}
                hasNext={false}
                label="ປິດໂຄງການ"
                status={canClose ? "ພ້ອມປິດ" : "ບໍ່ພ້ອມ"}
                action={
                  canClose && (
                    <button
                      onClick={() => onCloseProject(contract)}
                      className="inline-flex h-7 items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--danger)] bg-[var(--danger-soft)] px-2.5 text-[11px] font-medium text-[var(--danger)] hover:opacity-90 transition-opacity"
                    >
                      <X size={11} />
                      ປິດ
                    </button>
                  )
                }
              />
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-[var(--border)] bg-[var(--surface-soft)] px-5 py-3">
          <button
            onClick={() => onSchedule(contract)}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-[12.5px] font-medium text-[var(--text)] hover:bg-[var(--bg-subtle)] transition-colors"
          >
            <CalendarClock size={13} />
            ແຜນວຽກ
          </button>
          <button
            onClick={() => onBoq(contract)}
            disabled={!canEditBoq && !hasBoq}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--brand)] text-[12.5px] font-medium text-white hover:bg-[var(--brand-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Package size={13} />
            {hasBoq ? "ແກ້ BOQ" : "ສ້າງ BOQ"}
          </button>
        </div>
      </aside>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Close confirmation
   ───────────────────────────────────────────────────────────────────────── */

function CloseDialog({
  open,
  onCancel,
  onConfirm,
  loading,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative w-full max-w-sm overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)]">
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--danger-soft)] text-[var(--danger)]">
            <AlertCircle size={20} />
          </div>
          <h3 className="text-[15px] font-semibold text-[var(--text)]">ປິດໂຄງການ?</h3>
          <p className="mt-1 text-[12px] text-[var(--text-soft)]">
            ການກະທຳນີ້ບໍ່ສາມາດຍົກເລີກໄດ້ງ່າຍ
          </p>
        </div>
        <div className="flex gap-2 border-t border-[var(--border)] bg-[var(--surface-soft)] p-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] py-2 text-[12.5px] font-medium text-[var(--text)] hover:bg-[var(--bg-subtle)] disabled:opacity-60 transition-colors"
          >
            ຍົກເລີກ
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-[var(--radius-sm)] bg-[var(--danger)] py-2 text-[12.5px] font-medium text-white hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {loading ? "ກຳລັງປິດ..." : "ຢືນຢັນປິດ"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Main page
   ───────────────────────────────────────────────────────────────────────── */

function ContractListPage() {
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [role, setRole] = useState("");
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selected, setSelected] = useState<Contract | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeTarget, setCloseTarget] = useState<Contract | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    try {
      const u = localStorage.getItem("user");
      if (u) setRole(JSON.parse(u).role || "");
    } catch {
      // ignore
    }
    try {
      const v = localStorage.getItem("service-project-view");
      if (v === "list" || v === "kanban") setViewMode(v);
    } catch {
      // ignore
    }
    void fetchData();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("service-project-view", viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getProjectsBoq({ contracts: true });
      setContracts((res as any)?.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const summary = useMemo(() => {
    let waitingContract = 0;
    let waitingBoq = 0;
    let boqDone = 0;
    for (const c of contracts) {
      const s = statusOf(c);
      if (s.key === "waiting_contract") waitingContract++;
      else if (s.key === "waiting_boq") waitingBoq++;
      else boqDone++;
    }
    return { total: contracts.length, waitingContract, waitingBoq, boqDone };
  }, [contracts]);

  const filtered = useMemo(() => {
    const kw = debounced.trim().toLowerCase();
    return contracts.filter((c) => {
      if (statusTab !== "all" && statusOf(c).key !== statusTab) return false;
      if (!kw) return true;
      return (
        c.contract_name?.toLowerCase().includes(kw) ||
        c.contract_no?.toLowerCase().includes(kw) ||
        c.project_name?.toLowerCase().includes(kw) ||
        c.coordinator?.toLowerCase().includes(kw)
      );
    });
  }, [contracts, debounced, statusTab]);

  const handleBoq = (c: Contract) => {
    if (!isApproved(c) && role !== "service_admin") return;
    router.push(
      `/service-admin/create-boq/${encodeURIComponent(String(c.cust_code || ""))}/${encodeURIComponent(String(c.project_id || ""))}/${encodeURIComponent(String(c.roworder || c.contract_id || c.contract_no || ""))}`,
    );
  };

  const handleSchedule = (c: Contract) => {
    router.push(
      `/service-admin/work-schedule/${encodeURIComponent(String(c.cust_code || c.project_id || ""))}/${encodeURIComponent(String(c.contract_id || c.contract_no || ""))}`,
    );
  };

  const handleAskClose = (c: Contract) => {
    setCloseTarget(c);
    setCloseOpen(true);
  };

  const handleConfirmClose = async () => {
    if (!closeTarget) return;
    setClosing(true);
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const res = await fetch(
        `/api/projects/close/${encodeURIComponent(String(closeTarget.project_id))}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: user.username }),
        },
      );
      if (!res.ok) throw new Error();
      Swal.fire({ icon: "success", title: "ປິດໂຄງການສຳເລັດ", timer: 1500, showConfirmButton: false });
      setCloseOpen(false);
      setCloseTarget(null);
      void fetchData();
    } catch {
      Swal.fire("Error", "ປິດໂຄງການບໍ່ສຳເລັດ", "error");
    } finally {
      setClosing(false);
    }
  };

  usePageHeader({
    title: "ສັນຍາໂຄງການ",
    subtitle: `${filtered.length} / ${contracts.length} ສັນຍາ`,
    primaryAction: {
      label: "ໂຫລດໃໝ່",
      icon: <RefreshCw size={13} className={loading ? "animate-spin" : ""} />,
      onClick: () => void fetchData(),
      disabled: loading,
    },
    search: {
      value: search,
      onChange: setSearch,
      placeholder: "ຄົ້ນຫາສັນຍາ, ໂຄງການ, ຜູ້ປະສານ...",
    },
    filterChips: [
      {
        id: "all",
        label: "ທັງໝົດ",
        count: summary.total,
        active: statusTab === "all",
        onClick: () => setStatusTab("all"),
      },
      {
        id: "waiting_contract",
        label: "ລໍຖ້າອະນຸມັດ",
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
        label: "BOQ ແລ້ວ",
        count: summary.boqDone,
        active: statusTab === "boq_done",
        onClick: () => setStatusTab("boq_done"),
      },
    ],
  });

  return (
    <div className="space-y-4">
      {/* Stats + view toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4 min-w-0">
          {[
            { label: "ທັງໝົດ", value: summary.total, dot: "bg-[var(--text-mute)]" },
            { label: "ລໍຖ້າອະນຸມັດ", value: summary.waitingContract, dot: "bg-[var(--warning)]" },
            { label: "ລໍຖ້າ BOQ", value: summary.waitingBoq, dot: "bg-[var(--info)]" },
            { label: "BOQ ແລ້ວ", value: summary.boqDone, dot: "bg-[var(--success)]" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"
            >
              <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-[var(--text-mute)]">
                <span className={["h-1.5 w-1.5 rounded-full", s.dot].join(" ")} />
                <span className="truncate">{s.label}</span>
              </div>
              <div className="mt-1 font-mono text-[20px] font-bold tabular-nums tracking-tight text-[var(--text)]">
                {s.value}
              </div>
            </div>
          ))}
        </div>
        <div className="flex-shrink-0">
          <ViewSwitcher value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <ListSkeleton />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] px-6 py-14 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--text-mute)]">
            <SearchIcon size={20} />
          </div>
          <div>
            <div className="text-[14px] font-semibold text-[var(--text)]">ບໍ່ພົບສັນຍາ</div>
            <div className="mt-1 text-[12px] text-[var(--text-soft)]">ລອງປັບຄຳຄົ້ນ ຫຼື ຕົວກັ່ນຕອງ</div>
          </div>
          {(search || statusTab !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setStatusTab("all");
              }}
              className="text-[12px] font-medium text-[var(--brand)] hover:underline"
            >
              ລ້າງຕົວກັ່ນຕອງ
            </button>
          )}
        </div>
      ) : viewMode === "kanban" ? (
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 pt-3">
          <KanbanBoard<Contract>
            columns={[
              {
                id: "waiting_contract",
                title: "ລໍຖ້າອະນຸມັດສັນຍາ",
                color: "var(--warning)",
                records: filtered.filter((c) => statusOf(c).key === "waiting_contract"),
              },
              {
                id: "waiting_boq",
                title: "ລໍຖ້າອອກ BOQ",
                color: "var(--info)",
                records: filtered.filter((c) => statusOf(c).key === "waiting_boq"),
              },
              {
                id: "boq_done",
                title: "ອອກ BOQ ແລ້ວ",
                color: "var(--success)",
                records: filtered.filter((c) => statusOf(c).key === "boq_done"),
              },
            ]}
            getCardId={(c) => rowKey(c)}
            onCardClick={(c) => setSelected(c)}
            renderCard={(c) => {
              const { pjc } = splitCodes(c.contract_no);
              return (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[11px] font-semibold text-[var(--brand)]">
                      {pjc}
                    </span>
                    <span className="flex-shrink-0 font-mono text-[10.5px] text-[var(--text-mute)] tabular-nums">
                      {c.amount ? fmtMoney(c.amount) : "-"}
                    </span>
                  </div>
                  <div className="truncate text-[12.5px] font-semibold text-[var(--text)]">
                    {c.contract_name || "ບໍ່ລະບຸ"}
                  </div>
                  {c.project_name && (
                    <div className="truncate text-[10.5px] text-[var(--text-mute)]">
                      {c.project_name}
                    </div>
                  )}
                </div>
              );
            }}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[1.5rem_7rem_minmax(0,1fr)_minmax(0,1fr)_8rem_8rem_3rem] items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-sunken)] px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--text-soft)]">
            <span />
            <span>ສັນຍາ</span>
            <span>ຊື່ສັນຍາ</span>
            <span>ໂຄງການ</span>
            <span>ສະຖານະ</span>
            <span className="text-right">ມູນຄ່າ (₭)</span>
            <span />
          </div>

          {/* Rows */}
          <ul className="divide-y divide-[var(--border-soft)]">
            {filtered.map((c) => {
              const key = rowKey(c);
              const s = statusOf(c);
              const { pjc } = splitCodes(c.contract_no);
              const isSelected = selected && rowKey(selected) === key;
              return (
                <li
                  key={key}
                  onClick={() => setSelected(c)}
                  className={[
                    "group cursor-pointer transition-colors",
                    isSelected
                      ? "bg-[var(--brand-soft)]"
                      : "hover:bg-[var(--bg-subtle)]",
                  ].join(" ")}
                >
                  {/* Desktop row */}
                  <div className="hidden md:grid grid-cols-[1.5rem_7rem_minmax(0,1fr)_minmax(0,1fr)_8rem_8rem_3rem] items-center gap-3 px-4 py-3">
                    <span className={["h-1.5 w-1.5 rounded-full", s.dot].join(" ")} />
                    <span className="truncate font-mono text-[12.5px] font-semibold text-[var(--brand)]">
                      {pjc}
                    </span>
                    <span className="truncate text-[13px] text-[var(--text)]">
                      {c.contract_name || "ບໍ່ລະບຸ"}
                    </span>
                    <span className="truncate text-[12px] text-[var(--text-soft)]">
                      {c.project_name || "-"}
                    </span>
                    <span className={["truncate text-[12px] font-medium", s.text].join(" ")}>
                      {s.label}
                    </span>
                    <span className="truncate text-right font-mono text-[12.5px] tabular-nums text-[var(--text)]">
                      {c.amount ? fmtMoney(c.amount) : "-"}
                    </span>
                    <ChevronRight
                      size={14}
                      className="ml-auto text-[var(--text-mute)] group-hover:text-[var(--text)]"
                    />
                  </div>

                  {/* Mobile row */}
                  <div className="md:hidden px-4 py-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className={["h-1.5 w-1.5 rounded-full", s.dot].join(" ")} />
                      <span className="font-mono text-[12px] font-semibold text-[var(--brand)]">
                        {pjc}
                      </span>
                      <span className={["ml-auto text-[10.5px] font-medium", s.text].join(" ")}>
                        {s.label}
                      </span>
                    </div>
                    <div className="text-[13px] font-medium text-[var(--text)] truncate">
                      {c.contract_name || "ບໍ່ລະບຸ"}
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11.5px] text-[var(--text-soft)]">
                      <span className="truncate">{c.project_name || "-"}</span>
                      <span className="font-mono tabular-nums flex-shrink-0">
                        {c.amount ? fmtMoney(c.amount) : "-"} ₭
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Side panel */}
      <SidePanel
        contract={selected}
        onClose={() => setSelected(null)}
        role={role}
        onBoq={handleBoq}
        onSchedule={handleSchedule}
        onCloseProject={handleAskClose}
      />

      {/* Close confirm */}
      <CloseDialog
        open={closeOpen}
        onCancel={() => {
          setCloseOpen(false);
          setCloseTarget(null);
        }}
        onConfirm={handleConfirmClose}
        loading={closing}
      />
    </div>
  );
}

export default function Page() {
  return (
    <AuthGuard
      roles={["service_admin", "service_manager", "sale_manager", "sale_admin", "head_technician"]}
    >
      <ContractListPage />
    </AuthGuard>
  );
}
