"use client";

/** v2 — Contract detail (read view of one contract + its line items). */
import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ActivityFeed from "../../_components/ActivityFeed";
import { ArrowLeft, FolderKanban, CheckCircle2, Circle, ListChecks, Check, Paperclip, Loader2, Wallet } from "lucide-react";
import { getContract, getLegacyContract, deleteContract, setContractApproval } from "@/_actions/contracts";
import { deleteProjectContract, approveProjectAction, advanceProjectStage } from "@/_actions/projects";
import { isContractApproved } from "@/_components/pipeline";
import { checkAccountingApprove } from "@/_actions/boq";
import { Page, PageHeader, Card, Btn, Pill, SectionHeader, tblCls, thCls, tdCls, trHover } from "../../_components/ui";
import DocActions from "../../_components/DocActions";
import { getV2User } from "../../../_lib/session";
import { can } from "@/_lib/permissions";
import { useConfirm } from "../../_components/Confirm";
import { useT } from "@/_lib/i18n";

const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "-";
};
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const d10 = (v: unknown) => (v ? String(v).slice(0, 10) : "-");

export default function ContractDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const confirm = useConfirm();
  const t = useT();
  const user = getV2User();
  const [c, setC] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      let data: any = null;
      const res: any = await getContract(String(id));
      if (res && res.success !== false) data = res;
      else {
        const lr: any = await getLegacyContract(String(id));
        if (lr?.success) data = lr.data;
      }
      setC(data);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-2.5 text-[var(--text-mute)]">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-[13px] font-semibold">{t("common.loading", "ກຳລັງໂຫຼດ...")}</span>
      </div>
    );
  }
  if (!c) {
    return (
      <div className="px-4 py-10 text-center text-[13px] font-semibold text-[var(--text-mute)]">
        {t("contracts.notFound", "ບໍ່ພົບສັນຍາ")}
      </div>
    );
  }

  const items = Array.isArray(c.items) ? c.items : [];
  // Complete only when BOTH approvals are in — same rule as the project stepper.
  const full = isContractApproved(c);
  const salesApproved = !!c.sales_approved;
  const accountingApproved = !!c.accounting_approved;
  const canApproveContract = can(user, "contracts", "approve");
  const itemsTotal = items.reduce((s: number, it: any) => s + (it.amount != null ? num(it.amount) : num(it.qty) * num(it.unit_price)), 0);
  const isErp = c.src === "erp";
  const subtitle = [c.project_name, c.customer_name].filter(Boolean).join(" · ");

  const currentUser = () => {
    try { return JSON.parse(localStorage.getItem("v2_user") || "{}"); } catch { return {}; }
  };

  /** A fully approved contract (sales AND accounting) advances the project to ສັນຍາ. */
  const advanceIfApproved = async () => {
    if (c.project_id) await advanceProjectStage(String(c.project_id), "ສັນຍາ").catch(() => {});
  };

  // v2 contracts (odg_contract): two-step toggle, supports undo.
  const setStep = async (which: "sales" | "accounting", approved: boolean) => {
    if (approved && !(await confirm({ title: t("contracts.confirmApproveTitle", "ຢືນຢັນການອະນຸມັດ"), message: which === "sales" ? t("contracts.approveSalesQ", "ອະນຸມັດຝ່າຍຂາຍ?") : t("contracts.approveAccountingQ", "ອະນຸມັດຝ່າຍບັນຊີ?"), confirmLabel: t("common.approve", "ອະນຸມັດ") }))) return;
    const approver = currentUser().name || "";
    const res: any = await setContractApproval(String(id), which, approved, approver);
    if (res?.success) {
      if (approved) await advanceIfApproved();
      reload();
    } else {
      alert(res?.message || t("contracts.failed", "ບໍ່ສຳເລັດ"));
    }
  };

  // Legacy ERP contracts (odg_projects_contract): approve-only (no undo in ERP).
  // Sales writes approve_status_1 + bumps the project to "ready for withdrawal";
  // accounting writes approve_status_2/acc_approve.
  const approveErp = async (which: "sales" | "accounting") => {
    const u = currentUser();
    const username = u.username || u.name || "";
    if (which === "sales" && !c.project_id) {
      alert(t("contracts.noProjectCannotApprove", "ສັນຍານີ້ບໍ່ມີໂຄງການ ຈຶ່ງອະນຸມັດຝ່າຍຂາຍບໍ່ໄດ້"));
      return;
    }
    if (!(await confirm({ title: t("contracts.confirmApproveTitle", "ຢືນຢັນການອະນຸມັດ"), message: which === "sales" ? t("contracts.approveSalesQ", "ອະນຸມັດຝ່າຍຂາຍ?") : t("contracts.approveAccountingQ", "ອະນຸມັດຝ່າຍບັນຊີ?"), confirmLabel: t("common.approve", "ອະນຸມັດ") }))) return;
    const res: any = which === "sales"
      ? await approveProjectAction(String(c.project_id), { username, contract_no: c.contract_no })
      : await checkAccountingApprove(String(c.contract_no), { username, project_id: c.project_id ? String(c.project_id) : undefined });
    if (res?.success) {
      await advanceIfApproved();
      reload();
    } else {
      alert(res?.message || t("contracts.failed", "ບໍ່ສຳເລັດ"));
    }
  };

  return (
    <Page max="max-w-[1100px]">
      <PageHeader
        title={c.contract_no || "-"}
        subtitle={subtitle || undefined}
        actions={
          <>
            <Pill tone={full ? "green" : "amber"}>{full ? t("contracts.complete", "ສົມບູນ") : t("status.pending", "ລໍຖ້າອະນຸມັດ")}</Pill>
            {c.src === "erp" ? (
              <DocActions
                onDelete={() => deleteProjectContract(String(c.project_id), String(c.contract_no))}
                afterDelete="/contracts"
                label={t("contracts.title", "ສັນຍາ")}
                canDelete={can(user, "contracts", "delete")}
              />
            ) : (
              <DocActions
                editHref={c.project_id ? `/projects/${c.project_id}/contract/new?edit=${id}` : undefined}
                onDelete={() => deleteContract(String(id))}
                afterDelete="/contracts"
                label={t("contracts.title", "ສັນຍາ")}
                canEdit={can(user, "contracts", "edit")}
                canDelete={can(user, "contracts", "delete")}
              />
            )}
            <Btn variant="outline" onClick={() => router.push("/contracts")}>
              <ArrowLeft size={14} /> {t("contracts.backToList", "ກັບໄປລາຍການສັນຍາ")}
            </Btn>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <SectionHeader icon={<FolderKanban size={14} />} title={t("contracts.infoTitle", "ຂໍ້ມູນສັນຍາ")} tone="brand" />
          <div className="grid grid-cols-2 gap-x-5 gap-y-3.5 xl:grid-cols-3">
            <Info label={t("common.customer", "ລູກຄ້າ")} value={c.customer_name} />
            <Info label={t("common.phone", "ໂທ")} value={c.customer_phone} />
            <Info label={t("contracts.signDate", "ວັນເຊັນ")} value={d10(c.sign_date)} />
            <Info label={t("contracts.startDate", "ເລີ່ມ")} value={d10(c.start_date)} />
            <Info label={t("contracts.endDate", "ສິ້ນສຸດ")} value={d10(c.end_date)} />
            <Info label={t("common.amount", "ມູນຄ່າ")} value={money(c.total_amount)} />
            <Info label={t("contracts.paymentTerms", "ເງື່ອນໄຂຈ່າຍ")} value={c.payment_terms} full />
            <Info label={t("common.note", "ໝາຍເຫດ")} value={c.notes} full />
          </div>

          {Array.isArray(c.installments) && c.installments.length > 0 && (
            <div className="mt-4 border-t border-[var(--border-soft)] pt-3">
              <div className="mb-2 text-[11px] font-bold tracking-wider text-[var(--text-mute)]">{t("contracts.installments", "ງວດການຊຳລະ")}</div>
              <ul className="space-y-1.5">
                {c.installments.map((it: any, i: number) => (
                  <li key={i} className="flex items-center justify-between rounded-lg border border-[var(--border-soft)] bg-[var(--surface-sunken)] px-3 py-1.5 text-[12.5px]">
                    <span className="text-[var(--text-soft)]">{t("contracts.installmentNo", "ງວດ")} {it.installment_no}{it.items?.[0]?.description ? ` · ${it.items[0].description}` : ""}</span>
                    <b className="tabular-nums text-[var(--text)]">{money(it.total_amount)} {t("common.kip", "ບາດ")}</b>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(c.attachments) && c.attachments.length > 0 && (
            <div className="mt-4 border-t border-[var(--border-soft)] pt-3">
              <div className="mb-2 text-[11px] font-bold tracking-wider text-[var(--text-mute)]">{t("contracts.attachments", "ເອກະສານແນບ")}</div>
              <ul className="space-y-1.5">
                {c.attachments.map((a: any, i: number) => (
                  <li key={i}>
                    <a href={a.file_path} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--brand)] hover:underline">
                      <Paperclip size={13} /> {a.file_name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <SectionHeader icon={<Wallet size={14} />} title={t("contracts.contractValue", "ມູນຄ່າສັນຍາ")} tone="neutral" />
            <div className="text-2xl font-black tabular-nums tracking-tight text-[var(--text)]">{money(c.total_amount)}</div>
          </Card>

          <Card className="p-5">
            <SectionHeader icon={<CheckCircle2 size={14} />} title={t("contracts.approvalTitle", "ການອະນຸມັດ")} tone="emerald" />
            <div className="space-y-2.5">
              <ApprovalRow
                label={t("contracts.sales", "ຝ່າຍຂາຍ")}
                step={1}
                approved={salesApproved}
                who={c.sales_approver}
                onApprove={isErp ? () => approveErp("sales") : () => setStep("sales", true)}
                onUndo={isErp ? undefined : () => setStep("sales", false)}
              />
              {/* Accounting — the second half of a complete contract (isContractApproved). */}
              <ApprovalRow
                label={t("contracts.accounting", "ບັນຊີ")}
                step={2}
                approved={accountingApproved}
                who={c.accounting_approver}
                locked={!salesApproved}
                lockedHint={t("contracts.waitSalesApprove", "ລໍຖ້າຝ່າຍຂາຍອະນຸມັດ")}
                onApprove={
                  canApproveContract
                    ? isErp
                      ? () => approveErp("accounting")
                      : () => setStep("accounting", true)
                    : undefined
                }
                onUndo={!isErp && canApproveContract ? () => setStep("accounting", false) : undefined}
              />
            </div>
            {isErp && (
              <p className="mt-3 text-[10.5px] font-semibold text-[var(--text-mute)]">{t("contracts.erpNoUndo", "ສັນຍາເກົ່າ — ການອະນຸມັດບໍ່ສາມາດຍົກເລີກໄດ້")}</p>
            )}
          </Card>
        </div>
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-5 pt-5">
          <SectionHeader icon={<ListChecks size={14} />} title={t("boq.item", "ລາຍການ")} tone="cyan" />
          <span className="mb-4 rounded-full border border-[var(--border)] bg-[var(--surface-sunken)] px-2.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--text-mute)]">
            {items.length} {t("boq.itemUnit", "ລາຍການ")}
          </span>
        </div>
        {items.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3 text-[var(--text-mute)]">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-sunken)] text-[var(--text-mute)]">
              <ListChecks className="h-7 w-7" />
            </div>
            <span className="text-[12.5px] font-semibold">{t("boq.noItems", "ບໍ່ມີລາຍການ")}</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={tblCls}>
              <thead>
                <tr>
                  <th className={`${thCls} w-8 pl-5`}>#</th>
                  <th className={thCls}>{t("boq.item", "ລາຍການ")}</th>
                  <th className={`${thCls} w-24`}>{t("common.unit", "ໜ່ວຍ")}</th>
                  <th className={`${thCls} w-24 text-right`}>{t("common.qty", "ຈຳນວນ")}</th>
                  <th className={`${thCls} w-32 text-right`}>{t("common.price", "ລາຄາ")}</th>
                  <th className={`${thCls} w-32 pr-5 text-right`}>{t("contracts.lineTotal", "ລວມ")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it: any, i: number) => (
                  <tr key={i} className={trHover}>
                    <td className={`${tdCls} pl-5 tabular-nums text-[var(--text-mute)]`}>{i + 1}</td>
                    <td className={`${tdCls} font-semibold text-[var(--text)]`}>{it.description || it.item_name || "-"}</td>
                    <td className={tdCls}>{it.unit || "-"}</td>
                    <td className={`${tdCls} text-right tabular-nums`}>{money(it.qty)}</td>
                    <td className={`${tdCls} text-right tabular-nums`}>{money(it.unit_price)}</td>
                    <td className={`${tdCls} pr-5 text-right font-bold tabular-nums text-[var(--text)]`}>
                      {money(it.amount ?? num(it.qty) * num(it.unit_price))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--surface-sunken)]">
                  <td className="border-t border-[var(--border)] px-5 py-3 text-[11px] font-black tracking-wider text-[var(--text-soft)]" colSpan={5}>
                    {t("contracts.grandTotal", "ລວມມູນຄ່າ")}
                  </td>
                  <td className="border-t border-[var(--border)] px-5 py-3 pr-5 text-right text-[14px] font-black tabular-nums text-[var(--text)]">
                    {money(itemsTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {c.project_id && (
        <div className="mt-4">
          <Btn variant="outline" onClick={() => router.push(`/projects/${c.project_id}`)}>
            <FolderKanban size={14} /> {t("boq.goToProject", "ໄປໜ້າໂຄງການ")}
          </Btn>
        </div>
      )}

      <div className="mt-5"><ActivityFeed entityType="contract" entityId={String(id)} /></div>
    </Page>
  );
}

function Info({ label, value, full }: { label: string; value: any; full?: boolean }) {
  return (
    <div className={full ? "col-span-2 xl:col-span-3" : ""}>
      <div className="text-[10.5px] font-bold tracking-wider text-[var(--text-mute)]">{label}</div>
      <div className="mt-0.5 text-[12.5px] font-semibold text-[var(--text)]">{value || "—"}</div>
    </div>
  );
}

function ApprovalRow({
  label,
  step,
  approved,
  who,
  locked,
  lockedHint,
  onApprove,
  onUndo,
}: {
  label: string;
  step?: number;
  approved: boolean;
  who?: string;
  locked?: boolean;
  lockedHint?: string;
  onApprove?: () => void;
  onUndo?: () => void;
}) {
  const t = useT();
  // A locked step (its prerequisite isn't approved yet) can't be approved.
  const blocked = !!locked && !approved;
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
        approved
          ? "border-[var(--success-soft)] bg-[var(--success-soft)]"
          : blocked
            ? "border-[var(--border)] bg-[var(--surface-sunken)] opacity-70"
            : "border-[var(--border)] bg-[var(--surface-sunken)]"
      }`}
    >
      <span
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
          approved ? "bg-[var(--surface)] text-[var(--success)]" : "bg-[var(--surface)] text-[var(--text-mute)]"
        }`}
      >
        {approved ? <CheckCircle2 size={16} /> : <Circle size={16} />}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--text)]">
          {step != null && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--surface)] text-[9px] font-black text-[var(--text-mute)]">{step}</span>
          )}
          {label}
        </div>
        <div className="truncate text-[10.5px] font-semibold text-[var(--text-mute)]">
          {approved ? who || t("status.approved", "ອະນຸມັດແລ້ວ") : blocked ? lockedHint || t("contracts.waitPrevStep", "ລໍຖ້າຂັ້ນຕອນກ່ອນໜ້າ") : t("status.pending", "ລໍຖ້າອະນຸມັດ")}
        </div>
      </div>
      <span className="ml-auto flex flex-shrink-0 items-center gap-2">
        {approved ? (
          <>
            <Pill tone="green">{t("common.approve", "ອະນຸມັດ")}</Pill>
            {onUndo && (
              <button onClick={onUndo} className="text-[10px] font-bold text-[var(--text-mute)] transition-colors hover:text-[var(--danger)]">
                {t("common.cancel", "ຍົກເລີກ")}
              </button>
            )}
          </>
        ) : blocked ? (
          <Pill tone="neutral">{t("contracts.locked", "ລ໋ອກ")}</Pill>
        ) : onApprove ? (
          <button
            onClick={onApprove}
            className="inline-flex h-7 items-center gap-1 rounded-lg bg-[var(--go)] px-2.5 text-[11px] font-bold text-white transition-all hover:bg-[var(--go-hover)] active:scale-[0.97]"
          >
            <Check size={12} strokeWidth={2.5} /> {t("common.approve", "ອະນຸມັດ")}
          </button>
        ) : (
          <Pill tone="amber">{t("contracts.waiting", "ລໍຖ້າ")}</Pill>
        )}
      </span>
    </div>
  );
}
