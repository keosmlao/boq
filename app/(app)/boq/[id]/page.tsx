"use client";

/** v2 — BOQ detail (ERP odg_projects_boq): materials/labour/consumables as line items. */
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ListChecks,
  FolderKanban,
  User,
  UserCheck,
  CalendarClock,
  Boxes,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { deleteBoq, approveBoq } from "@/_actions/boq";
import { advanceProjectStage } from "@/_actions/projects";
import {
  Page,
  PageHeader,
  Card,
  Pill,
  Btn,
  SectionHeader,
  tblCls,
  thCls,
  tdCls,
  trHover,
  TwoLine,
  type PillTone,
} from "../../_components/ui";
import DocActions from "../../_components/DocActions";
import { getV2User } from "../../../_lib/session";
import { can } from "@/_lib/permissions";
import { useT } from "@/_lib/i18n";

const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "-";
};
const tone = (s: string): PillTone => (s === "ອະນຸມັດແລ້ວ" ? "green" : s === "ປະຕິເສດ" ? "red" : "amber");
const fmtDate = (v: unknown) => (v ? String(v).slice(0, 10) : "-");

export default function BoqDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const t = useT();
  const [b, setB] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<number | null>(null); // 1=approve, 2=reject

  const docNo = decodeURIComponent(String(id));
  const user = getV2User();
  const isAdminUser = String(user?.role || "").trim().toLowerCase() === "admin";
  const acl = user ? { role: user.role, permissions: user.permissions } : null;
  // The first BOQ of a contract: manager (boq.approve) can approve. Subsequent
  // (2nd+) BOQ of the same contract: only an admin OR a user granted the
  // boq "approve_next" permission may approve.
  const canApproveNext = isAdminUser || can(acl, "boq", "approve_next");
  const canApprove =
    can(acl, "boq", "approve") &&
    (b?.is_first !== false || canApproveNext);

  const load = React.useCallback(async () => {
    const response = await fetch(`/api/boq/${encodeURIComponent(docNo)}`, { cache: "no-store" });
    const payload: any = await response.json().catch(() => null);
    const lr: any = payload?.data ?? payload;
    if (lr && lr.success !== false) {
      const apv = Number(lr.approve_status);
      setB({
        boq_no: lr.doc_no,
        is_first: lr.is_first !== false,
        project_id: lr.project_id != null ? String(lr.project_id) : "",
        project_name: lr.project_name || lr.contract_no || "",
        customer_name: lr.cust_code || "",
        status: apv === 1 ? "ອະນຸມັດແລ້ວ" : apv === 2 ? "ປະຕິເສດ" : "ລໍຖ້າອະນຸມັດ",
        requester: lr.creator_name || lr.user_created || "",
        approver: lr.approver_name || lr.approver || "",
        created_at: lr.doc_date,
        items: (Array.isArray(lr.boq_list) ? lr.boq_list : []).map((x: any) => ({
          item_code: x.item_code,
          description: x.item_name,
          unit: x.unit_code,
          qty: x.qty,
        })),
      });
    } else {
      setB(null);
    }
  }, [docNo]);

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

  const doApprove = async (status: number) => {
    setBusy(true);
    try {
      const res: any = await approveBoq(docNo, { status, username: user?.username });
      if (res?.success === false) alert(res.message || t("common.actionFailed", "ດຳເນີນການບໍ່ສຳເລັດ"));
      // Stage follows the APPROVAL, wherever it happens (idempotent server-side).
      else if (status === 1 && b?.project_id) {
        await advanceProjectStage(String(b.project_id), "BOQ").catch(() => {});
      }
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-3 text-[var(--text-mute)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--brand)]" />
        <span className="text-sm font-semibold">{t("common.loading", "ກຳລັງໂຫຼດ...")}</span>
      </div>
    );
  }
  if (!b) {
    return <div className="px-4 py-10 text-center text-[var(--text-mute)]">{t("boq.notFound", "ບໍ່ພົບ BOQ")}</div>;
  }

  const items = Array.isArray(b.items) ? b.items : [];
  const status = String(b.status || "ລໍຖ້າອະນຸມັດ");
  const totalQty = items.reduce((s: number, it: any) => s + (Number(it.qty) || 0), 0);
  const pending = status === "ລໍຖ້າອະນຸມັດ";

  return (
    <Page max="max-w-[1100px]">
      <PageHeader
        title={b.boq_no || "-"}
        subtitle={`${b.project_name || ""}${b.customer_name ? ` · ${b.customer_name}` : ""}`}
        badge={<Pill tone={tone(status)}>{status}</Pill>}
        actions={
          <>
            {canApprove && pending && (
              <>
                <Btn variant="go" disabled={busy} onClick={() => setConfirmStatus(1)}>
                  <CheckCircle2 size={14} /> {t("common.approve", "ອະນຸມັດ")}
                </Btn>
                <Btn variant="danger-outline" disabled={busy} onClick={() => setConfirmStatus(2)}>
                  <XCircle size={14} /> {t("common.reject", "ປະຕິເສດ")}
                </Btn>
              </>
            )}
            <DocActions
              editHref={b.project_id ? `/projects/${b.project_id}/boq/new?edit=${encodeURIComponent(b.boq_no)}` : undefined}
              onDelete={() => deleteBoq(b.boq_no)}
              afterDelete="/boq"
              label="BOQ"
              canEdit={can(user, "boq", "edit")}
              canDelete={can(user, "boq", "delete")}
            />
            <Btn variant="outline" onClick={() => router.push("/boq")}>
              <ArrowLeft size={14} /> {t("boq.backToList", "ກັບໄປລາຍການ BOQ")}
            </Btn>
          </>
        }
      />

      {!canApprove && pending && b.is_first === false && !canApproveNext && can(acl, "boq", "approve") && (
        <div className="mb-4 rounded-xl border border-[var(--warning-soft)] bg-[var(--warning-soft)] px-4 py-2.5 text-[11.5px] font-bold text-[var(--warning)]">
          {t("boq.secondNeedsAdmin", "ໃບ BOQ ທີ 2 ຂຶ້ນໄປ ຕ້ອງໃຫ້ຜູ້ດູແລລະບົບ ຫຼື ຜູ້ມີສິດອະນຸມັດໃບຕໍ່ໄປ")}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Items table */}
        <Card className="overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between px-4 pt-4">
            <SectionHeader
              icon={<ListChecks size={14} />}
              title={t("boq.itemsTitle", "ລາຍການ BOQ (ຈຳນວນ)")}
              tone="brand"
              className="mb-0"
            />
            <Pill tone="neutral">
              {items.length} {t("boq.itemUnit", "ລາຍການ")}
            </Pill>
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-12 text-center text-[12.5px] text-[var(--text-mute)]">{t("boq.noItems", "ບໍ່ມີລາຍການ")}</div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className={tblCls}>
                <thead>
                  <tr>
                    <th className={`${thCls} w-12`}>#</th>
                    <th className={thCls}>{t("boq.item", "ລາຍການ")}</th>
                    <th className={`${thCls} w-24 text-center`}>{t("common.unit", "ໜ່ວຍ")}</th>
                    <th className={`${thCls} w-28 text-right`}>{t("common.qty", "ຈຳນວນ")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it: any, i: number) => (
                    <tr key={i} className={trHover}>
                      <td className={`${tdCls} text-[var(--text-mute)] tabular-nums`}>{i + 1}</td>
                      <td className={tdCls}>
                        <TwoLine
                          primary={it.description || "-"}
                          secondary={it.item_code ? <span className="font-mono">{it.item_code}</span> : undefined}
                        />
                      </td>
                      <td className={`${tdCls} text-center`}>
                        <Pill tone="neutral">{it.unit || "-"}</Pill>
                      </td>
                      <td className={`${tdCls} text-right font-semibold tabular-nums text-[var(--text)]`}>{money(it.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Metadata */}
        <div className="space-y-4">
          <Card className="p-4">
            <SectionHeader icon={<ListChecks size={14} />} title={t("boq.infoTitle", "ຂໍ້ມູນ BOQ")} tone="slate" />
            <div className="space-y-2">
              <InfoRow icon={<User size={13} />} label={t("boq.requesterCreator", "ຜູ້ຂໍ / ຜູ້ສ້າງ")} value={b.requester} />
              <InfoRow icon={<UserCheck size={13} />} label={t("common.approver", "ຜູ້ອະນຸມັດ")} value={b.approver} />
              <InfoRow icon={<CalendarClock size={13} />} label={t("common.date", "ວັນທີ")} value={fmtDate(b.created_at)} />
              <InfoRow
                icon={<Boxes size={13} />}
                label={t("boq.itemCount", "ຈຳນວນລາຍການ")}
                value={`${items.length} ${t("boq.itemUnit", "ລາຍການ")} · ${money(totalQty)} ${t("boq.unitWord", "ໜ່ວຍ")}`}
              />
            </div>
            {b.project_id && (
              <Btn variant="outline" className="mt-4 w-full" onClick={() => router.push(`/projects/${b.project_id}`)}>
                <FolderKanban size={14} /> {t("boq.goToProject", "ໄປໜ້າໂຄງການ")}
              </Btn>
            )}
          </Card>
        </div>
      </div>

      {confirmStatus !== null && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 pt-[20vh]" onClick={() => !busy && setConfirmStatus(null)}>
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-4 text-center">
              <div
                className={`mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full ${
                  confirmStatus === 1
                    ? "bg-[var(--success-soft)] text-[var(--success)]"
                    : "bg-[var(--danger-soft)] text-[var(--danger)]"
                }`}
              >
                {confirmStatus === 1 ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
              </div>
              <div className="text-[14px] font-black text-[var(--text)]">
                {confirmStatus === 1 ? t("boq.confirmApproveTitle", "ຢືນຢັນການອະນຸມັດ") : t("boq.confirmRejectTitle", "ຢືນຢັນການປະຕິເສດ")}
              </div>
              <p className="mt-1 text-[12.5px] text-[var(--text-mute)]">
                {confirmStatus === 1 ? t("boq.confirmApproveMsg", "ອະນຸມັດ BOQ ໃບນີ້?") : t("boq.confirmRejectMsg", "ປະຕິເສດ BOQ ໃບນີ້?")} ({b.boq_no})
              </p>
            </div>
            <div className="flex gap-2 border-t border-[var(--border-soft)] bg-[var(--surface-sunken)] p-3">
              <Btn variant="outline" className="flex-1" onClick={() => setConfirmStatus(null)} disabled={busy}>
                {t("common.cancel", "ຍົກເລີກ")}
              </Btn>
              <Btn
                variant={confirmStatus === 1 ? "go" : "danger"}
                className="flex-1"
                onClick={async () => { const s = confirmStatus; setConfirmStatus(null); await doApprove(s!); }}
                disabled={busy}
              >
                {confirmStatus === 1 ? t("common.approve", "ອະນຸມັດ") : t("common.reject", "ປະຕິເສດ")}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-sunken)] p-2.5">
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-mute)]">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-bold tracking-wider text-[var(--text-mute)]">{label}</div>
        <div className="mt-0.5 break-words text-[12.5px] font-bold text-[var(--text)]">{value || "-"}</div>
      </div>
    </div>
  );
}
