"use client";

/**
 * Topbar notifications bell. Shows unread notifications for records the current
 * user follows (new comments, assigned/done activities), with links to the
 * record. Polls periodically.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, MessageSquare, CheckCircle2, CalendarClock, CheckCheck } from "lucide-react";
import type { Notification } from "@/_actions/notifications";
import { useT } from "@/_lib/i18n";

/** Poll/mark via the stable /api/notifications route (server actions go stale on redeploy). */
async function fetchNotifications(): Promise<{ items: Notification[]; unread: number } | null> {
  try {
    const resp = await fetch("/api/notifications", { cache: "no-store" });
    if (!resp.ok) return null;
    const j = await resp.json();
    return j?.success ? j.data : null;
  } catch {
    return null;
  }
}
async function markNotificationsRead(ids?: (string | number)[]): Promise<void> {
  try {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids ? { ids } : {}),
    });
  } catch {
    /* best-effort */
  }
}

const POLL_MS = 25000;

const ENTITY_ROUTE: Record<string, { base: string }> = {
  project: { base: "/projects" },
  contract: { base: "/contracts" },
  quotation: { base: "/quotations" },
  boq: { base: "/boq" },
  request: { base: "/requests" },
  work_order: { base: "/work-orders" },
  customer: { base: "/customers" },
};
const KIND_ICON: Record<string, React.ReactNode> = {
  comment: <MessageSquare size={13} />,
  activity: <CalendarClock size={13} />,
  activity_done: <CheckCircle2 size={13} />,
};

function makeRelTime(t: ReturnType<typeof useT>) {
  return (iso: string): string => {
    const ms = new Date(iso).getTime();
    if (!Number.isFinite(ms)) return "";
    const s = Math.floor((Date.now() - ms) / 1000);
    if (s < 60) return t("components.relTime.now", "ຫາກໍ່");
    if (s < 3600) return `${Math.floor(s / 60)} ${t("components.relTime.minutesAgo", "ນາທີກ່ອນ")}`;
    if (s < 86400) return `${Math.floor(s / 3600)} ${t("components.relTime.hoursAgo", "ຊົ່ວໂມງກ່ອນ")}`;
    return `${Math.floor(s / 86400)} ${t("components.relTime.daysAgo", "ມື້ກ່ອນ")}`;
  };
}

export default function NotificationsBell() {
  const tr = useT();
  const relTime = makeRelTime(tr);
  const ENTITY_LABEL: Record<string, string> = {
    project: tr("components.entity.project", "ໂຄງການ"),
    contract: tr("components.entity.contract", "ສັນຍາ"),
    quotation: tr("components.entity.quotation", "ໃບສະເໜີລາຄາ"),
    boq: tr("components.entity.boq", "BOQ"),
    request: tr("components.entity.request", "ຂໍເບີກ"),
    work_order: tr("components.entity.workOrder", "ໃບງານ"),
  };
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const data = await fetchNotifications();
      if (data) { setItems(data.items); setUnread(data.unread); }
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
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-soft)] hover:bg-[var(--surface-soft)] hover:text-[var(--text)] transition"
        title={tr("components.notifications.title", "ການແຈ້ງເຕືອນ")}
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-rose-500 px-1 text-[9.5px] font-black text-white ring-2 ring-[var(--surface)]">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button aria-hidden tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_20px_45px_-12px_rgba(15,23,42,0.28)] animate-scale-up">
            <div className="flex items-center gap-2 border-b border-[var(--border-soft)] bg-[var(--surface-soft)]/70 px-4 py-3">
              <Bell size={15} className="text-blue-600 dark:text-blue-400" />
              <span className="text-[12.5px] font-black text-[var(--text)]">{tr("components.notifications.title", "ການແຈ້ງເຕືອນ")}</span>
              {unread > 0 && (
                <button onClick={markAll} className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-bold text-blue-600 dark:text-blue-400 hover:underline">
                  <CheckCheck size={12} /> {tr("components.notifications.markAllRead", "ອ່ານທັງໝົດ")}
                </button>
              )}
            </div>
            <div className="max-h-[380px] overflow-y-auto">
              {items.length === 0 ? (
                <div className="px-4 py-8 text-center text-[12px] font-semibold text-[var(--text-mute)]">{tr("components.notifications.empty", "ບໍ່ມີການແຈ້ງເຕືອນ")}</div>
              ) : (
                items.map((n) => {
                  const route = ENTITY_ROUTE[n.entity_type];
                  return (
                    <button
                      key={n.id}
                      onClick={() => openRecord(n)}
                      className={`flex w-full items-start gap-2.5 border-b border-[var(--border-soft)] px-4 py-2.5 text-left transition hover:bg-[var(--surface-soft)] ${n.is_read ? "" : "bg-[var(--brand-tint)]"}`}
                    >
                      <span className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${n.is_read ? "bg-[var(--surface-soft)] text-[var(--text-mute)]" : "bg-[var(--brand-soft)] text-blue-600 dark:text-blue-400"}`}>
                        {KIND_ICON[n.kind] || <Bell size={13} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className={`text-[12px] leading-snug ${n.is_read ? "font-medium text-[var(--text-soft)]" : "font-bold text-[var(--text)]"}`}>{n.body}</div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] font-semibold text-[var(--text-mute)]">
                          <span>{relTime(n.created_at)}</span>
                          {route && <span>· {ENTITY_LABEL[n.entity_type] ?? n.entity_type}</span>}
                        </div>
                      </div>
                      {!n.is_read && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500 dark:bg-blue-400" />}
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
