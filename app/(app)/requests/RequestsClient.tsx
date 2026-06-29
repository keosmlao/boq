"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import CrossList from "../_components/CrossList";
import ProjectPickerModal from "../_components/ProjectPickerModal";
import { Btn } from "../_components/ui";
import { getRequests } from "@/_actions/request-v2";
import { useT } from "@/_lib/i18n";

const d10 = (v: unknown) => {
  if (!v) return "-";
  const d = new Date(v as any);
  if (isNaN(d.getTime())) return String(v).slice(0, 10);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function RequestsClient({ initialRows }: { initialRows: any[] }) {
  const router = useRouter();
  const t = useT();
  const [pick, setPick] = useState(false);

  const stLabel = (s: string) =>
    s === "withdrawn"
      ? t("requests.withdrawn", "ເບີກແລ້ວ")
      : s === "rejected"
        ? t("status.rejected", "ປະຕິເສດ")
        : t("requests.requested", "ຮ້ອງຂໍ");

  return (
    <>
      <CrossList
        title={t("requests.title", "ຂໍເບີກ")}
        load={() => getRequests({})}
        initialRows={initialRows}
        searchText={(r) => `${r.request_no ?? ""} ${r.project_name ?? ""}`}
        rowHref={(r) => `/requests/${encodeURIComponent(r.id)}`}
        searchPlaceholder={t("requests.searchPlaceholder", "ຄົ້ນຫາ ເລກທີ່, ໂຄງການ...")}
        empty={t("requests.empty", "ຍັງບໍ່ມີການຂໍເບີກ")}
        groupBy={(r) =>
          r.src === "app" && r.status !== "withdrawn" && r.status !== "rejected"
            ? t("requests.fromAppGroup", "📱 ໃບຂໍຈາກຊ່າງ (ລໍດຶງ)")
            : r.project_name || t("requests.noProject", "(ບໍ່ລະບຸໂຄງການ)")
        }
        groupLabel={t("requests.groupByProject", "ຈັດກຸ່ມຕາມໂຄງການ")}
        headerActions={
          <Btn onClick={() => setPick(true)}>
            <Plus size={14} /> {t("requests.create", "ສ້າງໃບຂໍເບີກ")}
          </Btn>
        }
        columns={[
          { header: t("requests.docNo", "ເລກທີ່"), cell: (r) => <span className="font-mono text-[var(--theme-text)]">{r.request_no || "-"}</span> },
          { header: t("requests.project", "ໂຄງການ"), cell: (r) => <span className="font-medium">{r.project_name || "-"}</span> },
          { header: t("common.date", "ວັນທີ"), cell: (r) => d10(r.created_at) },
          { header: t("requests.items", "ລາຍການ"), align: "right", cell: (r) => (Array.isArray(r.items) ? r.items.length : 0) },
          {
            header: t("common.status", "ສະຖານະ"),
            cell: (r) => {
              const s = String(r.status || "requested");
              // App requests pending a pull stand out so staff convert them to a real requisition.
              if (r.src === "app" && s !== "withdrawn" && s !== "rejected") {
                return <span className="inline-flex items-center gap-1 rounded-full bg-pink-100 px-2 py-0.5 text-[11px] font-bold text-pink-700">📱 {t("requests.awaitingPull", "ລໍດຶງ (ຈากແອັບ)")}</span>;
              }
              return <span className="text-slate-600">{stLabel(s)}</span>;
            },
          },
        ]}
      />
      <ProjectPickerModal
        open={pick}
        onClose={() => setPick(false)}
        onPick={(p) => router.push(`/projects/${p.id}/request/new`)}
        title={t("requests.pickProject", "ເລືອກໂຄງການເພື່ອຂໍເບີກ")}
        requireBoq
      />
    </>
  );
}
