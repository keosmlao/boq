"use client";

/**
 * Odoo-style "Activities" section for a record — scheduled to-dos with a type,
 * assignee and due date. Sits above the discussion/log timeline. Open activities
 * show here; marking one done moves it into the timeline (see chatter).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarClock, Check, X, Plus, ListTodo, Phone, Users, Mail, FileText, Loader2 } from "lucide-react";
import { getActivities, scheduleActivity, markActivityDone, cancelActivity, getAssignableUsers, type Activity } from "@/_actions/activities";

const POLL_MS = 8000;

const TYPES: { key: string; label: string; icon: React.ReactNode; tone: string }[] = [
  { key: "todo", label: "ສິ່ງທີ່ຕ້ອງເຮັດ", icon: <ListTodo size={14} />, tone: "bg-blue-50 text-blue-600" },
  { key: "call", label: "ໂທຫາ", icon: <Phone size={14} />, tone: "bg-emerald-50 text-emerald-600" },
  { key: "meeting", label: "ນັດພົບ", icon: <Users size={14} />, tone: "bg-violet-50 text-violet-600" },
  { key: "email", label: "ອີເມວ", icon: <Mail size={14} />, tone: "bg-amber-50 text-amber-600" },
  { key: "document", label: "ເອກະສານ", icon: <FileText size={14} />, tone: "bg-cyan-50 text-cyan-600" },
];
const typeMeta = (k: string) => TYPES.find((t) => t.key === k) || TYPES[0];

const todayStr = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function dueMeta(due: string | null) {
  if (!due) return { label: "ບໍ່ກຳນົດ", cls: "bg-slate-100 text-slate-500" };
  const t = todayStr();
  if (due < t) return { label: `ເລີຍກຳນົດ · ${due}`, cls: "bg-rose-50 text-rose-700" };
  if (due === t) return { label: "ມື້ນີ້", cls: "bg-amber-50 text-amber-700" };
  return { label: due, cls: "bg-slate-100 text-slate-500" };
}

export default function ActivitiesPanel({ entityType, entityId }: { entityType: string; entityId: string | number }) {
  const id = String(entityId ?? "");
  const [items, setItems] = useState<Activity[]>([]);
  const [users, setUsers] = useState<{ username: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const polling = useRef(false);

  // form
  const [type, setType] = useState("todo");
  const [summary, setSummary] = useState("");
  const [assignee, setAssignee] = useState("");
  const [due, setDue] = useState(todayStr());

  const load = useCallback(async () => {
    if (polling.current || !id) return;
    polling.current = true;
    try {
      const res = await getActivities(entityType, id);
      if (res?.success) setItems(res.data);
    } finally {
      polling.current = false;
    }
  }, [entityType, id]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    getAssignableUsers().then((r) => { if (r?.success) setUsers(r.data); });
  }, []);

  const planned = items.filter((a) => a.state === "planned");

  const submit = async () => {
    const s = summary.trim();
    if (!s || busy) return;
    setBusy(true);
    try {
      const picked = users.find((u) => u.username === assignee);
      const res = await scheduleActivity({
        entityType, entityId: id, activityType: type, summary: s,
        assigneeUsername: assignee || undefined, assigneeName: picked?.name,
        dueDate: due || undefined,
      });
      if (res?.success) {
        setItems((p) => [res.data, ...p]);
        setSummary(""); setOpen(false); setType("todo"); setDue(todayStr());
      }
    } finally {
      setBusy(false);
    }
  };

  const done = async (aid: string) => {
    setItems((p) => p.filter((x) => x.id !== aid));
    const res = await markActivityDone(aid);
    if (!res?.success) load();
  };
  const cancel = async (aid: string) => {
    setItems((p) => p.filter((x) => x.id !== aid));
    const res = await cancelActivity(aid);
    if (!res?.success) load();
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
        <CalendarClock size={16} className="text-amber-600" />
        <h2 className="text-[13px] font-black text-slate-800">ກິດຈະກຳທີ່ຕ້ອງເຮັດ</h2>
        {planned.length > 0 && <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">{planned.length}</span>}
        <button
          onClick={() => setOpen((o) => !o)}
          className="ml-auto inline-flex h-7 items-center gap-1 rounded-lg bg-blue-600 px-2.5 text-[11px] font-bold text-white transition hover:bg-blue-700 active:scale-95"
        >
          <Plus size={13} strokeWidth={3} /> ນັດໝາຍ
        </button>
      </div>

      {/* Schedule form */}
      {open && (
        <div className="space-y-2.5 border-b border-slate-100 bg-slate-50/60 px-4 py-3.5">
          <div className="flex flex-wrap gap-1.5">
            {TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => setType(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] font-bold transition ${type === t.key ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="ຫົວข้อกิจกรรม..."
            className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15"
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="h-9 min-w-[140px] flex-1 rounded-xl border border-slate-200 bg-white px-2.5 text-[12.5px] font-semibold text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="">ມອບໝາຍ (ຕົນເອງ)</option>
              {users.map((u) => <option key={u.username} value={u.username}>{u.name}</option>)}
            </select>
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-[12.5px] font-semibold text-slate-700 outline-none focus:border-blue-500"
            />
            <button
              onClick={submit}
              disabled={!summary.trim() || busy}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white transition hover:bg-blue-700 active:scale-95 disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} ບັນທຶກ
            </button>
          </div>
        </div>
      )}

      {/* Planned list */}
      <div className="divide-y divide-slate-50">
        {planned.length === 0 ? (
          <div className="px-5 py-6 text-center text-[12px] font-semibold text-slate-400">ບໍ່ມีกิจกรรมค้าง</div>
        ) : (
          planned.map((a) => {
            const tm = typeMeta(a.activity_type);
            const dm = dueMeta(a.due_date);
            return (
              <div key={a.id} className="group flex items-start gap-3 px-4 py-3">
                <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${tm.tone}`}>{tm.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-slate-800">{a.summary}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-bold ${dm.cls}`}>{dm.label}</span>
                    {a.assignee_name && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-500">👤 {a.assignee_name}</span>}
                  </div>
                  {a.note && <p className="mt-1 text-[11.5px] text-slate-500">{a.note}</p>}
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  <button onClick={() => done(a.id)} title="ສຳເລັດ" className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100">
                    <Check size={14} strokeWidth={2.5} />
                  </button>
                  <button onClick={() => cancel(a.id)} title="ຍົກເລີກ" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 transition hover:bg-rose-50 hover:text-rose-500">
                    <X size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
