"use client";

/** Standard installation checklist — editable master list (add / edit / delete / reorder). */
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, ClipboardCheck, FolderSync, Info, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Page, PageHeader, Card, Btn, inputCls } from "../_components/ui";
import { can } from "@/_lib/permissions";
import { getV2User, type V2User } from "../../_lib/session";
import { useT } from "@/_lib/i18n";
import {
  getStandardTasks,
  createStandardTask,
  updateStandardTask,
  deleteStandardTask,
  reorderStandardTasks,
  applyStandardTasksToAllProjects,
  type StdTask,
} from "@/_actions/std-tasks";

export default function StandardTasksPage() {
  const t = useT();
  const [tasks, setTasks] = useState<StdTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<V2User | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [applying, setApplying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const canCreate = useMemo(() => can(user, "std-tasks", "create"), [user]);
  const canEdit = useMemo(() => can(user, "std-tasks", "edit"), [user]);
  const canDelete = useMemo(() => can(user, "std-tasks", "delete"), [user]);

  const load = async () => {
    const res = await getStandardTasks();
    if (res.success) {
      setTasks(res.data);
      setError(null);
    } else {
      setError((res as { message?: string }).message || t("stdTasks.loadFailed", "ໂຫຼດບໍ່ສຳເລັດ"));
    }
    setLoading(false);
  };

  useEffect(() => {
    setUser(getV2User());
    load();
  }, []);

  const add = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    const res = await createStandardTask(title);
    setAdding(false);
    if (res.success) {
      setNewTitle("");
      load();
    } else {
      setError((res as { message?: string }).message || t("stdTasks.addFailed", "ເພີ່ມບໍ່ສຳເລັດ"));
    }
  };

  const saveEdit = async () => {
    if (editingId == null) return;
    const title = editValue.trim();
    if (!title) return;
    setBusyId(editingId);
    const res = await updateStandardTask(editingId, title);
    setBusyId(null);
    if (res.success) {
      setEditingId(null);
      load();
    } else {
      setError((res as { message?: string }).message || t("stdTasks.saveFailed", "ບັນທຶກບໍ່ສຳເລັດ"));
    }
  };

  const remove = async (task: StdTask) => {
    if (!confirm(`${t("stdTasks.deleteConfirm", "ລຶບ")} "${task.title}"?`)) return;
    setBusyId(task.id);
    const res = await deleteStandardTask(task.id);
    setBusyId(null);
    if (res.success) load();
    else setError((res as { message?: string }).message || t("stdTasks.deleteFailed", "ລຶບບໍ່ສຳເລັດ"));
  };

  const applyAll = async () => {
    if (!confirm(t("stdTasks.applyAllConfirm", "ນຳໃຊ້ລາຍການມາດຕະຖານກັບທຸກໂຄງການ?\nໂຄງການທີ່ມີຢູ່ແລ້ວຈະຖືກຂ້າມ (ບໍ່ສ້າງຊ້ຳ)."))) return;
    setApplying(true);
    setNotice(null);
    const res = await applyStandardTasksToAllProjects();
    setApplying(false);
    if (res.success) {
      setNotice(`${t("stdTasks.applyDone", "ສຳເລັດ — ເພີ່ມໃຫ້")} ${res.projects} ${t("stdTasks.projectsUnit", "ໂຄງການ")} (${res.tasks} ${t("stdTasks.tasksUnit", "ໜ້າວຽກ")}).`);
    } else {
      setError((res as { message?: string }).message || t("stdTasks.applyFailed", "ນຳໃຊ້ບໍ່ສຳເລັດ"));
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= tasks.length) return;
    const reordered = [...tasks];
    [reordered[index], reordered[next]] = [reordered[next], reordered[index]];
    setTasks(reordered); // optimistic
    const res = await reorderStandardTasks(reordered.map((x) => x.id));
    if (!res.success) {
      setError((res as { message?: string }).message || t("stdTasks.reorderFailed", "ຈັດລຳດັບບໍ່ສຳເລັດ"));
      load(); // rollback to server truth
    }
  };

  return (
    <Page max="max-w-none">
      <PageHeader
        title={t("stdTasks.title", "ງານຕິດຕັ້ງມາດຕະຖານ")}
        subtitle={`${tasks.length} ${t("stdTasks.itemsUnit", "ລາຍການ")} · ${t("stdTasks.subtitleHint", "ເພີ່ມເຂົ້າໂຄງການອັດຕະໂນມັດ ເມື່ອ BOQ ຖືກອະນຸມັດ")}`}
        actions={
          canEdit ? (
            <Btn variant="outline" onClick={applyAll} disabled={applying}>
              {applying ? <Loader2 size={14} className="animate-spin" /> : <FolderSync size={14} />} {t("stdTasks.applyAll", "ນຳໃຊ້ກັບທຸກໂຄງການ")}
            </Btn>
          ) : undefined
        }
      />

      {notice && <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-700">{notice}</p>}

      <Card className="mb-4 flex items-start gap-3 border-blue-200 bg-blue-50/60 p-4">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
          <Info size={16} />
        </span>
        <p className="text-[12.5px] font-semibold leading-relaxed text-blue-800">
          {t("stdTasks.infoBefore", "ການແກ້ໄຂລາຍການນີ້ມີຜົນກັບໂຄງການທີ່ຈະອະນຸມັດ BOQ")} <b>{t("stdTasks.infoNext", "ຕໍ່ໄປ")}</b>. {t("stdTasks.infoAfter", "ໂຄງການທີ່ສ້າງງານໄປແລ້ວຈະບໍ່ປ່ຽນ.")}
        </p>
      </Card>

      {error && <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-600">{error}</p>}

      {canCreate && (
        <Card className="mb-4 p-3">
          <div className="flex items-center gap-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder={t("stdTasks.addPlaceholder", "ເພີ່ມງານຕິດຕັ້ງມາດຕະຖານໃໝ່...")}
              className={inputCls}
            />
            <Btn onClick={add} disabled={adding || !newTitle.trim()}>
              {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} />} {t("common.add", "ເພີ່ມ")}
            </Btn>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        {loading ? (
          <p className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
            <Loader2 size={16} className="animate-spin" /> {t("common.loading", "ກຳລັງໂຫຼດ...")}
          </p>
        ) : tasks.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">{t("stdTasks.noData", "ຍັງບໍ່ມີລາຍການ")}</p>
        ) : (
          <ol className="divide-y divide-slate-100">
            {tasks.map((task, i) => (
              <li key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[12px] font-black text-slate-600">
                  {i + 1}
                </span>

                {editingId === task.id ? (
                  <>
                    <input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                      className={`${inputCls} flex-1`}
                    />
                    <button onClick={saveEdit} disabled={busyId === task.id} className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50" title={t("common.save", "ບັນທຶກ")}>
                      {busyId === task.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={16} />}
                    </button>
                    <button onClick={() => setEditingId(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100" title={t("common.cancel", "ຍົກເລີກ")}>
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-[13.5px] font-semibold text-slate-800">{task.title}</span>
                    {canEdit && (
                      <span className="flex">
                        <button onClick={() => move(i, -1)} disabled={i === 0} className="flex h-8 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" title={t("stdTasks.moveUp", "ເລື່ອນຂຶ້ນ")}>
                          <ArrowUp size={14} />
                        </button>
                        <button onClick={() => move(i, 1)} disabled={i === tasks.length - 1} className="flex h-8 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" title={t("stdTasks.moveDown", "ເລື່ອນລົງ")}>
                          <ArrowDown size={14} />
                        </button>
                      </span>
                    )}
                    {canEdit && (
                      <button onClick={() => { setEditingId(task.id); setEditValue(task.title); }} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-blue-600" title={t("common.edit", "ແກ້ໄຂ")}>
                        <Pencil size={14} />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => remove(task)} disabled={busyId === task.id} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" title={t("common.delete", "ລຶບ")}>
                        {busyId === task.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    )}
                    {!canEdit && !canDelete && <ClipboardCheck size={15} className="text-slate-300" />}
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </Page>
  );
}
