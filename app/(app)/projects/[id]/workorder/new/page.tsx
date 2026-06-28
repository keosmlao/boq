"use client";

/**
 * v2 — Work order (stage 7, ໃບງານ). A project has MANY work orders. Each WO =
 * one team doing a SELECTED set of (still-unassigned) tasks over a date range,
 * logging actual hours. Labour cost = Σ actual hours × rate/hour.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save, Wrench, PackageOpen, Plus, Trash2 } from "lucide-react";
import { getProjectBasic, advanceProjectStage } from "@/_actions/projects";
import { getContracts } from "@/_actions/contracts";
import { getCustomer } from "@/_actions/customers";
import { getTechnicians, getTasks } from "@/_actions/lookups";
import { getProjectTasks } from "@/_actions/tasks-v2";
import { getProjectMaterials } from "@/_actions/boq-v2";
import { createWorkOrder } from "@/_actions/workorder";
import { Page, Card, Btn, Field, inputCls, tblCls, thCls, tdCls } from "../../../../_components/ui";
import RSelect from "../../../../_components/RSelect";
import { useT } from "@/_lib/i18n";

type Row = { id: any; master_id?: string; title: string; phase?: string; task_code?: string; est_hours: number; include: boolean; actual_hours: number };
type Avail = { item_code: string | null; description: string; unit: string | null; remaining: number };
type Line = { availIdx: number; qty: number };

const money = (n: number) => (Number.isFinite(n) ? n.toLocaleString("en-US") : "0");
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function WorkOrderPage() {
  const t = useT();
  const { id } = useParams();
  const router = useRouter();

  const [project, setProject] = useState<any>(null);
  const [contract, setContract] = useState<any>(null);
  const [custName, setCustName] = useState("");
  const [techs, setTechs] = useState<any[]>([]);
  const [masters, setMasters] = useState<any[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [avail, setAvail] = useState<Avail[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [techCode, setTechCode] = useState("");
  const [workDate, setWorkDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [ratePerHour, setRatePerHour] = useState(0);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [pRes, cRes, teRes, tkRes, mRes, taRes]: any = await Promise.all([
          getProjectBasic(String(id)),
          getContracts({ projectId: String(id) }),
          getTechnicians(),
          getProjectTasks({ projectId: String(id) }),
          getProjectMaterials(String(id)),
          getTasks(),
        ]);
        if (!alive) return;
        const p = pRes?.success ? pRes.data : null;
        setProject(p);
        setContract((cRes?.success ? cRes.data || [] : [])[0] || null);
        setTechs(teRes?.success ? teRes.data || [] : Array.isArray(teRes) ? teRes : []);
        setMasters(taRes?.success ? taRes.data || [] : Array.isArray(taRes) ? taRes : []);

        // All project tasks — a task can appear in many work orders (repeat / re-visit).
        const tasks = tkRes?.success ? tkRes.data || [] : [];
        setRows(
          tasks.map((t: any) => ({
            id: t.id,
            title: t.title || "",
            phase: t.phase || "",
            est_hours: num(t.est_hours),
            include: false,
            actual_hours: num(t.est_hours),
          })),
        );

        const matRows = mRes?.success ? mRes.data || [] : [];
        setAvail(
          matRows
            .filter((m: any) => num(m.remaining) > 0)
            .map((m: any) => ({
              item_code: m.item_code ?? null,
              description: m.description || m.item_name || "",
              unit: m.unit ?? null,
              remaining: num(m.remaining),
            })),
        );

        if (p?.sml_code) {
          const cuRes: any = await getCustomer(String(p.sml_code));
          if (alive && cuRes?.success) setCustName(cuRes.data.name || "");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const selected = rows.filter((r) => r.include);
  const totalHours = useMemo(() => selected.reduce((s, r) => s + num(r.actual_hours), 0), [rows]);
  const laborCost = totalHours * num(ratePerHour);

  const setRow = (i: number, patch: Partial<Row>) => setRows((a) => a.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addTask = () => setRows((a) => [...a, { id: null, master_id: "", title: "", task_code: "", phase: "ນອກແຜນ", est_hours: 0, include: true, actual_hours: 0 }]);
  const removeTask = (i: number) => setRows((a) => a.filter((_, idx) => idx !== i));
  const onPickMaster = (i: number, masterId: string) => {
    const m = masters.find((x) => String(x.id) === masterId);
    if (m) setRow(i, { master_id: masterId, task_code: m.code ?? "", title: String(m.task || m.name || ""), phase: String(m.phase || "ນອກແຜນ") });
    else setRow(i, { master_id: "" });
  };
  const addLine = () => setLines((a) => [...a, { availIdx: -1, qty: 0 }]);
  const removeLine = (i: number) => setLines((a) => a.filter((_, idx) => idx !== i));
  const pickLine = (i: number, availIdx: number) => setLines((a) => a.map((l, idx) => (idx === i ? { ...l, availIdx, qty: 0 } : l)));
  const setLineQty = (i: number, v: number) =>
    setLines((a) => a.map((l, idx) => (idx === i ? { ...l, qty: Math.max(0, Math.min(num(v), avail[l.availIdx]?.remaining ?? 0)) } : l)));
  const pickedMats = lines
    .filter((l) => l.availIdx >= 0 && l.qty > 0 && avail[l.availIdx])
    .map((l) => ({ ...avail[l.availIdx], qty: l.qty }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!techCode) {
      setError(t("workorderNew.selectTeam", "ກະລຸນາເລືອກທີມ"));
      return;
    }
    const picked = rows.filter((r) => r.include && (r.id || String(r.title).trim()));
    if (!picked.length) {
      setError(t("workorderNew.selectAtLeastOneTask", "ກະລຸນາເລືອກໜ້າວຽກຢ່າງໜ້ອຍ 1 ອັນ"));
      return;
    }
    const tech = techs.find((t) => String(t.code) === techCode);
    setSaving(true);
    try {
      const res: any = await createWorkOrder({
        project_id: String(id),
        contract_id: contract?.id ? String(contract.id) : null,
        technician_code: techCode,
        technician_name: tech ? String(tech.name_1 || "") : "",
        work_date: workDate || null,
        end_date: endDate || null,
        rate_per_hour: num(ratePerHour),
        notes: notes || null,
        tasks: picked.map((r) => ({ id: r.id, title: r.title, task_code: r.task_code || null, phase: r.phase || null, actual_hours: num(r.actual_hours) })),
        // Material template (admin issues the actual ໃບຂໍເບີກ from this later, in rounds).
        materials: pickedMats.map((m) => ({ item_code: m.item_code, description: m.description, unit: m.unit, qty: m.qty })),
      });
      if (res?.success) {
        await advanceProjectStage(String(id), "ໃບງານ").catch(() => {});
        router.push(`/projects/${id}?tab=workorders`);
      } else setError(res?.message || t("workorderNew.saveFailed", "ບັນທຶກບໍ່ສຳເລັດ"));
    } catch (err: any) {
      setError(err?.message || t("workorderNew.errorOccurred", "ເກີດຂໍ້ຜິດພາດ"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-3 text-[var(--theme-text-mute)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--theme-border-subtle)] border-t-[var(--theme-primary)]" />
        <span className="text-sm">{t("common.loading", "ກຳລັງໂຫຼດ...")}</span>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <Page max="max-w-[700px]">
        <Card className="border-t-2 border-t-emerald-400 p-6 text-center">
          <p className="text-[13px] text-[var(--theme-text-soft)]">
            {t("workorderNew.noTasksYet", "ໂຄງການນີ້ຍັງບໍ່ມີໜ້າວຽກ — ກະລຸນາກຳນົດໜ້າວຽກກ່ອນ ຈຶ່ງອອກໃບງານໄດ້.")}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Btn variant="outline" onClick={() => router.push(`/projects/${id}`)}>{t("workorderNew.backToProject", "ກັບໄປໂຄງການ")}</Btn>
            <Btn onClick={() => router.push(`/projects/${id}/tasks/new`)}>{t("workorderNew.planTasks", "ກຳນົດໜ້າວຽກ")}</Btn>
          </div>
        </Card>
      </Page>
    );
  }

  return (
    <Page max="max-w-none">
      <form onSubmit={submit}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <button type="button" onClick={() => router.push(`/projects/${id}`)} className="mb-1 inline-flex items-center gap-1 text-[12px] text-[var(--theme-text-mute)] hover:text-[var(--theme-primary)]">
              <ArrowLeft size={14} /> {t("workorderNew.toProject", "ໄປໂຄງການ")}
            </button>
            <h1 className="flex items-center gap-2 text-[19px] font-bold leading-tight text-[var(--theme-text)]">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 text-white">
                <Wrench size={16} />
              </span>
              {t("workorderNew.title", "ອອກໃບງານ")}
            </h1>
            {(custName || project?.project_name) && (
              <p className="text-[12px] text-[var(--theme-text-mute)]">
                {custName && <span className="font-medium text-[var(--theme-text-soft)]">{t("workorderNew.customerLabel", "ລູກຄ້າ")}: {custName}</span>}
                {custName && project?.project_name && " · "}
                {project?.project_name && <>{t("workorderNew.projectLabel", "ໂຄງການ")}: {project.project_name}</>}
              </p>
            )}
          </div>
          <Btn type="submit" disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? t("common.saving", "ກຳລັງບັນທຶກ...") : t("workorderNew.saveWorkOrder", "ບັນທຶກໃບງານ")}
          </Btn>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>
        )}

        {/* WO header */}
        <Card className="mb-4 border-t-2 border-t-emerald-400 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t("workorderNew.team", "ທີມ / ຜູ້ຮັບຜິດຊອບ")} required>
              <RSelect
                value={techCode}
                onChange={setTechCode}
                placeholder={t("workorderNew.selectTeamOption", "ເລືອກທີມ...")}
                isClearable
                options={techs.map((tc) => ({ value: String(tc.code), label: `${tc.name_1}${tc.role ? ` (${tc.role})` : ""}` }))}
              />
            </Field>
            <Field label={t("workorderNew.startDate", "ວັນເລີ່ມ")}>
              <input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label={t("workorderNew.endDate", "ວັນຈົບ")}>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label={t("workorderNew.ratePerHour", "ອັດຕາ/ຊົ່ວໂມງ")}>
              <input type="number" min="0" value={ratePerHour} onChange={(e) => setRatePerHour(Number(e.target.value))} className={`${inputCls} text-right`} />
            </Field>
          </div>
        </Card>

        {/* Task selection */}
        <Card className="mb-4 overflow-hidden border-t-2 border-t-emerald-400">
          <div className="flex items-center justify-between border-b border-[var(--theme-border-subtle)] px-3 py-2">
            <h2 className="flex items-center gap-2 text-[13px] font-bold text-[var(--theme-text)]">
              <span className="h-4 w-1 rounded bg-emerald-500" /> {t("workorderNew.selectTasks", "ເລືອກໜ້າວຽກ")} ({selected.length}/{rows.length})
            </h2>
            <Btn type="button" variant="outline" onClick={addTask}><Plus size={14} /> {t("workorderNew.addAdhocTask", "ເພີ່ມວຽກນອກແຜນ")}</Btn>
          </div>
          <div className="overflow-x-auto">
            <table className={tblCls}>
              <thead>
                <tr>
                  <th className={`${thCls} w-10 text-center`}>{t("workorderNew.select", "ເລືອກ")}</th>
                  <th className={thCls}>{t("workorderNew.task", "ໜ້າວຽກ")}</th>
                  <th className={`${thCls} w-32`}>{t("workorderNew.phase", "ໄລຍະ")}</th>
                  <th className={`${thCls} w-24 text-right`}>{t("workorderNew.estHours", "ປະມານ(ຊມ)")}</th>
                  <th className={`${thCls} w-28 text-right`}>{t("workorderNew.actualHours", "ຊົ່ວໂມງຈິງ")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const isAdhoc = !r.id;
                  return (
                    <tr key={r.id ?? `adhoc-${i}`} className={r.include ? "bg-emerald-50/40" : ""}>
                      <td className={`${tdCls} text-center`}>
                        <input type="checkbox" checked={r.include} onChange={(e) => setRow(i, { include: e.target.checked })} className="h-4 w-4 accent-[var(--theme-primary)]" />
                      </td>
                      <td className={`${tdCls} font-medium text-[var(--theme-text)]`}>
                        {isAdhoc ? (
                          <div className="flex items-center gap-2">
                            {masters.length > 0 ? (
                              <RSelect
                                value={r.master_id || ""}
                                onChange={(v) => onPickMaster(i, v)}
                                placeholder={r.title || t("workorderNew.selectFromMaster", "ເລືອກວຽກຈາກ master...")}
                                options={masters.map((m) => ({ value: String(m.id), label: `${m.phase ? `[${m.phase}] ` : ""}${m.task || m.name}` }))}
                              />
                            ) : (
                              <input value={r.title} onChange={(e) => setRow(i, { title: e.target.value })} placeholder={t("workorderNew.adhocTaskNamePlaceholder", "ຊື່ວຽກນອກແຜນ")} className={`${inputCls} h-8`} />
                            )}
                            <button type="button" onClick={() => removeTask(i)} className="text-rose-500 hover:text-rose-700"><Trash2 size={15} /></button>
                          </div>
                        ) : (
                          r.title
                        )}
                      </td>
                      <td className={`${tdCls} text-[var(--theme-text-soft)]`}>
                        {isAdhoc ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">{t("workorderNew.adhoc", "ນອກແຜນ")}</span> : r.phase || "-"}
                      </td>
                      <td className={`${tdCls} text-right tabular-nums text-[var(--theme-text-mute)]`}>{isAdhoc ? "-" : r.est_hours}</td>
                      <td className={tdCls}>
                        <input type="number" min="0" value={r.actual_hours} disabled={!r.include} onChange={(e) => setRow(i, { actual_hours: Number(e.target.value) })} className={`${inputCls} h-8 text-right disabled:bg-[var(--theme-bg-muted)] disabled:opacity-60`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="overflow-hidden border-t-2 border-t-cyan-400 lg:col-span-2">
            <div className="flex items-center justify-between border-b border-[var(--theme-border-subtle)] px-3 py-2">
              <h2 className="flex items-center gap-2 text-[13px] font-bold text-[var(--theme-text)]">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-100 text-cyan-600"><PackageOpen size={14} /></span>
                {t("workorderNew.materialsToSite", "ວັດສະດຸເບີກເຂົ້າໜ້າງານ")} {pickedMats.length > 0 && <span className="text-[11px] font-normal text-[var(--theme-text-mute)]">({pickedMats.length} {t("workorderNew.itemsUnit", "ລາຍການ")})</span>}
              </h2>
              <Btn type="button" variant="outline" onClick={addLine} disabled={avail.length === 0}>
                <Plus size={14} /> {t("workorderNew.addItem", "ເພີ່ມລາຍການ")}
              </Btn>
            </div>
            {avail.length === 0 ? (
              <div className="px-3 py-4 text-center text-[12px] text-[var(--theme-text-mute)]">{t("workorderNew.noRemainingMaterials", "ບໍ່ມີວັດສະດຸຄົງເຫຼືອໃຫ້ເບີກ (ກວດ BOQ ຂອງໂຄງການ)")}</div>
            ) : lines.length === 0 ? (
              <div className="px-3 py-6 text-center text-[12px] text-[var(--theme-text-mute)]">{t("workorderNew.materialsEmptyHint", 'ກົດ "ເພີ່ມລາຍການ" ເພື່ອເລືອກວັດສະດຸທີ່ຈະເບີກ')}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className={tblCls}>
                  <thead>
                    <tr>
                      <th className={thCls}>{t("workorderNew.item", "ລາຍການ")}</th>
                      <th className={`${thCls} w-14`}>{t("common.unit", "ໜ່ວຍ")}</th>
                      <th className={`${thCls} w-20 text-right`}>{t("workorderNew.remaining", "ຄົງເຫຼືອ")}</th>
                      <th className={`${thCls} w-28 text-right`}>{t("workorderNew.withdraw", "ເບີກ")}</th>
                      <th className={`${thCls} w-8`} />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => {
                      const a = l.availIdx >= 0 ? avail[l.availIdx] : null;
                      return (
                        <tr key={i} className={l.qty > 0 ? "bg-cyan-50/40" : ""}>
                          <td className={tdCls}>
                            <RSelect
                              value={l.availIdx >= 0 ? String(l.availIdx) : ""}
                              onChange={(v) => pickLine(i, v === "" ? -1 : Number(v))}
                              placeholder={t("workorderNew.selectMaterial", "ເລືອກວັດສະດຸ...")}
                              isClearable
                              options={avail.map((m, mi) => ({ value: String(mi), label: String(m.description) }))}
                            />
                          </td>
                          <td className={`${tdCls} text-[var(--theme-text-soft)]`}>{a?.unit || "-"}</td>
                          <td className={`${tdCls} text-right tabular-nums text-[var(--theme-text-mute)]`}>{a ? money(a.remaining) : "-"}</td>
                          <td className={tdCls}>
                            <input
                              type="number"
                              min="0"
                              max={a?.remaining ?? 0}
                              value={l.qty || ""}
                              disabled={!a}
                              onChange={(e) => setLineQty(i, Number(e.target.value))}
                              placeholder="0"
                              className={`${inputCls} h-8 text-right disabled:bg-[var(--theme-bg-muted)] disabled:opacity-60`}
                            />
                          </td>
                          <td className={tdCls}>
                            <button type="button" onClick={() => removeLine(i)} className="text-rose-500 hover:text-rose-700"><Trash2 size={15} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="border-t border-[var(--theme-border-subtle)] px-3 py-1.5 text-[11px] text-[var(--theme-text-mute)]">
              {t("workorderNew.materialsNote", "ເພີ່ມວັດສະດຸທີ່ຊ່າງຈະເບີກເຂົ້າໜ້າງານ (ຈຳນວນບໍ່ເກີນຄົງເຫຼືອ) — ບັນທຶກໃບງານ → ສ້າງໃບຂໍເບີກໃຫ້ອັດຕະໂນມັດ.")}
            </p>
          </Card>

          <Card className="border-t-2 border-t-emerald-400 p-4">
            <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-[var(--theme-text)]">
              <span className="h-4 w-1 rounded bg-emerald-500" /> {t("workorderNew.laborSummary", "ສະຫຼຸບຄ່າແຮງ")}
            </div>
            <div className="space-y-1.5 text-[12.5px]">
              <div className="flex justify-between"><span className="text-[var(--theme-text-soft)]">{t("workorderNew.task", "ໜ້າວຽກ")}</span><span className="tabular-nums">{selected.length}</span></div>
              <div className="flex justify-between"><span className="text-[var(--theme-text-soft)]">{t("workorderNew.totalHours", "ລວມຊົ່ວໂມງ")}</span><span className="tabular-nums font-semibold">{totalHours}</span></div>
              <div className="flex justify-between"><span className="text-[var(--theme-text-soft)]">{t("workorderNew.ratePerHour", "ອັດຕາ/ຊົ່ວໂມງ")}</span><span className="tabular-nums">{money(num(ratePerHour))}</span></div>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-[var(--theme-border-subtle)] pt-2 text-[15px] font-bold text-[var(--theme-text)]">
              <span>{t("workorderNew.laborCost", "ຄ່າແຮງ")}</span>
              <span className="tabular-nums text-[var(--theme-primary)]">{money(laborCost)}</span>
            </div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCls} mt-3 h-auto py-2`} placeholder={t("common.note", "ໝາຍເຫດ")} />
          </Card>
        </div>
      </form>
    </Page>
  );
}
