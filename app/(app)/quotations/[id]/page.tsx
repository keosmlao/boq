"use client";

/** v2 — Quotation detail (read view of one quotation + its line items). */
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ActivityFeed from "../../_components/ActivityFeed";
import { ArrowLeft, FolderKanban, CheckCircle2, XCircle, ListChecks, Loader2, Printer } from "lucide-react";
import { getQuotation, deleteQuotation, approveQuotation } from "@/_actions/quotations";
import { advanceProjectStage } from "@/_actions/projects";
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
import { getV2User } from "../../../_lib/session";
import { can } from "@/_lib/permissions";
import { useConfirm } from "../../_components/Confirm";
import { useT } from "@/_lib/i18n";

const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "-";
};
const d10 = (v: unknown) => (v ? String(v).slice(0, 10) : "-");

/** Approved → green, rejected → red, anything else (pending) → amber. */
const statusTone = (s: string): PillTone =>
  s === "ອະນຸມັດແລ້ວ" ? "green" : s === "ປະຕິເສດ" ? "red" : "amber";

export default function QuotationDetailPage() {
  const t = useT();
  const { id } = useParams();
  const router = useRouter();
  const confirm = useConfirm();
  const vatLabel = (v: unknown) => {
    const s = String(v ?? "");
    return s === "exclusive" ? t("quotations.vatExclusive", "ແຍກນອກ") : s === "inclusive" ? t("quotations.vatInclusive", "ລວມໃນ") : t("quotations.vatNone", "ບໍ່ມີ (0%)");
  };
  const [q, setQ] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const user = getV2User();
  const canApprove = can(user ? { role: user.role, permissions: user.permissions } : null, "quotations", "approve");

  const load = React.useCallback(async () => {
    const res: any = await getQuotation(String(id));
    setQ(res && res.success !== false ? res : null);
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
  }, [load]);

  const doApprove = async (newStatus: string) => {
    const isReject = newStatus === "ປະຕິເສດ";
    if (!(await confirm({ title: isReject ? t("quotations.confirmRejectTitle", "ຢືນຢັນການປະຕິເສດ") : t("quotations.confirmApproveTitle", "ຢືນຢັນການອະນຸມັດ"), message: isReject ? t("quotations.confirmRejectMsg", "ປະຕິເສດ ໃບສະເໜີລາຄາ?") : t("quotations.confirmApproveMsg", "ອະນຸມັດ ໃບສະເໜີລາຄາ?"), confirmLabel: isReject ? t("common.reject", "ປະຕິເສດ") : t("common.approve", "ອະນຸມັດ"), tone: isReject ? "danger" : "primary" }))) return;
    setBusy(true);
    try {
      const res: any = await approveQuotation(String(id), newStatus);
      if (res?.success === false) alert(res.message || t("common.error", "ບໍ່ສຳເລັດ"));
      // Stage follows the APPROVAL, wherever it happens (idempotent server-side).
      else if (newStatus === "ອະນຸມັດແລ້ວ" && q?.project_id) {
        await advanceProjectStage(String(q.project_id), "ສະເໜີລາຄາ").catch(() => {});
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-2.5 text-[var(--text-mute)]">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-[13px] font-semibold">{t("common.loading", "ກຳລັງໂຫຼດ...")}</span>
      </div>
    );
  }
  if (!q) {
    return (
      <div className="px-4 py-10 text-center text-[13px] font-semibold text-[var(--text-mute)]">
        {t("quotations.notFound", "ບໍ່ພົບໃບສະເໜີລາຄາ")}
      </div>
    );
  }

  const items = Array.isArray(q.items) ? q.items : [];
  const status = String(q.status || "ລໍຖ້າອະນຸມັດ");
  const subtitle = [q.project_name, q.customer_name].filter(Boolean).join(" · ");

  return (
    <Page max="max-w-[1100px]">
      <PageHeader
        title={q.quotation_no || "-"}
        subtitle={subtitle || undefined}
        actions={
          <>
            <Pill tone={statusTone(status)}>{status}</Pill>
            {canApprove && status === "ລໍຖ້າອະນຸມັດ" && (
              <>
                <Btn variant="go" disabled={busy} onClick={() => doApprove("ອະນຸມັດແລ້ວ")}>
                  <CheckCircle2 size={14} /> {t("common.approve", "ອະນຸມັດ")}
                </Btn>
                <Btn variant="danger-outline" disabled={busy} onClick={() => doApprove("ປະຕິເສດ")}>
                  <XCircle size={14} /> {t("common.reject", "ປະຕິເສດ")}
                </Btn>
              </>
            )}
            <Btn variant="outline" onClick={() => window.open(`/print/quotations/${id}`, "_blank")}>
              <Printer size={14} /> {t("quotations.printBill", "ພິມບິນ")}
            </Btn>
            <DocActions
              editHref={q.project_id ? `/projects/${q.project_id}/quotation/new?edit=${id}` : undefined}
              onDelete={() => deleteQuotation(String(id))}
              afterDelete="/quotations"
              label={t("quotations.docLabel", "ໃບສະເໜີ")}
              canEdit={can(user, "quotations", "edit")}
              canDelete={can(user, "quotations", "delete")}
            />
            <Btn variant="outline" onClick={() => router.push("/quotations")}>
              <ArrowLeft size={14} /> {t("quotations.backToList", "ກັບໄປລາຍການໃບສະເໜີ")}
            </Btn>
          </>
        }
      />

      {/* Quotation info */}
      <Card className="mb-4 p-5">
        <SectionHeader icon={<FolderKanban size={14} />} title={t("quotations.infoTitle", "ຂໍ້ມູນໃບສະເໜີ")} tone="brand" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <Info label={t("common.customer", "ລູກຄ້າ")} value={q.customer_name} />
          <Info label={t("common.phone", "ໂທ")} value={q.customer_phone} />
          <Info label={t("common.date", "ວັນທີ")} value={d10(q.quotation_date)} />
          <Info label={t("quotations.validUntil", "ມີຜົນເຖິງ")} value={d10(q.validity_date)} />
          <Info label={t("quotations.vatType", "ປະເພດ VAT")} value={vatLabel(q.tax_type)} />
          <Info label={t("quotations.address", "ທີ່ຢູ່")} value={q.customer_address} />
          <Info label={t("common.note", "ໝາຍເຫດ")} value={q.notes} full />
        </div>
      </Card>

      {/* Items */}
      <Card className="mb-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-5 pt-5">
          <SectionHeader icon={<ListChecks size={14} />} title={t("quotations.items", "ລາຍການ")} tone="cyan" />
          <span className="mb-4 rounded-full border border-[var(--border)] bg-[var(--surface-sunken)] px-2.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--text-mute)]">
            {items.length}
          </span>
        </div>
        {items.length === 0 ? (
          <div className="px-4 py-10 text-center text-[12.5px] text-[var(--text-mute)]">{t("quotations.noItems", "ບໍ່ມີລາຍການ")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className={tblCls}>
              <thead>
                <tr>
                  <th className={`${thCls} w-12 pl-5`}>#</th>
                  <th className={thCls}>{t("quotations.items", "ລາຍການ")}</th>
                  <th className={`${thCls} w-28`}>{t("quotations.brand", "ຍີ່ຫໍ້")}</th>
                  <th className={`${thCls} w-28`}>{t("quotations.category", "ປະເພດສິນຄ້າ")}</th>
                  <th className={`${thCls} w-24`}>{t("common.unit", "ໜ່ວຍ")}</th>
                  <th className={`${thCls} w-24 text-right`}>{t("common.qty", "ຈຳນວນ")}</th>
                  <th className={`${thCls} w-32 text-right`}>{t("common.price", "ລາຄາ")}</th>
                  <th className={`${thCls} w-32 pr-5 text-right`}>{t("quotations.lineTotal", "ລວມ")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it: any, i: number) => (
                  <tr key={i} className={trHover}>
                    <td className={`${tdCls} pl-5 tabular-nums text-[var(--text-mute)]`}>{i + 1}</td>
                    <td className={`${tdCls} font-semibold text-[var(--text)]`}>{it.description || it.item_name || "-"}</td>
                    <td className={tdCls}>{it.brand || "-"}</td>
                    <td className={tdCls}>{it.category || "-"}</td>
                    <td className={tdCls}>{it.unit || "-"}</td>
                    <td className={`${tdCls} text-right tabular-nums`}>{money(it.qty)}</td>
                    <td className={`${tdCls} text-right tabular-nums`}>{money(it.unit_price)}</td>
                    <td className={`${tdCls} pr-5 text-right font-bold tabular-nums text-[var(--text)]`}>
                      {money(it.amount ?? (Number(it.qty) || 0) * (Number(it.unit_price) || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Totals */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {q.project_id && (
            <Btn variant="outline" onClick={() => router.push(`/projects/${q.project_id}`)}>
              <FolderKanban size={14} /> {t("quotations.goToProject", "ໄປໜ້າໂຄງການ")}
            </Btn>
          )}
        </div>
        <Card className="w-full max-w-sm p-5">
          <div className="space-y-2.5 text-[12.5px] font-semibold">
            <div className="flex justify-between">
              <span className="text-[var(--text-mute)]">{t("quotations.subtotal", "ລວມຍ່ອຍ")}</span>
              <span className="tabular-nums text-[var(--text)]">{money(q.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-mute)]">{t("quotations.discount", "ສ່ວນຫຼຸດ")}</span>
              <span className="tabular-nums text-[var(--text)]">{money(q.discount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-mute)]">VAT</span>
              <span className="tabular-nums text-[var(--text)]">{money(q.tax)}</span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-[var(--border-soft)] pt-3">
            <span className="text-xs font-black tracking-wider text-[var(--text)]">{t("quotations.grandTotal", "ລວມທັງໝົດ")}</span>
            <span className="text-lg font-black tabular-nums tracking-tight text-[var(--text)]">{money(q.total_amount)}</span>
          </div>
        </Card>
      </div>

      <div className="mt-5"><ActivityFeed entityType="quotation" entityId={String(id)} /></div>
    </Page>
  );
}

function Info({ label, value, full }: { label: string; value: any; full?: boolean }) {
  return (
    <div className={full ? "col-span-2 border-t border-[var(--border-soft)] pt-3 sm:col-span-3" : ""}>
      <div className="text-[10.5px] font-bold tracking-wider text-[var(--text-mute)]">{label}</div>
      <div className="mt-0.5 text-[12.5px] font-semibold leading-relaxed text-[var(--text)]">{value || "-"}</div>
    </div>
  );
}
