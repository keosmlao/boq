"use client";

/** v2 — Work order detail (team, dates, tasks, hours, labour cost). */
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ClipboardList,
  FolderKanban,
  Users,
  CalendarClock,
  Clock,
  DollarSign,
  Wallet,
  PackageOpen,
  Truck,
  Wrench,
} from "lucide-react";
import { getWorkOrderById, deleteWorkOrder } from "@/_actions/workorder";
import {
  Page,
  PageHeader,
  Card,
  Btn,
  Pill,
  SectionHeader,
  tblCls,
  thCls,
  tdCls,
  trHover,
  type PillTone,
} from "../../_components/ui";
import DocActions from "../../_components/DocActions";
import WorkOrderJobPanel from "./WorkOrderJobPanel";
import { getV2User } from "../../../_lib/session";
import { can } from "@/_lib/permissions";
import { workOrderStage } from "@/_lib/workorder-stage";
import { useT } from "@/_lib/i18n";

const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "-";
};
const d10 = (v: unknown) => (v ? String(v).slice(0, 10) : "-");

const STAGE_PILL: Record<string, PillTone> = {
  issued: "blue",
  accepted: "brand",
  in_progress: "amber",
  awaiting_review: "amber",
  closed: "green",
  approval_rejected: "red",
  accept_rejected: "red",
};

export default function WorkOrderDetailPage() {
  const t = useT();
  const { id } = useParams();
  const router = useRouter();
  const user = getV2User();
  const [w, setW] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = React.useCallback(async () => {
    const res: any = await getWorkOrderById(String(id));
    setW(res?.success ? res.data : null);
  }, [id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await load();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id, load]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-3 text-[var(--text-mute)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--brand)]" />
        <span className="text-sm">{t("common.loading", "ກຳລັງໂຫຼດ...")}</span>
      </div>
    );
  }
  if (!w) {
    return <div className="px-4 py-10 text-center text-[var(--text-mute)]">{t("workorders.notFound", "ບໍ່ພົບໃບງານ")}</div>;
  }

  const tasks = Array.isArray(w.tasks) ? w.tasks : [];
  const mats = Array.isArray(w.materials) ? w.materials : [];
  const isErp = w.src === "erp";
  const stage = isErp ? null : workOrderStage(w);
  const statusLabel = isErp ? String(w.status || "-") : stage!.label;
  const statusTone: PillTone = isErp ? "neutral" : STAGE_PILL[stage!.key] || "neutral";

  const subtitle = [
    w.project_name,
    w.technician_name ? `${t("workorders.headCraftsman", "ຊ່າງຫຼັກ")}: ${w.technician_name}` : null,
    d10(w.work_date),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Page max="max-w-[1100px]">
      <PageHeader
        title={w.work_no || "-"}
        subtitle={subtitle}
        actions={
          <>
            <Pill tone={statusTone}>{statusLabel}</Pill>
            {!isErp && w.project_id && mats.length > 0 && (
              <Btn variant="go" onClick={() => router.push(`/projects/${w.project_id}/request/new?wo=${id}`)}>
                <PackageOpen size={14} /> {t("workorders.createRequisition", "ສ້າງໃບຂໍເບີກ")}
              </Btn>
            )}
            {w.project_id && (
              <Btn variant="outline" onClick={() => router.push(`/projects/${w.project_id}`)}>
                <FolderKanban size={14} /> {t("workorders.goToProject", "ໄປໜ້າໂຄງການ")}
              </Btn>
            )}
            <Btn variant="outline" onClick={() => router.push("/work-orders")}>
              <ArrowLeft size={14} /> {t("workorders.backToList", "ກັບໄປລາຍການໃບງານ")}
            </Btn>
            {!isErp && (
              <DocActions
                onDelete={() => deleteWorkOrder(String(id))}
                afterDelete="/work-orders"
                label={t("workorders.title", "ໃບງານ")}
                canDelete={can(user, "work-orders", "delete")}
              />
            )}
          </>
        }
      />

      <div className="space-y-5">
        {/* Mobile head-craftsman lifecycle: approve → accept → check-in → check-out */}
        <WorkOrderJobPanel wo={w} onChanged={load} />

        {/* Work order info */}
        <Card className="p-5">
          <SectionHeader icon={<Wrench size={14} />} title={t("workorders.info", "ຂໍ້ມູນໃບງານ")} tone="brand" />
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem
              icon={<Users size={14} />}
              label={t("workorders.headCraftsman", "ຊ່າງຫຼັກ")}
              value={w.technician_code ? `${w.technician_name || "-"} (${w.technician_code})` : w.technician_name}
            />
            <InfoItem
              icon={<Users size={14} />}
              label={t("workorders.helpers", "ຜູ້ຊ່ວຍຊ່າງ")}
              value={Array.isArray(w.helpers) && w.helpers.length ? w.helpers.join(", ") : "-"}
            />
            <InfoItem
              icon={<Truck size={14} />}
              label={t("workorders.vehicle", "ລົດຊ່າງ")}
              value={w.vehicle_plate ? `${w.vehicle_plate}${w.vehicle_name ? ` — ${w.vehicle_name}` : ""}` : w.vehicle_name}
            />
            <InfoItem icon={<CalendarClock size={14} />} label={t("workorders.startDate", "ວັນເລີ່ມ")} value={d10(w.work_date)} />
            <InfoItem icon={<CalendarClock size={14} />} label={t("workorders.endDate", "ວັນຈົບ")} value={d10(w.end_date)} />
            <InfoItem icon={<Wallet size={14} />} label={t("workorders.ratePerHour", "ອັດຕາ / ຊົ່ວໂມງ")} value={money(w.rate_per_hour)} />
            <InfoItem icon={<Clock size={14} />} label={t("workorders.totalHours", "ລວມຊົ່ວໂມງ")} value={String(Number(w.total_hours) || 0)} />
            <InfoItem icon={<DollarSign size={14} />} label={t("workorders.totalLaborCost", "ຄ່າແຮງທັງໝົດ")} value={money(w.labor_cost)} />
          </div>

          {w.notes && (
            <div className="mt-5 border-t border-[var(--border-soft)] pt-3">
              <span className="mb-1 block text-[11px] font-bold tracking-wider text-[var(--text-mute)]">{t("common.note", "ໝາຍເຫດ")}</span>
              <p className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-sunken)] p-2.5 text-[12.5px] leading-relaxed text-[var(--text-soft)]">
                {w.notes}
              </p>
            </div>
          )}
        </Card>

        {/* Tasks */}
        <Card className="overflow-hidden">
          <div className="px-5 pt-5">
            <SectionHeader
              icon={<ClipboardList size={14} />}
              title={`${t("workorders.tasks", "ໜ້າວຽກ")} (${tasks.length})`}
              tone="brand"
              className="mb-0"
            />
          </div>
          {tasks.length === 0 ? (
            <div className="px-5 py-10 text-center text-xs text-[var(--text-mute)]">{t("workorders.noTasks", "ບໍ່ມີໜ້າວຽກ")}</div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className={tblCls}>
                <thead>
                  <tr>
                    <th className={`${thCls} w-12 text-center`}>#</th>
                    <th className={thCls}>{t("workorders.tasks", "ໜ້າວຽກ")}</th>
                    <th className={`${thCls} w-32 text-right`}>{t("workorders.actualHours", "ຊົ່ວໂມງຈິງ")}</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task: any, i: number) => (
                    <tr key={i} className={trHover}>
                      <td className={`${tdCls} text-center font-mono text-[11px] text-[var(--text-mute)]`}>{i + 1}</td>
                      <td className={`${tdCls} font-semibold text-[var(--text)]`}>{task.title || "-"}</td>
                      <td className={`${tdCls} text-right font-semibold tabular-nums text-[var(--text)]`}>
                        {Number(task.actual_hours) || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Material template → admin issues the actual ໃບຂໍເບີກ from this (rounds) */}
        <Card className="overflow-hidden">
          <div className="px-5 pt-5">
            <SectionHeader
              icon={<PackageOpen size={14} />}
              title={`${t("workorders.materialsToRequest", "ວັດສະດຸທີ່ຕ້ອງເບີກ (template)")} (${mats.length})`}
              tone="cyan"
              className="mb-0"
            />
          </div>
          {mats.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-[var(--text-mute)]">{t("workorders.noMaterials", "ບໍ່ມີວັດສະດຸໃນ template")}</div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className={tblCls}>
                <thead>
                  <tr>
                    <th className={thCls}>{t("workorders.colItem", "ລາຍການ")}</th>
                    <th className={`${thCls} w-24 text-center`}>{t("inventory.unit", "ໜ່ວຍ")}</th>
                    <th className={`${thCls} w-28 text-right`}>{t("common.qty", "ຈຳນວນ")}</th>
                  </tr>
                </thead>
                <tbody>
                  {mats.map((m: any, i: number) => (
                    <tr key={i} className={trHover}>
                      <td className={`${tdCls} font-semibold text-[var(--text)]`}>{m.description || m.item_name || m.item_code || "-"}</td>
                      <td className={`${tdCls} text-center`}>
                        <Pill tone="neutral">{m.unit || m.unit_code || "-"}</Pill>
                      </td>
                      <td className={`${tdCls} text-right font-semibold tabular-nums text-[var(--text)]`}>{money(m.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-[var(--border-soft)] px-5 py-2 text-[11px] text-[var(--text-mute)]">
            {t("workorders.materialsNote", "ນີ້ແມ່ນ template ທີ່ຊ່າງຕ້ອງການ — admin ກົດ \"ສ້າງໃບຂໍເບີກ\" ເພື່ອອອກໃບຂໍເບີກຈິງ (ສ້າງໄດ້ຫຼາຍຮອບ).")}
          </p>
        </Card>
      </div>
    </Page>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text-mute)]">
        {icon}
      </span>
      <div className="min-w-0">
        <span className="mb-0.5 block text-[11px] font-bold tracking-wider text-[var(--text-mute)]">{label}</span>
        <span className="block break-words text-[13px] font-semibold text-[var(--text)]">{value || "-"}</span>
      </div>
    </div>
  );
}
