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
  | "workorder";

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
];

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
 * Derive the 7 pipeline stages from whatever the legacy data exposes.
 * `survey` and the late stages aren't tracked in the old schema yet, so they
 * are shown honestly (na / pending) rather than faked.
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

/* ── Colour map for legacy Lao project_status strings ─────────────────────── */
const STATUS_COLORS: Record<string, string> = {
  "ລົງທະບຽນ": "bg-sky-50 text-sky-700 border border-sky-200/50",
  "ສຳຫຼວດ": "bg-violet-50 text-violet-700 border border-violet-200/50",
  "ສະເໜີລາຄາ": "bg-indigo-50 text-indigo-700 border border-indigo-200/50",
  "ສັນຍາ": "bg-blue-50 text-blue-700 border border-blue-200/50",
  "BOQ": "bg-cyan-50 text-cyan-700 border border-cyan-200/50",
  "ກຳນົດໜ້າວຽກ": "bg-teal-50 text-teal-700 border border-teal-200/50",
  "ໃບງານ": "bg-emerald-50 text-emerald-700 border border-emerald-200/50",
  "ລໍຖ້າດຳເນີນ": "bg-amber-50 text-amber-700 border border-amber-200/50",
  "ຂັ້ນຕອນດຳເນີນໂຄງການ": "bg-blue-50 text-blue-700 border border-blue-200/50",
  "ດຳເນີນຕາມໂຄງການ": "bg-blue-50 text-blue-700 border border-blue-200/50",
  "ສາມາດເບີກຂອງໃດ້": "bg-cyan-50 text-cyan-700 border border-cyan-200/50",
  "ດຳເນີນການຕິດຕັ້ງ": "bg-indigo-50 text-indigo-700 border border-indigo-200/50",
  "ລໍຖ້າອະນຸມັດປິດໂຄງການ": "bg-blue-50 text-blue-700 border border-blue-200/50",
  "ປິດໂຄງການ": "bg-emerald-50 text-emerald-700 border border-emerald-200/50",
  "ໃນງານ": "bg-emerald-50 text-emerald-700 border border-emerald-200/50",
};

export function StatusBadge({ status }: { status?: string | null }) {
  const s = norm(status) || "-";
  const cls = STATUS_COLORS[s] || "bg-slate-50 text-slate-600 border border-slate-200/60";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${cls}`}>
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
            ? "border-emerald-500 bg-emerald-500 text-white"
            : stage.state === "current"
              ? "border-[var(--theme-primary)] bg-[var(--theme-primary)] text-white ring-4 ring-[var(--theme-primary-tint)]"
              : stage.state === "na"
                ? "border-dashed border-gray-300 bg-white text-gray-300"
                : "border-gray-300 bg-white text-gray-400";
        const labelCls =
          stage.state === "current"
            ? "text-[var(--theme-primary)] font-bold"
            : stage.state === "done"
              ? "text-emerald-700 font-semibold"
              : stage.state === "na"
                ? "text-gray-400"
                : "text-gray-500";
        const line =
          stage.state === "done" ? "bg-emerald-400" : "bg-gray-200";
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
