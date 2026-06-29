"use client";

/** v2 — Request (ໃບຂໍເບີກ) detail + linked withdrawal slips (ໃບເບີກ / ic_trans). */
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ActivityFeed from "../../_components/ActivityFeed";
import { ArrowLeft, PackageOpen, Truck, FolderKanban, User, CalendarClock, Warehouse, MapPin } from "lucide-react";
import { getRequestDetail, deleteRequest, approveSubstitute } from "@/_actions/request-v2";
import { Page, Card, thCls, tdCls } from "../../_components/ui";
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
      <div className="flex h-[60vh] items-center justify-center gap-3 text-[var(--theme-text-mute)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--theme-border-subtle)] border-t-[var(--theme-primary)]" />
        <span className="text-sm">{t("common.loading", "ກຳລັງໂຫຼດ...")}</span>
      </div>
    );
  }
  if (!r) {
    return <div className="px-4 py-10 text-center text-[var(--theme-text-mute)]">{t("requests.notFound", "ບໍ່ພົບໃບຂໍເບີກ")}</div>;
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

  return (
    <Page max="max-w-none">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          onClick={() => router.push("/requests")}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--theme-text-mute)] hover:text-[var(--theme-primary)] transition-colors"
        >
          <ArrowLeft size={14} /> {t("requests.backToList", "ກັບໄປລາຍການຂໍເບີກ")}
        </button>
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
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content Column (Spans 2 columns on large screens) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Hero banner — blue brand gradient */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 p-6 text-white shadow-md shadow-blue-600/15">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />

            <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 shadow-inner backdrop-blur-md">
                  <PackageOpen size={30} className="text-white" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/80">{t("requests.docNoLabel", "ເລກທີໃບຂໍເບີກ")}</span>
                  <h1 className="font-mono text-2xl font-black leading-none tracking-tight">{r.request_no || r.doc_no || "-"}</h1>
                  <p className="mt-1 truncate text-xs text-white/75 font-medium">{r.project_name || "—"}</p>
                </div>
              </div>
              <div className="sm:self-center">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-bold ${
                  withdrawn ? "border-transparent bg-white text-slate-900" : "border-white/20 bg-white/10 text-white"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${withdrawn ? "bg-slate-900" : "bg-white animate-pulse"}`} />
                  {withdrawn ? t("requests.withdrawn", "ເບີກແລ້ວ") : t("requests.requested", "ຮ້ອງຂໍ")}
                </span>
              </div>
            </div>
          </div>

          {/* Requested Items Card */}
          <Card className="overflow-hidden border-t-4 border-t-slate-300 shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--theme-border-subtle)] px-4 py-3 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 text-slate-600 text-xs font-bold">
                  {items.length}
                </span>
                <h2 className="text-[13.5px] font-bold text-[var(--theme-text)]">{t("requests.itemsTitle", "ລາຍການຂໍເບີກ")}</h2>
              </div>
            </div>
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs text-[var(--theme-text-mute)]">{t("requests.noItems", "ບໍ່ມີລາຍການ")}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-[13px]">
                  <thead>
                    <tr>
                      <th className={`${thCls} w-10 text-center pl-4`}>#</th>
                      <th className={`${thCls} pl-2`}>{t("requests.colItem", "ລາຍການ")}</th>
                      <th className={`${thCls} w-24 text-center`}>{t("common.unit", "ໜ່ວຍ")}</th>
                      <th className={`${thCls} w-24 text-right`}>{t("requests.colQtyRequested", "ຈຳນວນຂໍ")}</th>
                      <th className={`${thCls} w-24 text-right`}>{t("requests.withdrawn", "ເບີກແລ້ວ")}</th>
                      <th className={`${thCls} w-28 text-center pr-4`}>{t("common.status", "ສະຖານະ")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--theme-border-subtle)] bg-white">
                    {items.map((it: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className={`${tdCls} text-center pl-4 font-mono text-xs text-[var(--theme-text-mute)]`}>{i + 1}</td>
                        <td className={`${tdCls} pl-2 font-medium text-[var(--theme-text)]`}>
                          <div>{it.description || it.item_name || it.item_code || "-"}</div>
                          {it.substituted && (
                            <div className="mt-0.5 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                              {t("requests.substitutedFrom", "ປ່ຽນຈາກ")}: {it.boq_item_name || it.boq_item_code}
                            </div>
                          )}
                        </td>
                        <td className={`${tdCls} text-center`}>
                          <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                            {it.unit || it.unit_code || "-"}
                          </span>
                        </td>
                        <td className={`${tdCls} text-right font-semibold text-slate-900 tabular-nums`}>{num(it.qty)}</td>
                        <td className={`${tdCls} text-right font-semibold tabular-nums ${Number(it.withdrawn_qty) > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                          {num(it.withdrawn_qty)}
                        </td>
                        <td className={`${tdCls} text-center pr-4`}>
                          <ItemStatus status={it.item_status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Withdrawal Slips Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1 text-[13px] font-bold text-[var(--theme-text-soft)]">
              <Truck size={16} className="text-slate-500" />
              <span>{t("requests.linkedSlips", "ໃບເບີກທີ່ເຊື່ອມໂຍງ")} ({withdrawals.length})</span>
            </div>

            {withdrawals.length > 0 ? (
              <div className="space-y-4">
                {withdrawals.map((w: any, wi: number) => (
                  <Card key={wi} className="overflow-hidden border-l-4 border-l-slate-300 shadow-sm">
                    <div className="bg-slate-50 px-4 py-3 border-b border-[var(--theme-border-subtle)]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                            {t("requests.warehouseSlip", "ໃບເບີກສາງ")}
                          </span>
                          <span className="font-mono text-[13.5px] font-bold text-slate-900">{w.doc_no}</span>
                        </div>
                        <span className="inline-flex items-center whitespace-nowrap rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-white">{t("requests.withdrawn", "ເບີກແລ້ວ")}</span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px] sm:grid-cols-4 border-t border-slate-100 pt-2">
                        <Info icon={<CalendarClock size={13} className="text-slate-500" />} label={t("requests.withdrawDateTime", "ວັນທີ/ເວລາເບີກ")} value={fmtWoDate(w.doc_date, w.doc_time)} />
                        <Info icon={<User size={13} className="text-slate-500" />} label={t("requests.withdrawer", "ຜູ້ເບີກ")} value={w.withdrawer} />
                        <Info icon={<Warehouse size={13} className="text-slate-500" />} label={t("requests.warehouse", "ສາງເກັບ")} value={w.wh_name} />
                        <Info icon={<MapPin size={13} className="text-slate-500" />} label={t("requests.shelf", "ຊັ້ນວາງ (Shelf)")} value={w.shelf_name} />
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full border-separate border-spacing-0 text-[13px]">
                        <thead>
                          <tr>
                            <th className={`${thCls} pl-4`}>{t("requests.colItem", "ລາຍການ")}</th>
                            <th className={`${thCls} w-24 text-center`}>{t("common.unit", "ໜ່ວຍ")}</th>
                            <th className={`${thCls} w-24 text-right pr-4`}>{t("requests.colQtyActual", "ເບີກຈິງ")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--theme-border-subtle)] bg-white">
                          {(Array.isArray(w.items) ? w.items : []).map((it: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                              <td className={`${tdCls} pl-4 font-medium text-[var(--theme-text)]`}>{it.item_name || it.item_code || "-"}</td>
                              <td className={`${tdCls} text-center`}>
                                <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                                  {it.unit_code || "-"}
                                </span>
                              </td>
                              <td className={`${tdCls} text-right pr-4 font-semibold text-slate-700 tabular-nums`}>{num(it.qty)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="flex flex-col items-center justify-center gap-3 py-12 text-center text-[var(--theme-text-mute)] border-dashed border-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                  <Truck className="h-6 w-6 opacity-60" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--theme-text)]">{t("requests.noWithdrawal", "ຍັງບໍ່ມີການເບີກສິນຄ້າ")}</h3>
                  <p className="text-xs text-[var(--theme-text-mute)] mt-0.5">{t("requests.noWithdrawalHint", "ລາຍການຂໍເບີກນີ້ ຍັງບໍ່ທັນໄດ້ຖືກດຶງໄປສ້າງໃບເບີກເທື່ອ")}</p>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Sidebar Column (Spans 1 column on large screens) */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <Card className="p-5 space-y-4 shadow-sm border-t-4 border-t-slate-500">
            <h3 className="text-sm font-bold text-[var(--theme-text)] border-b border-[var(--theme-border-subtle)] pb-2">
              {t("requests.infoTitle", "ຂໍ້ມູນການຂໍເບີກ")}
            </h3>

            <div className="space-y-3.5">
              <SidebarInfo icon={<FolderKanban size={15} className="text-slate-400" />} label={t("requests.projectLabel", "ໂຄງການ / ໂປຣເຈັກ")} value={r.project_name} />
              <SidebarInfo icon={<User size={15} className="text-slate-400" />} label={t("requests.requester", "ຜູ້ຮ້ອງຂໍເບີກ")} value={r.requester} />
              {r.used_by_name && (
                <SidebarInfo icon={<User size={15} className="text-slate-400" />} label={t("requests.usedBy", "ຜູ້ໃຊ້ວັດສະດຸ (ທີມ/ຊ່າງ)")} value={r.used_by_name} />
              )}
              <SidebarInfo icon={<CalendarClock size={15} className="text-slate-400" />} label={t("requests.requestDateTime", "ວັນທີ/ເວລາ ຮ້ອງຂໍ")} value={fmt(r.created_at, true)} />
              <SidebarInfo icon={<PackageOpen size={15} className="text-slate-400" />} label={t("requests.totalItems", "ຈຳນວນລາຍການທັງໝົດ")} value={`${num(totalQty)} ${t("requests.unitRollsPieces", "ມ້ວນ/ຊິ້ນ")}`} />
            </div>

            {r.notes && (
              <div className="mt-4 border-t border-[var(--theme-border-subtle)] pt-3">
                <span className="text-[11px] font-semibold text-[var(--theme-text-mute)] block mb-1">{t("common.note", "ໝາຍເຫດ")}</span>
                <p className="text-[12.5px] text-[var(--theme-text-soft)] bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                  {r.notes}
                </p>
              </div>
            )}
          </Card>

          {/* Quick Actions Card */}
          <Card className="p-4 shadow-sm bg-slate-50/50">
            <div className="flex flex-col gap-2.5">
              {/* Substitution approval */}
              {isV2 && hasSubstitute && (
                substituteApproved ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11.5px] font-semibold text-emerald-700">
                    ✓ {t("requests.substituteApproved", "ອະນຸມັດການປ່ຽນແທນແລ້ວ")}
                    {r.substitute_approver ? ` · ${r.substitute_approver}` : ""}
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <div className="text-[11.5px] font-semibold text-amber-700">{t("requests.substituteNeedsApproval", "ມີການປ່ຽນສິນຄ້າ — ຕ້ອງອະນຸມັດກ່ອນເບີກ")}</div>
                    {canApproveSubstitute && (
                      <button
                        onClick={approveSubst}
                        disabled={marking}
                        className="mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-amber-600 text-[12px] font-bold text-white hover:bg-amber-700 disabled:opacity-60"
                      >
                        {marking ? t("common.saving", "ກຳລັງບັນທຶກ...") : t("requests.approveSubstitute", "ອະນຸມັດການປ່ຽນແທນ")}
                      </button>
                    )}
                  </div>
                )
              )}
              {/* The actual withdrawal (ໃບເບີກ) is created in SML by the warehouse;
                  the app no longer marks requests withdrawn manually. */}
              {r.project_id && (
                <button
                  onClick={() => router.push(`/projects/${r.project_id}`)}
                  className="flex w-full h-9 items-center justify-center gap-2 rounded-lg bg-white border border-[var(--theme-border-subtle)] text-[12.5px] font-bold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  <FolderKanban size={15} />
                  <span>{t("requests.goToProject", "ໄປໜ້າໂຄງການ")}</span>
                </button>
              )}

              <button
                onClick={() => router.push("/requests")}
                className="flex w-full h-9 items-center justify-center gap-2 rounded-lg bg-white border border-[var(--theme-border-subtle)] text-[12.5px] font-bold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft size={15} />
                <span>{t("requests.backToList", "ກັບໄປລາຍການຂໍເບີກ")}</span>
              </button>
            </div>
          </Card>
        </div>
      </div>
    <div className="mt-5"><ActivityFeed entityType="request" entityId={String(id)} /></div>
    </Page>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <div>
      <div className="mb-0.5 flex items-center gap-1 text-[10.5px] text-[var(--theme-text-mute)]">
        <span className="text-[var(--theme-text-mute)]">{icon}</span>
        {label}
      </div>
      <div className="font-medium text-[var(--theme-text)]">{value || "-"}</div>
    </div>
  );
}

function ItemStatus({ status }: { status: unknown }) {
  const t = useT();
  const value = String(status || "requested");
  if (value === "withdrawn") {
    return <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700">{t("requests.withdrawn", "ເບີກແລ້ວ")}</span>;
  }
  if (value === "partial") {
    return <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[10.5px] font-bold text-blue-700">{t("requests.partial", "ເບີກບາງສ່ວນ")}</span>;
  }
  return <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold text-amber-700">{t("requests.waitingWithdraw", "ລໍຖ້າເບີກ")}</span>;
}

function SidebarInfo({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <div className="flex items-start gap-3 p-1">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 mt-0.5">
        {icon}
      </div>
      <div className="min-w-0">
        <span className="text-[11px] font-semibold text-[var(--theme-text-mute)] block mb-0.5">
          {label}
        </span>
        <span className="text-[13px] font-bold text-[var(--theme-text)] block break-words">
          {value || "-"}
        </span>
      </div>
    </div>
  );
}
