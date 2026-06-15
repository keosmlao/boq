"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import CrossList from "../_components/CrossList";
import ProjectPickerModal from "../_components/ProjectPickerModal";
import { Pill, Btn } from "../_components/ui";
import { getRequests } from "@/_actions/request-v2";

const d10 = (v: unknown) => {
  if (!v) return "-";
  const d = new Date(v as any);
  if (isNaN(d.getTime())) return String(v).slice(0, 10);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const stLabel = (s: string) => (s === "withdrawn" ? "ເບີກແລ້ວ" : s === "rejected" ? "ປະຕິເສດ" : "ຮ້ອງຂໍ");
const stTone = (s: string) => (s === "withdrawn" ? "green" : s === "rejected" ? "red" : "amber");

export default function RequestsListPage() {
  const router = useRouter();
  const [pick, setPick] = useState(false);

  return (
    <>
      <CrossList
        title="ຂໍເບີກ"
        load={() => getRequests({})}
        searchText={(r) => `${r.request_no ?? ""} ${r.project_name ?? ""}`}
        rowHref={(r) => `/requests/${encodeURIComponent(r.id)}`}
        searchPlaceholder="ຄົ້ນຫາ ເລກທີ່, ໂຄງການ..."
        empty="ຍັງບໍ່ມີການຂໍເບີກ"
        headerActions={
          <Btn onClick={() => setPick(true)}>
            <Plus size={14} /> ສ້າງໃບຂໍເບີກ
          </Btn>
        }
        columns={[
          { header: "ເລກທີ່", cell: (r) => <span className="font-mono text-[var(--theme-text)]">{r.request_no || "-"}</span> },
          { header: "ໂຄງການ", cell: (r) => <span className="font-medium">{r.project_name || "-"}</span> },
          { header: "ວັນທີ", cell: (r) => d10(r.created_at) },
          { header: "ລາຍການ", align: "right", cell: (r) => (Array.isArray(r.items) ? r.items.length : 0) },
          { header: "ສະຖານະ", cell: (r) => <Pill tone={stTone(String(r.status || "")) as any}>{stLabel(String(r.status || "requested"))}</Pill> },
        ]}
      />
      <ProjectPickerModal
        open={pick}
        onClose={() => setPick(false)}
        onPick={(p) => router.push(`/projects/${p.id}/request/new`)}
        title="ເລືອກໂຄງການເພື່ອຂໍເບີກ"
      />
    </>
  );
}
