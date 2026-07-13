"use client";

/**
 * v2 — Work order (stage 7, ໃບງານ). A project has MANY work orders. Each WO =
 * one team doing a SELECTED set of (still-unassigned) tasks over a date range,
 * logging actual hours. Labour cost = Σ actual hours × rate/hour.
 *
 * Doubles as the EDIT form via `?edit=<work order id>` (same pattern as the
 * quotation / BOQ forms). A work order may only be edited BEFORE it enters the
 * flow — see canEditWorkOrder(); the server refuses anything else.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Save, Wrench, PackageOpen, Plus, Trash2, ListChecks, Search, X } from "lucide-react";
import { getProjectBasic, advanceProjectStage } from "@/_actions/projects";
import { getContracts } from "@/_actions/contracts";
import { getCustomer } from "@/_actions/customers";
import { getTechnicians, getTasks, getVehicles } from "@/_actions/lookups";
import { getProjectTasks } from "@/_actions/tasks-v2";
import { getProjectMaterials } from "@/_actions/boq-v2";
import { createWorkOrder, getWorkOrderById, updateWorkOrder } from "@/_actions/workorder";
import { canEditWorkOrder } from "@/_lib/workorder-stage";
import { Page, PageHeader, Card, Btn, Field, Pill, SectionHeader, inputCls, tblCls, thCls, tdCls, trHover } from "../../../../_components/ui";
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
  const editId = useSearchParams().get("edit");

  const [blocked, setBlocked] = useState(""); // work order exists but may no longer be edited
  const [droppedMats, setDroppedMats] = useState<string[]>([]); // WO materials no longer available
  const [project, setProject] = useState<any>(null);
  const [contract, setContract] = useState<any>(null);
  const [custName, setCustName] = useState("");
  const [techs, setTechs] = useState<any[]>([]);
  const [masters, setMasters] = useState<any[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [avail, setAvail] = useState<Avail[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [techCode, setTechCode] = useState("");
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [workDate, setWorkDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [ratePerHour, setRatePerHour] = useState(0);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [taskModal, setTaskModal] = useState(false);
  const [taskQ, setTaskQ] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [pRes, cRes, teRes, tkRes, mRes, taRes, vRes]: any = await Promise.all([
          getProjectBasic(String(id)),
          getContracts({ projectId: String(id) }),
          getTechnicians(),
          getProjectTasks({ projectId: String(id) }),
          getProjectMaterials(String(id)),
          getTasks(),
          getVehicles(),
        ]);
        if (!alive) return;
        const p = pRes?.success ? pRes.data : null;
        setProject(p);
        setContract((cRes?.success ? cRes.data || [] : [])[0] || null);
        // Only lead technicians run a work order — helpers (assistant) are not pickable.
        const allTechs = teRes?.success ? teRes.data || [] : Array.isArray(teRes) ? teRes : [];
        setTechs(allTechs.filter((tc: any) => String(tc.role || "").toLowerCase() !== "assistant"));
        setMasters(taRes?.success ? taRes.data || [] : Array.isArray(taRes) ? taRes : []);
        setVehicles(vRes?.success ? vRes.data || [] : []);

        // Edit mode: load the work order and refuse if it already entered the flow.
        let wo: any = null;
        if (editId) {
          const wRes: any = await getWorkOrderById(String(editId));
          if (!alive) return;
          if (!wRes?.success) {
            setBlocked(wRes?.message || t("workorderNew.notFound", "ບໍ່ພົບໃບງານ"));
            return;
          }
          wo = wRes.data;
          if (!canEditWorkOrder(wo)) {
            setBlocked(t("workorderNew.notEditable", "ໃບງານນີ້ເຂົ້າຂັ້ນຕອນແລ້ວ — ແກ້ໄຂບໍ່ໄດ້"));
            return;
          }
          setTechCode(wo.technician_code ? String(wo.technician_code) : "");
          setVehicleId(wo.vehicle_id ? String(wo.vehicle_id) : "");
          setWorkDate(String(wo.work_date ?? "").slice(0, 10));
          setEndDate(String(wo.end_date ?? "").slice(0, 10));
          setRatePerHour(num(wo.rate_per_hour));
          setNotes(String(wo.notes ?? ""));
        }

        // All project tasks — a task can appear in many work orders (repeat / re-visit).
        // In edit mode the tasks this work order already holds come back selected
        // (they carry work_order_id), so re-saving never duplicates them.
        const tasks = tkRes?.success ? tkRes.data || [] : [];
        setRows(
          tasks.map((t: any) => {
            const mine = !!editId && String(t.work_order_id ?? "") === String(editId);
            return {
              id: t.id,
              title: t.title || "",
              phase: t.phase || "",
              est_hours: num(t.est_hours),
              include: mine,
              actual_hours: mine ? num(t.actual_hours) || num(t.est_hours) : num(t.est_hours),
            };
          }),
        );

        const matRows = mRes?.success ? mRes.data || [] : [];
        const availRows: Avail[] = matRows
          .filter((m: any) => num(m.remaining) > 0)
          .map((m: any) => ({
            item_code: m.item_code ?? null,
            description: m.description || m.item_name || "",
            unit: m.unit ?? null,
            remaining: num(m.remaining),
          }));
        setAvail(availRows);

        // Edit mode: prefill the material lines from the work order. Anything that
        // has no remaining quantity any more cannot be carried over — say so.
        if (wo) {
          const woMats = Array.isArray(wo.materials) ? wo.materials : [];
          const prefill: Line[] = [];
          const dropped: string[] = [];
          for (const m of woMats) {
            const code = m?.item_code ? String(m.item_code) : "";
            const desc = String(m?.description ?? "");
            const idx = availRows.findIndex((a) => (code && String(a.item_code ?? "") === code) || (!code && a.description === desc));
            const qty = num(m?.qty);
            if (idx >= 0 && qty > 0) prefill.push({ availIdx: idx, qty: Math.min(qty, availRows[idx].remaining) });
            else if (qty > 0) dropped.push(desc || code);
          }
          setLines(prefill);
          setDroppedMats(dropped);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, editId]);

  const selected = rows.filter((r) => r.include);
  const totalHours = useMemo(() => selected.reduce((s, r) => s + num(r.actual_hours), 0), [rows]);
  const laborCost = totalHours * num(ratePerHour);

  // Picking a team pulls in the vehicle assigned to it (ໜ້າຈັດການທີມຊ່າງ); still overridable here.
  const pickTech = (code: string) => {
    setTechCode(code);
    const tech = techs.find((tc) => String(tc.code) === code);
    const v = tech?.vehicle_id ? String(tech.vehicle_id) : "";
    if (v && vehicles.some((x) => String(x.id) === v)) setVehicleId(v);
  };

  // Ad-hoc rows always show — they are still being filled in, so a search must not hide them.
  const matchTask = (r: Row) => {
    const kw = taskQ.trim().toLowerCase();
    if (!kw || !r.id) return true;
    return `${r.title} ${r.phase ?? ""}`.toLowerCase().includes(kw);
  };

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
    if (!vehicleId) {
      setError(t("workorderNew.selectVehicle", "ກະລຸນາເລືອກລົດຊ່າງ"));
      return;
    }
    const picked = rows.filter((r) => r.include && (r.id || String(r.title).trim()));
    if (!picked.length) {
      setError(t("workorderNew.selectAtLeastOneTask", "ກະລຸນາເລືອກໜ້າວຽກຢ່າງໜ້ອຍ 1 ອັນ"));
      return;
    }
    const tech = techs.find((t) => String(t.code) === techCode);
    const vehicle = vehicles.find((v) => String(v.id) === vehicleId);
    setSaving(true);
    try {
      const payload = {
        project_id: String(id),
        contract_id: contract?.id ? String(contract.id) : null,
        technician_code: techCode,
        technician_name: tech ? String(tech.name_1 || "") : "",
        vehicle_id: vehicleId,
        vehicle_plate: vehicle ? String(vehicle.plate_no || "") : "",
        vehicle_name: vehicle ? String(vehicle.name || "") : "",
        work_date: workDate || null,
        end_date: endDate || null,
        rate_per_hour: num(ratePerHour),
        notes: notes || null,
        tasks: picked.map((r) => ({ id: r.id, title: r.title, task_code: r.task_code || null, phase: r.phase || null, actual_hours: num(r.actual_hours) })),
        // Material template (admin issues the actual ໃບຂໍເບີກ from this later, in rounds).
        materials: pickedMats.map((m) => ({ item_code: m.item_code, description: m.description, unit: m.unit, qty: m.qty })),
      };
      const res: any = editId ? await updateWorkOrder(String(editId), payload) : await createWorkOrder(payload);
      if (res?.success) {
        if (editId) {
          router.push(`/work-orders/${editId}`);
          return;
        }
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
      <div className="flex h-[60vh] items-center justify-center gap-3 text-[var(--text-mute)]">
        <Loader2 size={20} className="animate-spin text-[var(--brand)]" />
        <span className="text-[12.5px] font-semibold">{t("common.loading", "ກຳລັງໂຫຼດ...")}</span>
      </div>
    );
  }

  // Edit refused (missing / already in flight) — say so, never silently create a new one.
  if (blocked) {
    return (
      <Page max="max-w-[700px]">
        <Card className="p-6 text-center">
          <p className="text-[13px] font-semibold text-[var(--danger)]">{blocked}</p>
          <div className="mt-4 flex justify-center gap-2">
            <Btn variant="outline" onClick={() => router.push(`/projects/${id}?tab=workorders`)}>{t("workorderNew.backToProject", "ກັບໄປໂຄງການ")}</Btn>
            {editId && <Btn variant="ink" onClick={() => router.push(`/work-orders/${editId}`)}>{t("workorderNew.viewWorkOrder", "ເບິ່ງໃບງານ")}</Btn>}
          </div>
        </Card>
      </Page>
    );
  }

  if (!rows.length) {
    return (
      <Page max="max-w-[700px]">
        <Card className="p-6 text-center">
          <p className="text-[13px] text-[var(--text-soft)]">
            {t("workorderNew.noTasksYet", "ໂຄງການນີ້ຍັງບໍ່ມີໜ້າວຽກ — ກະລຸນາກຳນົດໜ້າວຽກກ່ອນ ຈຶ່ງອອກໃບງານໄດ້.")}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Btn variant="outline" onClick={() => router.push(`/projects/${id}`)}>{t("workorderNew.backToProject", "ກັບໄປໂຄງການ")}</Btn>
            <Btn variant="ink" onClick={() => router.push(`/projects/${id}/tasks/new`)}>{t("workorderNew.planTasks", "ກຳນົດໜ້າວຽກ")}</Btn>
          </div>
        </Card>
      </Page>
    );
  }

  const subtitle = [
    custName ? `${t("workorderNew.customerLabel", "ລູກຄ້າ")}: ${custName}` : "",
    project?.project_name ? `${t("workorderNew.projectLabel", "ໂຄງການ")}: ${project.project_name}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Page max="max-w-none">
      <form onSubmit={submit}>
        <PageHeader
          title={editId ? t("workorderNew.editTitle", "ແກ້ໄຂໃບງານ") : t("workorderNew.title", "ອອກໃບງານ")}
          subtitle={subtitle || undefined}
          badge={
            <Pill tone="brand">
              <Wrench size={11} className="mr-1" /> {editId ? t("workorderNew.editTitle", "ແກ້ໄຂໃບງານ") : t("workorderNew.title", "ອອກໃບງານ")}
            </Pill>
          }
          actions={
            <>
              <Btn type="button" variant="outline" onClick={() => router.push(`/projects/${id}`)}>
                <ArrowLeft size={14} /> {t("workorderNew.toProject", "ໄປໂຄງການ")}
              </Btn>
              <Btn type="submit" variant="go" disabled={saving}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? t("common.saving", "ກຳລັງບັນທຶກ...") : t("workorderNew.saveWorkOrder", "ບັນທຶກໃບງານ")}
              </Btn>
            </>
          }
        />

        {error && (
          <div className="mb-4 rounded-lg border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] font-semibold text-[var(--danger)]">
            {error}
          </div>
        )}

        {droppedMats.length > 0 && (
          <div className="mb-4 rounded-lg border border-[var(--warning-soft)] bg-[var(--warning-soft)] px-3 py-2 text-[12.5px] font-semibold text-[var(--warning)]">
            {t("workorderNew.materialsNoLongerAvailable", "ວັດສະດຸບາງລາຍການໃນໃບງານເດີມບໍ່ມີຄົງເຫຼືອແລ້ວ ຈຶ່ງດຶງມາບໍ່ໄດ້")}: {droppedMats.join(", ")}
          </div>
        )}

        {/* WO header */}
        <Card className="mb-4 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t("workorderNew.team", "ທີມ / ຜູ້ຮັບຜິດຊອບ")} required>
              <RSelect
                value={techCode}
                onChange={pickTech}
                placeholder={t("workorderNew.selectTeamOption", "ເລືອກທີມ...")}
                isClearable
                options={techs.map((tc) => ({ value: String(tc.code), label: `${tc.name_1}${tc.role ? ` (${tc.role})` : ""}` }))}
              />
            </Field>
            <Field label={t("workorderNew.vehicle", "ລົດຊ່າງ")} required>
              <RSelect
                value={vehicleId}
                onChange={setVehicleId}
                placeholder={t("workorderNew.selectVehicleOption", "ເລືອກລົດ...")}
                isClearable
                options={vehicles.map((v) => ({
                  value: String(v.id),
                  label: `${v.plate_no || "-"}${v.name ? ` — ${v.name}` : ""}${v.status && v.status !== "available" ? ` (${v.status})` : ""}`,
                }))}
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

        {/* Task selection — picked in a modal, only the chosen tasks stay on the page */}
        <Card className="mb-4 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-2.5">
            <SectionHeader
              className="mb-0"
              icon={<ListChecks size={15} />}
              title={`${t("workorderNew.selectedTasks", "ໜ້າວຽກທີ່ເລືອກ")} (${selected.length}/${rows.length})`}
              tone="brand"
            />
            <Btn type="button" variant="outline" onClick={() => setTaskModal(true)}>
              <ListChecks size={14} /> {t("workorderNew.selectTasks", "ເລືອກໜ້າວຽກ")}
            </Btn>
          </div>
          {selected.length === 0 ? (
            <div className="px-3 py-6 text-center text-[12px] text-[var(--text-mute)]">
              {t("workorderNew.tasksEmptyHint", 'ກົດ "ເລືອກໜ້າວຽກ" ເພື່ອເລືອກໜ້າວຽກເຂົ້າໃບງານ')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className={tblCls}>
                <thead>
                  <tr>
                    <th className={thCls}>{t("workorderNew.task", "ໜ້າວຽກ")}</th>
                    <th className={`${thCls} w-32`}>{t("workorderNew.phase", "ໄລຍະ")}</th>
                    <th className={`${thCls} w-24 text-right`}>{t("workorderNew.estHours", "ປະມານ(ຊມ)")}</th>
                    <th className={`${thCls} w-28 text-right`}>{t("workorderNew.actualHours", "ຊົ່ວໂມງຈິງ")}</th>
                    <th className={`${thCls} w-8`} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) =>
                    !r.include ? null : (
                      <tr key={r.id ?? `adhoc-${i}`} className={trHover}>
                        <td className={`${tdCls} font-semibold text-[var(--text)]`}>{r.title || t("workorderNew.adhocTaskNamePlaceholder", "ຊື່ວຽກນອກແຜນ")}</td>
                        <td className={tdCls}>
                          {!r.id ? <Pill tone="amber">{t("workorderNew.adhoc", "ນອກແຜນ")}</Pill> : r.phase || "-"}
                        </td>
                        <td className={`${tdCls} text-right tabular-nums text-[var(--text-mute)]`}>{!r.id ? "-" : r.est_hours}</td>
                        <td className={tdCls}>
                          <input type="number" min="0" value={r.actual_hours} onChange={(e) => setRow(i, { actual_hours: Number(e.target.value) })} className={`${inputCls} h-8 text-right`} />
                        </td>
                        <td className={tdCls}>
                          <button
                            type="button"
                            onClick={() => (r.id ? setRow(i, { include: false }) : removeTask(i))}
                            className="text-[var(--danger)] transition-opacity hover:opacity-70"
                            title={t("workorderNew.removeFromWorkOrder", "ເອົາອອກຈາກໃບງານ")}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="overflow-hidden lg:col-span-2">
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-2.5">
              <SectionHeader
                className="mb-0"
                icon={<PackageOpen size={15} />}
                title={`${t("workorderNew.materialsToSite", "ວັດສະດຸເບີກເຂົ້າໜ້າງານ")}${
                  pickedMats.length > 0 ? ` (${pickedMats.length} ${t("workorderNew.itemsUnit", "ລາຍການ")})` : ""
                }`}
                tone="cyan"
              />
              <Btn type="button" variant="outline" onClick={addLine} disabled={avail.length === 0}>
                <Plus size={14} /> {t("workorderNew.addItem", "ເພີ່ມລາຍການ")}
              </Btn>
            </div>
            {avail.length === 0 ? (
              <div className="px-3 py-4 text-center text-[12px] text-[var(--text-mute)]">{t("workorderNew.noRemainingMaterials", "ບໍ່ມີວັດສະດຸຄົງເຫຼືອໃຫ້ເບີກ (ກວດ BOQ ຂອງໂຄງການ)")}</div>
            ) : lines.length === 0 ? (
              <div className="px-3 py-6 text-center text-[12px] text-[var(--text-mute)]">{t("workorderNew.materialsEmptyHint", 'ກົດ "ເພີ່ມລາຍການ" ເພື່ອເລືອກວັດສະດຸທີ່ຈະເບີກ')}</div>
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
                        <tr key={i} className={l.qty > 0 ? "bg-[var(--brand-tint)]" : ""}>
                          <td className={tdCls}>
                            <RSelect
                              value={l.availIdx >= 0 ? String(l.availIdx) : ""}
                              onChange={(v) => pickLine(i, v === "" ? -1 : Number(v))}
                              placeholder={t("workorderNew.selectMaterial", "ເລືອກວັດສະດຸ...")}
                              isClearable
                              options={avail.map((m, mi) => ({ value: String(mi), label: String(m.description) }))}
                            />
                          </td>
                          <td className={`${tdCls} text-[var(--text-soft)]`}>{a?.unit || "-"}</td>
                          <td className={`${tdCls} text-right tabular-nums text-[var(--text-mute)]`}>{a ? money(a.remaining) : "-"}</td>
                          <td className={tdCls}>
                            <input
                              type="number"
                              min="0"
                              max={a?.remaining ?? 0}
                              value={l.qty || ""}
                              disabled={!a}
                              onChange={(e) => setLineQty(i, Number(e.target.value))}
                              placeholder="0"
                              className={`${inputCls} h-8 text-right disabled:bg-[var(--surface-sunken)] disabled:opacity-60`}
                            />
                          </td>
                          <td className={tdCls}>
                            <button type="button" onClick={() => removeLine(i)} className="text-[var(--danger)] transition-opacity hover:opacity-70"><Trash2 size={15} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="border-t border-[var(--border-soft)] px-3 py-1.5 text-[11px] text-[var(--text-mute)]">
              {t("workorderNew.materialsNote", "ເພີ່ມວັດສະດຸທີ່ຊ່າງຈະເບີກເຂົ້າໜ້າງານ (ຈຳນວນບໍ່ເກີນຄົງເຫຼືອ) — ບັນທຶກໃບງານ → ສ້າງໃບຂໍເບີກໃຫ້ອັດຕະໂນມັດ.")}
            </p>
          </Card>

          <Card className="p-4">
            <SectionHeader icon={<Wrench size={15} />} title={t("workorderNew.laborSummary", "ສະຫຼຸບຄ່າແຮງ")} tone="brand" />
            <div className="space-y-1.5 text-[12.5px] text-[var(--text)]">
              <div className="flex justify-between"><span className="text-[var(--text-soft)]">{t("workorderNew.task", "ໜ້າວຽກ")}</span><span className="tabular-nums">{selected.length}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-soft)]">{t("workorderNew.totalHours", "ລວມຊົ່ວໂມງ")}</span><span className="tabular-nums font-semibold">{totalHours}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-soft)]">{t("workorderNew.ratePerHour", "ອັດຕາ/ຊົ່ວໂມງ")}</span><span className="tabular-nums">{money(num(ratePerHour))}</span></div>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-[var(--border-soft)] pt-2 text-[15px] font-bold text-[var(--text)]">
              <span>{t("workorderNew.laborCost", "ຄ່າແຮງ")}</span>
              <span className="tabular-nums text-[var(--brand)]">{money(laborCost)}</span>
            </div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCls} mt-3 h-auto py-2`} placeholder={t("common.note", "ໝາຍເຫດ")} />
          </Card>
        </div>
      </form>

      {taskModal && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 pt-[6vh]" onClick={() => setTaskModal(false)}>
          <div className="flex max-h-[84vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between bg-[var(--ink)] px-4 py-3 text-[var(--ink-text)]">
              <h3 className="flex items-center gap-2 text-[14px] font-bold">
                <ListChecks size={16} /> {t("workorderNew.selectTasks", "ເລືອກໜ້າວຽກ")} ({selected.length}/{rows.length})
              </h3>
              <button type="button" onClick={() => setTaskModal(false)} className="opacity-80 transition-opacity hover:opacity-100"><X size={18} /></button>
            </div>

            <div className="flex items-center gap-2 border-b border-[var(--border-soft)] p-2">
              <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3">
                <Search size={15} className="text-[var(--text-mute)]" />
                <input
                  autoFocus
                  value={taskQ}
                  onChange={(e) => setTaskQ(e.target.value)}
                  placeholder={t("workorderNew.searchTasks", "ຄົ້ນຫາໜ້າວຽກ...")}
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-mute)]"
                />
              </div>
              <Btn type="button" variant="outline" onClick={addTask}><Plus size={14} /> {t("workorderNew.addAdhocTask", "ເພີ່ມວຽກນອກແຜນ")}</Btn>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
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
                    if (!matchTask(r)) return null;
                    return (
                      <tr key={r.id ?? `adhoc-${i}`} className={r.include ? "bg-[var(--brand-tint)]" : trHover}>
                        <td className={`${tdCls} text-center`}>
                          <input type="checkbox" checked={r.include} onChange={(e) => setRow(i, { include: e.target.checked })} className="h-4 w-4 accent-[var(--brand)]" />
                        </td>
                        <td className={`${tdCls} font-semibold text-[var(--text)]`}>
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
                              <button type="button" onClick={() => removeTask(i)} className="text-[var(--danger)] transition-opacity hover:opacity-70"><Trash2 size={15} /></button>
                            </div>
                          ) : (
                            r.title
                          )}
                        </td>
                        <td className={tdCls}>
                          {isAdhoc ? <Pill tone="amber">{t("workorderNew.adhoc", "ນອກແຜນ")}</Pill> : r.phase || "-"}
                        </td>
                        <td className={`${tdCls} text-right tabular-nums text-[var(--text-mute)]`}>{isAdhoc ? "-" : r.est_hours}</td>
                        <td className={tdCls}>
                          <input type="number" min="0" value={r.actual_hours} disabled={!r.include} onChange={(e) => setRow(i, { actual_hours: Number(e.target.value) })} className={`${inputCls} h-8 text-right disabled:bg-[var(--surface-sunken)] disabled:opacity-60`} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end border-t border-[var(--border-soft)] bg-[var(--surface-sunken)] p-3">
              <Btn type="button" variant="ink" onClick={() => setTaskModal(false)}>
                {t("common.done", "ຕົກລົງ")} {selected.length > 0 ? `(${selected.length})` : ""}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
