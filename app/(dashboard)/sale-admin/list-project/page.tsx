"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  FileText,
  MapPin,
  Package,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search as SearchIcon,
  Trash2,
  User,
  X,
  Briefcase,
  ClipboardCheck,
} from "lucide-react";

import AuthGuard from "@/_components/AuthGuard";
import { usePageHeader } from "@/_components/PageHeader";
import ViewSwitcher, { type ViewMode } from "@/_components/odoo/ViewSwitcher";
import KanbanBoard, { type KanbanColumn } from "@/_components/odoo/KanbanBoard";
import {
  deleteProjectAction,
  getProject,
  getProjects,
  updateProjectAction,
} from "@/_actions/projects";
import { getQuotations } from "@/_actions/quotations";

/* ─────────────────────────────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────────────────────────────── */

type StatusId =
  | "ລົງທະບຽນໂຄງການ"
  | "ສຳຫຼວດ ແລະ ອອກແບບ"
  | "ສະເໜີລາຄາ"
  | "ເຊັນສັນຍາ"
  | "ດຳເນີນສັນຍາ"
  | "ກຳລັງເບີກວັດສະດຸ"
  | "ສຳເລັດ";

type ContractItem = {
  id?: number | string;
  cust_code?: string;
  quotation_id?: number | string | null;
  contract_name?: string;
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
  project_type?: string;
  bussiness_type?: string;
  sml_code?: string;
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
  quotation_count?: number | string | null;
  approved_quotation_count?: number | string | null;
  request_count?: number | string | null;
  __q?: string;
  [key: string]: unknown;
};

type QuotationItem = {
  id?: number | string;
  quotation_no?: string;
  project_name?: string;
  status?: string;
  total_amount?: number | string;
  quotation_date?: string;
};

/* ─────────────────────────────────────────────────────────────────────────
   Status + helpers
   ───────────────────────────────────────────────────────────────────────── */

const STATUSES: ReadonlyArray<{ id: StatusId; short: string; tone: string; chip: string }> = [
  { id: "ລົງທະບຽນໂຄງການ", short: "ລົງທະບຽນ", tone: "var(--text-mute)", chip: "bg-[var(--bg-subtle)] text-[var(--text-soft)]" },
  { id: "ສຳຫຼວດ ແລະ ອອກແບບ", short: "ສຳຫຼວດ", tone: "var(--info)", chip: "bg-[var(--info-soft)] text-[var(--info)]" },
  { id: "ສະເໜີລາຄາ", short: "ສະເໜີລາຄາ", tone: "var(--warning)", chip: "bg-[var(--warning-soft)] text-[var(--warning)]" },
  { id: "ເຊັນສັນຍາ", short: "ເຊັນສັນຍາ", tone: "var(--brand)", chip: "bg-[var(--brand-soft)] text-[var(--brand)]" },
  { id: "ດຳເນີນສັນຍາ", short: "ດຳເນີນສັນຍາ", tone: "var(--success)", chip: "bg-[var(--success-soft)] text-[var(--success)]" },
  { id: "ກຳລັງເບີກວັດສະດຸ", short: "ກຳລັງເບີກ", tone: "#0891b2", chip: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-400" },
  { id: "ສຳເລັດ", short: "ສຳເລັດ", tone: "var(--text-mute)", chip: "bg-[var(--bg-subtle)] text-[var(--text-soft)]" },
];

const MIGRATION: Record<string, StatusId> = {
  ລໍຖ້າດຳເນີນ: "ລົງທະບຽນໂຄງການ",
  ຂັ້ນຕອນອອກແບບ: "ສຳຫຼວດ ແລະ ອອກແບບ",
  ຂັ້ນຕອນສະເໜີຂາຍ: "ສະເໜີລາຄາ",
  ຂັ້ນຕອນການເຮັດສັນຍາ: "ເຊັນສັນຍາ",
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

const toNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const lower = (v: unknown) => String(v ?? "").toLowerCase();
const isAccApproved = (a2: unknown, acc?: unknown) =>
  Math.max(toNum(a2), toNum(acc)) === 1;

const normalizeStatus = (v?: string | null): StatusId => {
  if (!v) return STATUSES[0].id;
  if (STATUSES.some((s) => s.id === v)) return v as StatusId;
  return MIGRATION[v] || STATUSES[0].id;
};

const resolveStatus = (p?: ProjectItem | null): StatusId => {
  const base = normalizeStatus(p?.project_status);
  if (!p || base === "ສຳເລັດ") return base;
  if (toNum(p.request_count) > 0) return "ກຳລັງເບີກວັດສະດຸ";
  if (toNum(p.boq_contract_count) > 0) return "ດຳເນີນສັນຍາ";
  if (toNum(p.contract_count) > 0) return "ເຊັນສັນຍາ";
  if (Array.isArray(p.contractlist) && p.contractlist.length > 0) {
    const hasBoq = p.contractlist.some((c) => Boolean(c.has_boq) || c.boq_status === "done");
    return hasBoq ? "ດຳເນີນສັນຍາ" : "ເຊັນສັນຍາ";
  }
  if (toNum(p.approved_quotation_count) > 0) return "ເຊັນສັນຍາ";
  if (toNum(p.quotation_count) > 0) return "ສະເໜີລາຄາ";
  return base;
};

const meta = (id: StatusId) => STATUSES.find((s) => s.id === id) || STATUSES[0];

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

const code = (p?: ProjectItem | null) => p?.project_code || `PRJ-${p?.id || "-"}`;
const loc = (p?: ProjectItem | null) =>
  [p?.village_name, p?.district_name, p?.province_name].filter(Boolean).join(", ") || "-";
const imgOf = (p?: ProjectItem | null) => p?.image_gallery?.[0] || p?.image_url || "";

const relationCounts = (p: ProjectItem, quotations?: QuotationItem[]) => {
  const qCount = quotations ? quotations.length : toNum(p.quotation_count);
  const cCount =
    Array.isArray(p.contractlist) && p.contractlist.length > 0
      ? p.contractlist.length
      : toNum(p.contract_count);
  const boqCount = Math.max(
    toNum(p.boq_count),
    toNum(p.boq_contract_count),
    Array.isArray(p.contractlist)
      ? p.contractlist.filter((c) => Boolean(c.has_boq) || c.boq_status === "done").length
      : 0,
  );
  const reqCount = Math.max(
    toNum(p.request_count),
    Array.isArray(p.contractlist)
      ? p.contractlist.reduce((sum, c) => sum + toNum(c.request_count), 0)
      : 0,
  );
  return { quotations: qCount, contracts: cCount, boqs: boqCount, requests: reqCount };
};

/* ─────────────────────────────────────────────────────────────────────────
   Stage progress (7 dots)
   ───────────────────────────────────────────────────────────────────────── */

function StageProgress({ project }: { project: ProjectItem }) {
  const current = resolveStatus(project);
  const idx = STATUSES.findIndex((s) => s.id === current);
  return (
    <div className="flex items-center gap-1" title={meta(current).short}>
      {STATUSES.map((s, i) => {
        const isPast = i < idx;
        const isCurrent = i === idx;
        return (
          <span
            key={s.id}
            className={[
              "h-1.5 rounded-full transition-colors",
              isCurrent ? "w-4" : "w-1.5",
            ].join(" ")}
            style={{
              backgroundColor: isPast || isCurrent ? s.tone : "var(--border-strong)",
            }}
          />
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Skeleton
   ───────────────────────────────────────────────────────────────────────── */

function ListSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="hidden md:flex items-center gap-3 border-b border-[var(--border-soft)] bg-[var(--surface-sunken)] px-4 py-2.5">
        {[110, 200, 140, 100, 80].map((w, i) => (
          <div key={i} className="h-3 animate-pulse rounded bg-[var(--bg-subtle)]" style={{ width: w }} />
        ))}
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-[var(--border-soft)] px-4 py-3 last:border-0">
          <div className="h-9 w-9 flex-shrink-0 animate-pulse rounded-[var(--radius-sm)] bg-[var(--bg-subtle)]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-1/3 animate-pulse rounded bg-[var(--bg-subtle)]" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-[var(--bg-subtle)]" />
          </div>
          <div className="hidden md:block h-3 w-24 animate-pulse rounded bg-[var(--bg-subtle)]" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-[var(--bg-subtle)]" />
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Workflow tree (inside side panel)
   ───────────────────────────────────────────────────────────────────────── */

function WorkflowSection({
  title,
  count,
  onAdd,
  children,
}: {
  title: string;
  count: number;
  onAdd?: () => void;
  children?: React.ReactNode;
}) {
  const done = count > 0;
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2">
        <span
          className={[
            "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full",
            done
              ? "bg-[var(--brand)] text-white"
              : "border border-[var(--border-strong)] bg-[var(--surface)]",
          ].join(" ")}
        >
          {done && <CheckCircle2 size={10} />}
        </span>
        <span className="text-[12.5px] font-semibold text-[var(--text)]">{title}</span>
        <span className="text-[11px] text-[var(--text-mute)]">
          {count > 0 ? `(${count})` : "ຍັງບໍ່ມີ"}
        </span>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="ml-auto inline-flex h-6 items-center gap-1 rounded-[var(--radius-sm)] px-2 text-[11px] font-medium text-[var(--brand)] hover:bg-[var(--brand-soft)] transition-colors"
          >
            <Plus size={11} />
            ສ້າງ
          </button>
        )}
      </div>
      {children && <div className="divide-y divide-[var(--border-soft)]">{children}</div>}
    </div>
  );
}

function WorkflowItem({
  label,
  code: codeText,
  meta: metaText,
  onClick,
  trailing,
}: {
  label: string;
  code?: string;
  meta?: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      className={[
        "flex items-center gap-2.5 px-3 py-2 text-[12.5px]",
        onClick && "cursor-pointer hover:bg-[var(--bg-subtle)] transition-colors",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
    >
      {codeText && (
        <span className="font-mono text-[11.5px] font-semibold text-[var(--brand)] flex-shrink-0">
          {codeText}
        </span>
      )}
      <span className="truncate text-[var(--text)]">{label}</span>
      {metaText && (
        <span className="ml-auto text-[11px] text-[var(--text-mute)] truncate">{metaText}</span>
      )}
      {trailing}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Side panel
   ───────────────────────────────────────────────────────────────────────── */

function SidePanel({
  project,
  quotations,
  loading,
  onClose,
  onEdit,
  onDelete,
  onCreateQuotation,
  onCreateContract,
  onCreateBoq,
  onOpenQuotation,
  onOpenBoq,
}: {
  project: ProjectItem | null;
  quotations: QuotationItem[];
  loading: boolean;
  onClose: () => void;
  onEdit: (p: ProjectItem) => void;
  onDelete: (id: ProjectItem["id"]) => void;
  onCreateQuotation: (p: ProjectItem) => void;
  onCreateContract: (p: ProjectItem) => void;
  onCreateBoq: (p: ProjectItem, c: ContractItem) => void;
  onOpenQuotation: (q: QuotationItem) => void;
  onOpenBoq: (docNo: string) => void;
}) {
  if (!project) return null;
  const status = meta(resolveStatus(project));
  const counts = relationCounts(project, quotations);
  const contracts = Array.isArray(project.contractlist) ? project.contractlist : [];
  const allBoqs = contracts.flatMap((c) =>
    Array.isArray(c.boq_list) ? c.boq_list.map((b) => ({ ...b, contract: c })) : [],
  );

  return (
    <div className="fixed inset-0 z-[80]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 animate-fade-in" />
      <aside
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 flex h-full w-full max-w-[520px] flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)]"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-[11.5px] font-semibold text-[var(--brand)]">
                {code(project)}
              </span>
              <span
                className={[
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                  status.chip,
                ].join(" ")}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.tone }} />
                {status.short}
              </span>
            </div>
            <h2 className="mt-1 truncate text-[16px] font-semibold text-[var(--text)]">
              {project.project_name || "-"}
            </h2>
            {project.current_status_elapsed_label && (
              <div className="mt-1 text-[11.5px] text-[var(--text-mute)]">
                ໃນສະຖານະນີ້ {project.current_status_elapsed_label}
                {project.project_elapsed_label && ` · ລວມ ${project.project_elapsed_label}`}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="ປິດ"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-mute)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Stage progress */}
        <div className="border-b border-[var(--border)] bg-[var(--surface-soft)] px-5 py-3">
          <StageProgress project={project} />
        </div>

        {/* Body */}
        <div className="theme-scrollbar flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Project info */}
          <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-soft)] p-3 space-y-1.5 text-[12.5px]">
            <div className="flex items-center gap-2 text-[var(--text-soft)]">
              <MapPin size={13} className="flex-shrink-0 text-[var(--text-mute)]" />
              <span className="truncate">{loc(project)}</span>
            </div>
            {project.customer_name && (
              <div className="flex items-center gap-2 text-[var(--text-soft)]">
                <User size={12} className="flex-shrink-0 text-[var(--text-mute)]" />
                <span className="truncate">{project.customer_name}</span>
              </div>
            )}
            {project.coordinator && (
              <div className="flex items-center gap-2 text-[var(--text-soft)]">
                <User size={12} className="flex-shrink-0 text-[var(--text-mute)]" />
                <span className="truncate">{project.coordinator}</span>
              </div>
            )}
            {project.phone && (
              <div className="flex items-center gap-2 text-[var(--text-soft)]">
                <Phone size={12} className="flex-shrink-0 text-[var(--text-mute)]" />
                <span className="truncate">{project.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-[var(--text-mute)] text-[11.5px]">
              ລົງທະບຽນ {fmtDate(project.date_register)}
            </div>
          </section>

          {/* Quick counts */}
          <section className="grid grid-cols-4 gap-2">
            {[
              { label: "Quote", n: counts.quotations, icon: FileText },
              { label: "Contract", n: counts.contracts, icon: Briefcase },
              { label: "BOQ", n: counts.boqs, icon: ClipboardCheck },
              { label: "Req", n: counts.requests, icon: Package },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-center"
              >
                <s.icon size={12} className="mx-auto text-[var(--text-mute)]" />
                <div className="mt-1 font-mono text-[14px] font-bold tabular-nums text-[var(--text)]">
                  {s.n}
                </div>
                <div className="text-[9.5px] uppercase tracking-wider text-[var(--text-mute)]">
                  {s.label}
                </div>
              </div>
            ))}
          </section>

          {/* Workflow */}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-subtle)]"
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <WorkflowSection
                title="ໃບສະເໜີລາຄາ"
                count={quotations.length}
                onAdd={() => onCreateQuotation(project)}
              >
                {quotations.length > 0 &&
                  quotations.map((q) => {
                    const approved = q.status === "ອະນຸມັດແລ້ວ";
                    return (
                      <WorkflowItem
                        key={q.id}
                        code={q.quotation_no}
                        label={approved ? "ອະນຸມັດແລ້ວ" : q.status || "ລໍຖ້າອະນຸມັດ"}
                        meta={q.total_amount ? Number(q.total_amount).toLocaleString() : undefined}
                        onClick={() => onOpenQuotation(q)}
                        trailing={
                          <span
                            className={[
                              "h-1.5 w-1.5 rounded-full",
                              approved ? "bg-[var(--success)]" : "bg-[var(--warning)]",
                            ].join(" ")}
                          />
                        }
                      />
                    );
                  })}
              </WorkflowSection>

              <WorkflowSection
                title="ສັນຍາ"
                count={contracts.length}
                onAdd={() => onCreateContract(project)}
              >
                {contracts.length > 0 &&
                  contracts.map((c) => {
                    const s1 = toNum(c.approve_status_1) === 1;
                    const s2 = isAccApproved(c.approve_status_2, c.acc_approve);
                    const label = !s1
                      ? "ລໍຖ້າຂາຍອະນຸມັດ"
                      : !s2
                        ? "ລໍຖ້າບັນຊີ"
                        : "ອະນຸມັດຄົບ";
                    const dot = !s1
                      ? "bg-[var(--warning)]"
                      : !s2
                        ? "bg-[var(--brand)]"
                        : "bg-[var(--success)]";
                    return (
                      <WorkflowItem
                        key={c.id || c.contract_no}
                        code={c.contract_no || c.contract_code}
                        label={c.contract_name || label}
                        meta={label}
                        trailing={<span className={["h-1.5 w-1.5 rounded-full", dot].join(" ")} />}
                      />
                    );
                  })}
              </WorkflowSection>

              <WorkflowSection title="BOQ" count={counts.boqs}>
                {allBoqs.length > 0 &&
                  allBoqs.map((b) => (
                    <WorkflowItem
                      key={`${b.doc_no}-${b.contract.contract_no}`}
                      code={b.doc_no}
                      label={fmtDate(b.doc_date)}
                      meta={b.contract.contract_no || ""}
                      onClick={b.doc_no ? () => onOpenBoq(b.doc_no!) : undefined}
                    />
                  ))}
                {contracts.length > 0 &&
                  allBoqs.length === 0 &&
                  contracts.map((c) => {
                    const s1 = toNum(c.approve_status_1) === 1;
                    const s2 = isAccApproved(c.approve_status_2, c.acc_approve);
                    const canCreate = s1 && s2;
                    return (
                      <WorkflowItem
                        key={c.id || c.contract_no}
                        code={c.contract_no || c.contract_code}
                        label={c.contract_name || "ສັນຍາ"}
                        trailing={
                          canCreate && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onCreateBoq(project, c);
                              }}
                              className="inline-flex h-6 items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--brand)] px-2 text-[10.5px] font-medium text-white hover:bg-[var(--brand-hover)] transition-colors"
                            >
                              <Plus size={10} />
                              ສ້າງ
                            </button>
                          )
                        }
                      />
                    );
                  })}
              </WorkflowSection>

              <WorkflowSection title="ໃບເບີກ" count={counts.requests} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-[var(--border)] bg-[var(--surface-soft)] px-5 py-3">
          <button
            onClick={() => onDelete(project.id)}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[12.5px] font-medium text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-colors"
          >
            <Trash2 size={13} />
            ລຶບ
          </button>
          <button
            onClick={() => onEdit(project)}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-[12.5px] font-medium text-[var(--text)] hover:bg-[var(--bg-subtle)] transition-colors"
          >
            <Pencil size={13} />
            ແກ້ໄຂ
          </button>
          <button
            onClick={() => onCreateQuotation(project)}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--brand)] text-[12.5px] font-medium text-white hover:bg-[var(--brand-hover)] transition-colors"
          >
            <Plus size={13} />
            ສະເໜີລາຄາ
          </button>
        </div>
      </aside>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Main page
   ───────────────────────────────────────────────────────────────────────── */

function ProjectList() {
  const router = useRouter();
  const [isNavigating, startNavigating] = useTransition();
  const goCreateProject = () =>
    startNavigating(() => router.push("/sale-admin/create-project"));
  const host = process.env.NEXT_PUBLIC_IMAGE_HOST || "";

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [tab, setTab] = useState<StatusId | "all">("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Side panel state
  const [selected, setSelected] = useState<ProjectItem | null>(null);
  const [panelQuotations, setPanelQuotations] = useState<QuotationItem[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const perPage = 25;

  /* ── Effects ── */
  useEffect(() => {
    try {
      const v = localStorage.getItem("sale-project-view");
      if (v === "list" || v === "kanban") setViewMode(v);
    } catch {
      // ignore
    }
    void load();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("sale-project-view", viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [tab, debounced]);

  const load = async () => {
    try {
      setLoading(true);
      const j: any = await getProjects({ summary: true });
      setProjects(
        (Array.isArray(j?.data) ? j.data : []).map((p: ProjectItem) => ({
          ...p,
          __q: searchOf(p),
        })),
      );
    } catch {
      Swal.fire("ຜິດພາດ", "ໂຫລດຂໍ້ມູນບໍ່ສຳເລັດ", "error");
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paginated = useMemo(
    () => filtered.slice((safePage - 1) * perPage, safePage * perPage),
    [filtered, safePage],
  );

  /* ── Selection ── */
  const openPanel = async (p: ProjectItem) => {
    setSelected(p);
    setPanelQuotations([]);

    const tasks: Promise<void>[] = [];
    const contractsStale =
      !Array.isArray(p.contractlist) ||
      p.contractlist.some((c) => Boolean(c.has_boq) && !Array.isArray(c.boq_list));

    if (contractsStale) {
      tasks.push(
        (async () => {
          const j: any = await getProject(String(p.id), { includeContracts: true });
          const d = j?.data;
          if (d) {
            setSelected((cur) =>
              cur && cur.id === p.id
                ? { ...cur, ...d, contractlist: Array.isArray(d.contractlist) ? d.contractlist : cur.contractlist }
                : cur,
            );
            setProjects((cur) =>
              cur.map((x) =>
                x.id === p.id && Array.isArray(d.contractlist)
                  ? { ...x, contractlist: d.contractlist }
                  : x,
              ),
            );
          }
        })(),
      );
    }

    tasks.push(
      (async () => {
        const qj: any = await getQuotations({ projectId: String(p.id) });
        const list = Array.isArray(qj?.data) ? qj.data : [];
        setSelected((cur) => {
          if (cur && cur.id === p.id) setPanelQuotations(list);
          return cur;
        });
      })(),
    );

    if (tasks.length === 0) return;
    setPanelLoading(true);
    try {
      await Promise.all(tasks);
    } catch {
      // ignore
    } finally {
      setPanelLoading(false);
    }
  };

  /* ── Actions ── */
  const goEdit = (p: ProjectItem) => {
    try {
      localStorage.setItem("project_edit_prefill", JSON.stringify(p));
    } catch {
      // ignore
    }
    router.push(`/sale-admin/create-project/${p.id}`);
  };

  const goCreateQuotation = (p: ProjectItem) =>
    router.push(`/sale-admin/create-quotation?projectId=${encodeURIComponent(String(p.id))}`);

  const goCreateContract = (p: ProjectItem) =>
    router.push(`/sale-admin/request-project-creation/${p.id}`);

  const goCreateBoq = (p: ProjectItem, c: ContractItem) => {
    const cust = c.cust_code || p.sml_code || p.id;
    const contractNo = c.contract_no || c.contract_code || c.id;
    if (!cust || !contractNo) {
      Swal.fire("ຜິດພາດ", "ບໍ່ພົບຂໍ້ມູນສັນຍາ", "error");
      return;
    }
    router.push(
      `/service-admin/create-boq/${encodeURIComponent(String(cust))}/${encodeURIComponent(String(p.id))}/${encodeURIComponent(String(contractNo))}`,
    );
  };

  const goOpenQuotation = (q: QuotationItem) => {
    if (!q.id) return;
    router.push(`/sale-admin/quotation/${q.id}`);
  };

  const goOpenBoq = (docNo: string) => router.push(`/boq/${encodeURIComponent(docNo)}/edit`);

  const remove = (id: ProjectItem["id"]) => {
    Swal.fire({
      title: "ທ່ານແນ່ໃຈບໍ?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "var(--danger)",
      cancelButtonText: "ຍົກເລີກ",
      confirmButtonText: "ລຶບ",
    }).then(async (r) => {
      if (!r.isConfirmed) return;
      try {
        const res = await deleteProjectAction(String(id));
        if (!res?.success) throw new Error();
        setProjects((c) => c.filter((x) => x.id !== id));
        if (selected?.id === id) setSelected(null);
        Swal.fire({ icon: "success", title: "ລຶບແລ້ວ", timer: 1200, showConfirmButton: false });
      } catch {
        Swal.fire("ຜິດພາດ", "ລຶບບໍ່ສຳເລັດ", "error");
      }
    });
  };

  const applyKanbanStatus = async (p: ProjectItem, newStatus: StatusId) => {
    const current = resolveStatus(p);
    const derivedOnly: StatusId[] = ["ສະເໜີລາຄາ", "ເຊັນສັນຍາ", "ດຳເນີນສັນຍາ", "ກຳລັງເບີກວັດສະດຸ"];
    if (derivedOnly.includes(newStatus)) {
      Swal.fire({
        icon: "info",
        title: "ສະຖານະນີ້ຄຳນວນເອງ",
        text: "ສະຖານະນີ້ປ່ຽນອັດຕະໂນມັດຕາມ Quotation / Contract / BOQ / ໃບເບີກ",
      });
      return;
    }
    if (current === newStatus) return;
    try {
      const r = await updateProjectAction(String(p.id), { project_status: newStatus });
      if (!r?.success) throw new Error();
      setProjects((c) =>
        c.map((x) =>
          x.id === p.id ? { ...x, project_status: newStatus, __q: searchOf({ ...x, project_status: newStatus }) } : x,
        ),
      );
    } catch {
      Swal.fire("ຜິດພາດ", "ປ່ຽນສະຖານະບໍ່ສຳເລັດ", "error");
    }
  };

  /* ── Page header ── */
  usePageHeader({
    title: tab === "all" ? "ໂຄງການທັງໝົດ" : meta(tab as StatusId).short,
    subtitle: `${filtered.length} / ${projects.length} ໂຄງການ`,
    primaryAction: {
      label: isNavigating ? "ກຳລັງເປີດ..." : "ສ້າງໂຄງການ",
      icon: isNavigating ? (
        <RefreshCw size={13} className="animate-spin" />
      ) : (
        <Plus size={13} />
      ),
      onClick: goCreateProject,
      disabled: isNavigating,
    },
    secondaryActions: [
      {
        label: "ໂຫລດໃໝ່",
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
    filterChips: [
      {
        id: "all",
        label: "ທັງໝົດ",
        count: projects.length,
        active: tab === "all",
        onClick: () => setTab("all"),
      },
      ...counts.map((s) => ({
        id: s.id,
        label: s.short,
        count: s.count,
        active: tab === s.id,
        onClick: () => setTab(s.id),
      })),
    ],
  });

  /* ── Render ── */
  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex items-center justify-end">
        <ViewSwitcher value={viewMode} onChange={setViewMode} />
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
            <div className="text-[14px] font-semibold text-[var(--text)]">ບໍ່ພົບໂຄງການ</div>
            <div className="mt-1 text-[12px] text-[var(--text-soft)]">ລອງປັບຄຳຄົ້ນ ຫຼື ຕົວກັ່ນຕອງ</div>
          </div>
          {(search || tab !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setTab("all");
              }}
              className="text-[12px] font-medium text-[var(--brand)] hover:underline"
            >
              ລ້າງຕົວກັ່ນຕອງ
            </button>
          )}
        </div>
      ) : viewMode === "kanban" ? (
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 pt-3">
          <KanbanBoard<ProjectItem>
            columns={STATUSES.map<KanbanColumn<ProjectItem>>((s) => ({
              id: s.id,
              title: s.short,
              records: filtered.filter((p) => resolveStatus(p) === s.id),
              color: s.tone,
            }))}
            getCardId={(p) => p.id}
            onCardClick={(p) => void openPanel(p)}
            onCardMove={(p, to) => void applyKanbanStatus(p, to as StatusId)}
            renderCard={(p) => {
              const s = meta(resolveStatus(p));
              const cnt = relationCounts(p);
              const img = imgOf(p);
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[10.5px] font-semibold text-[var(--brand)]">
                      {code(p)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--text-soft)]">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.tone }} />
                      {s.short}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {img && (
                      <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--bg-subtle)]">
                        <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-semibold text-[var(--text)]">
                        {p.project_name || "-"}
                      </div>
                      <div className="truncate text-[10.5px] text-[var(--text-mute)]">
                        {loc(p)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-[var(--text-mute)]">
                    {cnt.quotations > 0 && (
                      <span>Q:{cnt.quotations}</span>
                    )}
                    {cnt.contracts > 0 && <span>·  C:{cnt.contracts}</span>}
                    {cnt.boqs > 0 && <span>· B:{cnt.boqs}</span>}
                    {cnt.requests > 0 && <span>· R:{cnt.requests}</span>}
                  </div>
                </div>
              );
            }}
          />
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]">
            {/* Header */}
            <div className="hidden md:grid grid-cols-[3rem_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.5fr)_8rem_3rem] items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-sunken)] px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--text-soft)]">
              <span />
              <span>ໂຄງການ</span>
              <span>ສະຖານທີ່</span>
              <span>Stage</span>
              <span>ສະຖານະ</span>
              <span />
            </div>

            {/* Rows */}
            <ul className="divide-y divide-[var(--border-soft)]">
              {paginated.map((p) => {
                const s = meta(resolveStatus(p));
                const img = imgOf(p);
                const isSelected = selected?.id === p.id;
                return (
                  <li
                    key={p.id}
                    onClick={() => void openPanel(p)}
                    className={[
                      "group cursor-pointer transition-colors",
                      isSelected ? "bg-[var(--brand-soft)]" : "hover:bg-[var(--bg-subtle)]",
                    ].join(" ")}
                  >
                    {/* Desktop */}
                    <div className="hidden md:grid grid-cols-[3rem_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.5fr)_8rem_3rem] items-center gap-3 px-4 py-3">
                      <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--bg-subtle)] ring-1 ring-[var(--border)]">
                        {img ? (
                          <img
                            src={img}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[var(--text-mute)]">
                            <Building2 size={14} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate text-[13px] font-semibold text-[var(--text)]">
                            {p.project_name || "-"}
                          </span>
                          <span className="flex-shrink-0 font-mono text-[10.5px] font-semibold text-[var(--brand)]">
                            {code(p)}
                          </span>
                        </div>
                        {p.customer_name && (
                          <div className="truncate text-[11.5px] text-[var(--text-mute)]">
                            {p.customer_name}
                          </div>
                        )}
                      </div>
                      <div className="text-[12px] text-[var(--text-soft)] truncate">{loc(p)}</div>
                      <StageProgress project={p} />
                      <span
                        className={[
                          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium w-fit",
                          s.chip,
                        ].join(" ")}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.tone }} />
                        {s.short}
                      </span>
                      <ChevronRight
                        size={14}
                        className="ml-auto text-[var(--text-mute)] group-hover:text-[var(--text)]"
                      />
                    </div>

                    {/* Mobile */}
                    <div className="md:hidden px-4 py-3 flex items-start gap-3">
                      <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--bg-subtle)] ring-1 ring-[var(--border)]">
                        {img ? (
                          <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[var(--text-mute)]">
                            <Building2 size={14} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[10.5px] font-semibold text-[var(--brand)]">
                            {code(p)}
                          </span>
                          <span
                            className={[
                              "ml-auto inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                              s.chip,
                            ].join(" ")}
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.tone }} />
                            {s.short}
                          </span>
                        </div>
                        <div className="text-[13px] font-semibold text-[var(--text)] truncate">
                          {p.project_name || "-"}
                        </div>
                        <div className="text-[11px] text-[var(--text-mute)] truncate">{loc(p)}</div>
                        <StageProgress project={p} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 text-[12px]">
              <div className="text-[var(--text-soft)]">
                ສະແດງ {(safePage - 1) * perPage + 1}–
                {Math.min(safePage * perPage, filtered.length)} /{" "}
                <span className="font-semibold text-[var(--text)]">{filtered.length}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="inline-flex h-7 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)] hover:bg-[var(--bg-subtle)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ກ່ອນ
                </button>
                <span className="px-2 font-medium text-[var(--text)]">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex h-7 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)] hover:bg-[var(--bg-subtle)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ຖັດໄປ
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <SidePanel
        project={selected}
        quotations={panelQuotations}
        loading={panelLoading}
        onClose={() => setSelected(null)}
        onEdit={goEdit}
        onDelete={remove}
        onCreateQuotation={goCreateQuotation}
        onCreateContract={goCreateContract}
        onCreateBoq={goCreateBoq}
        onOpenQuotation={goOpenQuotation}
        onOpenBoq={goOpenBoq}
      />
    </div>
  );
}

export default function Page() {
  return (
    <AuthGuard roles={["sale_admin", "sale_manager", "account_admin", "head_technician"]}>
      <ProjectList />
    </AuthGuard>
  );
}
