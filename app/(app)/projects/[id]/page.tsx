"use client";

/** v2 project pipeline — real data; stepper + current stage + tabs. */
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import ActivityFeed from "../../_components/ActivityFeed";
import {
  ArrowLeft,
  Phone,
  MapPin,
  User,
  Pencil,
  Trash2,
  AlertTriangle,
  Loader2,
  Plus,
  Check,
  X,
  Home,
  FileText,
  FileSignature,
  ListChecks,
  CalendarRange,
  Wrench,
  Boxes,
  PackageOpen,
  ClipboardList,
  FolderKanban,
} from "lucide-react";
import { Pill } from "../../_components/ui";
import { getProjectsBoq, deleteProjectAction, advanceProjectStage, deleteProjectContract } from "@/_actions/projects";
import { deleteBoq as deleteLegacyBoq, approveBoq } from "@/_actions/boq";
import { getQuotations, approveQuotation, deleteQuotation } from "@/_actions/quotations";
import { getSurveys, deleteSurvey } from "@/_actions/survey";
import { getContracts, setContractApproval, deleteContract } from "@/_actions/contracts";
import { getProjectMaterials } from "@/_actions/boq-v2";
import { getProjectTasks, deleteTaskPlan } from "@/_actions/tasks-v2";
import { getWorkOrders, deleteWorkOrder } from "@/_actions/workorder";
import { getRequests } from "@/_actions/request-v2";
import { computeStages, StatusBadge, type Stage } from "@/_components/pipeline";

type TabKey = "overview" | "survey" | "quotations" | "contracts" | "boq" | "tasks" | "workorders" | "materials" | "requests";

const TAB_ICONS: Record<TabKey, React.ReactNode> = {
  overview: <Home size={14} />,
  survey: <MapPin size={14} />,
  quotations: <FileText size={14} />,
  contracts: <FileSignature size={14} />,
  boq: <ListChecks size={14} />,
  tasks: <CalendarRange size={14} />,
  workorders: <Wrench size={14} />,
  materials: <Boxes size={14} />,
  requests: <PackageOpen size={14} />,
};

/** v2 pipeline stage order (mirrors advanceProjectStage on the server). */
const V2_STAGES = ["ລົງທະບຽນ", "ສຳຫຼວດ", "ສະເໜີລາຄາ", "ສັນຍາ", "BOQ", "ກຳນົດໜ້າວຽກ", "ໃບງານ", "ປິດໂຄງການ"];

export default function V2PipelinePage() {
  const { id } = useParams();
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [surveys, setSurveys] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [workorders, setWorkorders] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const tabParam = useSearchParams().get("tab") as TabKey | null;
  const [tab, setTab] = useState<TabKey>(tabParam || "overview");
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selectTab = async (key: TabKey) => {
    setTab(key);
    if (key !== "materials") return;
    const result: any = await getProjectMaterials(String(id));
    if (result?.success) setMaterials(result.data || []);
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      const res: any = await deleteProjectAction(String(id));
      if (res?.success) router.push("/projects");
      else {
        setDeleting(false);
        setConfirmDel(false);
      }
    } catch {
      setDeleting(false);
      setConfirmDel(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [pRes, qRes, sRes, cRes, tRes, woRes, mRes, rqRes]: any = await Promise.all([
          getProjectsBoq({ projectId: String(id) }),
          getQuotations({ projectId: String(id) }),
          getSurveys(String(id)),
          getContracts({ projectId: String(id) }),
          getProjectTasks({ projectId: String(id) }),
          getWorkOrders({ projectId: String(id) }),
          getProjectMaterials(String(id)),
          getRequests({ projectId: String(id) }),
        ]);
        if (!alive) return;
        const rows = pRes?.success ? pRes.data || [] : [];
        setProject(rows[0] || null);
        setQuotations(qRes?.success ? qRes.data || [] : Array.isArray(qRes) ? qRes : []);
        setSurveys(sRes?.success ? sRes.data || [] : []);
        setContracts(cRes?.success ? cRes.data || [] : []);
        setTasks(tRes?.success ? tRes.data || [] : []);
        setWorkorders(woRes?.success ? woRes.data || [] : []);
        setMaterials(mRes?.success ? mRes.data || [] : []);
        setRequests(rqRes?.success ? rqRes.data || [] : []);
        const errs = [tRes, woRes, mRes, rqRes]
          .filter((r: any) => r && r.success === false)
          .map((r: any) => r.message);
        setLoadError(errs.length ? errs.join(" · ") : "");
      } catch {
        if (alive) setProject(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const legacyContracts = useMemo(
    () => (Array.isArray(project?.contractlist) ? project.contractlist : []).map((c: any) => ({ ...c, src: "erp" })),
    [project]
  );
  const legacyBoqs = useMemo(
    () =>
      legacyContracts.flatMap((c: any) =>
        (Array.isArray(c?.boq_list) ? c.boq_list : []).map((b: any) => ({ ...b, src: "erp", contract_no: c.contract_no }))
      ),
    [legacyContracts]
  );
  const allContracts = useMemo(() => [...contracts, ...legacyContracts], [contracts, legacyContracts]);
  const allBoqs = legacyBoqs;

  const stages: Stage[] = useMemo(
    () => (project ? computeStages(project, quotations, allContracts, surveys, allBoqs, tasks, workorders) : []),
    [project, quotations, allContracts, surveys, allBoqs, tasks, workorders]
  );
  const current = stages.find((s) => s.state === "current");
  const hasActiveQuo = quotations.some((q: any) => (q.status || "") !== "ປະຕິເສດ");
  const hasAnyContract = allContracts.length > 0;

  const bumpStatus = (target: string) =>
    setProject((p: any) => {
      if (!p) return p;
      const ci = V2_STAGES.indexOf(p.project_status);
      const ti = V2_STAGES.indexOf(target);
      return ti > ci ? { ...p, project_status: target } : p;
    });

  const setQuoStatus = async (qid: any, status: string) => {
    const res: any = await approveQuotation(String(qid), status);
    if (res?.success) {
      setQuotations((qs) => qs.map((q) => (q.id === qid ? { ...q, status } : q)));
      if (status === "ອະນຸມັດແລ້ວ") {
        advanceProjectStage(String(id), "ສະເໜີລາຄາ").catch(() => {});
        bumpStatus("ສະເໜີລາຄາ");
      }
    } else {
      alert(res?.message || "ບໍ່ສຳເລັດ");
    }
  };

  const setContractStep = async (cid: any, which: "sales" | "accounting", approved: boolean) => {
    let approver = "";
    try {
      approver = JSON.parse(localStorage.getItem("v2_user") || "{}").name || "";
    } catch {
      /* ignore */
    }
    const res: any = await setContractApproval(String(cid), which, approved, approver);
    if (res?.success) {
      const flag = which === "sales" ? "sales_approved" : "accounting_approved";
      const who = which === "sales" ? "sales_approver" : "accounting_approver";
      setContracts((cs) => cs.map((c) => (c.id === cid ? { ...c, [flag]: approved, [who]: approver } : c)));
    } else {
      alert(res?.message || "ບໍ່ສຳເລັດ");
    }
  };

  const setBoqStep = async (docNo: any, status: string) => {
    let user: any = {};
    try { user = JSON.parse(localStorage.getItem("v2_user") || "{}"); } catch { /* ignore */ }
    const statusNum = status === "ອະນຸມັດແລ້ວ" ? 1 : status === "ປະຕິເສດ" ? 2 : 0;
    const res: any = await approveBoq(String(docNo), { status: statusNum, username: user.username || "" });
    if (res?.success) {
      setProject((p: any) =>
        p
          ? {
              ...p,
              contractlist: (p.contractlist || []).map((c: any) => ({
                ...c,
                boq_list: (c.boq_list || []).map((x: any) =>
                  (x.doc_no || x.boq_no) === docNo ? { ...x, approve_status: statusNum, approver: user.name || x.approver } : x
                ),
              })),
            }
          : p
      );
      if (status === "ອະນຸມັດແລ້ວ") {
        advanceProjectStage(String(id), "BOQ").catch(() => {});
        bumpStatus("BOQ");
      }
    } else {
      alert(res?.message || "ບໍ່ສຳເລັດ");
    }
  };

  const removeDoc = async (label: string, action: () => Promise<any>, ok: () => void) => {
    if (!window.confirm(`ລົບ${label}ນີ້? ກູ້ຄືນບໍ່ໄດ້.`)) return;
    const r: any = await action();
    if (r?.success) ok();
    else alert(r?.message || "ລົບບໍ່ສຳເລັດ");
  };
  const delQuotation = (qid: any) => removeDoc("ໃບສະເໜີ", () => deleteQuotation(String(qid)), () => setQuotations((a) => a.filter((x) => x.id !== qid)));
  const delContract = (c: any) =>
    c?.src === "erp"
      ? removeDoc("ສັນຍາ", () => deleteProjectContract(String(c.project_id), String(c.contract_no)), () =>
          setProject((p: any) => (p ? { ...p, contractlist: (p.contractlist || []).filter((x: any) => x.contract_no !== c.contract_no) } : p))
        )
      : removeDoc("ສັນຍາ", () => deleteContract(String(c.id)), () => setContracts((a) => a.filter((x) => x.id !== c.id)));
  const delBoq = (b: any) =>
    removeDoc("BOQ", () => deleteLegacyBoq(String(b.doc_no || b.boq_no)), () =>
      setProject((p: any) =>
        p
          ? { ...p, contractlist: (p.contractlist || []).map((c: any) => ({ ...c, boq_list: (c.boq_list || []).filter((x: any) => (x.doc_no || x.boq_no) !== (b.doc_no || b.boq_no)) })) }
          : p
      )
    );
  const delWO = (wid: any) => removeDoc("ໃບງານ", () => deleteWorkOrder(String(wid)), () => setWorkorders((a) => a.filter((x) => x.id !== wid)));
  const delSurvey = (sid: any) => removeDoc("ສຳຫຼວດ", () => deleteSurvey(String(sid)), () => setSurveys((a) => a.filter((x) => x.id !== sid)));
  const delTaskPlan = () => removeDoc("ແຜນວຽກ", () => deleteTaskPlan(String(id)), () => setTasks([]));

  const stageAction: Partial<Record<string, { label: string; href: string }>> = {
    survey: { label: "ບັນທຶກສຳຫຼວດ", href: `/projects/${id}/survey/new` },
    quotation: { label: "ສ້າງໃບສະເໜີລາຄາ", href: `/projects/${id}/quotation/new` },
    contract: { label: "ສ້າງສັນຍາ", href: `/projects/${id}/contract/new` },
    boq: { label: "ສ້າງ BOQ", href: `/projects/${id}/boq/new` },
    taskplan: { label: "ກຳນົດໜ້າວຽກ", href: `/projects/${id}/tasks/new` },
    workorder: { label: "ອອກໃບງານ", href: `/projects/${id}/workorder/new` },
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-3 text-[var(--theme-text-mute)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--theme-border-subtle)] border-t-[var(--theme-primary)]" />
        <span className="text-sm font-semibold">ກຳລັງໂຫຼດ...</span>
      </div>
    );
  }
  if (!project) {
    return (
      <div className="w-full px-4 md:px-6 py-10 text-center text-[var(--theme-text-mute)]">
        ບໍ່ພົບໂຄງການ
        <div className="mt-3">
          <button onClick={() => router.push("/projects")} className="text-[var(--theme-primary)] hover:underline">
            ← ກັບໄປລາຍການ
          </button>
        </div>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; n?: number }[] = [
    { key: "overview", label: "ພາບລວມ" },
    { key: "survey", label: "ສຳຫຼວດ", n: surveys.length },
    { key: "quotations", label: "ໃບສະເໜີ", n: quotations.length },
    { key: "contracts", label: "ສັນຍາ", n: allContracts.length },
    { key: "boq", label: "BOQ", n: allBoqs.length },
    { key: "tasks", label: "ໜ້າວຽກ", n: tasks.length },
    { key: "workorders", label: "ໃບງານ", n: workorders.length },
    { key: "materials", label: "ລວມວັດສະດຸ", n: materials.length },
    { key: "requests", label: "ຂໍເບີກ", n: requests.length },
  ];

  const addBtn =
    "inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white transition hover:bg-blue-700 active:scale-[0.98]";
  const showCta =
    current &&
    stageAction[current.key] &&
    !(current.key === "contract" && hasAnyContract) &&
    !(current.key === "quotation" && hasActiveQuo);

  return (
    <div className="w-full px-4 md:px-6 py-6 animate-fade-in">
      {/* Back link */}
      <button
        onClick={() => router.push("/projects")}
        className="group mb-5 inline-flex items-center gap-2 text-xs font-bold text-slate-500 transition-colors hover:text-blue-600"
      >
        <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
        <span>ກັບໄປລາຍການໂຄງການ</span>
      </button>

      {loadError && (
        <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-xs font-bold text-rose-700 flex items-center gap-2.5">
          <AlertTriangle size={15} />
          <span>ໂຫຼດຂໍ້ມູນບາງສ່ວນບໍ່ສຳເລັດ: {loadError}</span>
        </div>
      )}

      {/* Two-column workspace: ink info rail (left) + tabbed content (right) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[330px_minmax(0,1fr)]">
        {/* ── Left rail ── */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {/* Brand identity card — blue gradient */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 p-5 text-white shadow-[var(--theme-shadow-lg)]">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-3xl" />
            <div className="relative">
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white">
                  <FolderKanban size={18} />
                </span>
                <StatusBadge status={project.project_status} />
              </div>
              <h1 className="mt-3 text-lg font-black leading-tight tracking-tight text-white font-display">
                {project.project_name || "(ບໍ່ມີຊື່)"}
              </h1>

              <div className="mt-4 space-y-2.5 border-t border-white/10 pt-4 text-[12px]">
                <InkRow icon={<User size={13} />} label="ລະຫັດລູກຄ້າ" value={project.sml_code} mono />
                <InkRow icon={<User size={13} />} label="ຜູ້ປະສານ" value={project.coordinator} />
                <InkRow icon={<Phone size={13} />} label="ໂທ" value={project.phone} />
                <InkRow
                  icon={<MapPin size={13} />}
                  label="ສະຖານທີ່"
                  value={[project.village_name, project.district_name, project.province_name].filter(Boolean).join(" · ")}
                />
              </div>

              <div className="mt-4 flex gap-2 border-t border-white/10 pt-4">
                <button
                  onClick={() => router.push(`/projects/${id}/edit`)}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 text-xs font-bold text-white transition hover:bg-white/15 active:scale-[0.98]"
                >
                  <Pencil size={13} /> ແກ້ໄຂ
                </button>
                <button
                  onClick={() => setConfirmDel(true)}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-white/5 px-3 text-xs font-bold text-rose-300 transition hover:bg-rose-500/20 hover:text-rose-200 active:scale-[0.98]"
                >
                  <Trash2 size={13} /> ລຶບ
                </button>
              </div>
            </div>
          </div>

          {/* Stage progress + current-stage CTA */}
          <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-xs">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-4 w-1 rounded bg-blue-600" />
              <h2 className="text-[13px] font-black text-slate-900">ຂັ້ນຕອນໂຄງການ</h2>
            </div>
            <CustomStageStepper stages={stages} />
            {showCta && (
              <button
                onClick={() => router.push(stageAction[current!.key]!.href)}
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-black text-white transition hover:bg-blue-700 shadow-md shadow-blue-600/15 active:scale-[0.98]"
              >
                <Plus size={14} strokeWidth={2.5} /> {stageAction[current!.key]!.label}
              </button>
            )}
          </div>
        </aside>

        {/* ── Right content ── */}
        <div className="min-w-0 rounded-2xl border border-slate-200/70 bg-white overflow-hidden shadow-xs">
          <div className="bg-slate-50/70 border-b border-slate-100 p-1.5 flex gap-1.5 overflow-x-auto scrollbar-none">
            {tabs.map((t) => {
              const isActive = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => selectTab(t.key)}
                  className={`flex-shrink-0 whitespace-nowrap px-3.5 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2 transition-all ${
                    isActive
                      ? "bg-white text-blue-600 shadow-2xs ring-1 ring-blue-100"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
                  }`}
                >
                  {TAB_ICONS[t.key]}
                  <span>{t.label}</span>
                  {typeof t.n === "number" && (
                    <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-black ${
                      isActive ? "bg-blue-50 text-blue-600 ring-1 ring-blue-100" : "bg-slate-200/70 text-slate-500"
                    }`}>
                      {t.n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-5">
          {tab === "overview" && (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              <Row label="ຊື່ໂຄງການ" value={project.project_name} />
              <Row label="ສະຖານະ" value={project.project_status} />
              <Row label="ລະຫັດລູກຄ້າ" value={project.sml_code} />
              <Row label="ຜູ້ປະສານ" value={project.coordinator} />
              <Row label="ໂທ" value={project.phone} />
              <Row label="ແຂວງ" value={project.province_name} />
              <Row label="ເມືອງ" value={project.district_name} />
              <Row label="ບ້ານ" value={project.village_name} />
              <Row label="ຈຳນວນສັນຍາ" value={String(allContracts.length)} />
              <Row label="ຈຳນວນ BOQ" value={String(allBoqs.length)} />
            </dl>
          )}
          {tab === "survey" && (
            <div>
              <div className="mb-4 flex justify-end">
                <button
                  onClick={() => router.push(`/projects/${id}/survey/new`)}
                  className={addBtn}
                >
                  <Plus size={14} strokeWidth={2.5} /> ເພີ່ມການສຳຫຼວດ
                </button>
              </div>
              <SurveyList surveys={surveys} onDelete={delSurvey} />
            </div>
          )}
          {tab === "quotations" && (
            <div>
              {!hasActiveQuo && (
                <div className="mb-4 flex justify-end">
                  <button
                    onClick={() => router.push(`/projects/${id}/quotation/new`)}
                    className={addBtn}
                  >
                    <Plus size={14} strokeWidth={2.5} /> ສ້າງໃບສະເໜີ
                  </button>
                </div>
              )}
              <QuotationList quotations={quotations} onSetStatus={setQuoStatus} onDelete={delQuotation} />
            </div>
          )}
          {tab === "contracts" && (
            <div>
              {!hasAnyContract && (
                <div className="mb-4 flex justify-end">
                  <button
                    onClick={() => router.push(`/projects/${id}/contract/new`)}
                    className={addBtn}
                  >
                    <Plus size={14} strokeWidth={2.5} /> ສ້າງສັນຍາ
                  </button>
                </div>
              )}
              <ContractList contracts={allContracts} onApprove={setContractStep} onDelete={delContract} />
            </div>
          )}
          {tab === "boq" && (
            <div>
              {hasAnyContract && (
                <div className="mb-4 flex justify-end">
                  <button
                    onClick={() => router.push(`/projects/${id}/boq/new`)}
                    className={addBtn}
                  >
                    <Plus size={14} strokeWidth={2.5} /> ສ້າງ BOQ
                  </button>
                </div>
              )}
              {!hasAnyContract && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700 flex items-center gap-2">
                  <AlertTriangle size={14} />
                  <span>ຕ້ອງມີສັນຍາກ່ອນ ຈຶ່ງສ້າງ BOQ ໄດ້.</span>
                </div>
              )}
              <BoqList boqs={allBoqs} onSetStatus={setBoqStep} onDelete={delBoq} />
            </div>
          )}
          {tab === "tasks" && (
            <div>
              {hasAnyContract && (
                <div className="mb-4 flex justify-end gap-2">
                  {tasks.length > 0 && (
                    <button
                      onClick={delTaskPlan}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-4 text-xs font-bold text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 size={13} /> ລຶບແຜນວຽກ
                    </button>
                  )}
                  <button
                    onClick={() => router.push(`/projects/${id}/tasks/new`)}
                    className={addBtn}
                  >
                    <Plus size={14} strokeWidth={2.5} /> {tasks.length ? "ແກ້ໄຂແຜນວຽກ" : "ກຳນົດໜ້າວຽກ"}
                  </button>
                </div>
              )}
              <TaskList tasks={tasks} />
            </div>
          )}
          {tab === "workorders" && (
            <div>
              <div className="mb-4 flex justify-end">
                <button
                  onClick={() => router.push(`/projects/${id}/workorder/new`)}
                  className={addBtn}
                >
                  <Plus size={14} strokeWidth={2.5} /> ອອກໃບງານ
                </button>
              </div>
              <WorkOrderList workorders={workorders} onDelete={delWO} />
            </div>
          )}
          {tab === "materials" && <MaterialsSummary rows={materials} />}
          {tab === "requests" && (
            <div>
              {materials.length > 0 && (
                <div className="mb-4 flex justify-end">
                  <button
                    onClick={() => router.push(`/projects/${id}/request/new`)}
                    className={addBtn}
                  >
                    <Plus size={14} strokeWidth={2.5} /> ຂໍເບີກ
                  </button>
                </div>
              )}
              <RequestList requests={requests} />
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[20vh] backdrop-blur-xs" onClick={() => !deleting && setConfirmDel(false)}>
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-100">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">ລຶບໂຄງການ?</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                <span className="font-bold text-slate-800">{project.project_name}</span> ພ້ອມສັນຍາ/BOQ/ໃບງານທີ່ກ່ຽວຂ້ອງ ຈະຖືກລຶບຖາວອນ ແລະ ບໍ່ສາມາດກູ້ຄືນໄດ້.
              </p>
            </div>
            <div className="flex gap-2 border-t border-slate-100 bg-slate-50 p-3.5">
              <button onClick={() => setConfirmDel(false)} disabled={deleting} className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60">
                ຍົກເລີກ
              </button>
              <button onClick={doDelete} disabled={deleting} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-600 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60 shadow-md shadow-rose-600/15">
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {deleting ? "ກຳລັງລຶບ..." : "ຢືນຢັນລຶບ"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="mt-5"><ActivityFeed entityType="project" entityId={String(id)} /></div>
    </div>
  );
}

const fmtMoney = (v: unknown) => {
  const n = Number(v);
  return Number.isNaN(n) ? "-" : n.toLocaleString("en-US");
};

function QuotationList({
  quotations,
  onSetStatus,
  onDelete,
}: {
  quotations: any[];
  onSetStatus: (id: any, status: string) => void;
  onDelete?: (id: any) => void;
}) {
  if (!quotations.length) {
    return (
      <div className="py-12 text-center text-slate-400">
        <FileText size={32} className="mx-auto mb-2 text-slate-300" />
        <span className="text-xs font-semibold">ຍັງບໍ່ມີໃບສະເໜີລາຄາ</span>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <th className="px-4 py-3 text-left">ເລກທີ່</th>
            <th className="px-4 py-3 text-left">ວັນທີ</th>
            <th className="px-4 py-3 text-right">ມູນຄ່າ</th>
            <th className="px-4 py-3 text-left">ສະຖານະ</th>
            <th className="px-4 py-3 text-right">ຈັດການ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {quotations.map((q, i) => {
            const status = (q.status ?? "").toString();
            const approved = status === "ອະນຸມັດແລ້ວ";
            const rejected = status === "ປະຕິເສດ";
            const tone = approved ? "green" : rejected ? "red" : "amber";
            return (
              <tr key={q.id ?? i} className="group transition-colors hover:bg-slate-50/50">
                <td className="px-4 py-3 font-mono font-bold">
                  <Link href={`/quotations/${q.id}`} className="text-blue-600 hover:text-blue-700 hover:underline">{q.quotation_no || "-"}</Link>
                </td>
                <td className="px-4 py-3 text-slate-500">{(q.quotation_date ?? "").toString().slice(0, 10) || "-"}</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">{fmtMoney(q.total_amount)}</td>
                <td className="px-4 py-3"><Pill tone={tone as any}>{status || "ລໍຖ້າອະນຸມັດ"}</Pill></td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {!approved && (
                      <button
                        onClick={() => onSetStatus(q.id, "ອະນຸມັດແລ້ວ")}
                        className="inline-flex h-7 items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 active:scale-[0.97] transition-all"
                      >
                        <Check size={12} strokeWidth={2.5} /> ອະນຸມັດ
                      </button>
                    )}
                    {!rejected && !approved && (
                      <button
                        onClick={() => onSetStatus(q.id, "ປະຕິເສດ")}
                        className="inline-flex h-7 items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50 active:scale-[0.97] transition-all"
                      >
                        <X size={12} strokeWidth={2.5} /> ປະຕິເສດ
                      </button>
                    )}
                    {approved && (
                      <button
                        onClick={() => onSetStatus(q.id, "ລໍຖ້າອະນຸມັດ")}
                        className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        ຍົກເລີກອະນຸມັດ
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(q.id)}
                        title="ລົບ"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RequestList({ requests }: { requests: any[] }) {
  if (!requests.length) {
    return (
      <div className="py-12 text-center text-slate-400">
        <PackageOpen size={32} className="mx-auto mb-2 text-slate-300" />
        <span className="text-xs font-semibold">ຍັງບໍ່ມີການຂໍເບີກ</span>
      </div>
    );
  }
  const stLabel = (s: string) => (s === "withdrawn" ? "ເບີກແລ້ວ" : s === "rejected" ? "ປະຕິເສດ" : "ຮ້ອງຂໍ");
  const stTone = (s: string) => (s === "withdrawn" ? "green" : s === "rejected" ? "red" : "amber");
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <th className="px-4 py-3 text-left">ເລກທີ່</th>
            <th className="px-4 py-3 text-left">ວັນທີ</th>
            <th className="px-4 py-3 text-right">ລາຍການ</th>
            <th className="px-4 py-3 text-left">ສະຖານະ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {requests.map((r, i) => {
            const st = String(r.status || "requested");
            const items = Array.isArray(r.items) ? r.items : [];
            const isErp = r.src === "erp";
            return (
              <tr key={r.id ?? i} className="group transition-colors hover:bg-slate-50/50">
                <td className="px-4 py-3 font-mono font-bold">
                  <Link href={`/requests/${encodeURIComponent(r.id)}`} className="text-blue-600 hover:text-blue-700 hover:underline">{r.request_no || "-"}</Link>
                  {isErp && <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">ເກົ່າ</span>}
                </td>
                <td className="px-4 py-3 text-slate-500">{(r.created_at ?? "").toString().slice(0, 10) || "-"}</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-slate-700">{items.length}</td>
                <td className="px-4 py-3"><Pill tone={stTone(st) as any}>{stLabel(st)}</Pill></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MaterialsSummary({ rows }: { rows: any[] }) {
  if (!rows.length) {
    return (
      <div className="py-12 text-center text-slate-400">
        <Boxes size={32} className="mx-auto mb-2 text-slate-300" />
        <span className="text-xs font-semibold">ຍັງບໍ່ມີວັດສະດຸ (ຕ້ອງມີ BOQ ກ່ອນ)</span>
      </div>
    );
  }
  const sum = (k: string) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <th className="px-4 py-3 text-left">ລາຍການ</th>
            <th className="px-4 py-3 text-left">ໜ່ວຍ</th>
            <th className="px-4 py-3 text-right">ຍອດ BOQ</th>
            <th className="px-4 py-3 text-right">ຂໍເບີກ</th>
            <th className="px-4 py-3 text-right">ເບີກແລ້ວ</th>
            <th className="px-4 py-3 text-right">ຄົງເຫຼືອ</th>
            <th className="px-4 py-3 text-center">ສະຖານະ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => {
            const remain = Number(r.remaining) || 0;
            const requested = Number(r.request_qty) || 0;
            const withdrawn = Number(r.withdraw_qty) || 0;
            const status = withdrawn > 0 ? "withdrawn" : requested > 0 ? "requested" : "available";
            return (
              <tr key={i} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 font-bold text-slate-900">{r.description || r.item_code || "-"}</td>
                <td className="px-4 py-3 text-slate-500">{r.unit || "-"}</td>
                <td className="px-4 py-3 text-right font-mono text-slate-700">{(Number(r.boq_qty) || 0).toLocaleString("en-US")}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-amber-600">{(Number(r.request_qty) || 0).toLocaleString("en-US")}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-600">{(Number(r.withdraw_qty) || 0).toLocaleString("en-US")}</td>
                <td className={`px-4 py-3 text-right font-mono font-bold ${remain > 0 ? "text-slate-900" : "text-slate-400"}`}>{remain.toLocaleString("en-US")}</td>
                <td className="px-4 py-3 text-center">
                  {status === "withdrawn" ? (
                    <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">ເບີກແລ້ວ</span>
                  ) : status === "requested" ? (
                    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">ລໍຖ້າເບີກ</span>
                  ) : (
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">ຍັງບໍ່ຂໍເບີກ</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 bg-slate-50/60 font-bold">
            <td className="px-4 py-3 text-slate-900" colSpan={2}>ລວມ</td>
            <td className="px-4 py-3 text-right font-mono text-slate-700">{sum("boq_qty").toLocaleString("en-US")}</td>
            <td className="px-4 py-3 text-right font-mono text-amber-600">{sum("request_qty").toLocaleString("en-US")}</td>
            <td className="px-4 py-3 text-right font-mono text-emerald-600">{sum("withdraw_qty").toLocaleString("en-US")}</td>
            <td className="px-4 py-3 text-right font-mono text-blue-600">{sum("remaining").toLocaleString("en-US")}</td>
            <td className="px-4 py-3" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function WorkOrderList({ workorders, onDelete }: { workorders: any[]; onDelete?: (id: any) => void }) {
  if (!workorders.length) {
    return (
      <div className="py-12 text-center text-slate-400">
        <Wrench size={32} className="mx-auto mb-2 text-slate-300" />
        <span className="text-xs font-semibold">ຍັງບໍ່ມີໃບງານ</span>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <th className="px-4 py-3 text-left">ໃບງານ</th>
            <th className="px-4 py-3 text-left">ທີມ</th>
            <th className="px-4 py-3 text-left">ວັນທີ</th>
            <th className="px-4 py-3 text-right">ຊົ່ວໂມງ</th>
            <th className="px-4 py-3 text-right">ຄ່າແຮງ</th>
            <th className="px-4 py-3 text-right">ຈັດການ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {workorders.map((w, i) => (
            <tr key={w.id ?? i} className="group transition-colors hover:bg-slate-50/50">
              <td className="px-4 py-3 font-mono font-bold">
                <Link href={`/work-orders/${w.id}`} className="text-blue-600 hover:text-blue-700 hover:underline">{w.work_no || "-"}</Link>
              </td>
              <td className="px-4 py-3 text-slate-600 font-bold">{w.technician_name || "-"}</td>
              <td className="px-4 py-3 text-slate-500">{(w.work_date ?? w.created_at ?? "").toString().slice(0, 10) || "-"}</td>
              <td className="px-4 py-3 text-right font-mono text-slate-700">{Number(w.total_hours) || 0}</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">{fmtMoney(w.labor_cost)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end">
                  {onDelete && (
                    <button
                      onClick={() => onDelete(w.id)}
                      title="ລົບ"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskList({ tasks }: { tasks: any[] }) {
  if (!tasks.length) {
    return (
      <div className="py-12 text-center text-slate-400">
        <CalendarRange size={32} className="mx-auto mb-2 text-slate-300" />
        <span className="text-xs font-semibold">ຍັງບໍ່ໄດ້ກຳນົດໜ້າວຽກ</span>
      </div>
    );
  }
  const totalDays = tasks.reduce((s, t) => s + (Number(t.est_days) || 0), 0);
  const totalHours = tasks.reduce((s, t) => s + (Number(t.est_hours) || 0), 0);
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <th className="px-4 py-3 text-left">ໜ້າວຽກ</th>
            <th className="px-4 py-3 text-left">ໄລຍະ</th>
            <th className="px-4 py-3 text-right">ວັນ</th>
            <th className="px-4 py-3 text-right">ຊົ່ວໂມງ</th>
            <th className="px-4 py-3 text-left">ທີມ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tasks.map((t, i) => (
            <tr key={t.id ?? i} className="hover:bg-slate-50/50">
              <td className="px-4 py-3 font-bold text-slate-900">{t.title}</td>
              <td className="px-4 py-3 text-slate-500">{t.phase || "-"}</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">{Number(t.est_days) || 0}</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">{Number(t.est_hours) || 0}</td>
              <td className="px-4 py-3 text-slate-500 font-bold">{t.technician_name || "— ກຳນົດຕາມຫຼັງ"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 bg-slate-50/60 font-bold">
            <td className="px-4 py-3 text-slate-900" colSpan={2}>ລວມ</td>
            <td className="px-4 py-3 text-right font-mono text-blue-600">{totalDays} ວັນ</td>
            <td className="px-4 py-3 text-right font-mono text-blue-600">{totalHours} ຊມ</td>
            <td className="px-4 py-3" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function BoqList({ boqs, onSetStatus, onDelete }: { boqs: any[]; onSetStatus: (docNo: any, status: string) => void; onDelete?: (b: any) => void }) {
  if (!boqs.length) {
    return (
      <div className="py-12 text-center text-slate-400">
        <ListChecks size={32} className="mx-auto mb-2 text-slate-300" />
        <span className="text-xs font-semibold">ຍັງບໍ່ມີ BOQ</span>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <th className="px-4 py-3 text-left">BOQ ເລກທີ່</th>
            <th className="px-4 py-3 text-left">ວັນທີ</th>
            <th className="px-4 py-3 text-left">ຜູ້ຂໍ</th>
            <th className="px-4 py-3 text-left">ຜູ້ອະນຸມັດ</th>
            <th className="px-4 py-3 text-left">ສະຖານະ</th>
            <th className="px-4 py-3 text-right">ຈັດການ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {boqs.map((b, i) => {
            const docNo = b.doc_no || b.boq_no || "";
            const apv = Number(b.approve_status);
            const status = apv === 1 ? "ອະນຸມັດແລ້ວ" : apv === 2 ? "ປະຕິເສດ" : "ລໍຖ້າອະນຸມັດ";
            const approved = status === "ອະນຸມັດແລ້ວ";
            const rejected = status === "ປະຕິເສດ";
            const tone = approved ? "green" : rejected ? "red" : "amber";
            return (
              <tr key={docNo || i} className="group transition-colors hover:bg-slate-50/50">
                <td className="px-4 py-3 font-mono font-bold">
                  <Link href={`/boq/${encodeURIComponent(docNo)}`} className="text-blue-600 hover:text-blue-700 hover:underline">{docNo || "-"}</Link>
                </td>
                <td className="px-4 py-3 text-slate-500">{(b.doc_date ?? "").toString().slice(0, 10) || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{b.user_created || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{b.approver || "-"}</td>
                <td className="px-4 py-3"><Pill tone={tone as any}>{status}</Pill></td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {!approved && (
                      <button
                        onClick={() => onSetStatus(docNo, "ອະນຸມັດແລ້ວ")}
                        className="inline-flex h-7 items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 active:scale-[0.97] transition-all"
                      >
                        <Check size={12} strokeWidth={2.5} /> ອະນຸມັດ
                      </button>
                    )}
                    {!rejected && !approved && (
                      <button
                        onClick={() => onSetStatus(docNo, "ປະຕິເສດ")}
                        className="inline-flex h-7 items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50 active:scale-[0.97] transition-all"
                      >
                        <X size={12} strokeWidth={2.5} /> ປະຕິເສດ
                      </button>
                    )}
                    {(approved || rejected) && (
                      <button
                        onClick={() => onSetStatus(docNo, "ລໍຖ້າອະນຸມັດ")}
                        className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        ຍົກເລີກ
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(b)}
                        title="ລົບ"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ContractList({
  contracts,
  onApprove,
  onDelete,
}: {
  contracts: any[];
  onApprove: (id: any, which: "sales" | "accounting", approved: boolean) => void;
  onDelete?: (c: any) => void;
}) {
  if (!contracts.length) {
    return (
      <div className="py-12 text-center text-slate-400">
        <FileSignature size={32} className="mx-auto mb-2 text-slate-300" />
        <span className="text-xs font-semibold">ຍັງບໍ່ມີສັນຍາ</span>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {contracts.map((c, i) => {
        const isErp = c.src === "erp";
        const sales = isErp ? Number(c.approve_status_1) === 1 : !!c.sales_approved;
        const acc = isErp
          ? Math.max(Number(c.approve_status_2) || 0, Number(c.acc_approve) || 0) === 1
          : !!c.accounting_approved;
        const full = sales && acc;
        return (
          <div key={c.id ?? c.contract_no ?? i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="min-w-0">
                <div className="flex items-center flex-wrap gap-2">
                  <span className="font-mono text-sm font-extrabold text-slate-900">{c.contract_no || "-"}</span>
                  <Pill tone={full ? "green" : "amber"}>{full ? "ສົມບູນ" : "ລໍຖ້າອະນຸມັດ"}</Pill>
                  {isErp && <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">ເກົ່າ</span>}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-bold text-blue-600">ມູນຄ່າ {fmtMoney(c.total_amount)}</span>
                  {c.sign_date && <span className="text-slate-300">|</span>}
                  {c.sign_date && <span>ເຊັນວັນທີ: {String(c.sign_date).slice(0, 10)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <Link
                  href={isErp ? `/contracts/${encodeURIComponent(c.contract_no || "")}` : `/contracts/${c.id}`}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50/50 transition-colors"
                >
                  ລາຍລະອຽດ →
                </Link>
                {onDelete && (
                  <button
                    onClick={() => onDelete(c)}
                    title="ລົບ"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
            {isErp ? (
              <div className="mt-3 flex flex-wrap gap-4 text-xs font-bold text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="flex items-center gap-1.5">ຝ່າຍຂາຍ: {sales ? <span className="text-emerald-600">ອະນຸມັດ ✓</span> : <span className="text-amber-500">ລໍຖ້າ</span>}</span>
                <span className="text-slate-200">|</span>
                <span className="flex items-center gap-1.5">ບັນຊີ: {acc ? <span className="text-emerald-600">ອະນຸມັດ ✓</span> : <span className="text-amber-500">ລໍຖ້າ</span>}</span>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-3">
                <ApprovalCell
                  label="ຜູ້ຈັດການຝ່າຍຂາຍ"
                  approved={sales}
                  approver={c.sales_approver}
                  onApprove={() => onApprove(c.id, "sales", true)}
                  // Can't un-approve sales while accounting still depends on it.
                  onUndo={acc ? undefined : () => onApprove(c.id, "sales", false)}
                />
                <ApprovalCell
                  label="ບັນຊີ"
                  approved={acc}
                  approver={c.accounting_approver}
                  locked={!sales}
                  lockedHint="ລໍຖ້າຝ່າຍຂາຍກ່ອນ"
                  onApprove={() => onApprove(c.id, "accounting", true)}
                  onUndo={() => onApprove(c.id, "accounting", false)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ApprovalCell({
  label,
  approved,
  approver,
  locked,
  lockedHint,
  onApprove,
  onUndo,
}: {
  label: string;
  approved: boolean;
  approver?: string;
  locked?: boolean;
  lockedHint?: string;
  onApprove: () => void;
  onUndo?: () => void;
}) {
  const blocked = !!locked && !approved;
  return (
    <div className={`flex items-center flex-wrap gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/40 px-3 py-2 text-xs ${blocked ? "opacity-70" : ""}`}>
      <span className="font-bold text-slate-500">{label}:</span>
      {approved ? (
        <div className="flex items-center gap-2">
          <Pill tone="green">✓ ອະນຸມັດແລ້ວ</Pill>
          {approver && <span className="text-[10px] text-slate-400 font-bold">ໂດຍ: {approver}</span>}
          {onUndo && <button onClick={onUndo} className="text-[10px] font-bold text-slate-400 hover:text-rose-600 transition-colors">ຍົກເລີກ</button>}
        </div>
      ) : blocked ? (
        <span className="text-[10px] font-bold text-slate-400">🔒 {lockedHint || "ລໍຖ້າຂັ້ນຕອນກ່ອນໜ້າ"}</span>
      ) : (
        <button
          onClick={onApprove}
          className="inline-flex h-7 items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 active:scale-[0.97] transition-all"
        >
          <Check size={12} strokeWidth={2.5} /> ອະນຸມັດ
        </button>
      )}
    </div>
  );
}

function SurveyList({ surveys, onDelete }: { surveys: any[]; onDelete?: (id: any) => void }) {
  if (!surveys.length) {
    return (
      <div className="py-12 text-center text-slate-400">
        <MapPin size={32} className="mx-auto mb-2 text-slate-300" />
        <span className="text-xs font-semibold">ຍັງບໍ່ໄດ້ສຳຫຼວດ</span>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {surveys.map((s, i) => {
        const d = s.data || {};
        const meas = Array.isArray(d.measurements) ? d.measurements : [];
        const mats = Array.isArray(d.materials) ? d.materials : [];
        const photos = Array.isArray(d.photos) ? d.photos : [];
        const c = d.checklist || {};
        return (
          <div key={s.id ?? i} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:shadow-sm transition-shadow">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <span className="font-extrabold text-slate-900 text-sm">
                  {(s.survey_date ?? "").toString().slice(0, 10) || "-"}
                </span>
                {s.surveyor && (
                  <span className="rounded-lg bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
                    ໂດຍ: {s.surveyor}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {d.condition && <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200/60 rounded-md px-2 py-0.5 font-semibold">ສະພາບ: {d.condition}</span>}
                {onDelete && (
                  <button
                    onClick={() => onDelete(s.id)}
                    title="ລົບ"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            {meas.length > 0 && (
              <div className="mb-3.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">ຜົນການວັດແທກ</div>
                <div className="flex flex-wrap gap-2">
                  {meas.map((m: any, j: number) => (
                    <span key={j} className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1 text-xs text-slate-700 shadow-2xs">
                      {m.label}: <b className="font-bold text-blue-600">{m.value}</b> {m.unit}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {mats.length > 0 && (
              <div className="mb-3.5 rounded-xl bg-slate-50 p-3 border border-slate-100">
                <span className="font-bold text-xs text-slate-700 block mb-1.5">ວັດສະດຸເບື້ອງຕົ້ນ:</span>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                  {mats.map((m: any, j: number) => (
                    <span key={j} className="inline-flex items-center gap-1.5 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                      {m.item} ({m.qty} {m.unit || "ໜ່ວຍ"})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(c.power || c.wallType || c.access || c.obstacles) && (
              <div className="mb-3.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">ລາຍການກວດສອບໜ້າງານ</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {c.power && <div className="rounded-xl bg-slate-50/40 border border-slate-200/50 p-2.5 text-xs"><span className="text-slate-400 block text-[10px] font-semibold">ໄຟຟ້າ:</span><span className="font-bold text-slate-700">{c.power}</span></div>}
                  {c.wallType && <div className="rounded-xl bg-slate-50/40 border border-slate-200/50 p-2.5 text-xs"><span className="text-slate-400 block text-[10px] font-semibold">ຝາ/ເພດານ:</span><span className="font-bold text-slate-700">{c.wallType}</span></div>}
                  {c.access && <div className="rounded-xl bg-slate-50/40 border border-slate-200/50 p-2.5 text-xs"><span className="text-slate-400 block text-[10px] font-semibold">ທາງເຂົ້າ:</span><span className="font-bold text-slate-700">{c.access}</span></div>}
                  {c.obstacles && <div className="rounded-xl bg-slate-50/40 border border-slate-200/50 p-2.5 text-xs"><span className="text-slate-400 block text-[10px] font-semibold">ອຸປະສັກ:</span><span className="font-bold text-slate-700">{c.obstacles}</span></div>}
                </div>
              </div>
            )}

            {photos.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">ຮູບພາບໜ້າງານ</div>
                <div className="flex flex-wrap gap-2">
                  {photos.map((url: string, j: number) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={j} src={url} alt="" className="h-16 w-16 rounded-xl object-cover ring-1 ring-slate-200 transition-all duration-300 hover:scale-105 hover:ring-blue-400 hover:shadow-md cursor-zoom-in" />
                  ))}
                </div>
              </div>
            )}

            {s.findings && (
              <div className="mt-3 rounded-xl border border-blue-100/80 bg-blue-50/20 p-3 text-xs text-slate-700 leading-relaxed font-medium">
                <span className="font-bold text-blue-800 block mb-0.5">ຂໍ້ສັງເກດເພີ່ມເຕີມ:</span>
                {s.findings}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 text-sm transition-colors hover:bg-slate-50/50 px-2 rounded-lg">
      <dt className="font-bold text-slate-500">{label}</dt>
      <dd className="text-right font-extrabold text-slate-900">{value || "-"}</dd>
    </div>
  );
}

/** Info row inside the ink identity card (left rail). */
function InkRow({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-white/10 text-blue-400">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
        <div className={`font-bold text-white break-words ${mono ? "font-mono" : ""}`}>{value}</div>
      </div>
    </div>
  );
}

function CustomStageStepper({ stages }: { stages: Stage[] }) {
  const stageDefs = [
    { key: "register", label: "ລົງທະບຽນ", icon: <ClipboardList size={13} strokeWidth={2.5} /> },
    { key: "survey", label: "ສຳຫຼວດ", icon: <MapPin size={13} strokeWidth={2.5} /> },
    { key: "quotation", label: "ສະເໜີລາຄາ", icon: <FileText size={13} strokeWidth={2.5} /> },
    { key: "contract", label: "ສັນຍາ", icon: <FileSignature size={13} strokeWidth={2.5} /> },
    { key: "boq", label: "BOQ", icon: <ListChecks size={13} strokeWidth={2.5} /> },
    { key: "taskplan", label: "ກຳນົດໜ້າວຽກ", icon: <CalendarRange size={13} strokeWidth={2.5} /> },
    { key: "workorder", label: "ໃບງານ", icon: <Wrench size={13} strokeWidth={2.5} /> },
  ];

  return (
    <ol className="select-none">
      {stages.map((stage, i) => {
        const def = stageDefs.find((d) => d.key === stage.key) || stageDefs[0];
        const isLast = i === stages.length - 1;

        const isDone = stage.state === "done";
        const isCurrent = stage.state === "current";
        const isNa = stage.state === "na";

        let circleCls = "";
        let labelCls = "";
        if (isDone) {
          circleCls = "border-emerald-500 bg-emerald-500 text-white";
          labelCls = "text-emerald-700 font-bold";
        } else if (isCurrent) {
          circleCls = "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/25";
          labelCls = "text-blue-700 font-black";
        } else if (isNa) {
          circleCls = "border-dashed border-slate-200 bg-white text-slate-300";
          labelCls = "text-slate-400 font-medium";
        } else {
          circleCls = "border-slate-200 bg-white text-slate-400";
          labelCls = "text-slate-500 font-semibold";
        }

        const lineBg = isDone ? "bg-emerald-400" : "bg-slate-200";

        return (
          <li key={stage.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border-2 transition-all ${circleCls}`}>
                {isCurrent && <span className="absolute inset-0 rounded-lg bg-blue-500/25 animate-ping" />}
                {isDone ? <Check size={14} strokeWidth={3} className="relative z-10" /> : <span className="relative z-10">{def.icon}</span>}
              </div>
              {!isLast && <div className={`my-1 w-[2px] flex-1 min-h-[14px] rounded-full ${lineBg}`} />}
            </div>
            <div className="pb-4">
              <div className={`text-[12px] leading-tight ${labelCls}`}>{stage.label}</div>
              {stage.detail && <div className="mt-0.5 text-[10px] leading-tight text-slate-400">{stage.detail}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
