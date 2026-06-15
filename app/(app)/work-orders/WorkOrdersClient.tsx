"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import CrossList from "../_components/CrossList";
import ProjectPickerModal from "../_components/ProjectPickerModal";
import { Pill, Btn } from "../_components/ui";
import { getWorkOrders } from "@/_actions/workorder";
import { workOrderStage, type StageTone } from "@/_lib/workorder-stage";

// Map the stage tone to a Pill tone.
const STAGE_PILL: Record<StageTone, "neutral" | "blue" | "green" | "amber" | "red" | "cyan" | "indigo"> = {
  neutral: "neutral",
  teal: "cyan",
  indigo: "indigo",
  amber: "amber",
  green: "green",
  red: "red",
};

const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "-";
};

const d10 = (v: unknown) => {
  if (!v) return "-";
  const d = new Date(v as any);
  if (isNaN(d.getTime())) return String(v).slice(0, 10);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Categorize both v2 work orders and legacy ERP work orders for tab filtering */
function getStageKey(r: any): string {
  if (r.src === "erp") {
    const status = String(r.status || "").trim();
    if (status === "ປິດງານແລ້ວ" || status === "closed" || status === "Closed") return "closed";
    if (status === "ກຳລັງເຂົ້າໜ້າງານ" || status === "IN_PROGRESS" || status === "in_progress") return "in_progress";
    if (status === "ຊ່າງຮັບງານ" || status === "ASSIGNED" || status === "assigned") return "accepted";
    if (status === "ບໍ່ອະນຸມັດ" || status === "rejected") return "rejected";
    return "issued"; // fallback for ອອກໃບງານ
  }
  const s = workOrderStage(r);
  if (s.key === "approval_rejected" || s.key === "accept_rejected") return "rejected";
  return s.key;
}

export default function WorkOrdersClient({ initialRows }: { initialRows: any[] }) {
  const router = useRouter();
  const [pick, setPick] = useState(false);
  const [allRows, setAllRows] = useState<any[]>(initialRows ?? []);
  const [activeTab, setActiveTab] = useState<string>("all");

  const counts = useMemo(() => {
    return {
      all: allRows.length,
      issued: allRows.filter((r) => getStageKey(r) === "issued").length,
      accepted: allRows.filter((r) => getStageKey(r) === "accepted").length,
      in_progress: allRows.filter((r) => getStageKey(r) === "in_progress").length,
      awaiting_review: allRows.filter((r) => getStageKey(r) === "awaiting_review").length,
      closed: allRows.filter((r) => getStageKey(r) === "closed").length,
      rejected: allRows.filter((r) => getStageKey(r) === "rejected").length,
    };
  }, [allRows]);

  const filteredRows = useMemo(() => {
    if (activeTab === "all") return allRows;
    return allRows.filter((r) => getStageKey(r) === activeTab);
  }, [allRows, activeTab]);

  const tabs = [
    { key: "all", label: "ທັງໝົດ", count: counts.all },
    { key: "issued", label: "ອອກໃບງານ", count: counts.issued },
    { key: "accepted", label: "ຊ່າງຮັບງານ", count: counts.accepted },
    { key: "in_progress", label: "ກຳລັງເຂົ້າໜ້າງານ", count: counts.in_progress },
    { key: "awaiting_review", label: "ລໍຖ້າກວດສອບ", count: counts.awaiting_review },
    { key: "closed", label: "ປິດງານແລ້ວ", count: counts.closed },
    { key: "rejected", label: "ປະຕິເສດ", count: counts.rejected },
  ];

  return (
    <>
      <CrossList
        key={activeTab}
        title="ໃບງານ"
        load={async () => {
          const res = await getWorkOrders({});
          if (res?.success) {
            const data = res.data || [];
            setAllRows(data);
            return data.filter((r) => activeTab === "all" || getStageKey(r) === activeTab);
          }
          if (Array.isArray(res)) {
            setAllRows(res);
            return res.filter((r) => activeTab === "all" || getStageKey(r) === activeTab);
          }
          return [];
        }}
        initialRows={filteredRows}
        searchText={(r) => `${r.work_no ?? ""} ${r.technician_name ?? ""} ${r.technician_code ?? ""} ${r.title ?? ""}`}
        rowHref={(r) => `/work-orders/${r.id}`}
        searchPlaceholder="ຄົ້ນຫາ ໃບງານ, ວຽກ, ທີມ..."
        empty="ຍັງບໍ່ມີໃບງານ"
        headerActions={
          <Btn onClick={() => setPick(true)}>
            <Plus size={14} /> ອອກໃບງານ
          </Btn>
        }
        aboveTable={
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-slate-50/20 px-4 py-3">
            {tabs.map((t) => {
              const active = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-[11px] font-bold transition-all active:scale-[0.98] ${
                    active
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                      : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                  }`}
                >
                  <span>{t.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                      active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>
        }
        columns={[
          {
            header: "ໃບງານ",
            cell: (r) => (
              <span className="font-mono text-[var(--theme-text)]">
                {r.work_no || "-"}
                {r.src === "erp" && <span className="ml-1.5 rounded bg-[var(--theme-bg-muted)] px-1 py-0.5 text-[9px] text-[var(--theme-text-mute)]">ເກົ່າ</span>}
              </span>
            ),
          },
          { header: "ວຽກ", cell: (r) => r.title || "-" },
          { header: "ທີມ/ຊ່າງ", cell: (r) => (r.technician_code ? `${r.technician_name || "-"} (${r.technician_code})` : r.technician_name || "-") },
          { header: "ວັນທີ", cell: (r) => d10(r.work_date ?? r.created_at) },
          {
            header: "ສະຖານະ",
            cell: (r) => {
              if (r.src === "erp") return r.status ? <Pill tone="neutral">{r.status}</Pill> : "-";
              const s = workOrderStage(r);
              return <Pill tone={STAGE_PILL[s.tone]}>{s.label}</Pill>;
            },
          },
          { header: "ຄ່າແຮງ", align: "right", cell: (r) => (r.src === "erp" ? "-" : money(r.labor_cost)) },
        ]}
      />
      <ProjectPickerModal
        open={pick}
        onClose={() => setPick(false)}
        onPick={(p) => router.push(`/projects/${p.id}/workorder/new`)}
        title="ເລືອກໂຄງການເພື່ອອອກໃບງານ"
      />
    </>
  );
}
