"use client";

/** v2 — Work order detail (team, dates, tasks, hours, labour cost). */
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ActivityFeed from "../../_components/ActivityFeed";
import { ArrowLeft, Wrench, FolderKanban, Users, CalendarClock, Clock, DollarSign, Wallet, PackageOpen } from "lucide-react";
import { getWorkOrderById, deleteWorkOrder } from "@/_actions/workorder";
import { Page, Card, Btn, tblCls, thCls, tdCls } from "../../_components/ui";
import DocActions from "../../_components/DocActions";

const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "-";
};
const d10 = (v: unknown) => (v ? String(v).slice(0, 10) : "-");

export default function WorkOrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [w, setW] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res: any = await getWorkOrderById(String(id));
        if (alive) setW(res?.success ? res.data : null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-3 text-[var(--theme-text-mute)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--theme-border-subtle)] border-t-[var(--theme-primary)]" />
        <span className="text-sm">ກຳລັງໂຫຼດ...</span>
      </div>
    );
  }
  if (!w) {
    return <div className="px-4 py-10 text-center text-[var(--theme-text-mute)]">ບໍ່ພົບໃບງານ</div>;
  }

  const tasks = Array.isArray(w.tasks) ? w.tasks : [];
  const mats = Array.isArray(w.materials) ? w.materials : [];

  return (
    <Page max="max-w-none">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          onClick={() => router.push("/work-orders")}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--theme-text-mute)] hover:text-[var(--theme-primary)] transition-colors"
        >
          <ArrowLeft size={14} /> ກັບໄປລາຍການໃບງານ
        </button>
        {w.src !== "erp" && (
          <DocActions onDelete={() => deleteWorkOrder(String(id))} afterDelete="/work-orders" label="ໃບງານ" />
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content Column (Spans 2 columns on large screens) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Hero Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 p-6 text-white shadow-lg shadow-emerald-500/10">
            {/* Decorative shapes */}
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-emerald-600/20 blur-2xl" />

            <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 shadow-inner backdrop-blur-md">
                  <Wrench size={30} className="text-white" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-100">ເລກທີໃບງານ</span>
                  <h1 className="font-mono text-2xl font-black leading-none tracking-tight">{w.work_no || "-"}</h1>
                  <p className="mt-1 truncate text-xs text-white/85 font-medium">
                    {w.technician_name ? `ຊ່າງຫຼັກ: ${w.technician_name}` : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tasks/Work list Card */}
          <Card className="overflow-hidden border-t-4 border-t-emerald-500 shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--theme-border-subtle)] px-4 py-3 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-100 text-emerald-600 text-xs font-bold">
                  {tasks.length}
                </span>
                <h2 className="text-[13.5px] font-bold text-[var(--theme-text)]">ໜ້າວຽກ</h2>
              </div>
            </div>
            {tasks.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs text-[var(--theme-text-mute)]">ບໍ່ມີໜ້າວຽກ</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-[13px]">
                  <thead>
                    <tr>
                      <th className={`${thCls} w-10 text-center pl-4`}>#</th>
                      <th className={`${thCls} pl-2`}>ໜ້າວຽກ</th>
                      <th className={`${thCls} w-28 text-right pr-4`}>ຊົ່ວໂມງຈິງ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--theme-border-subtle)] bg-white">
                    {tasks.map((t: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className={`${tdCls} text-center pl-4 font-mono text-xs text-[var(--theme-text-mute)]`}>{i + 1}</td>
                        <td className={`${tdCls} pl-2 font-medium text-[var(--theme-text)]`}>{t.title || "-"}</td>
                        <td className={`${tdCls} text-right pr-4 font-semibold text-slate-900 tabular-nums`}>
                          {Number(t.actual_hours) || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Material template → admin issues the actual ໃບຂໍເບີກ from this (rounds) */}
          <Card className="overflow-hidden border-t-4 border-t-cyan-500 shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--theme-border-subtle)] px-4 py-3 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-cyan-100 text-cyan-600 text-xs font-bold">{mats.length}</span>
                <h2 className="text-[13.5px] font-bold text-[var(--theme-text)]">ວັດສະດຸທີ່ຕ້ອງເບີກ (template)</h2>
              </div>
              {w.src !== "erp" && w.project_id && mats.length > 0 && (
                <button
                  onClick={() => router.push(`/projects/${w.project_id}/request/new?wo=${id}`)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-cyan-600 px-3 text-[12px] font-bold text-white shadow-sm hover:bg-cyan-700 transition-colors"
                >
                  <PackageOpen size={14} /> ສ້າງໃບຂໍເບີກ
                </button>
              )}
            </div>
            {mats.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-[var(--theme-text-mute)]">ບໍ່ມີວັດສະດຸໃນ template</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-[13px]">
                  <thead>
                    <tr>
                      <th className={`${thCls} pl-4`}>ລາຍການ</th>
                      <th className={`${thCls} w-20 text-center`}>ໜ່ວຍ</th>
                      <th className={`${thCls} w-24 text-right pr-4`}>ຈຳນວນ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--theme-border-subtle)] bg-white">
                    {mats.map((m: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className={`${tdCls} pl-4 font-medium text-[var(--theme-text)]`}>{m.description || m.item_name || m.item_code || "-"}</td>
                        <td className={`${tdCls} text-center`}>
                          <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{m.unit || m.unit_code || "-"}</span>
                        </td>
                        <td className={`${tdCls} text-right pr-4 font-semibold text-slate-900 tabular-nums`}>{money(m.qty)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="border-t border-[var(--theme-border-subtle)] px-4 py-1.5 text-[11px] text-[var(--theme-text-mute)]">
              ນີ້ແມ່ນ template ທີ່ຊ່າງຕ້ອງການ — admin ກົດ "ສ້າງໃບຂໍເບີກ" ເພື່ອອອກໃບຂໍເບີກຈິງ (ສ້າງໄດ້ຫຼາຍຮອບ).
            </p>
          </Card>
        </div>

        {/* Sidebar Column (Spans 1 column on large screens) */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <Card className="p-5 space-y-4 shadow-sm border-t-4 border-t-slate-500">
            <h3 className="text-sm font-bold text-[var(--theme-text)] border-b border-[var(--theme-border-subtle)] pb-2">
              ຂໍ້ມູນໃບງານ
            </h3>

            <div className="space-y-3.5">
              <SidebarInfo icon={<Users size={15} className="text-emerald-600" />} label="ຊ່າງຫຼັກ" value={w.technician_name} />
              <SidebarInfo
                icon={<Users size={15} className="text-emerald-600" />}
                label="ຜູ້ຊ່ວຍຊ່າງ"
                value={Array.isArray(w.helpers) && w.helpers.length ? w.helpers.join(", ") : "-"}
              />
              <SidebarInfo icon={<CalendarClock size={15} className="text-emerald-600" />} label="ວັນເລີ່ມ" value={d10(w.work_date)} />
              <SidebarInfo icon={<CalendarClock size={15} className="text-emerald-600" />} label="ວັນຈົບ" value={d10(w.end_date)} />
              <SidebarInfo icon={<Wallet size={15} className="text-emerald-600" />} label="ອັດຕາ / ຊົ່ວໂມງ" value={money(w.rate_per_hour)} />
              <SidebarInfo icon={<Clock size={15} className="text-emerald-600" />} label="ລວມຊົ່ວໂມງ" value={String(Number(w.total_hours) || 0)} />
              <SidebarInfo icon={<DollarSign size={15} className="text-emerald-600" />} label="ຄ່າແຮງທັງໝົດ" value={money(w.labor_cost)} />
            </div>

            {w.notes && (
              <div className="mt-4 border-t border-[var(--theme-border-subtle)] pt-3">
                <span className="text-[11px] font-semibold text-[var(--theme-text-mute)] block mb-1">ໝາຍເຫດ</span>
                <p className="text-[12.5px] text-[var(--theme-text-soft)] bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                  {w.notes}
                </p>
              </div>
            )}
          </Card>

          {/* Quick Actions Card */}
          <Card className="p-4 shadow-sm bg-slate-50/50">
            <div className="flex flex-col gap-2.5">
              {w.project_id && (
                <button
                  onClick={() => router.push(`/projects/${w.project_id}`)}
                  className="flex w-full h-9 items-center justify-center gap-2 rounded-lg bg-white border border-[var(--theme-border-subtle)] text-[12.5px] font-bold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-emerald-600 transition-colors"
                >
                  <FolderKanban size={15} />
                  <span>ໄປໜ້າໂຄງການ</span>
                </button>
              )}

              <button
                onClick={() => router.push("/work-orders")}
                className="flex w-full h-9 items-center justify-center gap-2 rounded-lg bg-white border border-[var(--theme-border-subtle)] text-[12.5px] font-bold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-emerald-600 transition-colors"
              >
                <ArrowLeft size={15} />
                <span>ກັບໄປລາຍການໃບງານ</span>
              </button>
            </div>
          </Card>
        </div>
      </div>
    <div className="mt-5"><ActivityFeed entityType="work_order" entityId={String(id)} /></div>
    </Page>
  );
}

function SidebarInfo({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <div className="flex items-start gap-3 p-1">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 mt-0.5">
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
