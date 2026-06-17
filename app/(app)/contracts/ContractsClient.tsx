"use client";

import React from "react";
import CrossList from "../_components/CrossList";
import { getAllContractsForList } from "@/_actions/contracts";
import { useT } from "@/_lib/i18n";

export default function ContractsClient({ initialRows }: { initialRows: any[] }) {
  const t = useT();
  return (
    <CrossList
      title={t("contracts.title", "ສັນຍາ")}
      initialRows={initialRows}
      load={() => getAllContractsForList()}
      searchText={(r) => `${r.contract_no ?? ""} ${r.project_name ?? ""} ${r.customer_name ?? ""}`}
      rowHref={(r) => (r.src === "erp" ? `/contracts/${encodeURIComponent(r.contract_no || "")}` : `/contracts/${r.id}`)}
      searchPlaceholder={t("contracts.searchPlaceholder", "ຄົ້ນຫາ ເລກສັນຍາ, ໂຄງການ, ລູກຄ້າ...")}
      empty={t("contracts.empty", "ຍັງບໍ່ມີສັນຍາ")}
      groupBy={(r) => r.customer_name || "(ບໍ່ລະບຸລູກຄ້າ)"}
      subGroupBy={(r) => r.project_name || "(ບໍ່ລະບຸໂຄງການ)"}
      groupLabel={t("contracts.groupLabel", "ຈັດກຸ່ມ: ລູກຄ້າ → ໂຄງການ")}
      columns={[
        { header: t("contracts.contractNo", "ເລກສັນຍາ"), cell: (r) => <span className="font-mono text-[var(--theme-text)]">{r.contract_no || "-"}</span> },
        { header: t("boq.project", "ໂຄງການ"), cell: (r) => <span className="font-medium">{r.project_name || "-"}</span> },
        { header: t("common.customer", "ລູກຄ້າ"), cell: (r) => r.customer_name || "-" },
        {
          header: t("contracts.sales", "ຝ່າຍຂາຍ"),
          cell: (r) => <span className="text-slate-600">{r.sales_approved ? t("common.approve", "ອະນຸມັດ") : t("contracts.waiting", "ລໍຖ້າ")}</span>,
        },
        {
          header: t("contracts.accounting", "ບັນຊີ"),
          cell: (r) => <span className="text-slate-600">{r.accounting_approved ? t("common.approve", "ອະນຸມັດ") : t("contracts.waiting", "ລໍຖ້າ")}</span>,
        },
      ]}
    />
  );
}
