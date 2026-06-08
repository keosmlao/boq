import { useEffect, useMemo, useState } from "react";
import { FilePlus, Loader2, Save, User, X } from "lucide-react";

export default function WorkOrderModal({
  open,
  onClose,
  message,
  selectedProjectId,
  setSelectedProjectId,
  projects,
  contracts,
  form,
  setForm,
  taskOptions,
  techOptions,
  techHelperDefaults,
  selectedHelpers,
  helperLookup,
  helperToAdd,
  setHelperToAdd,
  defaultHelperOptions,
  otherHelperOptions,
  saving,
  submit,
  resetForm,
}) {
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectQuery, setProjectQuery] = useState("");
  const [contractOpen, setContractOpen] = useState(false);
  const [contractQuery, setContractQuery] = useState("");
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskQuery, setTaskQuery] = useState("");
  const [techOpen, setTechOpen] = useState(false);
  const [techQuery, setTechQuery] = useState("");
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [priorityQuery, setPriorityQuery] = useState("");
  const [helperOpen, setHelperOpen] = useState(false);

  const projectLabel = (p) => `${p.project_name || ""} (${p.cust_code || p.id || "-"})`.trim();
  const contractLabel = (c) => `${c.contract_no || c.contract_id || ""} - ${c.contract_name || ""}`.trim();
  const taskLabel = (t) => `${t.task || t.name || ""} ${t.phase ? `(${t.phase})` : ""}`.trim();
  const techLabel = (t) => `${t.name || ""}`.trim();
  const helperLabel = (h) => `${h.name || ""}${h.code ? ` (${h.code})` : ""}`.trim();
  const priorityOptions = [
    { value: "Low", label: "ຕໍາ" },
    { value: "Normal", label: "ປົກກະຕິ" },
    { value: "High", label: "ດ່ວນ" },
  ];

  useEffect(() => {
    const selected = projects.find((p) => String(p.id) === String(selectedProjectId));
    if (selected) {
      setProjectQuery(projectLabel(selected));
    } else {
      setProjectQuery("");
    }
  }, [projects, selectedProjectId]);

  const filteredProjects = useMemo(() => {
    if (!projectQuery) return projects;
    const s = projectQuery.toLowerCase();
    return projects.filter((p) => projectLabel(p).toLowerCase().includes(s));
  }, [projects, projectQuery]);

  useEffect(() => {
    const selected = contracts.find((c) => (c.contract_no || c.contract_id) === form.contract_no);
    if (selected) {
      setContractQuery(contractLabel(selected));
    } else {
      setContractQuery("");
    }
  }, [contracts, form.contract_no]);

  const filteredContracts = useMemo(() => {
    if (!contractQuery) return contracts;
    const s = contractQuery.toLowerCase();
    return contracts.filter((c) => contractLabel(c).toLowerCase().includes(s));
  }, [contracts, contractQuery]);

  useEffect(() => {
    if (!form.task_list || form.task_list.length === 0) {
      setTaskQuery("");
    }
  }, [form.task_list]);

  const filteredTasks = useMemo(() => {
    if (!taskQuery) return taskOptions;
    const s = taskQuery.toLowerCase();
    return taskOptions.filter((t) => taskLabel(t).toLowerCase().includes(s));
  }, [taskOptions, taskQuery]);

  const selectedTasks = useMemo(() => {
    if (Array.isArray(form.task_list) && form.task_list.length) return form.task_list;
    if (form.task_id || form.task_name) {
      return [{ task_id: form.task_id, task_name: form.task_name }];
    }
    return [];
  }, [form.task_list, form.task_id, form.task_name]);

  const hasTasks = selectedTasks.length > 0;

  useEffect(() => {
    const selected = techOptions.find((t) => String(t.code || t.name) === String(form.technician_id));
    if (selected) {
      setTechQuery(techLabel(selected));
    } else {
      setTechQuery("");
    }
  }, [techOptions, form.technician_id]);

  const filteredTechs = useMemo(() => {
    if (!techQuery) return techOptions;
    const s = techQuery.toLowerCase();
    return techOptions.filter((t) => techLabel(t).toLowerCase().includes(s));
  }, [techOptions, techQuery]);

  useEffect(() => {
    const selected = priorityOptions.find((p) => p.value === form.priority);
    setPriorityQuery(selected ? selected.label : "");
  }, [form.priority]);

  const filteredPriorities = useMemo(() => {
    if (!priorityQuery) return priorityOptions;
    const s = priorityQuery.toLowerCase();
    return priorityOptions.filter((p) => p.label.toLowerCase().includes(s));
  }, [priorityQuery]);

  const helperOptionsAll = [
    ...defaultHelperOptions.map((h) => ({ ...h, _group: "default" })),
    ...otherHelperOptions.map((h) => ({ ...h, _group: "other" })),
  ];

  const filteredHelpers = useMemo(() => {
    if (!helperToAdd) return helperOptionsAll;
    const s = helperToAdd.toLowerCase();
    return helperOptionsAll.filter((h) => helperLabel(h).toLowerCase().includes(s));
  }, [helperOptionsAll, helperToAdd]);

  const selectedProject = useMemo(
    () => projects.find((p) => String(p.id) === String(selectedProjectId)),
    [projects, selectedProjectId]
  );
  const selectedContract = useMemo(
    () => contracts.find((c) => (c.contract_no || c.contract_id) === form.contract_no),
    [contracts, form.contract_no]
  );
  const selectedTech = useMemo(
    () => techOptions.find((t) => String(t.code || t.name) === String(form.technician_id)),
    [techOptions, form.technician_id]
  );
  const isReady = Boolean(
    form.project_code && form.contract_no && hasTasks && form.technician_id
  );
  const messageIsSuccess = Boolean(message && message.includes("ສຳເລັດ"));
  const missingFields = [
    !form.project_code && "ໂຄງການ",
    !form.contract_no && "ສັນຍາ",
    !hasTasks && "ວຽກ",
    !form.technician_id && "ຊ່າງນໍາ",
  ].filter(Boolean);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 wo-modal">
      <style>{`
        .wo-modal { font-family: var(--font-lao), system-ui, sans-serif; color: var(--theme-text); }
        .wo-backdrop { background: rgba(15, 23, 42, 0.36); backdrop-filter: blur(2px); }
        .wo-input { width: 100%; height: 36px; padding: 0 10px; border: 1px solid var(--theme-border-subtle); border-radius: 4px; background: #fff; font-size: 13px; }
        .wo-input:focus { outline: none; border-color: var(--theme-accent); box-shadow: 0 0 0 2px rgba(113, 75, 103, 0.12); }
        .wo-input:disabled { background: #f4f4f4; color: var(--theme-text-mute); cursor: not-allowed; }
        .wo-textarea { min-height: 92px; height: auto; padding: 9px 10px; line-height: 1.5; }
        .wo-label { font-size: 12px; font-weight: 600; color: var(--theme-text); }
        .wo-dropdown { position: absolute; z-index: 50; margin-top: 3px; width: 100%; max-height: 230px; overflow-y: auto; border: 1px solid var(--theme-border-subtle); border-radius: 4px; background: #fff; box-shadow: var(--theme-shadow); }
        .wo-dropdown button { width: 100%; text-align: left; padding: 8px 10px; font-size: 13px; color: var(--theme-text); }
        .wo-dropdown button:hover { background: var(--theme-bg-muted); }
        .wo-chip { display: inline-flex; align-items: center; gap: 6px; border-radius: 4px; background: #f7f7f7; color: var(--theme-text); border: 1px solid var(--theme-border-subtle); padding: 3px 7px; font-size: 12px; font-weight: 500; }
        .wo-alert { border-radius: 4px; padding: 9px 11px; font-size: 13px; font-weight: 600; }
        .wo-alert-success { background: #ecfdf5; color: #047857; border: 1px solid #6ee7b7; }
        .wo-alert-warning { background: #fff7ed; color: #c2410c; border: 1px solid #fdba74; }
        .wo-status { border-left: 1px solid var(--theme-border-subtle); padding: 8px 14px; font-size: 12px; font-weight: 700; color: var(--theme-text-mute); background: #f7f7f7; }
        .wo-status-active { background: #fff; color: var(--theme-accent); border-bottom: 2px solid var(--theme-accent); }
      `}</style>

      <div className="absolute inset-0 wo-backdrop" />

      <div className="relative flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded border border-[var(--theme-border-subtle)] bg-white shadow-[var(--theme-shadow)]">
        <header className="border-b border-[var(--theme-border-subtle)] bg-[#f7f7f7]">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <div className="flex items-center gap-2">
              <button
                disabled={saving}
                onClick={submit}
                className="inline-flex h-8 items-center gap-1.5 rounded bg-[var(--theme-accent)] px-3 text-xs font-semibold text-white hover:bg-[var(--theme-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
                ບັນທຶກ
              </button>
              <button
                onClick={resetForm}
                className="h-8 rounded border border-[var(--theme-border-subtle)] bg-white px-3 text-xs font-semibold text-[var(--theme-text)] hover:bg-[var(--theme-bg-muted)]"
              >
                ລ້າງ
              </button>
              <button
                onClick={onClose}
                className="h-8 rounded border border-[var(--theme-border-subtle)] bg-white px-3 text-xs font-semibold text-[var(--theme-text)] hover:bg-[var(--theme-bg-muted)]"
              >
                ປິດ
              </button>
            </div>
            <div className="flex items-center overflow-hidden rounded border border-[var(--theme-border-subtle)] bg-[#f7f7f7]">
              <span className={`wo-status ${!isReady ? "wo-status-active" : ""}`}>ຂາດຂໍ້ມູນ</span>
              <span className={`wo-status ${isReady ? "wo-status-active" : ""}`}>ພ້ອມບັນທຶກ</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-[#f3f3f3] px-4 py-4">
          <div className="mx-auto max-w-4xl border border-[var(--theme-border-subtle)] bg-white">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--theme-border-subtle)] px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--theme-text-mute)]">
                  <FilePlus size={15} />
                  WORK ORDER
                </div>
                <h2 className="mt-1 truncate text-2xl font-semibold text-[var(--theme-text)]">
                  ສ້າງໃບງານໃໝ່
                </h2>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-[var(--theme-border-subtle)] bg-white text-[var(--theme-text-mute)] hover:bg-[var(--theme-bg-muted)] hover:text-[var(--theme-text)]"
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </div>

            {message && (
              <div className="px-5 pt-4">
                <div className={`wo-alert ${messageIsSuccess ? "wo-alert-success" : "wo-alert-warning"}`}>
                  {message}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-x-8 gap-y-5 px-5 py-5 lg:grid-cols-2">
              <div>
                <label className="wo-label">ໂຄງການ *</label>
                <div className="relative mt-1.5">
                  <input
                    className="wo-input"
                    placeholder="ຄົ້ນຫາໂຄງການ..."
                    value={projectQuery}
                    onChange={(e) => {
                      setProjectQuery(e.target.value);
                      setProjectOpen(true);
                    }}
                    onFocus={() => setProjectOpen(true)}
                    onBlur={() => setTimeout(() => setProjectOpen(false), 150)}
                  />
                  {projectOpen && (
                    <div className="wo-dropdown">
                      {filteredProjects.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-[var(--theme-text-mute)]">ບໍ່ພົບຂໍ້ມູນ</div>
                      ) : (
                        filteredProjects.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedProjectId(p.id);
                              setProjectQuery(projectLabel(p));
                              setProjectOpen(false);
                            }}
                          >
                            {projectLabel(p)}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {selectedProject && <div className="mt-1 text-[11px] text-[var(--theme-text-mute)]">{selectedProject.project_name}</div>}
              </div>

              <div>
                <label className="wo-label">ສັນຍາ *</label>
                <div className="relative mt-1.5">
                  <input
                    className="wo-input"
                    placeholder="ຄົ້ນຫາສັນຍາ..."
                    value={contractQuery}
                    onChange={(e) => {
                      setContractQuery(e.target.value);
                      setContractOpen(true);
                    }}
                    onFocus={() => setContractOpen(true)}
                    onBlur={() => setTimeout(() => setContractOpen(false), 150)}
                    disabled={!contracts.length}
                  />
                  {contractOpen && contracts.length > 0 && (
                    <div className="wo-dropdown">
                      {filteredContracts.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-[var(--theme-text-mute)]">ບໍ່ພົບຂໍ້ມູນ</div>
                      ) : (
                        filteredContracts.map((c, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              const val = c.contract_no || c.contract_id || "";
                              setForm({
                                ...form,
                                contract_no: val,
                                task_id: "",
                                task_name: "",
                                task_list: [],
                                technician_id: "",
                                helper_ids: "",
                              });
                              setContractQuery(contractLabel(c));
                              setTaskQuery("");
                              setContractOpen(false);
                            }}
                          >
                            {contractLabel(c)}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {selectedContract && <div className="mt-1 text-[11px] text-[var(--theme-text-mute)]">{selectedContract.contract_no}</div>}
              </div>

              <div>
                <label className="wo-label">Priority</label>
                <div className="relative mt-1.5">
                  <input
                    className="wo-input"
                    placeholder="Priority"
                    value={priorityQuery}
                    onChange={(e) => {
                      setPriorityQuery(e.target.value);
                      setPriorityOpen(true);
                    }}
                    onFocus={() => setPriorityOpen(true)}
                    onBlur={() => setTimeout(() => setPriorityOpen(false), 150)}
                  />
                  {priorityOpen && (
                    <div className="wo-dropdown">
                      {filteredPriorities.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => {
                            setForm({ ...form, priority: p.value });
                            setPriorityQuery(p.label);
                            setPriorityOpen(false);
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="wo-label">ຊ່າງນໍາ *</label>
                <div className="relative mt-1.5">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-text-mute)]" size={16} />
                  <input
                    className="wo-input pl-9"
                    placeholder="ຄົ້ນຫາຊ່າງນໍາ..."
                    value={techQuery}
                    onChange={(e) => {
                      setTechQuery(e.target.value);
                      setTechOpen(true);
                    }}
                    onFocus={() => setTechOpen(true)}
                    onBlur={() => setTimeout(() => setTechOpen(false), 150)}
                  />
                  {techOpen && (
                    <div className="wo-dropdown">
                      {filteredTechs.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-[var(--theme-text-mute)]">ບໍ່ພົບຂໍ້ມູນ</div>
                      ) : (
                        filteredTechs.map((t, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              const techCode = t.code || t.name;
                              const defaults = techHelperDefaults[techCode] || [];
                              const merged = Array.from(
                                new Set(
                                  [...defaults, ...selectedHelpers]
                                    .map((s) => String(s || "").trim())
                                    .filter(Boolean)
                                )
                              );
                              setForm({
                                ...form,
                                technician_id: techCode,
                                helper_ids: techCode ? merged.join(",") : "",
                              });
                              setTechQuery(techLabel(t));
                              setTechOpen(false);
                            }}
                          >
                            {techLabel(t)}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {selectedTech && <div className="mt-1 text-[11px] text-[var(--theme-text-mute)]">{selectedTech.name}</div>}
              </div>
            </div>

            <div className="border-t border-[var(--theme-border-subtle)] px-5 py-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[var(--theme-text)]">ລາຍການວຽກ *</h3>
                <div className="relative w-full sm:w-80">
                  <input
                    className="wo-input"
                    placeholder="ເພີ່ມວຽກ..."
                    value={taskQuery}
                    onChange={(e) => {
                      setTaskQuery(e.target.value);
                      setTaskOpen(true);
                    }}
                    onFocus={() => setTaskOpen(true)}
                    onBlur={() => setTimeout(() => setTaskOpen(false), 150)}
                    disabled={!form.contract_no}
                  />
                  {taskOpen && (
                    <div className="wo-dropdown">
                      {filteredTasks.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-[var(--theme-text-mute)]">ບໍ່ພົບຂໍ້ມູນ</div>
                      ) : (
                        filteredTasks.map((t, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              const newTask = { task_id: t.id, task_name: t.task || t.name || "" };
                              const exists = selectedTasks.some((task) =>
                                String(task.task_id || task.task_name) ===
                                String(newTask.task_id || newTask.task_name)
                              );
                              const nextTasks = exists ? selectedTasks : [...selectedTasks, newTask];
                              const primary = nextTasks[0] || {};
                              setForm({
                                ...form,
                                task_id: primary.task_id || "",
                                task_name: primary.task_name || "",
                                task_list: nextTasks,
                              });
                              setTaskQuery("");
                              setTaskOpen(false);
                            }}
                          >
                            {taskLabel(t)}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-hidden rounded border border-[var(--theme-border-subtle)]">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--theme-border-subtle)] bg-[#f7f7f7]">
                      <th className="w-12 px-3 py-2 text-left text-[11px] font-semibold text-[var(--theme-text-mute)]">#</th>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold text-[var(--theme-text-mute)]">ວຽກ</th>
                      <th className="w-16 px-3 py-2 text-right text-[11px] font-semibold text-[var(--theme-text-mute)]">ລົບ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTasks.length > 0 ? (
                      selectedTasks.map((task, idx) => (
                        <tr key={`${task.task_id || task.task_name || "task"}-${idx}`} className="border-b border-[var(--theme-border-subtle)] last:border-b-0">
                          <td className="px-3 py-2 text-xs text-[var(--theme-text-mute)]">{idx + 1}</td>
                          <td className="px-3 py-2 text-sm font-medium text-[var(--theme-text)]">{task.task_name || "-"}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                const next = selectedTasks.filter((_, i) => i !== idx);
                                const primary = next[0] || {};
                                setForm({
                                  ...form,
                                  task_id: primary.task_id || "",
                                  task_name: primary.task_name || "",
                                  task_list: next,
                                });
                              }}
                              className="inline-flex h-7 w-7 items-center justify-center rounded border border-[var(--theme-border-subtle)] text-[var(--theme-text-mute)] hover:bg-rose-50 hover:text-rose-600"
                              aria-label="Remove task"
                            >
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-3 py-5 text-center text-sm text-[var(--theme-text-mute)]">ຍັງບໍ່ມີວຽກ</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-x-8 gap-y-5 border-t border-[var(--theme-border-subtle)] px-5 py-4 lg:grid-cols-2">
              <div>
                <label className="wo-label">ຜູ້ຊ່ວຍ</label>
                <div className="mt-1.5 rounded border border-[var(--theme-border-subtle)] bg-[#fafafa] p-2">
                  {selectedHelpers.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {selectedHelpers.map((helper) => (
                        <span key={helper} className="wo-chip">
                          {helperLookup[helper] || helper}
                          <button
                            type="button"
                            onClick={() => {
                              const next = selectedHelpers.filter((h) => h !== helper);
                              setForm({ ...form, helper_ids: next.join(",") });
                            }}
                            className="text-[var(--theme-accent-strong)] hover:text-rose-600"
                            aria-label={`Remove ${helper}`}
                          >
                            <X size={13} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="relative">
                    <input
                      className="wo-input"
                      placeholder="ເພີ່ມຜູ້ຊ່ວຍ..."
                      value={helperToAdd}
                      onChange={(e) => {
                        setHelperToAdd(e.target.value);
                        setHelperOpen(true);
                      }}
                      onFocus={() => setHelperOpen(true)}
                      onBlur={() => setTimeout(() => setHelperOpen(false), 150)}
                    />
                    {helperOpen && (
                      <div className="wo-dropdown">
                        {filteredHelpers.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-[var(--theme-text-mute)]">ບໍ່ພົບຂໍ້ມູນ</div>
                        ) : (
                          filteredHelpers.map((h, idx) => (
                            <button
                              key={`${h._group}-${idx}`}
                              type="button"
                              onClick={() => {
                                const val = h.code || h.name;
                                if (!val) return;
                                const next = Array.from(new Set([...selectedHelpers, val]));
                                setForm({ ...form, helper_ids: next.join(",") });
                                setHelperToAdd("");
                                setHelperOpen(false);
                              }}
                            >
                              {helperLabel(h)}
                              <span className="ml-2 text-[10px] text-[var(--theme-text-mute)]">
                                {h._group === "default" ? "ຜູ້ຊ່ວຍປະຈໍາ" : "ຜູ້ຊ່ວຍອື່ນໆ"}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="wo-label">ລາຍລະອຽດ</label>
                <textarea
                  className="wo-input wo-textarea mt-1.5"
                  placeholder="ໃສ່ລາຍລະອຽດຂອງວຽກ..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>

            {!isReady && missingFields.length > 0 && (
              <div className="border-t border-[var(--theme-border-subtle)] px-5 py-3">
                <div className="wo-alert wo-alert-warning">
                  ຍັງຂາດ: {missingFields.join(" , ")}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
