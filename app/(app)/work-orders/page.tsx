"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import CrossList from "../_components/CrossList";
import ProjectPickerModal from "../_components/ProjectPickerModal";
import { Pill, Btn } from "../_components/ui";
import { getWorkOrders } from "@/_actions/workorder";

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

export default function WorkOrdersListPage() {
  const router = useRouter();
  const [pick, setPick] = useState(false);

  return (
    <>
      <CrossList
        title="ໃບງານ"
        load={() => getWorkOrders({})}
        searchText={(r) => `${r.work_no ?? ""} ${r.technician_name ?? ""} ${r.title ?? ""}`}
        rowHref={(r) => `/work-orders/${r.id}`}
        searchPlaceholder="ຄົ້ນຫາ ໃບງານ, ວຽກ, ທີມ..."
        empty="ຍັງບໍ່ມີໃບງານ"
        headerActions={
          <Btn onClick={() => setPick(true)}>
            <Plus size={14} /> ອອກໃບງານ
          </Btn>
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
          { header: "ທີມ/ຊ່າງ", cell: (r) => r.technician_name || "-" },
          { header: "ວັນທີ", cell: (r) => d10(r.work_date ?? r.created_at) },
          { header: "ສະຖານະ", cell: (r) => (r.status ? <Pill tone="amber">{r.status}</Pill> : "-") },
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
