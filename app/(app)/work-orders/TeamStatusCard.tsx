"use client";

/** Daily craftsman-team status — who's free today, who's on a job, with outcome. */
import { useEffect, useMemo, useState } from "react";
import { UsersRound, Wrench, CircleDot, RefreshCw } from "lucide-react";
import { getTechCalendar, type TechCalRow } from "@/_actions/tech-calendar";
import { Card, Pill, type PillTone } from "../_components/ui";
import { useT } from "@/_lib/i18n";

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ddmmyyyy = (d: Date) => `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;

type Tech = { code: string; name: string; wos: TechCalRow[] };

export default function TeamStatusCard() {
  const t = useT();
  const [rows, setRows] = useState<TechCalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const todayIso = isoOf(today);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getTechCalendar(todayIso, todayIso);
      setRows(res.success ? res.data : []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const { free, busy, working } = useMemo(() => {
    const map = new Map<string, Tech>();
    for (const r of rows) {
      let e = map.get(r.code);
      if (!e) { e = { code: r.code, name: r.tech_name || r.code, wos: [] }; map.set(r.code, e); }
      if (r.wo_id) e.wos.push(r);
    }
    const all = [...map.values()];
    const busyT = all.filter((x) => x.wos.length > 0);
    return {
      free: all.filter((x) => x.wos.length === 0),
      busy: busyT,
      working: busyT.filter((x) => x.wos.some((w) => w.checkin_at || String(w.status).toLowerCase() === "in_progress")).length,
    };
  }, [rows]);

  const total = free.length + busy.length;
  const stats: { label: string; value: number; tone: string }[] = [
    { label: t("teamStatus.total", "ທີມທັງໝົດ"), value: total, tone: "text-[var(--text)]" },
    { label: t("teamStatus.free", "ວ່າງ"), value: free.length, tone: "text-[var(--success)]" },
    { label: t("teamStatus.busy", "ມີວຽກ"), value: busy.length, tone: "text-[var(--warning)]" },
    { label: t("teamStatus.working", "ກຳລັງເຮັດ"), value: working, tone: "text-[var(--info)]" },
  ];

  const statusLabel = (w: TechCalRow) => {
    const s = String(w.status || "").toLowerCase();
    if (s === "closed" || w.checkout_at) return t("teamStatus.done", "ສຳເລັດ");
    if (s === "in_progress" || w.checkin_at) return t("teamStatus.working", "ກຳລັງເຮັດ");
    return t("teamStatus.assigned", "ຮັບງານ");
  };

  const statusTone = (w: TechCalRow): PillTone => {
    const s = String(w.status || "").toLowerCase();
    if (s === "closed" || w.checkout_at) return "green";
    if (s === "in_progress" || w.checkin_at) return "amber";
    return "brand";
  };

  return (
    <Card className="mb-4 overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-[var(--border-soft)] px-4 py-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--brand-soft)] bg-[var(--brand-soft)] text-[var(--brand-strong)]">
          <UsersRound size={15} />
        </span>
        <span className="text-[13px] font-bold text-[var(--text)]">{t("teamStatus.title", "ສະຖານະທີມຊ່າງປະຈຳວັນ")}</span>
        <span className="rounded-md bg-[var(--surface-sunken)] px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--text-mute)]">{ddmmyyyy(today)}</span>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-mute)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text)] disabled:opacity-60"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-sunken)] px-3 py-2">
            <div className={`text-[16px] font-black leading-none ${s.tone}`}>{s.value}</div>
            <div className="mt-1.5 text-[10.5px] font-semibold text-[var(--text-mute)]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ຊ່າງວ່າງມື້ນີ້ */}
      {free.length > 0 && (
        <div className="border-t border-[var(--border-soft)] px-3 pb-3 pt-2">
          <div className="mb-1.5 text-[10.5px] font-extrabold tracking-wider text-[var(--success)]">
            {t("teamStatus.freeToday", "ຊ່າງວ່າງມື້ນີ້")} ({free.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {free.map((f) => (
              <span
                key={f.code}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--success-soft)] bg-[var(--success-soft)] px-2.5 py-1 text-[12px] font-semibold text-[var(--success)]"
              >
                <CircleDot size={11} /> {f.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ທີມທີ່ມີວຽກມື້ນີ້ */}
      {busy.length > 0 && (
        <div className="border-t border-[var(--border-soft)] px-3 pb-3 pt-2">
          <div className="mb-1.5 text-[10.5px] font-extrabold tracking-wider text-[var(--text-mute)]">
            {t("teamStatus.busyToday", "ມີວຽກມື້ນີ້")} ({busy.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {busy.map((b) => (
              <div key={b.code} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5">
                <Wrench size={11} className="text-[var(--warning)]" />
                <span className="text-[12px] font-semibold text-[var(--text-soft)]">{b.name}</span>
                {b.wos[0]?.work_no && <span className="font-mono text-[10px] text-[var(--text-mute)]">{b.wos[0].work_no}</span>}
                <Pill tone={statusTone(b.wos[0])}>{statusLabel(b.wos[0])}</Pill>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
