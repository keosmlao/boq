"use client";

/** Manage craftsman teams — technicians + their helpers (odg_technicians). */
import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Pencil, Phone, Plus, RefreshCw, Search, Trash2, UsersRound, Wrench, X } from "lucide-react";
import { Page, PageHeader, Card, Btn, Field, Pill, Stat, inputCls } from "../_components/ui";
import { getTechnicians, createTechnician, updateTechnician, deleteTechnician } from "@/_actions/lookups";
import { getTeamAvailability, type TeamAvailability } from "@/_actions/team-availability";

type Tech = {
  roworder: number;
  code: string;
  name_1: string;
  phone: string | null;
  role: string | null;
  helpers: string[] | null;
};

type Draft = {
  roworder?: number;
  code: string;
  name_1: string;
  phone: string;
  role: string;
  helpers: string[];
  isNew: boolean;
};

const TECH_ROLES = [
  { key: "lead", label: "ຫົວໜ້າທີມ" },
  { key: "technician", label: "ຊ່າງ" },
  { key: "assistant", label: "ຜູ້ຊ່ວຍ" },
  { key: "helper", label: "ລູກມື" },
];
const roleLabel = (r?: string | null) => TECH_ROLES.find((x) => x.key === (r || "").toLowerCase())?.label || "ຊ່າງ";
const roleTone = (r?: string | null): "brand" | "green" | "amber" | "neutral" =>
  ({ lead: "brand", technician: "green", assistant: "amber", helper: "neutral" } as const)[(r || "").toLowerCase() as "lead"] || "neutral";

const emptyDraft = (): Draft => ({ code: "", name_1: "", phone: "", role: "technician", helpers: [], isNew: true });

const WO_STATUS_LABEL: Record<string, string> = {
  open: "ເປີດ",
  assigned: "ມອບໝາຍ",
  accepted: "ຮັບງານແລ້ວ",
  in_progress: "ກຳລັງເຮັດ",
  awaiting_review: "ລໍກວດສອບ",
};

type TeamState = { label: string; tone: "green" | "amber" | "blue"; busy: boolean };
function teamState(a?: TeamAvailability): TeamState {
  if (!a || a.active === 0) return { label: "ວ່າງ", tone: "green", busy: false };
  if (a.working > 0) return { label: "ກຳລັງເຮັດວຽກ", tone: "blue", busy: true };
  return { label: "ມີວຽກລໍ", tone: "amber", busy: true };
}

export default function TechTeamsPage() {
  const [techs, setTechs] = useState<Tech[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [avail, setAvail] = useState<Map<string, TeamAvailability>>(new Map());
  const [statusFilter, setStatusFilter] = useState<"all" | "free" | "busy">("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [res, avRes] = await Promise.all([getTechnicians(), getTeamAvailability()]);
    if (res.success) {
      setTechs((res.data as Tech[]).map((t) => ({ ...t, helpers: Array.isArray(t.helpers) ? t.helpers : [] })));
      setError(null);
    } else {
      setError((res as { message?: string }).message || "ໂຫຼດບໍ່ສຳເລັດ");
    }
    if (avRes.success) {
      setAvail(new Map(avRes.data.map((a) => [a.code, a])));
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const byCode = useMemo(() => {
    const m = new Map<string, Tech>();
    techs.forEach((t) => t.code && m.set(t.code, t));
    return m;
  }, [techs]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return techs.filter((t) => {
      if (s && !`${t.name_1} ${t.code} ${t.phone || ""}`.toLowerCase().includes(s)) return false;
      if (statusFilter !== "all") {
        const busy = teamState(avail.get(t.code)).busy;
        if (statusFilter === "busy" && !busy) return false;
        if (statusFilter === "free" && busy) return false;
      }
      return true;
    });
  }, [techs, q, statusFilter, avail]);

  const counts = useMemo(() => {
    let free = 0, busy = 0, working = 0;
    techs.forEach((t) => {
      const a = avail.get(t.code);
      const st = teamState(a);
      if (st.busy) busy++;
      else free++;
      if (a && a.working > 0) working++;
    });
    return { free, busy, working };
  }, [techs, avail]);

  const openNew = () => setDraft(emptyDraft());
  const openEdit = (t: Tech) =>
    setDraft({
      roworder: t.roworder,
      code: t.code || "",
      name_1: t.name_1 || "",
      phone: t.phone || "",
      role: (t.role || "technician").toLowerCase(),
      helpers: Array.isArray(t.helpers) ? t.helpers : [],
      isNew: false,
    });

  const toggleHelper = (code: string) =>
    setDraft((d) => {
      if (!d) return d;
      const has = d.helpers.includes(code);
      return { ...d, helpers: has ? d.helpers.filter((c) => c !== code) : [...d.helpers, code] };
    });

  const save = async () => {
    if (!draft) return;
    if (!draft.name_1.trim()) {
      setError("ກະລຸນາໃສ່ຊື່ຊ່າງ");
      return;
    }
    setSaving(true);
    const payload = { code: draft.code, name_1: draft.name_1, phone: draft.phone, role: draft.role, helpers: draft.helpers };
    const res = draft.isNew ? await createTechnician(payload) : await updateTechnician(draft.roworder!, payload);
    setSaving(false);
    if (res.success) {
      setDraft(null);
      load();
    } else {
      setError((res as { message?: string }).message || "ບັນທຶກບໍ່ສຳເລັດ");
    }
  };

  const remove = async (t: Tech) => {
    if (!confirm(`ລຶບ "${t.name_1}" ອອກຈາກລາຍຊື່ຊ່າງ?`)) return;
    const res = await deleteTechnician(t.roworder);
    if (res.success) load();
    else setError((res as { message?: string }).message || "ລຶບບໍ່ສຳເລັດ");
  };

  return (
    <Page max="max-w-none">
      <PageHeader
        title="ຈັດການທີມຊ່າງ"
        subtitle={`ທັງໝົດ ${techs.length} ຄົນ`}
        actions={
          <>
            <Btn variant="outline" onClick={load} disabled={loading}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> ໂຫຼດໃໝ່
            </Btn>
            <Btn onClick={openNew}>
              <Plus size={15} /> ເພີ່ມຊ່າງ
            </Btn>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat icon={<UsersRound size={18} />} label="ວ່າງ" value={counts.free} />
        <Stat icon={<Wrench size={18} />} label="ມີວຽກ" value={counts.busy} />
        <Stat icon={<Wrench size={18} />} label="ກຳລັງເຮັດ" value={counts.working} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ຄົ້ນຫາຊື່ / ລະຫັດ / ເບີໂທ" className={`${inputCls} pl-9`} />
        </div>
        <div className="flex gap-1.5">
          {([["all", "ທັງໝົດ"], ["free", "ວ່າງ"], ["busy", "ມີວຽກ"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`h-9 rounded-xl px-3 text-[11px] font-bold transition-all ${
                statusFilter === key ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-600">{error}</p>}

      {loading ? (
        <p className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin" /> ກຳລັງໂຫຼດ...
        </p>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">ບໍ່ພົບຊ່າງ</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => {
            const a = avail.get(t.code);
            const st = teamState(a);
            return (
            <Card key={t.roworder} className="p-4">
              <div className="flex items-start gap-3">
                <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${st.busy ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"}`}>
                  <UsersRound size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-[14px] font-bold text-slate-800">{t.name_1}</h3>
                    <Pill tone={roleTone(t.role)}>{roleLabel(t.role)}</Pill>
                    <Pill tone={st.tone}>{st.label}</Pill>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-slate-500">
                    {t.code && <span>{t.code}</span>}
                    {t.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone size={11} /> {t.phone}
                      </span>
                    )}
                  </div>
                  {a && a.active > 0 && (
                    <div className="mt-1 text-[11.5px] font-semibold text-blue-700">
                      <Wrench size={11} className="mr-1 inline" />
                      ໃບງານ {a.current_work_no || "—"} · {WO_STATUS_LABEL[a.current_status || ""] || a.current_status}
                      {a.active > 1 && <span className="text-slate-400"> (+{a.active - 1})</span>}
                    </div>
                  )}
                </div>
                <div className="flex flex-shrink-0 gap-1">
                  <button onClick={() => openEdit(t)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-blue-600" title="ແກ້ໄຂ">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => remove(t)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="ລຶບ">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {t.helpers && t.helpers.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-2.5">
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">ລູກທີມ ({t.helpers.length})</div>
                  <div className="flex flex-wrap gap-1.5">
                    {t.helpers.map((code) => (
                      <span key={code} className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {byCode.get(code)?.name_1 || code}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
            );
          })}
        </div>
      )}

      {/* Editor */}
      {draft && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 backdrop-blur-sm sm:items-center">
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-[15px] font-black text-slate-800">{draft.isNew ? "ເພີ່ມຊ່າງ" : "ແກ້ໄຂຊ່າງ"}</h2>
              <button onClick={() => setDraft(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="ລະຫັດ (code)">
                  <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} className={inputCls} placeholder="ເຊັ່ນ T001" />
                </Field>
                <Field label="ເບີໂທ">
                  <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className={inputCls} placeholder="020..." />
                </Field>
              </div>
              <Field label="ຊື່ຊ່າງ" required>
                <input value={draft.name_1} onChange={(e) => setDraft({ ...draft, name_1: e.target.value })} className={inputCls} placeholder="ຊື່ ແລະ ນາມສະກຸນ" />
              </Field>

              <Field label="ບົດບາດ">
                <div className="grid grid-cols-4 gap-2">
                  {TECH_ROLES.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setDraft({ ...draft, role: r.key })}
                      className={`h-9 rounded-xl text-[11px] font-bold transition-all ${
                        draft.role === r.key ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </Field>

              <div>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">ລູກທີມ / ຜູ້ຊ່ວຍ</div>
                <p className="mb-2 text-[11px] text-slate-400">ເລືອກຊ່າງຄົນອື່ນເຂົ້າທີມຂອງຄົນນີ້</p>
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
                  {techs.filter((t) => t.code && t.roworder !== draft.roworder).length === 0 ? (
                    <p className="px-1 py-2 text-center text-[11px] text-slate-400">ບໍ່ມີຊ່າງຄົນອື່ນໃຫ້ເລືອກ</p>
                  ) : (
                    techs
                      .filter((t) => t.code && t.roworder !== draft.roworder)
                      .map((t) => {
                        const on = draft.helpers.includes(t.code);
                        return (
                          <button
                            key={t.roworder}
                            type="button"
                            onClick={() => toggleHelper(t.code)}
                            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] font-semibold transition-colors ${
                              on ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <span className={`flex h-4 w-4 items-center justify-center rounded border ${on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"}`}>
                              {on && <Check size={11} strokeWidth={3} />}
                            </span>
                            <span className="flex-1 truncate">{t.name_1}</span>
                            <span className="text-[10px] text-slate-400">{roleLabel(t.role)}</span>
                          </button>
                        );
                      })
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
              <Btn variant="outline" onClick={() => setDraft(null)} disabled={saving} className="flex-1">
                ຍົກເລີກ
              </Btn>
              <Btn onClick={save} disabled={saving} className="flex-1">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} ບັນທຶກ
              </Btn>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
