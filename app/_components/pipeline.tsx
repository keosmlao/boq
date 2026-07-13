"use client";

/**
 * PREVIEW / PROTOTYPE — read-only.
 *
 * Stage model + small UI atoms for the project-centric pipeline design.
 * Pure presentation + derivation from existing (legacy) data. Nothing here
 * writes anything; it only interprets what the current system already returns.
 */
import React from "react";
import {
  ClipboardList,
  ClipboardCheck,
  MapPin,
  FileText,
  FileSignature,
  ListChecks,
  CalendarRange,
  Wrench,
  Check,
  Dot,
} from "lucide-react";

export type StageKey =
  | "register"
  | "survey"
  | "quotation"
  | "contract"
  | "boq"
  | "taskplan"
  | "workorder"
  | "close";

export type StageState = "done" | "current" | "pending" | "na";

export type Stage = {
  key: StageKey;
  label: string; // Lao
  state: StageState;
  detail: string;
};

export const STAGE_DEFS: { key: StageKey; label: string; icon: React.ReactNode }[] = [
  { key: "register", label: "ລົງທະບຽນ", icon: <ClipboardList size={15} /> },
  { key: "survey", label: "ສຳຫຼວດ", icon: <MapPin size={15} /> },
  { key: "quotation", label: "ສະເໜີລາຄາ", icon: <FileText size={15} /> },
  { key: "contract", label: "ສັນຍາ", icon: <FileSignature size={15} /> },
  { key: "boq", label: "BOQ", icon: <ListChecks size={15} /> },
  { key: "taskplan", label: "ກຳນົດໜ້າວຽກ", icon: <CalendarRange size={15} /> },
  { key: "workorder", label: "ໃບງານ", icon: <Wrench size={15} /> },
  { key: "close", label: "ກວດຮັບ/ປິດງານ", icon: <ClipboardCheck size={15} /> },
];

/** Close-out statuses (odg_projects.project_status) — mirrors app/_actions/projects.ts. */
export const PENDING_CLOSE_STATUS = "ລໍຖ້າອະນຸມັດປິດໂຄງການ";
export const CLOSED_STATUS = "ປິດໂຄງການ";

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};
const norm = (v: unknown) => (v ?? "").toString().trim();

/**
 * Contract is fully approved. Handles the v2 odg_contract shape
 * (sales_approved + accounting_approved booleans) and the legacy ERP shape.
 */
export function isContractApproved(c: any): boolean {
  if (c && (typeof c.sales_approved !== "undefined" || typeof c.accounting_approved !== "undefined")) {
    return !!c.sales_approved && !!c.accounting_approved;
  }
  return (
    num(c?.approve_status_1) === 1 &&
    Math.max(num(c?.approve_status_2), num(c?.acc_approve)) === 1
  );
}

/**
 * A work order is CLOSED — v2 (odg_work_order: closed_at / status='closed') or
 * legacy ERP (status 'ປິດງານແລ້ວ' / 'Closed'). Mirrors closeWorkOrderAs + the
 * work-order list's stage mapping.
 */
export function isWorkOrderClosed(w: any): boolean {
  if (w?.closed_at) return true;
  const s = norm(w?.status);
  return s.toLowerCase() === "closed" || s === "ປິດງານແລ້ວ";
}

export type CloseReadiness = {
  status: string;
  woTotal: number;
  woClosed: number;
  /** Every work order of the project is closed (and there is at least one). */
  allWorkOrdersClosed: boolean;
  /** A close request is waiting for a manager. */
  pendingClose: boolean;
  /** The project is closed (terminal). */
  closed: boolean;
  /** The close-out can be requested right now. */
  canRequestClose: boolean;
};

/** Real close-out state of a project, derived from the rows the page already loaded. */
export function computeCloseReadiness(project: any, workorders: any[] = []): CloseReadiness {
  const status = norm(project?.project_status);
  const woTotal = workorders.length;
  const woClosed = workorders.filter(isWorkOrderClosed).length;
  const allWorkOrdersClosed = woTotal > 0 && woClosed === woTotal;
  const pendingClose = status === PENDING_CLOSE_STATUS;
  const closed = status === CLOSED_STATUS;
  return {
    status,
    woTotal,
    woClosed,
    allWorkOrdersClosed,
    pendingClose,
    closed,
    canRequestClose: allWorkOrdersClosed && !pendingClose && !closed,
  };
}

/**
 * Derive the 8 pipeline stages from whatever the legacy data exposes.
 * `survey` and the late stages aren't tracked in the old schema yet, so they
 * are shown honestly (na / pending) rather than faked. The final stage
 * (ກວດຮັບ/ປິດງານ) is done only when the project really is ປິດໂຄງການ.
 */
export function computeStages(
  project: any,
  quotations: any[],
  contracts: any[],
  surveys: any[] = [],
  boqs: any[] = [],
  tasks: any[] = [],
  workorders: any[] = [],
): Stage[] {
  const hasQuotation = quotations.length > 0;
  const quotationApproved = quotations.some((q) => norm(q?.status) === "ອະນຸມັດແລ້ວ");
  const hasContract = contracts.length > 0;
  const contractApproved = contracts.some(isContractApproved);
  const hasBoq = boqs.some((b) => norm(b?.status) !== "ປະຕິເສດ");
  const boqApproved = boqs.some((b) => norm(b?.status) === "ອະນຸມັດແລ້ວ" || num(b?.approve_status) === 1);
  const close = computeCloseReadiness(project, workorders);

  const base: { key: StageKey; label: string; done: boolean; partial: boolean; na?: boolean; detail: string }[] = [
    { key: "register", label: "ລົງທະບຽນ", done: true, partial: false, detail: "ໂຄງການລົງທະບຽນແລ້ວ" },
    {
      key: "survey",
      label: "ສຳຫຼວດ",
      done: surveys.length > 0,
      partial: false,
      detail: surveys.length > 0 ? `ສຳຫຼວດແລ້ວ (${surveys.length})` : "ຍັງບໍ່ໄດ້ສຳຫຼວດ",
    },
    {
      key: "quotation",
      label: "ສະເໜີລາຄາ",
      done: quotationApproved,
      partial: hasQuotation && !quotationApproved,
      detail: quotationApproved
        ? `ອະນຸມັດແລ້ວ (${quotations.length} ໃບ)`
        : hasQuotation
          ? `ມີ ${quotations.length} ໃບ ລໍຖ້າອະນຸມັດ`
          : "ຍັງບໍ່ມີໃບສະເໜີ",
    },
    {
      key: "contract",
      label: "ສັນຍາ",
      done: contractApproved,
      partial: hasContract && !contractApproved,
      detail: contractApproved
        ? "ສັນຍາອະນຸມັດຄົບ (ຝ່າຍຂາຍ + ບັນຊີ)"
        : hasContract
          ? `ມີ ${contracts.length} ສັນຍາ ລໍຖ້າອະນຸມັດ`
          : "ຍັງບໍ່ມີສັນຍາ",
    },
    {
      key: "boq",
      label: "BOQ",
      done: boqApproved,
      partial: hasBoq && !boqApproved,
      detail: boqApproved
        ? `BOQ ອະນຸມັດແລ້ວ (${boqs.length} ສະບັບ)`
        : hasBoq
          ? `ມີ BOQ ${boqs.length} ສະບັບ ລໍຖ້າອະນຸມັດ`
          : "ຍັງບໍ່ມີ BOQ",
    },
    {
      key: "taskplan",
      label: "ກຳນົດໜ້າວຽກ",
      done: tasks.length > 0,
      partial: false,
      detail: tasks.length > 0 ? `ກຳນົດແລ້ວ (${tasks.length} ໜ້າວຽກ)` : "ຍັງບໍ່ໄດ້ກຳນົດໜ້າວຽກ",
    },
    {
      key: "workorder",
      label: "ໃບງານ",
      done: workorders.length > 0,
      partial: false,
      detail: workorders.length > 0 ? `ມີໃບງານ (${workorders.length})` : "ຍັງບໍ່ມີໃບງານ",
    },
    {
      key: "close",
      label: "ກວດຮັບ/ປິດງານ",
      done: close.closed,
      partial: close.pendingClose || close.canRequestClose,
      detail: close.closed
        ? "ປິດໂຄງການແລ້ວ"
        : close.pendingClose
          ? "ລໍຖ້າຜູ້ຈັດການອະນຸມັດປິດໂຄງການ"
          : close.woTotal === 0
            ? "ຍັງບໍ່ມີໃບງານໃຫ້ປິດ"
            : close.allWorkOrdersClosed
              ? `ໃບງານປິດຄົບ (${close.woClosed}/${close.woTotal}) — ພ້ອມປິດໂຄງການ`
              : `ໃບງານປິດແລ້ວ ${close.woClosed}/${close.woTotal}`,
    },
  ];

  // Monotonic pipeline: reaching a later stage means the earlier ones are
  // PASSED — don't ask the user to redo them (e.g. a project with a contract
  // has obviously passed survey/quotation even if v2 has no record).
  const lastDone = base.reduce((acc, s, i) => (s.done ? i : acc), -1);
  const adjusted = base.map((s, i) => (i < lastDone ? { ...s, done: true, partial: false } : s));

  let currentAssigned = false;
  return adjusted.map((s): Stage => {
    if (s.na) return { key: s.key, label: s.label, state: "na", detail: s.detail };
    if (s.done) return { key: s.key, label: s.label, state: "done", detail: s.detail };
    if (!currentAssigned) {
      currentAssigned = true;
      return { key: s.key, label: s.label, state: "current", detail: s.detail };
    }
    return { key: s.key, label: s.label, state: "pending", detail: s.detail };
  });
}

/* ── Token tones for legacy Lao project_status strings ────────────────────── */
const TONE_CLS = {
  info: "bg-[var(--info-soft)] text-[var(--info)] border-[var(--info-soft)]",
  brand: "bg-[var(--brand-soft)] text-[var(--brand-strong)] border-[var(--brand-soft)]",
  success: "bg-[var(--success-soft)] text-[var(--success)] border-[var(--success-soft)]",
  warning: "bg-[var(--warning-soft)] text-[var(--warning)] border-[var(--warning-soft)]",
  danger: "bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger-soft)]",
  neutral: "bg-[var(--surface-sunken)] text-[var(--text-soft)] border-[var(--border)]",
} as const;

const STATUS_TONES: Record<string, keyof typeof TONE_CLS> = {
  "ລົງທະບຽນ": "info",
  "ສຳຫຼວດ": "brand",
  "ສະເໜີລາຄາ": "info",
  "ສັນຍາ": "info",
  "BOQ": "brand",
  "ກຳນົດໜ້າວຽກ": "brand",
  "ໃບງານ": "success",
  "ລໍຖ້າດຳເນີນ": "warning",
  "ຂັ້ນຕອນດຳເນີນໂຄງການ": "info",
  "ດຳເນີນຕາມໂຄງການ": "info",
  "ສາມາດເບີກຂອງໃດ້": "brand",
  "ດຳເນີນການຕິດຕັ້ງ": "info",
  "ລໍຖ້າອະນຸມັດປິດໂຄງການ": "info",
  "ພັກໂຄງການ": "danger",
  "ປິດໂຄງການ": "success",
  "ໃນງານ": "success",
};

export function StatusBadge({ status }: { status?: string | null }) {
  const s = norm(status) || "-";
  const cls = TONE_CLS[STATUS_TONES[s] ?? "neutral"];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-85" />
      {s}
    </span>
  );
}

/* ── The horizontal stage stepper ────────────────────────────────────────── */
export function StageStepper({ stages }: { stages: Stage[] }) {
  return (
    <div className="flex w-full items-center overflow-x-auto pb-1">
      {stages.map((stage, i) => {
        const def = STAGE_DEFS.find((d) => d.key === stage.key)!;
        const isLast = i === stages.length - 1;
        const ring =
          stage.state === "done"
            ? "border-[var(--go)] bg-[var(--go)] text-white"
            : stage.state === "current"
              ? "border-[var(--brand)] bg-[var(--brand)] text-white ring-4 ring-[var(--brand-ring)]"
              : stage.state === "na"
                ? "border-dashed border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-mute)]"
                : "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-mute)]";
        const labelCls =
          stage.state === "current"
            ? "font-bold text-[var(--brand-strong)]"
            : stage.state === "done"
              ? "font-semibold text-[var(--success)]"
              : "text-[var(--text-mute)]";
        const line = stage.state === "done" ? "bg-[var(--go)]" : "bg-[var(--border)]";
        return (
          <React.Fragment key={stage.key}>
            <div className="flex min-w-[78px] flex-col items-center gap-1">
              <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${ring}`}>
                {stage.state === "done" ? <Check size={16} /> : stage.state === "na" ? <Dot size={18} /> : def.icon}
              </div>
              <span className={`text-center text-[11px] leading-tight ${labelCls}`}>
                {stage.label}
              </span>
            </div>
            {!isLast && <div className={`mb-5 h-0.5 flex-1 min-w-[16px] ${line}`} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}
