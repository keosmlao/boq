"use client";

/** Dashboard panel — my upcoming appointments + recent document activity. */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Bell, ChevronRight } from "lucide-react";
import { getMyActivities, type Activity } from "@/_actions/activities";
import { getMyNotifications } from "@/_actions/notifications";
import { Card, Pill, SectionHeader } from "./ui";
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
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[var(--border-soft)] px-4 py-3">
          <SectionHeader icon={<CalendarClock size={15} />} title={t("overview.myAppointments", "ນັດໝາຍຂອງຂ້ອຍ")} tone="brand" className="mb-0" />
          {appts.length > 0 && <span className="ml-auto"><Pill tone="brand">{appts.length}</Pill></span>}
        </div>
        {appts.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12px] text-[var(--text-mute)]">{t("overview.noAppointments", "ບໍ່ມີນັດໝາຍ")}</div>
        ) : (
          <div>
            {appts.map((a) => (
              <button
                key={a.id}
                onClick={() => { const h = hrefOf(a.entity_type, a.entity_id); if (h) router.push(h); }}
                className="flex w-full items-center gap-2 border-b border-[var(--border-soft)] px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-[var(--brand-tint)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-[var(--text)]">{a.summary || a.activity_type}</span>
                  <span className="block text-[11px] text-[var(--text-mute)]">{fmtDate((a as any).due_date)}</span>
                </span>
                <ChevronRight size={14} className="flex-shrink-0 text-[var(--text-mute)]" />
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Recent activity / notifications */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[var(--border-soft)] px-4 py-3">
          <SectionHeader icon={<Bell size={15} />} title={t("overview.recentActivity", "ກິດຈະກຳລ່າສຸດ")} tone="amber" className="mb-0" />
        </div>
        {notifs.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12px] text-[var(--text-mute)]">{t("overview.noActivity", "ບໍ່ມີກິດຈະກຳ")}</div>
        ) : (
          <div>
            {notifs.map((n) => (
              <button
                key={n.id}
                onClick={() => { const h = hrefOf(n.entity_type, n.entity_id); if (h) router.push(h); }}
                className="flex w-full items-start gap-2 border-b border-[var(--border-soft)] px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-[var(--brand-tint)]"
              >
                <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${n.is_read ? "bg-[var(--border-strong)]" : "bg-[var(--warning)]"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium text-[var(--text-soft)]">{n.body || n.kind}</span>
                  <span className="block text-[10.5px] text-[var(--text-mute)]">{n.actor_name ? `${n.actor_name} · ` : ""}{ago(n.created_at, t)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
