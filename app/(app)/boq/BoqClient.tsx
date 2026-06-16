"use client";

/**
 * BOQ cross-project list (interactive shell).
 *
 * Data is fetched on the SERVER in page.tsx and passed in via `initialRows`,
 * so navigation no longer triggers a client mount→fetch("/api/boqs") waterfall:
 * the rows are present in the first render. CrossList's refresh button still
 * re-pulls via the `load` callback below on demand.
 */
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import CrossList from "../_components/CrossList";
import ProjectPickerModal from "../_components/ProjectPickerModal";
import { Btn } from "../_components/ui";

const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "-";
};
export default function BoqClient({ initialRows }: { initialRows: any[] }) {
  const router = useRouter();
  const [pick, setPick] = useState(false);

  return (
    <>
      <CrossList
        title="BOQ"
        initialRows={initialRows ?? []}
        load={async () => {
          const response = await fetch("/api/boqs", { cache: "no-store" });
          const result = await response.json();
          if (!response.ok) throw new Error(result?.message || "Failed to load BOQs");
          return result;
        }}
        searchText={(r) => `${r.boq_no ?? ""} ${r.project_name ?? ""} ${r.customer_name ?? ""} ${r.requester ?? ""} ${r.approver ?? ""}`}
        rowHref={(r) => (r.src === "erp" ? `/boq/${encodeURIComponent(r.boq_no || "")}` : `/boq/${r.id}`)}
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
          { header: "ສະຖານະ", cell: (r) => <span className="text-slate-600">{r.status || "ລໍຖ້າອະນຸມັດ"}</span> },
          { header: "ວັນທີ", cell: (r) => (r.created_at ?? "").toString().slice(0, 10) || "-" },
        ]}
      />
      <ProjectPickerModal
        open={pick}
        onClose={() => setPick(false)}
        onPick={(p) => router.push(`/projects/${p.id}/boq/new`)}
        title="ເລືອກໂຄງການເພື່ອສ້າງ BOQ (ຕ້ອງມີສັນຍາທີ່ອະນຸມັດແລ້ວ)"
        requireApprovedContract
      />
    </>
  );
}
