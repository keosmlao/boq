"use client";

import React from "react";
import CrossList from "../_components/CrossList";
import { getAllContractsForList } from "@/_actions/contracts";

export default function ContractsClient({ initialRows }: { initialRows: any[] }) {
  return (
    <CrossList
      title="ສັນຍາ"
      initialRows={initialRows}
      load={() => getAllContractsForList()}
      searchText={(r) => `${r.contract_no ?? ""} ${r.project_name ?? ""} ${r.customer_name ?? ""}`}
      rowHref={(r) => (r.src === "erp" ? `/contracts/${encodeURIComponent(r.contract_no || "")}` : `/contracts/${r.id}`)}
      searchPlaceholder="ຄົ້ນຫາ ເລກສັນຍາ, ໂຄງການ, ລູກຄ້າ..."
      empty="ຍັງບໍ່ມີສັນຍາ"
      groupBy={(r) => r.customer_name || "(ບໍ່ລະບຸລູກຄ້າ)"}
      subGroupBy={(r) => r.project_name || "(ບໍ່ລະບຸໂຄງການ)"}
      groupLabel="ຈັດກຸ່ມ: ລູກຄ້າ → ໂຄງການ"
      columns={[
        { header: "ເລກສັນຍາ", cell: (r) => <span className="font-mono text-[var(--theme-text)]">{r.contract_no || "-"}</span> },
        { header: "ໂຄງການ", cell: (r) => <span className="font-medium">{r.project_name || "-"}</span> },
        { header: "ລູກຄ້າ", cell: (r) => r.customer_name || "-" },
        {
          header: "ຝ່າຍຂາຍ",
          cell: (r) => <span className="text-slate-600">{r.sales_approved ? "ອະນຸມັດ" : "ລໍຖ້າ"}</span>,
        },
        {
          header: "ບັນຊີ",
          cell: (r) => <span className="text-slate-600">{r.accounting_approved ? "ອະນຸມັດ" : "ລໍຖ້າ"}</span>,
        },
      ]}
    />
  );
}
