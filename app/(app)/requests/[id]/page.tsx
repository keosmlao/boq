"use client";

/** v2 — Request (ໃບຂໍເບີກ) detail + linked withdrawal slips (ໃບເບີກ / ic_trans). */
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ActivityFeed from "../../_components/ActivityFeed";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  PackageOpen,
  Truck,
  FolderKanban,
  User,
  CalendarClock,
  Warehouse,
  MapPin,
  XCircle,
  Printer,
  Pencil,
} from "lucide-react";
import { getRequestDetail, deleteRequest, approveSubstitute, setAppRequestStatus, setRequestStatus } from "@/_actions/request-v2";
import {
  Page,
  PageHeader,
  Card,
  Btn,
  Pill,
  SectionHeader,
  SectionTitle,
  tblCls,
  thCls,
  tdCls,
  trHover,
  type PillTone,
} from "../../_components/ui";
import DocActions from "../../_components/DocActions";
import { getV2User } from "../../../_lib/session";
import { can } from "@/_lib/permissions";
import { useT } from "@/_lib/i18n";

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "0";
};
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (v: unknown, withTime = false) => {
  if (!v) return "-";
  const d = new Date(v as any);
  if (isNaN(d.getTime())) return String(v).slice(0, 16);
  const base = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return withTime ? `${base} ${pad(d.getHours())}:${pad(d.getMinutes())}` : base;
};
const fmtWoDate = (date: unknown, time: unknown) => {
  const d = fmt(date);
  const t = time ? String(time).slice(0, 5) : "";
  return t ? `${d} ${t}` : d;
};

export default function RequestDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const t = useT();
  const user = getV2User();
  const [r, setR] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  const refresh = async () => {
    const res: any = await getRequestDetail(decodeURIComponent(String(id)));
    setR(res?.success ? res.data : null);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await refresh();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-3 text-[var(--text-mute)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--brand)]" />
        <span className="text-sm">{t("common.loading", "ກຳລັງໂຫຼດ...")}</span>
      </div>
    );
  }
  if (!r) {
    return <div className="px-4 py-10 text-center text-[var(--text-mute)]">{t("requests.notFound", "ບໍ່ພົບໃບຂໍເບີກ")}</div>;
  }

  const items = Array.isArray(r.items) ? r.items : [];
  const withdrawals = Array.isArray(r.withdrawals) ? r.withdrawals : [];
  const withdrawn = String(r.status) === "withdrawn";
  const totalQty = items.reduce((s: number, it: any) => s + (Number(it.qty) || 0), 0);
  // Only v2 requests (odg_request) carry an editable status. ERP requests derive
  // "ເບີກແລ້ວ" from an actual ic_trans withdrawal created in the ERP warehouse.
  const isV2 = r.src !== "erp";

  // Substitution approval — a request with substituted lines can't be withdrawn
  // until someone with requests.approve_substitute approves it.
  const hasSubstitute = items.some((it: any) => it.substituted);
  const substituteApproved = !!r.substitute_approved;
  const canApproveSubstitute = can(user, "requests", "approve_substitute");

  const approveSubst = async () => {
    setMarking(true);
    try {
      const res: any = await approveSubstitute(String(id));
      if (res?.success) await refresh();
      else alert(res?.message || t("requests.failed", "ບໍ່ສຳເລັດ"));
    } finally {
      setMarking(false);
    }
  };

  // App requests (odg_wo_material_request) — advance pending → approved → issued, or reject.
  const isApp = r.src === "app";
  const appStatus = String(r.app_status || "pending");
  const canApproveReq = can(user, "requests", "approve");
  const setApp = async (status: string, withReason = false) => {
    let note: string | undefined;
    if (withReason) {
      const reason = window.prompt(t("requests.rejectReason", "ເຫດຜົນທີ່ປະຕິເສດ"));
      if (reason === null) return;
      note = reason;
    }
    setMarking(true);
    try {
      const res: any = await setAppRequestStatus(String(id), status, note);
      if (res?.success) await refresh();
      else alert(res?.message || t("requests.failed", "ບໍ່ສຳເລັດ"));
    } finally {
      setMarking(false);
    }
  };

  // v2 requisition (odg_request) — the only rows whose status is editable here:
  // requested → ເບີກແລ້ວ (withdrawn) or ປະຕິເສດ (rejected). Same gate as the rest
  // of the page: requests.approve.
  const isV2Row = r.src === "v2";
  const v2Status = String(r.status || "requested");
  const rejected = v2Status === "rejected";
  const setV2 = async (status: string, withReason = false) => {
    let note: string | undefined;
    if (withReason) {
      const reason = window.prompt(t("requests.rejectReason", "ເຫດຜົນທີ່ປະຕິເສດ"));
      if (reason === null) return;
      note = reason;
    }
    setMarking(true);
    try {
      const res: any = await setRequestStatus(String(id), status, note);
      if (res?.success) await refresh();
      else alert(res?.message || t("requests.failed", "ບໍ່ສຳເລັດ"));
    } finally {
      setMarking(false);
    }
  };

  // Header status pill — app templates carry their own workflow status.
  const statusLabel = isApp
    ? appStatus === "approved"
      ? t("requests.awaitingPull", "ລໍຖ້າອອກໃບຂໍເບີກ")
      : appStatus === "rejected"
        ? t("status.rejected", "ປະຕິເສດ")
        : t("requests.awaitingHead", "ລໍຫົວໜ້າຊ່າງ")
    : withdrawn
      ? t("requests.withdrawn", "ເບີກແລ້ວ")
      : rejected
        ? t("status.rejected", "ປະຕິເສດ")
        : t("requests.requested", "ຮ້ອງຂໍ");
  const statusTone: PillTone = isApp
    ? appStatus === "approved"
      ? "blue"
      : appStatus === "rejected"
        ? "red"
        : "amber"
    : withdrawn
      ? "green"
      : rejected
        ? "red"
        : "amber";

  const subtitle = [r.project_name, r.requester, fmt(r.created_at, true)].filter(Boolean).join(" · ");

  return (
    <Page max="max-w-[1100px]">
      <PageHeader
        title={r.request_no || r.doc_no || "-"}
        subtitle={subtitle}
        actions={
          <>
            <Pill tone={statusTone}>{statusLabel}</Pill>

            <Btn variant="outline" onClick={() => window.open(`/print/requests/${encodeURIComponent(String(id))}`, "_blank")}>
              <Printer size={14} /> {t("requests.printBill", "ພິມບິນ")}
            </Btn>

            {/* Edit a craftsman app request BEFORE approval (dedicated page — app
                requests are otherwise read-only on web). v2/legacy use DocActions. */}
            {isApp && appStatus === "pending" && can(user, "requests", "edit") && (
              <Btn variant="ink" onClick={() => router.push(`/requests/${encodeURIComponent(String(id))}/edit`)}>
                <Pencil size={14} /> {t("common.edit", "ແກ້ໄຂ")}
              </Btn>
            )}

            {/* Step 2: ຫົວໜ້າຊ່າງ / supervisor (requests.approve) approves the template. */}
            {isApp && appStatus === "pending" && canApproveReq && (
              <>
                <Btn variant="go" onClick={() => setApp("approved")} disabled={marking}>
                  <CheckCircle2 size={14} />
                  {marking ? t("common.saving", "ກຳລັງບັນທຶກ...") : t("requests.approve", "ອະນຸມັດ (ຫົວໜ້າຊ່າງ)")}
                </Btn>
                <Btn variant="danger-outline" onClick={() => setApp("rejected", true)} disabled={marking}>
                  <XCircle size={14} /> {t("status.rejected", "ປະຕິເສດ")}
                </Btn>
              </>
            )}

            {/* Step 3: approved → admin (requests.create) pulls it into a real requisition (RQ- → SML). */}
            {isApp && appStatus === "approved" && can(user, "requests", "create") && r.project_id && (
              <Btn
                variant="go"
                onClick={() => router.push(`/projects/${r.project_id}/request/new?fromApp=${encodeURIComponent(String(id))}`)}
              >
                <PackageOpen size={14} /> {t("requests.pullToRequisition", "ດຶງມາອອກໃບຂໍເບີກ")}
              </Btn>
            )}

            {/* Approved templates can still be rejected before being pulled. */}
            {isApp && canApproveReq && appStatus === "approved" && (
              <Btn variant="danger-outline" onClick={() => setApp("rejected", true)} disabled={marking}>
                <XCircle size={14} /> {t("requests.dismissTemplate", "ປະຕິເສດ (ບໍ່ດຶງ)")}
              </Btn>
            )}

            {/* v2 requisition close-out: ເບີກແລ້ວ / ປະຕິເສດ (requests.approve). */}
            {isV2Row && v2Status === "requested" && canApproveReq && (
              <>
                <Btn variant="go" onClick={() => setV2("withdrawn")} disabled={marking}>
                  <CheckCircle2 size={14} />
                  {marking ? t("common.saving", "ກຳລັງບັນທຶກ...") : t("requests.markWithdrawn", "ໝາຍວ່າເບີກແລ້ວ")}
                </Btn>
                <Btn variant="danger-outline" onClick={() => setV2("rejected", true)} disabled={marking}>
                  <XCircle size={14} /> {t("status.rejected", "ປະຕິເສດ")}
                </Btn>
              </>
            )}

            {r.project_id && (
              <Btn variant="outline" onClick={() => router.push(`/projects/${r.project_id}`)}>
                <FolderKanban size={14} /> {t("requests.goToProject", "ໄປໜ້າໂຄງການ")}
              </Btn>
            )}
            <Btn variant="outline" onClick={() => router.push("/requests")}>
              <ArrowLeft size={14} /> {t("requests.backToList", "ກັບໄປລາຍການຂໍເບີກ")}
            </Btn>

            {!withdrawn && r.src !== "app" && (
              <DocActions
                editHref={r.project_id ? `/projects/${r.project_id}/request/new?edit=${encodeURIComponent(String(id))}` : undefined}
                onDelete={() => deleteRequest(String(id))}
                afterDelete="/requests"
                label={t("requests.docLabel", "ໃບຂໍເບີກ")}
                canEdit={can(user, "requests", "edit")}
                canDelete={can(user, "requests", "delete")}
              />
            )}
          </>
        }
      />

      <div className="space-y-5">
        {/* Waiting for the supervisor (viewer can't approve). */}
        {isApp && appStatus === "pending" && !canApproveReq && (
          <div className="rounded-xl border border-[var(--warning-soft)] bg-[var(--warning-soft)] px-4 py-2.5 text-[12px] font-bold text-[var(--warning)]">
            {t("requests.awaitingHeadApproval", "ລໍຖ້າຫົວໜ້າຊ່າງ (supervisor) ອະນຸມັດ")}
          </div>
        )}

        {/* Substitution approval */}
        {isV2 && hasSubstitute && (
          substituteApproved ? (
            <div className="flex items-center gap-2 rounded-xl border border-[var(--success-soft)] bg-[var(--success-soft)] px-4 py-2.5 text-[12px] font-bold text-[var(--success)]">
              <CheckCircle2 size={14} />
              {t("requests.substituteApproved", "ອະນຸມັດການປ່ຽນແທນແລ້ວ")}
              {r.substitute_approver ? ` · ${r.substitute_approver}` : ""}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--warning-soft)] bg-[var(--warning-soft)] px-4 py-2.5">
              <span className="text-[12px] font-bold text-[var(--warning)]">
                {t("requests.substituteNeedsApproval", "ມີການປ່ຽນສິນຄ້າ — ຕ້ອງອະນຸມັດກ່ອນເບີກ")}
              </span>
              {canApproveSubstitute && (
                <Btn variant="ink" onClick={approveSubst} disabled={marking}>
                  {marking ? t("common.saving", "ກຳລັງບັນທຶກ...") : t("requests.approveSubstitute", "ອະນຸມັດການປ່ຽນແທນ")}
                </Btn>
              )}
            </div>
          )
        )}

        {/* Request info */}
        <Card className="p-5">
          <SectionHeader icon={<ClipboardList size={14} />} title={t("requests.infoTitle", "ຂໍ້ມູນການຂໍເບີກ")} tone="brand" />
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem icon={<FolderKanban size={14} />} label={t("requests.projectLabel", "ໂຄງການ / ໂປຣເຈັກ")} value={r.project_name} />
            <InfoItem icon={<User size={14} />} label={t("requests.requester", "ຜູ້ຮ້ອງຂໍເບີກ")} value={r.requester} />
            {r.used_by_name && (
              <InfoItem icon={<User size={14} />} label={t("requests.usedBy", "ຜູ້ໃຊ້ວັດສະດຸ (ທີມ/ຊ່າງ)")} value={r.used_by_name} />
            )}
            <InfoItem
              icon={<CalendarClock size={14} />}
              label={t("requests.requestDateTime", "ວັນທີ/ເວລາ ຮ້ອງຂໍ")}
              value={fmt(r.created_at, true)}
            />
            <InfoItem
              icon={<PackageOpen size={14} />}
              label={t("requests.totalItems", "ຈຳນວນລາຍການທັງໝົດ")}
              value={`${num(totalQty)} ${t("requests.unitRollsPieces", "ມ້ວນ/ຊິ້ນ")}`}
            />
          </div>

          {r.notes && (
            <div className="mt-5 border-t border-[var(--border-soft)] pt-3">
              <span className="mb-1 block text-[11px] font-bold tracking-wider text-[var(--text-mute)]">{t("common.note", "ໝາຍເຫດ")}</span>
              <p className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-sunken)] p-2.5 text-[12.5px] leading-relaxed text-[var(--text-soft)]">
                {r.notes}
              </p>
            </div>
          )}
        </Card>

        {/* Requested items */}
        <Card className="overflow-hidden">
          <div className="px-5 pt-5">
            <SectionHeader
              icon={<PackageOpen size={14} />}
              title={`${t("requests.itemsTitle", "ລາຍການຂໍເບີກ")} (${items.length})`}
              tone="cyan"
              className="mb-0"
            />
          </div>
          {items.length === 0 ? (
            <div className="px-5 py-10 text-center text-xs text-[var(--text-mute)]">{t("requests.noItems", "ບໍ່ມີລາຍການ")}</div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className={tblCls}>
                <thead>
                  <tr>
                    <th className={`${thCls} w-12 text-center`}>#</th>
                    <th className={thCls}>{t("requests.colItem", "ລາຍການ")}</th>
                    <th className={`${thCls} w-24 text-center`}>{t("common.unit", "ໜ່ວຍ")}</th>
                    <th className={`${thCls} w-28 text-right`}>{t("requests.colQtyRequested", "ຈຳນວນຂໍ")}</th>
                    <th className={`${thCls} w-28 text-right`}>{t("requests.withdrawn", "ເບີກແລ້ວ")}</th>
                    <th className={`${thCls} w-32 text-center`}>{t("common.status", "ສະຖານະ")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it: any, i: number) => (
                    <tr key={i} className={trHover}>
                      <td className={`${tdCls} text-center font-mono text-[11px] text-[var(--text-mute)]`}>{i + 1}</td>
                      <td className={tdCls}>
                        <div className="font-semibold text-[var(--text)]">{it.description || it.item_name || it.item_code || "-"}</div>
                        {it.substituted && (
                          <div className="mt-1">
                            <Pill tone="amber">
                              {t("requests.substitutedFrom", "ປ່ຽນຈາກ")}: {it.boq_item_name || it.boq_item_code}
                            </Pill>
                          </div>
                        )}
                      </td>
                      <td className={`${tdCls} text-center`}>
                        <Pill tone="neutral">{it.unit || it.unit_code || "-"}</Pill>
                      </td>
                      <td className={`${tdCls} text-right font-semibold tabular-nums text-[var(--text)]`}>{num(it.qty)}</td>
                      <td
                        className={`${tdCls} text-right font-semibold tabular-nums ${
                          Number(it.withdrawn_qty) > 0 ? "text-[var(--success)]" : "text-[var(--text-mute)]"
                        }`}
                      >
                        {num(it.withdrawn_qty)}
                      </td>
                      <td className={`${tdCls} text-center`}>
                        <ItemStatus status={it.item_status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Linked withdrawal slips */}
        <div className="space-y-3">
          <SectionTitle label={`${t("requests.linkedSlips", "ໃບເບີກທີ່ເຊື່ອມໂຍງ")} (${withdrawals.length})`} />
          {withdrawals.length > 0 ? (
            withdrawals.map((w: any, wi: number) => (
              <Card key={wi} className="overflow-hidden">
                <div className="border-b border-[var(--border-soft)] bg-[var(--surface-sunken)] px-5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Truck size={14} className="text-[var(--text-mute)]" />
                      <span className="text-[11px] font-bold tracking-wider text-[var(--text-mute)]">
                        {t("requests.warehouseSlip", "ໃບເບີກສາງ")}
                      </span>
                      <span className="font-mono text-[13.5px] font-bold text-[var(--text)]">{w.doc_no}</span>
                    </div>
                    <Pill tone="green">{t("requests.withdrawn", "ເບີກແລ້ວ")}</Pill>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[var(--border-soft)] pt-2.5 text-[12px] sm:grid-cols-4">
                    <Info
                      icon={<CalendarClock size={13} />}
                      label={t("requests.withdrawDateTime", "ວັນທີ/ເວລາເບີກ")}
                      value={fmtWoDate(w.doc_date, w.doc_time)}
                    />
                    <Info icon={<User size={13} />} label={t("requests.withdrawer", "ຜູ້ເບີກ")} value={w.withdrawer} />
                    <Info icon={<Warehouse size={13} />} label={t("requests.warehouse", "ສາງເກັບ")} value={w.wh_name} />
                    <Info icon={<MapPin size={13} />} label={t("requests.shelf", "ຊັ້ນວາງ (Shelf)")} value={w.shelf_name} />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className={tblCls}>
                    <thead>
                      <tr>
                        <th className={thCls}>{t("requests.colItem", "ລາຍການ")}</th>
                        <th className={`${thCls} w-24 text-center`}>{t("common.unit", "ໜ່ວຍ")}</th>
                        <th className={`${thCls} w-28 text-right`}>{t("requests.colQtyActual", "ເບີກຈິງ")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Array.isArray(w.items) ? w.items : []).map((it: any, i: number) => (
                        <tr key={i} className={trHover}>
                          <td className={`${tdCls} font-semibold text-[var(--text)]`}>{it.item_name || it.item_code || "-"}</td>
                          <td className={`${tdCls} text-center`}>
                            <Pill tone="neutral">{it.unit_code || "-"}</Pill>
                          </td>
                          <td className={`${tdCls} text-right font-semibold tabular-nums text-[var(--text)]`}>{num(it.qty)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))
          ) : (
            <Card className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text-mute)]">
                <Truck size={22} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text)]">{t("requests.noWithdrawal", "ຍັງບໍ່ມີການເບີກສິນຄ້າ")}</h3>
                <p className="mt-0.5 text-xs text-[var(--text-mute)]">
                  {t("requests.noWithdrawalHint", "ລາຍການຂໍເບີກນີ້ ຍັງບໍ່ທັນໄດ້ຖືກດຶງໄປສ້າງໃບເບີກເທື່ອ")}
                </p>
              </div>
            </Card>
          )}
        </div>

        <ActivityFeed entityType="request" entityId={String(id)} />
      </div>
    </Page>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <div>
      <div className="mb-0.5 flex items-center gap-1 text-[10.5px] font-bold tracking-wider text-[var(--text-mute)]">
        <span className="text-[var(--text-mute)]">{icon}</span>
        {label}
      </div>
      <div className="font-semibold text-[var(--text)]">{value || "-"}</div>
    </div>
  );
}

function ItemStatus({ status }: { status: unknown }) {
  const t = useT();
  const value = String(status || "requested");
  if (value === "withdrawn") return <Pill tone="green">{t("requests.withdrawn", "ເບີກແລ້ວ")}</Pill>;
  if (value === "partial") return <Pill tone="blue">{t("requests.partial", "ເບີກບາງສ່ວນ")}</Pill>;
  return <Pill tone="amber">{t("requests.waitingWithdraw", "ລໍຖ້າເບີກ")}</Pill>;
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
