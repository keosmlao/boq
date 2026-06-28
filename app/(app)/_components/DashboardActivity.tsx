"use client";

/** Dashboard panel — my upcoming appointments + recent document activity. */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Bell, ChevronRight } from "lucide-react";
import { getMyActivities, type Activity } from "@/_actions/activities";
import { getMyNotifications } from "@/_actions/notifications";
import { useT } from "@/_lib/i18n";

const ROUTE: Record<string, string> = {
  contract: "/contracts", quotation: "/quotations", boq: "/boq", request: "/requests",
  work_order: "/work-orders", project: "/projects", customer: "/customers",
};
const hrefOf = (type: string, id: string) => (ROUTE[type] ? `${ROUTE[type]}/${encodeURIComponent(id)}` : "");
const fmtDate = (v: unknown) => { if (!v) return ""; const d = new Date(String(v)); return isNaN(d.getTime()) ? "" : `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`; };
const ago = (v: unknown, t: (k: string, f: string) => string) => {
  if (!v) return "";
  const m = Math.floor((Date.now() - new Date(String(v)).getTime()) / 60000);
  if (m < 1) return t("activity.now", "ຫາก่อน");
  if (m < 60) return `${m} ${t("activity.min", "ນາທີ")}`;
  if (m < 1440) return `${Math.floor(m / 60)} ${t("activity.hr", "ຊມ")}`;
  return `${Math.floor(m / 1440)} ${t("activity.day", "ມື້")}`;
};

export default function DashboardActivity() {
  const t = useT();
  const router = useRouter();
  const [appts, setAppts] = useState<Activity[]>([]);
  const [notifs, setNotifs] = useState<any[]>([]);

  useEffect(() => {
    getMyActivities().then((r) => { if (r.success) setAppts(r.data.slice(0, 6)); }).catch(() => {});
    getMyNotifications(8).then((r: any) => { if (r?.success) setNotifs(r.data?.items || []); }).catch(() => {});
  }, []);

  return (
    <div className="space-y-5">
      {/* My appointments */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><CalendarClock size={15} /></span>
          <h2 className="text-[13px] font-black text-slate-900">{t("overview.myAppointments", "ນັດໝາຍຂອງຂ້ອຍ")}</h2>
          {appts.length > 0 && <span className="ml-auto rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">{appts.length}</span>}
        </div>
        {appts.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12px] text-slate-400">{t("overview.noAppointments", "ບໍ່ມีนัดหมาย")}</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {appts.map((a) => (
              <button key={a.id} onClick={() => { const h = hrefOf(a.entity_type, a.entity_id); if (h) router.push(h); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-50/70">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-slate-800">{a.summary || a.activity_type}</span>
                  <span className="block text-[11px] text-slate-400">{fmtDate((a as any).due_date)}</span>
                </span>
                <ChevronRight size={14} className="flex-shrink-0 text-slate-300" />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Recent activity / notifications */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><Bell size={15} /></span>
          <h2 className="text-[13px] font-black text-slate-900">{t("overview.recentActivity", "ກິດจะกรรมล่าสุด")}</h2>
        </div>
        {notifs.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12px] text-slate-400">{t("overview.noActivity", "ບໍ່ມีกิจกรรม")}</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifs.map((n) => (
              <button key={n.id} onClick={() => { const h = hrefOf(n.entity_type, n.entity_id); if (h) router.push(h); }} className="flex w-full items-start gap-2 px-4 py-2.5 text-left hover:bg-slate-50/70">
                <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${n.is_read ? "bg-slate-200" : "bg-amber-500"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium text-slate-700">{n.body || n.kind}</span>
                  <span className="block text-[10.5px] text-slate-400">{n.actor_name ? `${n.actor_name} · ` : ""}{ago(n.created_at, t)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
