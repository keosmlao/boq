"use client";

/** v2 — Contract detail (read view of one contract + its line items). */
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ActivityFeed from "../../_components/ActivityFeed";
import { ArrowLeft, FileSignature, FolderKanban, CheckCircle2, Circle, ListChecks, Check } from "lucide-react";
import { getContract, getLegacyContract, deleteContract, setContractApproval } from "@/_actions/contracts";
import { deleteProjectContract, approveProjectAction } from "@/_actions/projects";
import { checkAccountingApprove } from "@/_actions/boq";
import { Page, Card, Btn, Pill, SectionHeader, tblCls, thCls, tdCls } from "../../_components/ui";
import DocActions from "../../_components/DocActions";

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
  const [c, setC] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let data: any = null;
        const res: any = await getContract(String(id));
        if (res && res.success !== false) data = res;
        else {
          const lr: any = await getLegacyContract(String(id));
          if (lr?.success) data = lr.data;
        }
        if (alive) setC(data);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-3 text-slate-400">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
        <span className="text-sm font-semibold">ກຳລັງໂຫຼດ...</span>
      </div>
    );
  }
  if (!c) {
    return <div className="px-4 py-10 text-center text-sm font-semibold text-slate-400">ບໍ່ພົບສັນຍາ</div>;
  }

  const items = Array.isArray(c.items) ? c.items : [];
  const full = !!c.sales_approved && !!c.accounting_approved;
  const itemsTotal = items.reduce((s: number, it: any) => s + (it.amount != null ? num(it.amount) : num(it.qty) * num(it.unit_price)), 0);
  const isErp = c.src === "erp";

  const currentUser = () => {
    try { return JSON.parse(localStorage.getItem("v2_user") || "{}"); } catch { return {}; }
  };

  // v2 contracts (odg_contract): two-step toggle, supports undo.
  const setStep = async (which: "sales" | "accounting", approved: boolean) => {
    const approver = currentUser().name || "";
    const res: any = await setContractApproval(String(id), which, approved, approver);
    if (res?.success) {
      const flag = which === "sales" ? "sales_approved" : "accounting_approved";
      const who = which === "sales" ? "sales_approver" : "accounting_approver";
      setC((prev: any) => (prev ? { ...prev, [flag]: approved, [who]: approved ? approver : null } : prev));
    } else {
      alert(res?.message || "ບໍ່ສຳເລັດ");
    }
  };

  // Legacy ERP contracts (odg_projects_contract): approve-only (no undo in ERP).
  // Sales writes approve_status_1 + bumps the project to "ready for withdrawal";
  // accounting writes approve_status_2/acc_approve.
  const approveErp = async (which: "sales" | "accounting") => {
    const u = currentUser();
    const username = u.username || u.name || "";
    if (which === "sales" && !c.project_id) {
      alert("ສັນຍານີ້ບໍ່ມີໂຄງການ ຈຶ່ງອະນຸມັດຝ່າຍຂາຍບໍ່ໄດ້");
      return;
    }
    const res: any = which === "sales"
      ? await approveProjectAction(String(c.project_id), { username, contract_no: c.contract_no })
      : await checkAccountingApprove(String(c.contract_no), { username, project_id: c.project_id ? String(c.project_id) : undefined });
    if (res?.success) {
      const flag = which === "sales" ? "sales_approved" : "accounting_approved";
      const who = which === "sales" ? "sales_approver" : "accounting_approver";
      setC((prev: any) => (prev ? { ...prev, [flag]: true, [who]: u.name || username } : prev));
    } else {
      alert(res?.message || "ບໍ່ສຳເລັດ");
    }
  };

  return (
    <Page max="max-w-none">
      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          onClick={() => router.push("/contracts")}
          className="group inline-flex items-center gap-2 text-xs font-bold text-slate-500 transition-colors hover:text-blue-600"
        >
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" /> ກັບໄປລາຍການສັນຍາ
        </button>
        {c.src === "erp" ? (
          <DocActions
            onDelete={() => deleteProjectContract(String(c.project_id), String(c.contract_no))}
            afterDelete="/contracts"
            label="ສັນຍາ"
          />
        ) : (
          <DocActions
            editHref={c.project_id ? `/projects/${c.project_id}/contract/new?edit=${id}` : undefined}
            onDelete={() => deleteContract(String(id))}
            afterDelete="/contracts"
            label="ສັນຍາ"
          />
        )}
      </div>

      {/* Brand header — blue gradient */}
      <div className="relative mb-4 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 p-5 shadow-md shadow-blue-600/15">
        <div className="pointer-events-none absolute -right-6 -top-8 opacity-[0.12]">
          <FileSignature size={150} className="text-white" />
        </div>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white">
              <FileSignature size={24} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/80">ສັນຍາ</div>
              <h1 className="font-display truncate text-2xl font-bold tracking-tight text-white">{c.contract_no || "-"}</h1>
              <p className="mt-0.5 truncate text-xs font-medium text-white/80">
                {c.project_name || ""}{c.customer_name ? ` · ${c.customer_name}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Pill tone={full ? "green" : "amber"}>{full ? "ສົມບູນ" : "ລໍຖ້າອະນຸມັດ"}</Pill>
            <div className="text-right">
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">ມູນຄ່າສັນຍາ</div>
              <div className="font-display text-xl font-bold tabular-nums text-white">{money(c.total_amount)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <SectionHeader icon={<FolderKanban size={15} />} title="ຂໍ້ມູນສັນຍາ" tone="blue" />
          <div className="grid grid-cols-2 gap-x-5 gap-y-3.5 xl:grid-cols-3">
            <Info label="ລູກຄ້າ" value={c.customer_name} />
            <Info label="ໂທ" value={c.customer_phone} />
            <Info label="ວັນເຊັນ" value={d10(c.sign_date)} />
            <Info label="ເລີ່ມ" value={d10(c.start_date)} />
            <Info label="ສິ້ນສຸດ" value={d10(c.end_date)} />
            <Info label="ມູນຄ່າ" value={money(c.total_amount)} />
            <Info label="ເງື່ອນໄຂຈ່າຍ" value={c.payment_terms} full />
            <Info label="ໝາຍເຫດ" value={c.notes} full />
          </div>
        </Card>
        <Card className="p-5">
          <SectionHeader icon={<CheckCircle2 size={15} />} title="ການອະນຸມັດ" tone="emerald" />
          <div className="space-y-2.5">
            <ApprovalRow
              label="ຝ່າຍຂາຍ"
              step={1}
              approved={!!c.sales_approved}
              who={c.sales_approver}
              onApprove={isErp ? () => approveErp("sales") : () => setStep("sales", true)}
              // Can't un-approve sales while accounting still depends on it.
              onUndo={isErp || c.accounting_approved ? undefined : () => setStep("sales", false)}
            />
            <ApprovalRow
              label="ບັນຊີ"
              step={2}
              approved={!!c.accounting_approved}
              who={c.accounting_approver}
              locked={!c.sales_approved}
              lockedHint="ລໍຖ້າຝ່າຍຂາຍອະນຸມັດກ່ອນ"
              onApprove={isErp ? () => approveErp("accounting") : () => setStep("accounting", true)}
              onUndo={isErp ? undefined : () => setStep("accounting", false)}
            />
          </div>
          {isErp && (
            <p className="mt-3 text-[10.5px] font-semibold text-slate-400">ສັນຍາເກົ່າ — ການອະນຸມັດບໍ່ສາມາດຍົກເລີກໄດ້</p>
          )}
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-3.5">
          <h2 className="flex items-center gap-2.5 text-sm font-black text-slate-800">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600 ring-1 ring-cyan-100">
              <ListChecks size={15} />
            </span>
            ລາຍການ
          </h2>
          <span className="font-display rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-500">
            {items.length} ລາຍການ
          </span>
        </div>
        {items.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3 text-slate-400">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-300">
              <ListChecks className="h-7 w-7" />
            </div>
            <span className="text-sm font-semibold">ບໍ່ມີລາຍການ</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={tblCls}>
              <thead>
                <tr>
                  <th className={`${thCls} w-8 pl-5`}>#</th>
                  <th className={thCls}>ລາຍການ</th>
                  <th className={`${thCls} w-24`}>ໜ່ວຍ</th>
                  <th className={`${thCls} w-24 text-right`}>ຈຳນວນ</th>
                  <th className={`${thCls} w-32 text-right`}>ລາຄາ</th>
                  <th className={`${thCls} w-32 pr-5 text-right`}>ລວມ</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it: any, i: number) => (
                  <tr key={i} className="transition-colors hover:bg-blue-50/40">
                    <td className={`${tdCls} pl-5 text-slate-400`}>{i + 1}</td>
                    <td className={`${tdCls} font-bold text-slate-900`}>{it.description || it.item_name || "-"}</td>
                    <td className={`${tdCls} text-slate-500`}>{it.unit || "-"}</td>
                    <td className={`${tdCls} text-right font-mono tabular-nums text-slate-700`}>{money(it.qty)}</td>
                    <td className={`${tdCls} text-right font-mono tabular-nums text-slate-700`}>{money(it.unit_price)}</td>
                    <td className={`${tdCls} pr-5 text-right font-mono font-bold tabular-nums text-slate-900`}>
                      {money(it.amount ?? num(it.qty) * num(it.unit_price))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50/70">
                  <td className="px-5 py-3 text-[12px] font-black uppercase tracking-wider text-slate-700" colSpan={5}>ລວມມູນຄ່າ</td>
                  <td className="px-5 py-3 pr-5 text-right font-mono text-[14px] font-black tabular-nums text-blue-700">{money(itemsTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {c.project_id && (
        <div className="mt-4">
          <Btn variant="outline" onClick={() => router.push(`/projects/${c.project_id}`)}>
            <FolderKanban size={14} /> ໄປໜ້າໂຄງການ
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
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-0.5 text-[13px] font-bold text-slate-800">{value || "—"}</div>
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
  // A locked step (its prerequisite isn't approved yet) can't be approved.
  const blocked = !!locked && !approved;
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
        approved ? "border-emerald-200 bg-emerald-50/50" : blocked ? "border-slate-200 bg-slate-50/40 opacity-70" : "border-slate-200 bg-slate-50/60"
      }`}
    >
      <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${approved ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
        {approved ? <CheckCircle2 size={16} /> : <Circle size={16} />}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-slate-800">
          {step != null && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[9px] font-black text-slate-500">{step}</span>
          )}
          {label}
        </div>
        <div className="truncate text-[10.5px] font-semibold text-slate-500">
          {approved ? who || "ອະນຸມັດແລ້ວ" : blocked ? lockedHint || "ລໍຖ້າຂັ້ນຕອນກ່ອນໜ້າ" : "ລໍຖ້າອະນຸມັດ"}
        </div>
      </div>
      <span className="ml-auto flex flex-shrink-0 items-center gap-2">
        {approved ? (
          <>
            <Pill tone="green">ອະນຸມັດ</Pill>
            {onUndo && (
              <button onClick={onUndo} className="text-[10px] font-bold text-slate-400 transition-colors hover:text-rose-600">
                ຍົກເລີກ
              </button>
            )}
          </>
        ) : blocked ? (
          <Pill tone="neutral">ລ໋ອກ</Pill>
        ) : onApprove ? (
          <button
            onClick={onApprove}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 text-[11px] font-bold text-emerald-700 transition-all hover:bg-emerald-50 active:scale-[0.97]"
          >
            <Check size={12} strokeWidth={2.5} /> ອະນຸມັດ
          </button>
        ) : (
          <Pill tone="amber">ລໍຖ້າ</Pill>
        )}
      </span>
    </div>
  );
}
