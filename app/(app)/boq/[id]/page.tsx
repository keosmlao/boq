"use client";

/** v2 — BOQ detail (ERP odg_projects_boq): materials/labour/consumables as line items. */
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ActivityFeed from "../../_components/ActivityFeed";
import { ArrowLeft, ListChecks, FolderKanban, User, UserCheck, CalendarClock, Boxes } from "lucide-react";
import { deleteBoq, approveBoq } from "@/_actions/boq";
import { Page, Card, Pill, Btn } from "../../_components/ui";
import DocActions from "../../_components/DocActions";
import { getV2User } from "../../../_lib/session";
import { can } from "@/_lib/permissions";
import { CheckCircle2, XCircle } from "lucide-react";

const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "-";
};
const tone = (s: string) => (s === "ອະນຸມັດແລ້ວ" ? "green" : s === "ປະຕິເສດ" ? "red" : "amber");
const fmtDate = (v: unknown) => (v ? String(v).slice(0, 10) : "-");

export default function BoqDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [b, setB] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<number | null>(null); // 1=approve, 2=reject

  const docNo = decodeURIComponent(String(id));
  const user = getV2User();
  const canApprove = can(user ? { role: user.role, permissions: user.permissions } : null, "boq", "approve");

  const load = React.useCallback(async () => {
    const response = await fetch(`/api/boq/${encodeURIComponent(docNo)}`, { cache: "no-store" });
    const payload: any = await response.json().catch(() => null);
    const lr: any = payload?.data ?? payload;
    if (lr && lr.success !== false) {
      const apv = Number(lr.approve_status);
      setB({
        boq_no: lr.doc_no,
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
      if (res?.success === false) alert(res.message || "ດຳເນີນການບໍ່ສຳເລັດ");
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-3 text-[var(--theme-text-mute)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--theme-border-subtle)] border-t-[var(--theme-primary)]" />
        <span className="text-sm font-semibold">ກຳລັງໂຫຼດ...</span>
      </div>
    );
  }
  if (!b) {
    return <div className="px-4 py-10 text-center text-[var(--theme-text-mute)]">ບໍ່ພົບ BOQ</div>;
  }

  const items = Array.isArray(b.items) ? b.items : [];
  const status = String(b.status || "ລໍຖ້າອະນຸມັດ");
  const totalQty = items.reduce((s: number, it: any) => s + (Number(it.qty) || 0), 0);

  return (
    <Page max="max-w-none">
      {/* Back button */}
      <div className="mb-5 flex items-center justify-between gap-2">
        <button
          onClick={() => router.push("/boq")}
          className="group inline-flex items-center gap-2 text-xs font-bold text-slate-500 transition-colors hover:text-blue-600"
        >
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
          <span>ກັບໄປລາຍການ BOQ</span>
        </button>
      </div>

      {/* Premium header banner — blue brand gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 p-5 text-white shadow-[var(--theme-shadow-lg)] mb-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
              <ListChecks size={22} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display font-black text-xl md:text-2xl tracking-tight text-white leading-none">
                  {b.boq_no || "-"}
                </h1>
                <Pill tone={tone(status) as any}>
                  <span className="flex items-center gap-1.5">
                    {status === "ອະນຸມັດແລ້ວ" && (
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      </span>
                    )}
                    {status === "ປະຕິເສດ" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                    )}
                    {status !== "ອະນຸມັດແລ້ວ" && status !== "ປະຕິເສດ" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                    )}
                    {status}
                  </span>
                </Pill>
              </div>
              <p className="mt-2 text-xs font-semibold text-white/80 leading-relaxed max-w-xl">
                {b.project_name || ""}{b.customer_name ? ` · ${b.customer_name}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 self-end sm:self-center">
            {canApprove && status === "ລໍຖ້າອະນຸມັດ" && (
              <>
                <Btn variant="primary" disabled={busy} onClick={() => setConfirmStatus(1)}>
                  <CheckCircle2 size={15} /> ອະນຸມັດ
                </Btn>
                <Btn variant="danger" disabled={busy} onClick={() => setConfirmStatus(2)}>
                  <XCircle size={15} /> ປະຕິເສດ
                </Btn>
              </>
            )}
            <DocActions
              editHref={b.project_id ? `/projects/${b.project_id}/boq/new?edit=${encodeURIComponent(b.boq_no)}` : undefined}
              onDelete={() => deleteBoq(b.boq_no)}
              afterDelete="/boq"
              label="BOQ"
            />
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left Card: Items Table */}
        <Card className="overflow-hidden border-t-2 border-t-blue-500 lg:col-span-2 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="border-b border-slate-100 px-4 py-3.5 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                <ListChecks size={13} strokeWidth={2.5} />
              </span>
              <h2 className="text-[13px] font-black uppercase tracking-wider text-slate-800">ລາຍການ BOQ (ຈຳນວນ)</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-black text-slate-600">
              {items.length} ລາຍການ
            </span>
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-[12.5px] text-slate-400">ບໍ່ມີລາຍການ</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-[12.5px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/40 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    <th className="sticky top-0 z-10 border-b border-slate-200 px-4 py-3 text-left w-12">#</th>
                    <th className="sticky top-0 z-10 border-b border-slate-200 px-4 py-3 text-left">ລາຍການ</th>
                    <th className="sticky top-0 z-10 border-b border-slate-200 px-4 py-3 text-center w-24">ໜ່ວຍ</th>
                    <th className="sticky top-0 z-10 border-b border-slate-200 px-4 py-3 text-right w-24">ຈຳນວນ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it: any, i: number) => (
                    <tr key={i} className="group transition-colors duration-150 hover:bg-blue-50/30">
                      <td className="px-4 py-3.5 align-middle">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="font-semibold text-slate-800 break-words leading-relaxed">
                            {it.description || "-"}
                          </span>
                          {it.item_code && (
                            <div className="flex items-center">
                              <span className="rounded bg-slate-100 group-hover:bg-white border border-slate-200/60 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-slate-500 transition-colors">
                                {it.item_code}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-middle text-center">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-700 transition-colors">
                          {it.unit || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 align-middle text-right font-mono font-bold text-slate-900 tabular-nums text-[13px]">
                        {money(it.qty)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Right Column: Metadata Sidebar */}
        <div className="space-y-4">
          <Card className="border-t-2 border-t-slate-400 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-4 w-1 rounded bg-blue-600" />
              <h2 className="text-[13px] font-black uppercase tracking-wider text-slate-800">ຂໍ້ມູນ BOQ</h2>
            </div>
            <div className="space-y-3">
              <InfoRow icon={<User size={14} />} tone="cyan" label="ຜູ້ຂໍ / ຜູ້ສ້າງ" value={b.requester} />
              <InfoRow icon={<UserCheck size={14} />} tone="emerald" label="ຜູ້ອະນຸມັດ" value={b.approver} />
              <InfoRow icon={<CalendarClock size={14} />} tone="indigo" label="ວັນທີ" value={fmtDate(b.created_at)} />
              <InfoRow icon={<Boxes size={14} />} tone="amber" label="ຈຳນວນລາຍການ" value={`${items.length} ລາຍການ · ${money(totalQty)} ໜ່ວຍ`} />
            </div>
          </Card>
        </div>
      </div>

      {/* Footer Navigation */}
      {b.project_id && (
        <div className="mt-6 flex justify-start">
          <button
            onClick={() => router.push(`/projects/${b.project_id}`)}
            className="group inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-xs font-bold text-slate-700 shadow-sm transition-all duration-150 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 active:scale-[0.98]"
          >
            <FolderKanban size={14} className="text-slate-500 group-hover:text-blue-600 transition-colors" />
            <span>ໄປໜ້າໂຄງການ</span>
            <ArrowLeft size={12} className="rotate-180 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
          </button>
        </div>
      )}
    <div className="mt-5"><ActivityFeed entityType="boq" entityId={docNo} /></div>

      {confirmStatus !== null && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 pt-[20vh]" onClick={() => !busy && setConfirmStatus(null)}>
          <div className="w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-[var(--theme-shadow-lg)]" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 text-center">
              <div className={`mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full ring-1 ${confirmStatus === 1 ? "bg-emerald-50 text-emerald-600 ring-emerald-100" : "bg-rose-50 text-rose-600 ring-rose-100"}`}>
                {confirmStatus === 1 ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
              </div>
              <div className="text-[14px] font-semibold text-[var(--theme-text)]">
                {confirmStatus === 1 ? "ຢືນຢັນການອະນຸມັດ" : "ຢືນຢັນການປະຕິເສດ"}
              </div>
              <p className="mt-1 text-[12.5px] text-[var(--theme-text-mute)]">
                {confirmStatus === 1 ? "ອະນຸມັດ BOQ ໃບນີ້?" : "ປະຕິເສດ BOQ ໃບນີ້?"} ({b.boq_no})
              </p>
            </div>
            <div className="flex gap-2 border-t border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] p-3">
              <button onClick={() => setConfirmStatus(null)} disabled={busy} className="flex-1 rounded-md border border-[var(--theme-border-subtle)] bg-white py-2 text-[12px] font-semibold text-[var(--theme-text-soft)] hover:bg-[var(--theme-bg-muted)] disabled:opacity-60">
                ຍົກເລີກ
              </button>
              <button
                onClick={async () => { const s = confirmStatus; setConfirmStatus(null); await doApprove(s!); }}
                disabled={busy}
                className={`flex-1 rounded-md py-2 text-[12px] font-semibold text-white disabled:opacity-60 ${confirmStatus === 1 ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}`}
              >
                {confirmStatus === 1 ? "ອະນຸມັດ" : "ປະຕິເສດ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

function InfoRow({ icon, tone, label, value }: { icon: React.ReactNode; tone: "cyan" | "emerald" | "indigo" | "amber"; label: string; value: any }) {
  const bg = {
    cyan: "bg-cyan-50 text-cyan-600 border border-cyan-100/70",
    emerald: "bg-emerald-50 text-emerald-600 border border-emerald-100/70",
    indigo: "bg-indigo-50 text-indigo-600 border border-indigo-100/70",
    amber: "bg-amber-50 text-amber-600 border border-amber-100/70",
  }[tone];
  return (
    <div className="group flex items-center gap-3.5 rounded-xl border border-slate-100 bg-slate-50/30 p-2.5 transition-all duration-200 hover:border-slate-200 hover:bg-slate-50/70 hover:shadow-xs">
      <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110 ${bg}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
        <div className="font-extrabold text-[12.5px] text-slate-700 break-words mt-0.5">{value || "-"}</div>
      </div>
    </div>
  );
}
