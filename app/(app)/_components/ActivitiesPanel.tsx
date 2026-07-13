"use client";

/**
 * Odoo-style "Activities" section for a record — scheduled to-dos with a type,
 * assignee and due date. Sits above the discussion/log timeline. Open activities
 * show here; marking one done moves it into the timeline (see chatter).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarClock, Check, X, Plus, ListTodo, Phone, Users, Mail, FileText, Loader2 } from "lucide-react";
import { getActivities, scheduleActivity, markActivityDone, cancelActivity, getAssignableUsers, type Activity } from "@/_actions/activities";
import RSelect from "./RSelect";
import { Btn, Card, Pill, inputCls } from "./ui";
import { useT } from "@/_lib/i18n";

const POLL_MS = 8000;

const TYPE_DEFS: { key: string; icon: React.ReactNode; tone: string }[] = [
  { key: "todo", icon: <ListTodo size={14} />, tone: "bg-[var(--info-soft)] text-[var(--info)]" },
  { key: "call", icon: <Phone size={14} />, tone: "bg-[var(--success-soft)] text-[var(--success)]" },
  { key: "meeting", icon: <Users size={14} />, tone: "bg-[var(--brand-soft)] text-[var(--brand-strong)]" },
  { key: "email", icon: <Mail size={14} />, tone: "bg-[var(--warning-soft)] text-[var(--warning)]" },
  { key: "document", icon: <FileText size={14} />, tone: "bg-[var(--surface-sunken)] text-[var(--text-soft)]" },
];

const todayStr = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function ActivitiesPanel({ entityType, entityId }: { entityType: string; entityId: string | number }) {
  const t = useT();
  const TYPE_LABEL: Record<string, string> = {
    todo: t("components.activities.typeTodo", "ສິ່ງທີ່ຕ້ອງເຮັດ"),
    call: t("components.activities.typeCall", "ໂທຫາ"),
    meeting: t("components.activities.typeMeeting", "ນັດພົບ"),
    email: t("components.activities.typeEmail", "ອີເມວ"),
    document: t("components.activities.typeDocument", "ເອກະສານ"),
  };
  const TYPES = TYPE_DEFS.map((d) => ({ ...d, label: TYPE_LABEL[d.key] ?? d.key }));
  const typeMeta = (k: string) => TYPES.find((x) => x.key === k) || TYPES[0];
  const dueMeta = (due: string | null): { label: string; tone: "neutral" | "red" | "amber" } => {
    if (!due) return { label: t("components.activities.noDueDate", "ບໍ່ກຳນົດ"), tone: "neutral" };
    const today = todayStr();
    if (due < today) return { label: `${t("components.activities.overdue", "ເລີຍກຳນົດ")} · ${due}`, tone: "red" };
    if (due === today) return { label: t("components.activities.today", "ມື້ນີ້"), tone: "amber" };
    return { label: due, tone: "neutral" };
  };
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
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--border-soft)] px-5 py-3.5">
        <CalendarClock size={16} className="text-[var(--warning)]" />
        <h2 className="text-[13px] font-black text-[var(--text)]">{t("components.activities.title", "ກິດຈະກຳທີ່ຕ້ອງເຮັດ")}</h2>
        {planned.length > 0 && <Pill tone="amber">{planned.length}</Pill>}
        <Btn variant="go" className="ml-auto h-7 px-2.5 text-[11px]" onClick={() => setOpen((o) => !o)}>
          <Plus size={13} strokeWidth={3} /> {t("components.activities.schedule", "ນັດໝາຍ")}
        </Btn>
      </div>

      {/* Schedule form */}
      {open && (
        <div className="space-y-2.5 border-b border-[var(--border-soft)] bg-[var(--surface-sunken)] px-4 py-3.5">
          <div className="flex flex-wrap gap-1.5">
            {TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => setType(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] font-bold transition ${
                  type === t.key
                    ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-soft)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder={t("components.activities.summaryPlaceholder", "ຫົວຂໍ້ກິດຈະກຳ...")}
            className={inputCls}
          />
          <div className="flex flex-wrap gap-2">
            <div className="min-w-[140px] flex-1">
              <RSelect
                value={assignee}
                onChange={setAssignee}
                isClearable
                placeholder={t("components.activities.assignSelf", "ມອບໝາຍ (ຕົນເອງ)")}
                options={users.map((u) => ({ value: u.username, label: u.name }))}
              />
            </div>
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className={`${inputCls} w-auto font-semibold`}
            />
            <Btn variant="ink" onClick={submit} disabled={!summary.trim() || busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {t("common.save", "ບັນທຶກ")}
            </Btn>
          </div>
        </div>
      )}

      {/* Planned list */}
      <div>
        {planned.length === 0 ? (
          <div className="px-5 py-6 text-center text-[12px] font-semibold text-[var(--text-mute)]">{t("components.activities.empty", "ບໍ່ມີກິດຈະກຳຄ້າງ")}</div>
        ) : (
          planned.map((a) => {
            const tm = typeMeta(a.activity_type);
            const dm = dueMeta(a.due_date);
            return (
              <div key={a.id} className="group flex items-start gap-3 border-b border-[var(--border-soft)] px-4 py-3 last:border-b-0">
                <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${tm.tone}`}>{tm.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-[var(--text)]">{a.summary}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Pill tone={dm.tone}>{dm.label}</Pill>
                    {a.assignee_name && <Pill tone="neutral">👤 {a.assignee_name}</Pill>}
                  </div>
                  {a.note && <p className="mt-1 text-[11.5px] text-[var(--text-soft)]">{a.note}</p>}
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  <button
                    onClick={() => done(a.id)}
                    title={t("components.activities.done", "ສຳເລັດ")}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--success-soft)] text-[var(--success)] transition hover:opacity-80"
                  >
                    <Check size={14} strokeWidth={2.5} />
                  </button>
                  <button
                    onClick={() => cancel(a.id)}
                    title={t("common.cancel", "ຍົກເລີກ")}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-mute)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
