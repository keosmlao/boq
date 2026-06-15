"use client";

/**
 * Topbar notifications bell. Shows unread notifications for records the current
 * user follows (new comments, assigned/done activities), with links to the
 * record. Polls periodically.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, MessageSquare, CheckCircle2, CalendarClock, CheckCheck } from "lucide-react";
import { getMyNotifications, markNotificationsRead, type Notification } from "@/_actions/notifications";

const POLL_MS = 25000;

const ENTITY_ROUTE: Record<string, { base: string; label: string }> = {
  project: { base: "/projects", label: "ໂຄງການ" },
  contract: { base: "/contracts", label: "ສັນຍา" },
  quotation: { base: "/quotations", label: "ໃບສະເໜີລາຄາ" },
  boq: { base: "/boq", label: "BOQ" },
  request: { base: "/requests", label: "ຂໍເບີກ" },
  work_order: { base: "/work-orders", label: "ໃບງານ" },
};
const KIND_ICON: Record<string, React.ReactNode> = {
  comment: <MessageSquare size={13} />,
  activity: <CalendarClock size={13} />,
  activity_done: <CheckCircle2 size={13} />,
};

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "ຫາກໍ່";
  if (s < 3600) return `${Math.floor(s / 60)} ນາທີກ່ອນ`;
  if (s < 86400) return `${Math.floor(s / 3600)} ຊົ່ວໂມງກ່ອນ`;
  return `${Math.floor(s / 86400)} ມື້ກ່ອນ`;
}

export default function NotificationsBell() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const res = await getMyNotifications();
      if (res?.success) { setItems(res.data.items); setUnread(res.data.unread); }
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    const onVis = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [load]);

  const openRecord = async (n: Notification) => {
    setOpen(false);
    if (!n.is_read) {
      setItems((p) => p.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      markNotificationsRead([n.id]);
    }
    const r = ENTITY_ROUTE[n.entity_type];
    if (r) router.push(`${r.base}/${encodeURIComponent(n.entity_id)}`);
  };

  const markAll = async () => {
    setItems((p) => p.map((x) => ({ ...x, is_read: true })));
    setUnread(0);
    await markNotificationsRead();
  };

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen((o) => !o); load(); }}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
        title="ການແຈ້ງເຕືອນ"
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-rose-500 px-1 text-[9.5px] font-black text-white ring-2 ring-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button aria-hidden tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_45px_-12px_rgba(15,23,42,0.28)] animate-scale-up">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
              <Bell size={15} className="text-blue-600" />
              <span className="text-[12.5px] font-black text-slate-800">ການแจ้งเตือน</span>
              {unread > 0 && (
                <button onClick={markAll} className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-bold text-blue-600 hover:underline">
                  <CheckCheck size={12} /> อ่านทั้งหมด
                </button>
              )}
            </div>
            <div className="max-h-[380px] overflow-y-auto">
              {items.length === 0 ? (
                <div className="px-4 py-8 text-center text-[12px] font-semibold text-slate-400">ບໍ່ມีการแจ้งเตือน</div>
              ) : (
                items.map((n) => {
                  const route = ENTITY_ROUTE[n.entity_type];
                  return (
                    <button
                      key={n.id}
                      onClick={() => openRecord(n)}
                      className={`flex w-full items-start gap-2.5 border-b border-slate-50 px-4 py-2.5 text-left transition hover:bg-blue-50/50 ${n.is_read ? "" : "bg-blue-50/30"}`}
                    >
                      <span className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${n.is_read ? "bg-slate-100 text-slate-400" : "bg-blue-100 text-blue-600"}`}>
                        {KIND_ICON[n.kind] || <Bell size={13} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className={`text-[12px] leading-snug ${n.is_read ? "font-medium text-slate-500" : "font-bold text-slate-800"}`}>{n.body}</div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] font-semibold text-slate-400">
                          <span>{relTime(n.created_at)}</span>
                          {route && <span>· {route.label}</span>}
                        </div>
                      </div>
                      {!n.is_read && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
