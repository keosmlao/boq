"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import CrossList from "../_components/CrossList";
import ProjectPickerModal from "../_components/ProjectPickerModal";
import { Pill, Btn } from "../_components/ui";
import { getAllBoqsForList } from "@/_actions/boq-v2";

const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "-";
};
const tone = (s: string) => (s === "ອະນຸມັດແລ້ວ" ? "green" : s === "ປະຕິເສດ" ? "red" : "amber");

export default function BoqListPage() {
  const router = useRouter();
  const [pick, setPick] = useState(false);

  return (
    <>
      <CrossList
        title="BOQ"
        load={() => getAllBoqsForList()}
        searchText={(r) => `${r.boq_no ?? ""} ${r.project_name ?? ""} ${r.customer_name ?? ""} ${r.requester ?? ""} ${r.approver ?? ""}`}
        rowHref={(r) => (r.src === "erp" ? `/v2/boq/${encodeURIComponent(r.boq_no || "")}` : `/v2/boq/${r.id}`)}
        searchPlaceholder="ຄົ້ນຫາ BOQ, ໂຄງການ, ລູກຄ້າ..."
        empty="ຍັງບໍ່ມີ BOQ"
        groupBy={(r) => r.project_name || "(ບໍ່ລະບຸໂຄງການ)"}
        groupLabel="ຈັດກຸ່ມຕາມໂຄງການ"
        headerActions={
          <Btn onClick={() => setPick(true)}>
            <Plus size={14} /> ສ້າງ BOQ
          </Btn>
        }
        columns={[
          { header: "BOQ ເລກທີ່", cell: (r) => <span className="font-mono text-[var(--theme-text)]">{r.boq_no || "-"}</span> },
          { header: "ໂຄງການ", cell: (r) => <span className="font-medium">{r.project_name || "-"}</span> },
          { header: "ມູນຄ່າ", align: "right", cell: (r) => money(r.total_amount ?? r.subtotal) },
          { header: "ຜູ້ຂໍ", cell: (r) => r.requester || "-" },
          { header: "ຜູ້ອະນຸມັດ", cell: (r) => r.approver || "-" },
          { header: "ສະຖານະ", cell: (r) => <Pill tone={tone(String(r.status || "")) as any}>{r.status || "ລໍຖ້າອະນຸມັດ"}</Pill> },
          { header: "ວັນທີ", cell: (r) => (r.created_at ?? "").toString().slice(0, 10) || "-" },
        ]}
      />
      <ProjectPickerModal
        open={pick}
        onClose={() => setPick(false)}
        onPick={(p) => router.push(`/v2/projects/${p.id}/boq/new`)}
        title="ເລືອກໂຄງການເພື່ອສ້າງ BOQ"
      />
    </>
  );
}
