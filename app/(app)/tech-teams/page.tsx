"use client";

/** Manage craftsman teams — technicians + their helpers (odg_technicians). */
import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Pencil, Phone, Plus, RefreshCw, Search, Trash2, UsersRound, Wrench, X } from "lucide-react";
import { Page, PageHeader, Card, Btn, Field, Pill, Stat, inputCls } from "../_components/ui";
import { getTechnicians, createTechnician, updateTechnician, deleteTechnician } from "@/_actions/lookups";
import { getTeamAvailability, type TeamAvailability } from "@/_actions/team-availability";
import { getV2User } from "../../_lib/session";
import { can } from "@/_lib/permissions";
import { useT } from "@/_lib/i18n";

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

type Translator = (key: string, fallback: string) => string;

const TECH_ROLES = [
  { key: "lead", labelKey: "techTeams.roleLead", labelLo: "ຫົວໜ້າທີມ" },
  { key: "technician", labelKey: "techTeams.roleTechnician", labelLo: "ຊ່າງ" },
  { key: "assistant", labelKey: "techTeams.roleAssistant", labelLo: "ຜູ້ຊ່ວຍ" },
  { key: "helper", labelKey: "techTeams.roleHelper", labelLo: "ລູກມື" },
];
const roleLabel = (t: Translator, r?: string | null) => {
  const role = TECH_ROLES.find((x) => x.key === (r || "").toLowerCase());
  return role ? t(role.labelKey, role.labelLo) : t("techTeams.roleTechnician", "ຊ່າງ");
};
const roleTone = (r?: string | null): "brand" | "green" | "amber" | "neutral" =>
  ({ lead: "brand", technician: "green", assistant: "amber", helper: "neutral" } as const)[(r || "").toLowerCase() as "lead"] || "neutral";

const emptyDraft = (): Draft => ({ code: "", name_1: "", phone: "", role: "technician", helpers: [], isNew: true });

const woStatusLabel = (t: Translator, status: string): string =>
  ({
    open: t("techTeams.woOpen", "ເປີດ"),
    assigned: t("techTeams.woAssigned", "ມອບໝາຍ"),
    accepted: t("techTeams.woAccepted", "ຮັບງານແລ້ວ"),
    in_progress: t("techTeams.woInProgress", "ກຳລັງເຮັດ"),
    awaiting_review: t("techTeams.woAwaitingReview", "ລໍກວດສອບ"),
  } as Record<string, string>)[status] || status;

type TeamState = { label: string; tone: "green" | "amber" | "blue"; busy: boolean };
function teamState(t: Translator, a?: TeamAvailability): TeamState {
  if (!a || a.active === 0) return { label: t("techTeams.free", "ວ່າງ"), tone: "green", busy: false };
  if (a.working > 0) return { label: t("techTeams.working", "ກຳລັງເຮັດວຽກ"), tone: "blue", busy: true };
  return { label: t("techTeams.hasPending", "ມີວຽກລໍ"), tone: "amber", busy: true };
}

export default function TechTeamsPage() {
  const t = useT();
  const user = getV2User();
  const canEdit = can(user, "tech-teams", "edit");
  const canDelete = can(user, "tech-teams", "delete");
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
      setError((res as { message?: string }).message || t("techTeams.loadFailed", "ໂຫຼດບໍ່ສຳເລັດ"));
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
    return techs.filter((tech) => {
      if (s && !`${tech.name_1} ${tech.code} ${tech.phone || ""}`.toLowerCase().includes(s)) return false;
      if (statusFilter !== "all") {
        const busy = teamState(t, avail.get(tech.code)).busy;
        if (statusFilter === "busy" && !busy) return false;
        if (statusFilter === "free" && busy) return false;
      }
      return true;
    });
  }, [techs, q, statusFilter, avail, t]);

  const counts = useMemo(() => {
    let free = 0, busy = 0, working = 0;
    techs.forEach((tech) => {
      const a = avail.get(tech.code);
      const st = teamState(t, a);
      if (st.busy) busy++;
      else free++;
      if (a && a.working > 0) working++;
    });
    return { free, busy, working };
  }, [techs, avail, t]);

  const openNew = () => setDraft(emptyDraft());
  const openEdit = (tech: Tech) =>
    setDraft({
      roworder: tech.roworder,
      code: tech.code || "",
      name_1: tech.name_1 || "",
      phone: tech.phone || "",
      role: (tech.role || "technician").toLowerCase(),
      helpers: Array.isArray(tech.helpers) ? tech.helpers : [],
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
      setError(t("techTeams.nameRequired", "ກະລຸນາໃສ່ຊື່ຊ່າງ"));
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
      setError((res as { message?: string }).message || t("techTeams.saveFailed", "ບັນທຶກບໍ່ສຳເລັດ"));
    }
  };

  const remove = async (tech: Tech) => {
    if (!confirm(`${t("techTeams.deletePrefix", "ລຶບ")} "${tech.name_1}" ${t("techTeams.deleteSuffix", "ອອກຈາກລາຍຊື່ຊ່າງ?")}`)) return;
    const res = await deleteTechnician(tech.roworder);
    if (res.success) load();
    else setError((res as { message?: string }).message || t("techTeams.deleteFailed", "ລຶບບໍ່ສຳເລັດ"));
  };

  return (
    <Page max="max-w-none">
      <PageHeader
        title={t("techTeams.title", "ຈັດການທີມຊ່າງ")}
        subtitle={`${t("techTeams.totalPrefix", "ທັງໝົດ")} ${techs.length} ${t("techTeams.peopleUnit", "ຄົນ")}`}
        actions={
          <>
            <Btn variant="outline" onClick={load} disabled={loading}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {t("techTeams.reload", "ໂຫຼດໃໝ່")}
            </Btn>
            <Btn onClick={openNew}>
              <Plus size={15} /> {t("techTeams.addTech", "ເພີ່ມຊ່າງ")}
            </Btn>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat icon={<UsersRound size={18} />} label={t("techTeams.free", "ວ່າງ")} value={counts.free} />
        <Stat icon={<Wrench size={18} />} label={t("techTeams.hasWork", "ມີວຽກ")} value={counts.busy} />
        <Stat icon={<Wrench size={18} />} label={t("techTeams.inProgress", "ກຳລັງເຮັດ")} value={counts.working} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("techTeams.searchPlaceholder", "ຄົ້ນຫາຊື່ / ລະຫັດ / ເບີໂທ")} className={`${inputCls} pl-9`} />
        </div>
        <div className="flex gap-1.5">
          {([["all", t("common.all", "ທັງໝົດ")], ["free", t("techTeams.free", "ວ່າງ")], ["busy", t("techTeams.hasWork", "ມີວຽກ")]] as const).map(([key, label]) => (
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
          <Loader2 size={16} className="animate-spin" /> {t("common.loading", "ກຳລັງໂຫຼດ...")}
        </p>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">{t("techTeams.noTech", "ບໍ່ພົບຊ່າງ")}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tech) => {
            const a = avail.get(tech.code);
            const st = teamState(t, a);
            return (
            <Card key={tech.roworder} className="p-4">
              <div className="flex items-start gap-3">
                <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${st.busy ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"}`}>
                  <UsersRound size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-[14px] font-bold text-slate-800">{tech.name_1}</h3>
                    <Pill tone={roleTone(tech.role)}>{roleLabel(t, tech.role)}</Pill>
                    <Pill tone={st.tone}>{st.label}</Pill>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-slate-500">
                    {tech.code && <span>{tech.code}</span>}
                    {tech.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone size={11} /> {tech.phone}
                      </span>
                    )}
                  </div>
                  {a && a.active > 0 && (
                    <div className="mt-1 text-[11.5px] font-semibold text-blue-700">
                      <Wrench size={11} className="mr-1 inline" />
                      {t("techTeams.workOrder", "ໃບງານ")} {a.current_work_no || "—"} · {woStatusLabel(t, a.current_status || "")}
                      {a.active > 1 && <span className="text-slate-400"> (+{a.active - 1})</span>}
                    </div>
                  )}
                </div>
                <div className="flex flex-shrink-0 gap-1">
                  {canEdit && (
                    <button onClick={() => openEdit(tech)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-blue-600" title={t("common.edit", "ແກ້ໄຂ")}>
                      <Pencil size={14} />
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => remove(tech)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" title={t("common.delete", "ລຶບ")}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {tech.helpers && tech.helpers.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-2.5">
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("techTeams.teamMembers", "ລູກທີມ")} ({tech.helpers.length})</div>
                  <div className="flex flex-wrap gap-1.5">
                    {tech.helpers.map((code) => (
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
              <h2 className="text-[15px] font-black text-slate-800">{draft.isNew ? t("techTeams.addTech", "ເພີ່ມຊ່າງ") : t("techTeams.editTech", "ແກ້ໄຂຊ່າງ")}</h2>
              <button onClick={() => setDraft(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("techTeams.codeLabel", "ລະຫັດ (code)")}>
                  <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} className={inputCls} placeholder={t("techTeams.codePlaceholder", "ເຊັ່ນ T001")} />
                </Field>
                <Field label={t("techTeams.phoneLabel", "ເບີໂທ")}>
                  <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className={inputCls} placeholder="020..." />
                </Field>
              </div>
              <Field label={t("techTeams.nameLabel", "ຊື່ຊ່າງ")} required>
                <input value={draft.name_1} onChange={(e) => setDraft({ ...draft, name_1: e.target.value })} className={inputCls} placeholder={t("techTeams.namePlaceholder", "ຊື່ ແລະ ນາມສະກຸນ")} />
              </Field>

              <Field label={t("techTeams.roleField", "ບົດບາດ")}>
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
                      {t(r.labelKey, r.labelLo)}
                    </button>
                  ))}
                </div>
              </Field>

              <div>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">{t("techTeams.helpersLabel", "ລູກທີມ / ຜູ້ຊ່ວຍ")}</div>
                <p className="mb-2 text-[11px] text-slate-400">{t("techTeams.helpersHint", "ເລືອກຊ່າງຄົນອື່ນເຂົ້າທີມຂອງຄົນນີ້")}</p>
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
                  {techs.filter((x) => x.code && x.roworder !== draft.roworder).length === 0 ? (
                    <p className="px-1 py-2 text-center text-[11px] text-slate-400">{t("techTeams.noOtherTech", "ບໍ່ມີຊ່າງຄົນອື່ນໃຫ້ເລືອກ")}</p>
                  ) : (
                    techs
                      .filter((x) => x.code && x.roworder !== draft.roworder)
                      .map((tech) => {
                        const on = draft.helpers.includes(tech.code);
                        return (
                          <button
                            key={tech.roworder}
                            type="button"
                            onClick={() => toggleHelper(tech.code)}
                            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] font-semibold transition-colors ${
                              on ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <span className={`flex h-4 w-4 items-center justify-center rounded border ${on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"}`}>
                              {on && <Check size={11} strokeWidth={3} />}
                            </span>
                            <span className="flex-1 truncate">{tech.name_1}</span>
                            <span className="text-[10px] text-slate-400">{roleLabel(t, tech.role)}</span>
                          </button>
                        );
                      })
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
              <Btn variant="outline" onClick={() => setDraft(null)} disabled={saving} className="flex-1">
                {t("common.cancel", "ຍົກເລີກ")}
              </Btn>
              <Btn onClick={save} disabled={saving} className="flex-1">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {t("common.save", "ບັນທຶກ")}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
