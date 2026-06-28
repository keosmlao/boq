"use client";

/**
 * v2 — Task plan (stage 6, ກຳນົດໜ້າວຽກ). At planning time we only set:
 * task (from the task master), phase, duration (days) and estimated hours.
 * The team and the actual start/end dates are assigned later (work-order stage).
 */
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save, Plus, Trash2, CalendarRange } from "lucide-react";
import { getProjectBasic, advanceProjectStage } from "@/_actions/projects";
import { getContracts } from "@/_actions/contracts";
import { getCustomer } from "@/_actions/customers";
import { getTasks } from "@/_actions/lookups";
import { getProjectTasks, saveTaskPlan } from "@/_actions/tasks-v2";
import { Page, Card, Btn, inputCls, tblCls, thCls, tdCls } from "../../../../_components/ui";
import RSelect from "../../../../_components/RSelect";
import TaskPickerModal from "../../../../_components/TaskPickerModal";
import { useT } from "@/_lib/i18n";

type Row = { master_id?: string; task_code?: string; title: string; phase?: string; est_days: number; est_hours: number };

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function TaskPlanPage() {
  const t = useT();
  const { id } = useParams();
  const router = useRouter();

  const [project, setProject] = useState<any>(null);
  const [contract, setContract] = useState<any>(null);
  const [custName, setCustName] = useState("");
  const [masters, setMasters] = useState<any[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pickOpen, setPickOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [pRes, cRes, tRes, exRes]: any = await Promise.all([
          getProjectBasic(String(id)),
          getContracts({ projectId: String(id) }),
          getTasks(),
          getProjectTasks({ projectId: String(id) }),
        ]);
        if (!alive) return;
        const p = pRes?.success ? pRes.data : null;
        setProject(p);
        setContract((cRes?.success ? cRes.data || [] : [])[0] || null);
        setMasters(tRes?.success ? tRes.data || [] : Array.isArray(tRes) ? tRes : []);

        const masterList = tRes?.success ? tRes.data || [] : Array.isArray(tRes) ? tRes : [];
        const findMasterId = (t: any) => {
          const m = masterList.find(
            (x: any) =>
              (t.task_code && String(x.code) === String(t.task_code)) ||
              String(x.task || x.name) === String(t.title),
          );
          return m ? String(m.id) : "";
        };
        const existing = exRes?.success ? exRes.data || [] : [];
        if (existing.length) {
          setRows(
            existing.map((t: any) => ({
              master_id: findMasterId(t),
              task_code: t.task_code || "",
              title: t.title || "",
              phase: t.phase || "",
              est_days: num(t.est_days),
              est_hours: num(t.est_hours),
            })),
          );
        } else {
          setRows([]);
        }

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

  const totalDays = useMemo(() => rows.reduce((s, r) => s + num(r.est_days), 0), [rows]);
  const totalHours = useMemo(() => rows.reduce((s, r) => s + num(r.est_hours), 0), [rows]);
  const usedIds = useMemo(() => new Set(rows.map((r) => r.master_id).filter(Boolean)), [rows]);

  const setRow = (i: number, patch: Partial<Row>) => setRows((a) => a.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeRow = (i: number) => setRows((a) => a.filter((_, idx) => idx !== i));
  const addPicked = (picked: any[]) => {
    const newRows: Row[] = picked.map((m) => ({
      master_id: String(m.id),
      task_code: m.code ?? "",
      title: String(m.task || m.name || ""),
      phase: String(m.phase || ""),
      est_days: 0,
      est_hours: 0,
    }));
    setRows((a) => [...a.filter((r) => r.master_id || String(r.title).trim()), ...newRows]);
    setPickOpen(false);
  };

  const onPickTask = (i: number, masterId: string) => {
    const m = masters.find((x) => String(x.id) === masterId);
    if (m) setRow(i, { master_id: masterId, task_code: m.code ?? "", title: String(m.task || m.name || ""), phase: String(m.phase || "") });
    else setRow(i, { master_id: "", task_code: "" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const valid = rows.filter((r) => r.title.trim());
    if (!valid.length) {
      setError(t("tasksNew.needAtLeastOneTask", "ກະລຸນາເພີ່ມໜ້າວຽກຢ່າງໜ້ອຍ 1 ແຖວ"));
      return;
    }
    setSaving(true);
    try {
      const res: any = await saveTaskPlan(String(id), contract?.id ? String(contract.id) : null, valid);
      if (res?.success) {
        await advanceProjectStage(String(id), "ກຳນົດໜ້າວຽກ").catch(() => {});
        router.push(`/projects/${id}?tab=tasks`);
      } else setError(res?.message || t("tasksNew.saveFailed", "ບັນທຶກບໍ່ສຳເລັດ"));
    } catch (err: any) {
      setError(err?.message || t("tasksNew.errorOccurred", "ເກີດຂໍ້ຜິດພາດ"));
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

  return (
    <Page max="max-w-none">
      <form onSubmit={submit}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => router.push(`/projects/${id}`)}
              className="mb-1 inline-flex items-center gap-1 text-[12px] text-[var(--theme-text-mute)] hover:text-[var(--theme-primary)]"
            >
              <ArrowLeft size={14} /> {t("tasksNew.toProject", "ໄປໂຄງການ")}
            </button>
            <h1 className="flex items-center gap-2 text-[19px] font-bold leading-tight text-[var(--theme-text)]">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-emerald-500 text-white">
                <CalendarRange size={16} />
              </span>
              {t("tasksNew.title", "ກຳນົດໜ້າວຽກ")}
            </h1>
            {(custName || project?.project_name) && (
              <p className="text-[12px] text-[var(--theme-text-mute)]">
                {custName && <span className="font-medium text-[var(--theme-text-soft)]">{t("tasksNew.customerLabel", "ລູກຄ້າ")}: {custName}</span>}
                {custName && project?.project_name && " · "}
                {project?.project_name && <>{t("tasksNew.projectLabel", "ໂຄງການ")}: {project.project_name}</>}
              </p>
            )}
          </div>
          <Btn type="submit" disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? t("common.saving", "ກຳລັງບັນທຶກ...") : t("tasksNew.savePlan", "ບັນທຶກແຜນວຽກ")}
          </Btn>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>
        )}

        <Card className="overflow-hidden border-t-2 border-t-teal-400">
          <div className="flex items-center justify-between border-b border-[var(--theme-border-subtle)] px-3 py-2">
            <h2 className="flex items-center gap-2 text-[13px] font-bold text-[var(--theme-text)]">
              <span className="h-4 w-1 rounded bg-teal-500" /> {t("tasksNew.taskListHeading", "ລາຍການໜ້າວຽກ")}
            </h2>
            <Btn type="button" variant="outline" onClick={() => setPickOpen(true)}><Plus size={14} /> {t("tasksNew.addTask", "ເພີ່ມໜ້າວຽກ")}</Btn>
          </div>
          <div className="overflow-x-auto">
            <table className={tblCls}>
              <thead>
                <tr>
                  <th className={`${thCls} w-8`}>#</th>
                  <th className={thCls}>{t("tasksNew.task", "ໜ້າວຽກ")}</th>
                  <th className={`${thCls} w-40`}>{t("tasksNew.phase", "ໄລຍະ")}</th>
                  <th className={`${thCls} w-24 text-right`}>{t("tasksNew.days", "ວັນ")}</th>
                  <th className={`${thCls} w-24 text-right`}>{t("tasksNew.hours", "ຊົ່ວໂມງ")}</th>
                  <th className={`${thCls} w-8`} />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-[12px] text-[var(--theme-text-mute)]">{t("tasksNew.emptyHint", 'ກົດ "ເພີ່ມໜ້າວຽກ" ເພື່ອເລືອກໜ້າວຽກ (ເລືອກໄດ້ຫຼາຍອັນພ້ອມກັນ)')}</td>
                  </tr>
                )}
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className={`${tdCls} text-[11px] text-[var(--theme-text-mute)]`}>{i + 1}</td>
                    <td className={tdCls}>
                      {masters.length > 0 ? (
                        <RSelect
                          value={r.master_id || ""}
                          onChange={(v) => onPickTask(i, v)}
                          placeholder={r.title || t("tasksNew.selectTask", "ເລືອກໜ້າວຽກ...")}
                          options={masters
                            .filter((m) => !usedIds.has(String(m.id)) || String(m.id) === String(r.master_id))
                            .map((m) => ({ value: String(m.id), label: `${m.phase ? `[${m.phase}] ` : ""}${m.task || m.name}` }))}
                        />
                      ) : (
                        <input value={r.title} onChange={(e) => setRow(i, { title: e.target.value })} className={`${inputCls} h-8`} placeholder={t("tasksNew.task", "ໜ້າວຽກ")} />
                      )}
                    </td>
                    <td className={tdCls}>
                      {r.phase ? (
                        <span className="inline-block rounded bg-[var(--theme-bg-muted)] px-2 py-0.5 text-[11px] text-[var(--theme-text-soft)]">{r.phase}</span>
                      ) : (
                        <span className="text-[var(--theme-text-mute)]">-</span>
                      )}
                    </td>
                    <td className={tdCls}>
                      <input type="number" min="0" value={r.est_days} onChange={(e) => setRow(i, { est_days: Number(e.target.value) })} className={`${inputCls} h-8 text-right`} />
                    </td>
                    <td className={tdCls}>
                      <input type="number" min="0" value={r.est_hours} onChange={(e) => setRow(i, { est_hours: Number(e.target.value) })} className={`${inputCls} h-8 text-right`} />
                    </td>
                    <td className={tdCls}>
                      <button type="button" onClick={() => removeRow(i)} className="text-rose-500 hover:text-rose-700"><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--theme-border-subtle)] font-semibold">
                  <td className={tdCls} colSpan={3}>{t("common.total", "ລວມ")}</td>
                  <td className={`${tdCls} text-right tabular-nums text-[var(--theme-primary)]`}>{totalDays}</td>
                  <td className={`${tdCls} text-right tabular-nums text-[var(--theme-primary)]`}>{totalHours}</td>
                  <td className={tdCls} />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <p className="mt-2 text-[11px] text-[var(--theme-text-mute)]">
          {t("tasksNew.notePrefix", "ໜ້າວຽກດຶງຈາກ ບັນຊີໜ້າວຽກ (task master).")} <b>{t("tasksNew.noteBold", "ທີມ ແລະ ວັນເລີ່ມ/ວັນຈົບ ກຳນົດຕາມຫຼັງ")}</b> {t("tasksNew.noteSuffix", "ໃນຂັ້ນໃບງານ. ຊົ່ວໂມງໃຊ້ຄິດໄລ່ຄ່າແຮງ.")}
        </p>
      </form>

      <TaskPickerModal
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        masters={masters}
        excludeIds={usedIds}
        onAdd={addPicked}
      />
    </Page>
  );
}
