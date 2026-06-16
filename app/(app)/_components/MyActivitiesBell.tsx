"use client";

/**
 * Topbar "my activities" indicator (Odoo systray style). Shows the count of the
 * current user's planned activities that are overdue or due today, with a
 * dropdown listing them and links to each record.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, ListTodo, Phone, Users, Mail, FileText } from "lucide-react";
import type { Activity } from "@/_actions/activities";

const POLL_MS = 30000;

/** Poll via the stable /api/my-activities route (server actions go stale on redeploy). */
async function fetchMyActivities(): Promise<Activity[] | null> {
  try {
    const resp = await fetch("/api/my-activities", { cache: "no-store" });
    if (!resp.ok) return null;
    const j = await resp.json();
    return j?.success ? j.data : null;
  } catch {
    return null;
  }
}

const ENTITY_ROUTE: Record<string, { base: string; label: string }> = {
  project: { base: "/projects", label: "ໂຄງການ" },
  contract: { base: "/contracts", label: "ສັນຍາ" },
  quotation: { base: "/quotations", label: "ໃບສະເໜີລາຄາ" },
  boq: { base: "/boq", label: "BOQ" },
  request: { base: "/requests", label: "ຂໍເບີກ" },
  work_order: { base: "/work-orders", label: "ໃບງານ" },
};
const TYPE_ICON: Record<string, React.ReactNode> = {
  todo: <ListTodo size={13} />, call: <Phone size={13} />, meeting: <Users size={13} />, email: <Mail size={13} />, document: <FileText size={13} />,
};

const todayStr = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function MyActivitiesBell() {
  const router = useRouter();
  const [items, setItems] = useState<Activity[]>([]);
  const [open, setOpen] = useState(false);
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const data = await fetchMyActivities();
      if (data) setItems(data);
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

  const t = todayStr();
  const dueCount = items.filter((a) => a.due_date && a.due_date <= t).length;

  const goto = (a: Activity) => {
    const r = ENTITY_ROUTE[a.entity_type];
    setOpen(false);
    if (r) router.push(`${r.base}/${encodeURIComponent(a.entity_id)}`);
  };

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen((o) => !o); load(); }}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-soft)] hover:bg-[var(--surface-soft)] hover:text-[var(--text)] transition"
        title="ກິດຈະກຳຂອງຂ້ອຍ"
      >
        <CalendarClock size={17} />
        {dueCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-rose-500 px-1 text-[9.5px] font-black text-white ring-2 ring-[var(--surface)]">
            {dueCount > 99 ? "99+" : dueCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button aria-hidden tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 origin-top-right overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_20px_45px_-12px_rgba(15,23,42,0.28)] animate-scale-up">
            <div className="flex items-center gap-2 border-b border-[var(--border-soft)] bg-[var(--surface-soft)]/70 px-4 py-3">
              <CalendarClock size={15} className="text-amber-600 dark:text-amber-400" />
              <span className="text-[12.5px] font-black text-[var(--text)]">ກິດຈະກຳຂອງຂ້ອຍ</span>
              <span className="ml-auto rounded-lg bg-[var(--surface-soft)] border border-[var(--border-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--text-soft)]">{items.length}</span>
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              {items.length === 0 ? (
                <div className="px-4 py-8 text-center text-[12px] font-semibold text-[var(--text-mute)]">ບໍ່ມີກິດຈະກຳຄ້າງ 🎉</div>
              ) : (
                items.map((a) => {
                  const overdue = a.due_date && a.due_date < t;
                  const today = a.due_date === t;
                  const route = ENTITY_ROUTE[a.entity_type];
                  return (
                    <button
                      key={a.id}
                      onClick={() => goto(a)}
                      className="flex w-full items-start gap-2.5 border-b border-[var(--border-soft)] px-4 py-2.5 text-left transition hover:bg-[var(--surface-soft)]"
                    >
                      <span className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${overdue ? "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400" : today ? "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400" : "bg-[var(--surface-soft)] text-[var(--text-soft)]"}`}>
                        {TYPE_ICON[a.activity_type] || <ListTodo size={13} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-bold text-[var(--text)]">{a.summary}</div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] font-semibold">
                          <span className={overdue ? "text-rose-600 dark:text-rose-400" : today ? "text-amber-600 dark:text-amber-400" : "text-[var(--text-mute)]"}>
                            {a.due_date ? (overdue ? `ເລີຍກຳນົດ · ${a.due_date}` : today ? "ມື້ນີ້" : a.due_date) : "ບໍ່ກຳນົດ"}
                          </span>
                          {route && <span className="text-[var(--text-mute)]">· {route.label}</span>}
                        </div>
                      </div>
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
