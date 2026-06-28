"use client";

/** v2 project pipeline — real data; stepper + current stage + tabs. */
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  Wallet,
} from "lucide-react";
import { Pill } from "../../_components/ui";
import { getProjectsBoq, deleteProjectAction, advanceProjectStage, deleteProjectContract } from "@/_actions/projects";
import { getProjectTimeline, type ProjectTimeline } from "@/_actions/project-timeline";
import { deleteBoq as deleteLegacyBoq, approveBoq } from "@/_actions/boq";
import { getQuotations, approveQuotation, deleteQuotation } from "@/_actions/quotations";
import { getSurveys, deleteSurvey } from "@/_actions/survey";
import { getContracts, setContractApproval, deleteContract } from "@/_actions/contracts";
import { getProjectMaterials } from "@/_actions/boq-v2";
import { getProjectTasks, deleteTaskPlan } from "@/_actions/tasks-v2";
import { getWorkOrders, deleteWorkOrder } from "@/_actions/workorder";
import { getRequests } from "@/_actions/request-v2";
import { getProjectSmlFinance } from "@/_actions/sml-finance";
import { computeStages, StatusBadge, type Stage } from "@/_components/pipeline";
import { useConfirm } from "../../_components/Confirm";
import { getV2User, type V2User } from "../../../_lib/session";
import { isManager, isAdmin, can } from "@/_lib/permissions";
import { useT } from "@/_lib/i18n";
import {
  getProjectInstall,
  requestProjectPause,
  reviewProjectPause,
  approveProjectPause,
  rejectProjectPause,
  resumeProject,
  type InstallRow,
} from "@/_actions/install-tracking";

type TabKey = "overview" | "survey" | "quotations" | "contracts" | "boq" | "tasks" | "workorders" | "materials" | "requests" | "finance";

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
  finance: <Wallet size={14} />,
};

/** v2 pipeline stage order (mirrors advanceProjectStage on the server). */
const V2_STAGES = ["ລົງທະບຽນ", "ສຳຫຼວດ", "ສະເໜີລາຄາ", "ສັນຍາ", "BOQ", "ກຳນົດໜ້າວຽກ", "ໃບງານ", "ປິດໂຄງການ"];

const fmtDay = (v?: string | null) => (v ? new Date(v).toLocaleDateString("en-GB") : "—");
/** Human duration in days: "12 ມື້" / "1 ປີ 2 ເດືອນ 3 ມື້". */
function durationLabel(days?: number | null): string {
  if (days == null) return "—";
  if (days <= 0) return "ມື້ດຽວ";
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const rest = (days % 365) % 30;
  return [years && `${years} ປີ`, months && `${months} ເດືອນ`, rest && `${rest} ມື້`].filter(Boolean).join(" ") || `${days} ມື້`;
}

export default function V2PipelinePage() {
  const { id } = useParams();
  const router = useRouter();
  const confirm = useConfirm();
  const t = useT();
  const [project, setProject] = useState<any>(null);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [surveys, setSurveys] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [workorders, setWorkorders] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [sml, setSml] = useState<any>(null);
  const [smlLoading, setSmlLoading] = useState(false);
  const [timeline, setTimeline] = useState<ProjectTimeline | null>(null);
  const [install, setInstall] = useState<InstallRow | null>(null);
  const [me, setMe] = useState<V2User | null>(null);
  const [loadError, setLoadError] = useState("");
  // Permission gates — hide edit/delete controls the user isn't allowed to use.
  const canEditProject = can(me, "projects", "edit");
  const canDeleteProject = can(me, "projects", "delete");
  const canDeleteQuotation = can(me, "quotations", "delete");
  const canDeleteContract = can(me, "contracts", "delete");
  const canDeleteBoq = can(me, "boq", "delete");
  const canDeleteWO = can(me, "work-orders", "delete");
  const canDeleteSurvey = can(me, "projects", "delete");
  const canEditTaskPlan = can(me, "schedule", "edit");
  const canDeleteTaskPlan = can(me, "schedule", "delete");
  const [loading, setLoading] = useState(true);
  const tabParam = useSearchParams().get("tab") as TabKey | null;
  const [tab, setTab] = useState<TabKey>(tabParam || "overview");
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selectTab = async (key: TabKey) => {
    setTab(key);
    if (key === "materials") {
      const result: any = await getProjectMaterials(String(id));
      if (result?.success) setMaterials(result.data || []);
    } else if (key === "finance" && !sml && !smlLoading) {
      setSmlLoading(true);
      try {
        const result: any = await getProjectSmlFinance(String(id));
        setSml(result?.success ? result : { error: result?.message || t("common.error", "ໂຫຼດບໍ່ສຳເລັດ") });
      } finally {
        setSmlLoading(false);
      }
    }
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

  // Re-fetch all project data. Called on mount and after mutations (approve /
  // pause / etc.) instead of a full window reload — keeps tab/scroll state.
  const reload = useCallback(async () => {
    try {
      const [pRes, qRes, sRes, cRes, tRes, woRes, mRes, rqRes, tlRes]: any = await Promise.all([
        getProjectsBoq({ projectId: String(id) }),
        getQuotations({ projectId: String(id) }),
        getSurveys(String(id)),
        getContracts({ projectId: String(id) }),
        getProjectTasks({ projectId: String(id) }),
        getWorkOrders({ projectId: String(id) }),
        getProjectMaterials(String(id)),
        getRequests({ projectId: String(id) }),
        getProjectTimeline(String(id)),
      ]);
      setTimeline(tlRes?.success ? tlRes.data : null);
      setMe(getV2User());
      getProjectInstall(String(id)).then((ir: any) => ir?.success && setInstall(ir.data));
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
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

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

  // Related documents attached to this project — shown in the delete dialog so
  // the user can see what will be removed/orphaned before confirming.
  const relatedDocs = useMemo(() => {
    const docLabel = (r: any) =>
      String(
        r?.doc_no ?? r?.boq_no ?? r?.contract_no ?? r?.quotation_no ?? r?.quo_no ??
        r?.wo_no ?? r?.code ?? r?.name ?? r?.title ?? r?.task_name ?? r?.id ?? ""
      ).trim() || "—";
    const groups = [
      { key: "contracts", label: t("projectDetail.docContracts", "ສັນຍາ"), rows: allContracts as any[] },
      { key: "boqs", label: "BOQ", rows: allBoqs as any[] },
      { key: "quotations", label: t("projectDetail.docQuotations", "ໃບສະເໜີລາຄາ"), rows: quotations as any[] },
      { key: "surveys", label: t("projectDetail.docSurveys", "ການສຳຫຼວດ"), rows: surveys as any[] },
      { key: "requests", label: t("projectDetail.docRequests", "ໃບເບີກວັດສະດຸ"), rows: requests as any[] },
      { key: "workorders", label: t("projectDetail.docWorkOrders", "ໃບສັ່ງງານ"), rows: workorders as any[] },
      { key: "tasks", label: t("projectDetail.docTasks", "ແຜນງານ/ງານ"), rows: tasks as any[] },
    ];
    return groups
      .map((g) => {
        const rows = Array.isArray(g.rows) ? g.rows : [];
        return { key: g.key, label: g.label, count: rows.length, samples: rows.slice(0, 4).map(docLabel) };
      })
      .filter((g) => g.count > 0);
  }, [allContracts, allBoqs, quotations, surveys, requests, workorders, tasks, t]);
  const relatedTotal = useMemo(() => relatedDocs.reduce((s, g) => s + g.count, 0), [relatedDocs]);

  const stages: Stage[] = useMemo(
    () => (project ? computeStages(project, quotations, allContracts, surveys, allBoqs, tasks, workorders) : []),
    [project, quotations, allContracts, surveys, allBoqs, tasks, workorders]
  );
  const current = stages.find((s) => s.state === "current");
  const hasActiveQuo = quotations.some((q: any) => (q.status || "") !== "ປະຕິເສດ");
  const hasAnyContract = allContracts.length > 0;


  const setQuoStatus = async (qid: any, status: string) => {
    const reject = status === "ປະຕິເສດ";
    if (!(await confirm({ title: reject ? t("projectDetail.confirmRejectTitle", "ຢືນຢັນການປະຕິເສດ") : t("projectDetail.confirmApproveTitle", "ຢືນຢັນການອະນຸມັດ"), message: `${reject ? t("common.reject", "ປະຕິເສດ") : t("common.approve", "ອະນຸມັດ")} ${t("projectDetail.quotationWord", "ໃບສະເໜີລາຄາ")}?`, confirmLabel: reject ? t("common.reject", "ປະຕິເສດ") : t("common.approve", "ອະນຸມັດ"), tone: reject ? "danger" : "primary" }))) return;
    const res: any = await approveQuotation(String(qid), status);
    if (res?.success) {
      if (status === "ອະນຸມັດແລ້ວ") advanceProjectStage(String(id), "ສະເໜີລາຄາ").catch(() => {});
      reload();
    } else {
      alert(res?.message || t("common.error", "ບໍ່ສຳເລັດ"));
    }
  };

  const setContractStep = async (cid: any, which: "sales" | "accounting", approved: boolean) => {
    let approver = "";
    try {
      approver = JSON.parse(localStorage.getItem("v2_user") || "{}").name || "";
    } catch {
      /* ignore */
    }
    if (approved && !(await confirm({ title: t("projectDetail.confirmApproveTitle", "ຢືນຢັນການອະນຸມັດ"), message: which === "sales" ? t("projectDetail.approveContractSales", "ອະນຸມັດສັນຍາ (ຝ່າຍຂາຍ)?") : t("projectDetail.approveContractAccounting", "ອະນຸມັດສັນຍາ (ຝ່າຍບັນຊີ)?"), confirmLabel: t("common.approve", "ອະນຸມັດ") }))) return;
    const res: any = await setContractApproval(String(cid), which, approved, approver);
    if (res?.success) {
      reload();
    } else {
      alert(res?.message || t("common.error", "ບໍ່ສຳເລັດ"));
    }
  };

  const setBoqStep = async (docNo: any, status: string) => {
    const reject = status === "ປະຕິເສດ";
    if (!(await confirm({ title: reject ? t("projectDetail.confirmRejectTitle", "ຢືນຢັນການປະຕິເສດ") : t("projectDetail.confirmApproveTitle", "ຢືນຢັນການອະນຸມັດ"), message: `${reject ? t("common.reject", "ປະຕິເສດ") : t("common.approve", "ອະນຸມັດ")} BOQ ${docNo}?`, confirmLabel: reject ? t("common.reject", "ປະຕິເສດ") : t("common.approve", "ອະນຸມັດ"), tone: reject ? "danger" : "primary" }))) return;
    let user: any = {};
    try { user = JSON.parse(localStorage.getItem("v2_user") || "{}"); } catch { /* ignore */ }
    const statusNum = status === "ອະນຸມັດແລ້ວ" ? 1 : status === "ປະຕິເສດ" ? 2 : 0;
    const res: any = await approveBoq(String(docNo), { status: statusNum, username: user.username || "" });
    if (res?.success) {
      if (status === "ອະນຸມັດແລ້ວ") advanceProjectStage(String(id), "BOQ").catch(() => {});
      reload();
    } else {
      alert(res?.message || t("common.error", "ບໍ່ສຳເລັດ"));
    }
  };

  const removeDoc = async (label: string, action: () => Promise<any>, ok: () => void) => {
    if (!window.confirm(`${t("projectDetail.deletePrefix", "ລົບ")}${label}${t("projectDetail.deleteSuffix", "ນີ້? ກູ້ຄືນບໍ່ໄດ້.")}`)) return;
    const r: any = await action();
    if (r?.success) ok();
    else alert(r?.message || t("projectDetail.deleteFailed", "ລົບບໍ່ສຳເລັດ"));
  };
  const delQuotation = (qid: any) => removeDoc(t("projectDetail.quotationShort", "ໃບສະເໜີ"), () => deleteQuotation(String(qid)), () => setQuotations((a) => a.filter((x) => x.id !== qid)));
  const delContract = (c: any) =>
    c?.src === "erp"
      ? removeDoc(t("projectDetail.docContracts", "ສັນຍາ"), () => deleteProjectContract(String(c.project_id), String(c.contract_no)), () =>
          setProject((p: any) => (p ? { ...p, contractlist: (p.contractlist || []).filter((x: any) => x.contract_no !== c.contract_no) } : p))
        )
      : removeDoc(t("projectDetail.docContracts", "ສັນຍາ"), () => deleteContract(String(c.id)), () => setContracts((a) => a.filter((x) => x.id !== c.id)));
  const delBoq = (b: any) =>
    removeDoc("BOQ", () => deleteLegacyBoq(String(b.doc_no || b.boq_no)), () =>
      setProject((p: any) =>
        p
          ? { ...p, contractlist: (p.contractlist || []).map((c: any) => ({ ...c, boq_list: (c.boq_list || []).filter((x: any) => (x.doc_no || x.boq_no) !== (b.doc_no || b.boq_no)) })) }
          : p
      )
    );
  const delWO = (wid: any) => removeDoc(t("projectDetail.workOrderWord", "ໃບງານ"), () => deleteWorkOrder(String(wid)), () => setWorkorders((a) => a.filter((x) => x.id !== wid)));
  const delSurvey = (sid: any) => removeDoc(t("projectDetail.surveyWord", "ສຳຫຼວດ"), () => deleteSurvey(String(sid)), () => setSurveys((a) => a.filter((x) => x.id !== sid)));
  const delTaskPlan = () => removeDoc(t("projectDetail.taskPlanWord", "ແຜນວຽກ"), () => deleteTaskPlan(String(id)), () => setTasks([]));

  const stageAction: Partial<Record<string, { label: string; href: string }>> = {
    survey: { label: t("projectDetail.ctaRecordSurvey", "ບັນທຶກສຳຫຼວດ"), href: `/projects/${id}/survey/new` },
    quotation: { label: t("projectDetail.ctaCreateQuotation", "ສ້າງໃບສະເໜີລາຄາ"), href: `/projects/${id}/quotation/new` },
    contract: { label: t("projectDetail.ctaCreateContract", "ສ້າງສັນຍາ"), href: `/projects/${id}/contract/new` },
    boq: { label: t("projectDetail.ctaCreateBoq", "ສ້າງ BOQ"), href: `/projects/${id}/boq/new` },
    // ກຳນົດໜ້າວຽກ ສ້າງເອງບໍ່ໄດ້ — ໜ້າວຽກມາດຕະຖານຖືກສ້າງອັດຕະໂນມັດເມື່ອ BOQ ອະນຸມັດ.
    workorder: { label: t("projectDetail.ctaIssueWorkOrder", "ອອກໃບງານ"), href: `/projects/${id}/workorder/new` },
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-3 text-[var(--theme-text-mute)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--theme-border-subtle)] border-t-[var(--theme-primary)]" />
        <span className="text-sm font-semibold">{t("common.loading", "ກຳລັງໂຫຼດ...")}</span>
      </div>
    );
  }
  if (!project) {
    return (
      <div className="w-full px-4 md:px-6 py-10 text-center text-[var(--theme-text-mute)]">
        {t("projectDetail.notFound", "ບໍ່ພົບໂຄງການ")}
        <div className="mt-3">
          <button onClick={() => router.push("/projects")} className="text-[var(--theme-primary)] hover:underline">
            ← {t("projectDetail.backToList", "ກັບໄປລາຍການ")}
          </button>
        </div>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; n?: number }[] = [
    { key: "overview", label: t("projectDetail.tabOverview", "ພາບລວມ") },
    { key: "survey", label: t("projectDetail.tabSurvey", "ສຳຫຼວດ"), n: surveys.length },
    { key: "quotations", label: t("projectDetail.tabQuotations", "ໃບສະເໜີ"), n: quotations.length },
    { key: "contracts", label: t("projectDetail.tabContracts", "ສັນຍາ"), n: allContracts.length },
    { key: "boq", label: "BOQ", n: allBoqs.length },
    { key: "tasks", label: t("projectDetail.tabTasks", "ໜ້າວຽກ"), n: tasks.length },
    { key: "workorders", label: t("projectDetail.tabWorkOrders", "ໃບງານ"), n: workorders.length },
    { key: "materials", label: t("projectDetail.tabMaterials", "ລວມວັດສະດຸ"), n: materials.length },
    { key: "requests", label: t("projectDetail.tabRequests", "ຂໍເບີກ"), n: requests.length },
    { key: "finance", label: t("projectDetail.tabFinance", "ການເງິນ SML") },
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
        <span>{t("projectDetail.backToProjectList", "ກັບໄປລາຍການໂຄງການ")}</span>
      </button>

      {loadError && (
        <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-xs font-bold text-rose-700 flex items-center gap-2.5">
          <AlertTriangle size={15} />
          <span>{t("projectDetail.partialLoadError", "ໂຫຼດຂໍ້ມູນບາງສ່ວນບໍ່ສຳເລັດ")}: {loadError}</span>
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
                {project.project_name || t("projectDetail.noName", "(ບໍ່ມີຊື່)")}
              </h1>

              <div className="mt-4 space-y-2.5 border-t border-white/10 pt-4 text-[12px]">
                <InkRow icon={<User size={13} />} label={t("projectDetail.customerCode", "ລະຫັດລູກຄ້າ")} value={project.sml_code} mono />
                <InkRow icon={<User size={13} />} label={t("projectDetail.coordinator", "ຜູ້ປະສານ")} value={project.coordinator} />
                <InkRow icon={<Phone size={13} />} label={t("common.phone", "ໂທ")} value={project.phone} />
                <InkRow
                  icon={<MapPin size={13} />}
                  label={t("projectDetail.location", "ສະຖານທີ່")}
                  value={[project.village_name, project.district_name, project.province_name].filter(Boolean).join(" · ")}
                />
              </div>

              {(canEditProject || canDeleteProject) && (
                <div className="mt-4 flex gap-2 border-t border-white/10 pt-4">
                  {canEditProject && (
                    <button
                      onClick={() => router.push(`/projects/${id}/edit`)}
                      className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 text-xs font-bold text-white transition hover:bg-white/15 active:scale-[0.98]"
                    >
                      <Pencil size={13} /> {t("common.edit", "ແກ້ໄຂ")}
                    </button>
                  )}
                  {canDeleteProject && (
                    <button
                      onClick={() => setConfirmDel(true)}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-white/5 px-3 text-xs font-bold text-rose-300 transition hover:bg-rose-500/20 hover:text-rose-200 active:scale-[0.98]"
                    >
                      <Trash2 size={13} /> {t("common.delete", "ລຶບ")}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Stage progress + current-stage CTA */}
          <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-xs">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-4 w-1 rounded bg-blue-600" />
              <h2 className="text-[13px] font-black text-slate-900">{t("projectDetail.projectStages", "ຂັ້ນຕອນໂຄງການ")}</h2>
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
            <div className="space-y-5">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                <Row label={t("projectDetail.rowProjectName", "ຊື່ໂຄງການ")} value={project.project_name} />
                <Row label={t("common.status", "ສະຖານະ")} value={project.project_status} />
                <Row label={t("projectDetail.customerCode", "ລະຫັດລູກຄ້າ")} value={project.sml_code} />
                <Row label={t("projectDetail.coordinator", "ຜູ້ປະສານ")} value={project.coordinator} />
                <Row label={t("common.phone", "ໂທ")} value={project.phone} />
                <Row label={t("projectDetail.province", "ແຂວງ")} value={project.province_name} />
                <Row label={t("projectDetail.district", "ເມືອງ")} value={project.district_name} />
                <Row label={t("projectDetail.village", "ບ້ານ")} value={project.village_name} />
                <Row label={t("projectDetail.contractCount", "ຈຳນວນສັນຍາ")} value={String(allContracts.length)} />
                <Row label={t("projectDetail.boqCount", "ຈຳນວນ BOQ")} value={String(allBoqs.length)} />
                <Row label={t("projectDetail.installStarted", "ເລີ່ມຕິດຕັ້ງ")} value={fmtDay(timeline?.installStartedAt)} />
                <Row label={t("projectDetail.endClosed", "ສິ້ນສຸດ / ປິດໂຄງການ")} value={timeline?.closedAt ? fmtDay(timeline.closedAt) : timeline?.ongoing ? t("projectDetail.stillOngoing", "ຍັງດຳເນີນຢູ່") : "—"} />
                <Row
                  label={t("projectDetail.projectDuration", "ໄລຍະເວລາໂຄງການ")}
                  value={
                    timeline?.installStartedAt
                      ? `${durationLabel(timeline.durationDays)}${timeline.ongoing ? ` ${t("projectDetail.untilNow", "(ຮອດປັດຈຸບັນ)")}` : ""}`
                      : t("projectDetail.notStartedInstall", "ຍັງບໍ່ເລີ່ມຕິດຕັ້ງ")
                  }
                />
                <Row label={t("projectDetail.workHours", "ຊົ່ວໂມງເຮັດງານ")} value={install ? `${install.worked_hours.toFixed(1)} ${t("overview.hoursUnit", "ຊມ")}` : "—"} />
              </dl>
              {install && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-[12px] font-black text-slate-900">{t("projectDetail.installPauseStatus", "ສະຖານະການຕິດຕັ້ງ / ການພັກ")}</h3>
                    {install.paused
                      ? <Pill tone="red">{t("overview.pausedFor", "ພັກ")} {install.current_pause_days} {t("overview.daysUnit", "ມື້")} ({t("projectDetail.since", "ຕັ້ງແຕ່")} {fmtDay(install.paused_since)})</Pill>
                      : <Pill tone="green">{t("overview.installActive", "ກຳລັງດຳເນີນ")}</Pill>}
                  </div>
                  {install.total_pause_days > 0 && (
                    <p className="mb-3 text-[11.5px] text-slate-500">{t("projectDetail.totalPaused", "ເຄີຍພັກລວມ")} {install.total_pause_days} {t("overview.daysUnit", "ມື້")}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {install.paused && isManager(me) && (
                      <button onClick={async () => { if (await confirm({ title: t("projectDetail.resumeTitle", "ກັບມາດຳເນີນ"), message: t("projectDetail.resumeMsg", "ຍົກເລີກການພັກ ແລະ ກັບໄປຕິດຕັ້ງ?"), confirmLabel: t("projectDetail.resumeTitle", "ກັບມາດຳເນີນ") })) { const r: any = await resumeProject(String(id)); if (r?.success) reload(); else alert(r?.message); } }} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11.5px] font-bold text-emerald-700 hover:bg-emerald-100">{t("projectDetail.resumeTitle", "ກັບມາດຳເນີນ")}</button>
                    )}
                    {!install.paused && !install.req_id && (
                      <button onClick={async () => { const reason = window.prompt(t("projectDetail.pauseReasonPrompt", "ເຫດຜົນທີ່ຂໍພັກໂຄງການ:"), ""); if (reason == null) return; const r: any = await requestProjectPause(String(id), reason); if (r?.success) reload(); else alert(r?.message); }} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11.5px] font-bold text-slate-600 hover:bg-slate-50">{t("projectDetail.requestPause", "ຮ້ອງຂໍພັກ")}</button>
                    )}
                    {install.req_status === "requested" && (isManager(me) ? (
                      <>
                        <span className="text-[11.5px] font-semibold text-slate-500 self-center">{t("projectDetail.pauseRequest", "ຄຳຮ້ອງພັກ")}{install.req_reason ? `: ${install.req_reason}` : ""} —</span>
                        <button onClick={async () => { if (await confirm({ title: t("projectDetail.reviewPauseTitle", "ກວດສອບຄຳຮ້ອງພັກ"), message: t("projectDetail.reviewPauseMsg", "ກວດສອບຜ່ານ?"), confirmLabel: t("projectDetail.pass", "ຜ່ານ") })) { const r: any = await reviewProjectPause(install.req_id!, true); if (r?.success) reload(); else alert(r?.message); } }} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11.5px] font-bold text-blue-700 hover:bg-blue-100">{t("projectDetail.reviewPass", "ກວດສອບຜ່ານ")}</button>
                        <button onClick={async () => { if (await confirm({ title: t("common.reject", "ປະຕິເສດ"), message: t("projectDetail.rejectPauseMsg", "ປະຕິເສດ ຄຳຮ້ອງພັກ?"), confirmLabel: t("common.reject", "ປະຕິເສດ"), tone: "danger" })) { const r: any = await rejectProjectPause(install.req_id!); if (r?.success) reload(); else alert(r?.message); } }} className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-[11.5px] font-bold text-rose-600 hover:bg-rose-50">{t("common.reject", "ປະຕິເສດ")}</button>
                      </>
                    ) : <span className="text-[11.5px] font-semibold text-amber-600">{t("projectDetail.waitManagerReview", "ລໍຖ້າຜູ້ຈັດການກວດສອບຄຳຮ້ອງພັກ")}</span>)}
                    {install.req_status === "manager_ok" && (isAdmin(me) ? (
                      <>
                        <span className="text-[11.5px] font-semibold text-slate-500 self-center">{t("projectDetail.reviewed", "ກວດສອບແລ້ວ")} —</span>
                        <button onClick={async () => { if (await confirm({ title: t("projectDetail.approvePauseTitle", "ອະນຸມັດ ພັກໂຄງການ"), message: t("projectDetail.approvePauseMsg", "ອະນຸມັດ ໃຫ້ພັກໂຄງການ?"), confirmLabel: t("common.approve", "ອະນຸມັດ") })) { const r: any = await approveProjectPause(install.req_id!); if (r?.success) reload(); else alert(r?.message); } }} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11.5px] font-bold text-rose-700 hover:bg-rose-100">{t("projectDetail.approvePause", "ອະນຸມັດພັກ")}</button>
                        <button onClick={async () => { if (await confirm({ title: t("common.reject", "ປະຕິເສດ"), message: t("projectDetail.rejectPauseMsg", "ປະຕິເສດ ຄຳຮ້ອງພັກ?"), confirmLabel: t("common.reject", "ປະຕິເສດ"), tone: "danger" })) { const r: any = await rejectProjectPause(install.req_id!); if (r?.success) reload(); else alert(r?.message); } }} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11.5px] font-bold text-slate-500 hover:bg-slate-50">{t("common.reject", "ປະຕິເສດ")}</button>
                      </>
                    ) : <span className="text-[11.5px] font-semibold text-amber-600">{t("projectDetail.waitAdminApprove", "ລໍຖ້າຜູ້ດູແລລະບົບອະນຸມັດ")}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}
          {tab === "survey" && (
            <div>
              <div className="mb-4 flex justify-end">
                <button
                  onClick={() => router.push(`/projects/${id}/survey/new`)}
                  className={addBtn}
                >
                  <Plus size={14} strokeWidth={2.5} /> {t("projectDetail.addSurvey", "ເພີ່ມການສຳຫຼວດ")}
                </button>
              </div>
              <SurveyList surveys={surveys} onDelete={canDeleteSurvey ? delSurvey : undefined} />
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
                    <Plus size={14} strokeWidth={2.5} /> {t("projectDetail.createQuotationShort", "ສ້າງໃບສະເໜີ")}
                  </button>
                </div>
              )}
              <QuotationList quotations={quotations} onSetStatus={setQuoStatus} onDelete={canDeleteQuotation ? delQuotation : undefined} />
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
                    <Plus size={14} strokeWidth={2.5} /> {t("projectDetail.ctaCreateContract", "ສ້າງສັນຍາ")}
                  </button>
                </div>
              )}
              <ContractList contracts={allContracts} onApprove={setContractStep} onDelete={canDeleteContract ? delContract : undefined} />
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
                    <Plus size={14} strokeWidth={2.5} /> {t("projectDetail.ctaCreateBoq", "ສ້າງ BOQ")}
                  </button>
                </div>
              )}
              {!hasAnyContract && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700 flex items-center gap-2">
                  <AlertTriangle size={14} />
                  <span>{t("projectDetail.needContractFirst", "ຕ້ອງມີສັນຍາກ່ອນ ຈຶ່ງສ້າງ BOQ ໄດ້.")}</span>
                </div>
              )}
              <BoqList boqs={allBoqs} onSetStatus={setBoqStep} onDelete={canDeleteBoq ? delBoq : undefined} canApproveNext={isAdmin(me) || can(me, "boq", "approve_next")} />
            </div>
          )}
          {tab === "tasks" && (
            <div>
              {/* ໜ້າວຽກມາດຕະຖານຖືກສ້າງອັດຕະໂນມັດເມື່ອ BOQ ອະນຸມັດ — ບໍ່ມີປຸ່ມສ້າງ.
                  ເມື່ອມີແຜນແລ້ວ ຍັງສາມາດແກ້ໄຂ/ລຶບໄດ້. */}
              {hasAnyContract && tasks.length > 0 && (canDeleteTaskPlan || canEditTaskPlan) && (
                <div className="mb-4 flex justify-end gap-2">
                  {canDeleteTaskPlan && (
                    <button
                      onClick={delTaskPlan}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-4 text-xs font-bold text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 size={13} /> {t("projectDetail.deleteTaskPlan", "ລຶບແຜນວຽກ")}
                    </button>
                  )}
                  {canEditTaskPlan && (
                    <button
                      onClick={() => router.push(`/projects/${id}/tasks/new`)}
                      className={addBtn}
                    >
                      <Pencil size={14} strokeWidth={2.5} /> {t("projectDetail.editTaskPlan", "ແກ້ໄຂແຜນວຽກ")}
                    </button>
                  )}
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
                  <Plus size={14} strokeWidth={2.5} /> {t("projectDetail.ctaIssueWorkOrder", "ອອກໃບງານ")}
                </button>
              </div>
              <WorkOrderList workorders={workorders} onDelete={canDeleteWO ? delWO : undefined} />
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
                    <Plus size={14} strokeWidth={2.5} /> {t("projectDetail.requestMaterial", "ຂໍເບີກ")}
                  </button>
                </div>
              )}
              <RequestList requests={requests} />
            </div>
          )}
          {tab === "finance" && <SmlFinance loading={smlLoading} data={sml} />}
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[12vh] backdrop-blur-xs" onClick={() => !deleting && setConfirmDel(false)}>
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-100">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">{t("projectDetail.deleteProjectTitle", "ລຶບໂຄງການ?")}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                <span className="font-bold text-slate-800">{project.project_name}</span>{" "}
                {relatedTotal > 0
                  ? t("projectDetail.deleteWithDocs", "ມີເອກະສານກ່ຽວຂ້ອງຢູ່. ການລຶບຈະລົບເອກະສານລຸ່ມນີ້ທັງໝົດ ແລະ ບໍ່ສາມາດກູ້ຄືນໄດ້.")
                  : t("projectDetail.deletePermanent", "ຈະຖືກລຶບຖາວອນ ແລະ ບໍ່ສາມາດກູ້ຄືນໄດ້.")}
              </p>
            </div>
            {relatedTotal > 0 && (
              <div className="mx-5 mb-4 max-h-56 overflow-y-auto rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-left">
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-amber-700">
                  {t("projectDetail.relatedDocs", "ເອກະສານກ່ຽວຂ້ອງ")} ({relatedTotal})
                </div>
                <ul className="space-y-1.5">
                  {relatedDocs.map((g) => (
                    <li key={g.key} className="text-[11px] leading-relaxed">
                      <span className="font-bold text-slate-800">{g.label}</span>
                      <span className="ml-1 rounded-full bg-amber-200/70 px-1.5 py-0.5 text-[10px] font-black text-amber-800">{g.count}</span>
                      <span className="ml-1.5 text-slate-500">
                        {g.samples.join(", ")}{g.count > g.samples.length ? " …" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-2 border-t border-slate-100 bg-slate-50 p-3.5">
              <button onClick={() => setConfirmDel(false)} disabled={deleting} className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60">
                {t("common.cancel", "ຍົກເລີກ")}
              </button>
              <button onClick={doDelete} disabled={deleting} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-600 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60 shadow-md shadow-rose-600/15">
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {deleting ? t("projectDetail.deleting", "ກຳລັງລຶບ...") : t("projectDetail.confirmDelete", "ຢືນຢັນລຶບ")}
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

/** Project financial footprint pulled from SML/ERP (read-only). */
function SmlFinance({ loading, data }: { loading: boolean; data: any }) {
  const t = useT();
  if (loading || !data) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-xs font-semibold">{t("projectDetail.loadingSml", "ກຳລັງໂຫຼດຂໍ້ມູນ SML...")}</span>
      </div>
    );
  }
  if (data.error) {
    return <div className="py-10 text-center text-xs font-semibold text-rose-500">{data.error}</div>;
  }
  if (!data.linked) {
    return (
      <div className="py-12 text-center text-slate-400">
        <Wallet size={32} className="mx-auto mb-2 text-slate-300" />
        <p className="text-xs font-semibold">{t("projectDetail.noSmlBill", "ໂຄງການນີ້ຍັງບໍ່ໄດ້ອອກບິນຂາຍຢູ່ SML")}</p>
        {data.projectCode && <p className="mt-1 text-[11px] text-slate-400">{t("projectDetail.code", "ລະຫັດ")}: {data.projectCode}</p>}
      </div>
    );
  }
  const { bills, payments, expenses, totals, projectCode } = data;
  const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString("en-GB") : "—");
  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { label: t("projectDetail.billedValue", "ມູນຄ່າບິນຂາຍ"), value: totals.billed, tone: "text-blue-700 bg-blue-50 border-blue-100" },
          { label: t("projectDetail.outstanding", "ຍັງຄ້າງຊຳລະ"), value: totals.outstanding, tone: "text-amber-700 bg-amber-50 border-amber-100" },
          { label: t("projectDetail.paid", "ຮັບຊຳລະແລ້ວ"), value: totals.paid, tone: "text-emerald-700 bg-emerald-50 border-emerald-100" },
          { label: t("projectDetail.expenseCost", "ຄ່າໃຊ້ຈ່າຍ/ຕົ້ນທຶນ"), value: totals.expense, tone: "text-rose-700 bg-rose-50 border-rose-100" },
        ].map((c) => (
          <div key={c.label} className={`rounded-xl border px-3 py-2.5 ${c.tone}`}>
            <div className="text-[10px] font-bold uppercase tracking-wide opacity-70">{c.label}</div>
            <div className="mt-0.5 text-sm font-black tabular-nums">{fmtMoney(c.value)}</div>
          </div>
        ))}
      </div>
      <div className="text-[11px] font-semibold text-slate-400">{t("projectDetail.smlCode", "ລະຫັດ SML")}: <span className="font-mono text-slate-600">{projectCode}</span></div>

      <SmlSection title={t("projectDetail.billList", "ລາຍການບິນຂາຍ")} count={bills.length} empty={t("projectDetail.noBills", "ບໍ່ມີບິນຂາຍ")}>
        <table className="min-w-full text-xs">
          <thead><tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <th className="px-3 py-2 text-left">{t("projectDetail.docNo", "ເລກທີ່")}</th><th className="px-3 py-2 text-left">{t("common.date", "ວັນທີ")}</th><th className="px-3 py-2 text-left">{t("projectDetail.type", "ປະເພດ")}</th><th className="px-3 py-2 text-left">{t("common.customer", "ລູກຄ້າ")}</th><th className="px-3 py-2 text-right">{t("projectDetail.value", "ມູນຄ່າ")}</th><th className="px-3 py-2 text-right">{t("projectDetail.due", "ຄ້າງ")}</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {bills.map((b: any, i: number) => (
              <tr key={b.doc_no || i} className="hover:bg-slate-50/50">
                <td className="px-3 py-2 font-mono font-bold text-slate-700">{b.doc_no}</td>
                <td className="px-3 py-2 text-slate-500">{fmtDate(b.doc_date)}</td>
                <td className="px-3 py-2 text-slate-500">{b.doc_kind}</td>
                <td className="px-3 py-2 text-slate-500">{b.cust_code || "—"}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-700">{fmtMoney(b.total_amount)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-amber-600">{b.balance_amount ? fmtMoney(b.balance_amount) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SmlSection>

      <SmlSection title={t("projectDetail.paymentList", "ລາຍການຊຳລະ")} count={payments.length} empty={t("projectDetail.noPayments", "ບໍ່ມີລາຍການຊຳລະ (ໜີ້ AR)")}>
        <table className="min-w-full text-xs">
          <thead><tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <th className="px-3 py-2 text-left">{t("projectDetail.docNo", "ເລກທີ່")}</th><th className="px-3 py-2 text-left">{t("common.date", "ວັນທີ")}</th><th className="px-3 py-2 text-left">{t("projectDetail.method", "ວິທີ")}</th><th className="px-3 py-2 text-right">{t("projectDetail.value", "ມູນຄ່າ")}</th><th className="px-3 py-2 text-right">{t("projectDetail.paidCol", "ຊຳລະ")}</th><th className="px-3 py-2 text-right">{t("projectDetail.debtBalance", "ຍອດໜີ້")}</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {payments.map((p: any, i: number) => (
              <tr key={p.doc_no || i} className="hover:bg-slate-50/50">
                <td className="px-3 py-2 font-mono font-bold text-slate-700">{p.doc_no}</td>
                <td className="px-3 py-2 text-slate-500">{fmtDate(p.doc_date)}</td>
                <td className="px-3 py-2 text-slate-500">{p.payment_method || "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">{fmtMoney(p.amount)}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-emerald-600">{fmtMoney(p.total_pay_money)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-amber-600">{fmtMoney(p.total_debt_balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SmlSection>

      <SmlSection title={t("projectDetail.expenseList", "ຄ່າໃຊ້ຈ່າຍ / ຕົ້ນທຶນ (ບັນຊີ)")} count={expenses.length} empty={t("projectDetail.noExpenses", "ບໍ່ມີຄ່າໃຊ້ຈ່າຍ")}>
        <table className="min-w-full text-xs">
          <thead><tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <th className="px-3 py-2 text-left">{t("projectDetail.accountCode", "ລະຫັດບັນຊີ")}</th><th className="px-3 py-2 text-left">{t("projectDetail.accountName", "ຊື່ບັນຊີ")}</th><th className="px-3 py-2 text-right">{t("projectDetail.value", "ມູນຄ່າ")}</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {expenses.map((e: any, i: number) => (
              <tr key={e.account_code || i} className="hover:bg-slate-50/50">
                <td className="px-3 py-2 font-mono text-slate-600">{e.account_code}</td>
                <td className="px-3 py-2 text-slate-700">{e.account_name}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-rose-600">{fmtMoney(e.debit - e.credit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SmlSection>
    </div>
  );
}

function SmlSection({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-2">
        <span className="h-3.5 w-1 rounded bg-blue-600" />
        <h3 className="text-[12px] font-black text-slate-800">{title}</h3>
        <span className="rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-black text-slate-600">{count}</span>
      </div>
      {count > 0 ? <div className="overflow-x-auto">{children}</div> : <div className="px-3 py-6 text-center text-[11px] font-semibold text-slate-400">{empty}</div>}
    </div>
  );
}

function QuotationList({
  quotations,
  onSetStatus,
  onDelete,
}: {
  quotations: any[];
  onSetStatus: (id: any, status: string) => void;
  onDelete?: (id: any) => void;
}) {
  const t = useT();
  if (!quotations.length) {
    return (
      <div className="py-12 text-center text-slate-400">
        <FileText size={32} className="mx-auto mb-2 text-slate-300" />
        <span className="text-xs font-semibold">{t("projectDetail.noQuotations", "ຍັງບໍ່ມີໃບສະເໜີລາຄາ")}</span>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <th className="px-4 py-3 text-left">{t("projectDetail.docNo", "ເລກທີ່")}</th>
            <th className="px-4 py-3 text-left">{t("common.date", "ວັນທີ")}</th>
            <th className="px-4 py-3 text-right">{t("projectDetail.value", "ມູນຄ່າ")}</th>
            <th className="px-4 py-3 text-left">{t("common.status", "ສະຖານະ")}</th>
            <th className="px-4 py-3 text-right">{t("common.actions", "ຈັດການ")}</th>
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
                <td className="px-4 py-3"><Pill tone={tone as any}>{status || t("projectDetail.pendingApproval", "ລໍຖ້າອະນຸມັດ")}</Pill></td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {!approved && (
                      <button
                        onClick={() => onSetStatus(q.id, "ອະນຸມັດແລ້ວ")}
                        className="inline-flex h-7 items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 active:scale-[0.97] transition-all"
                      >
                        <Check size={12} strokeWidth={2.5} /> {t("common.approve", "ອະນຸມັດ")}
                      </button>
                    )}
                    {!rejected && !approved && (
                      <button
                        onClick={() => onSetStatus(q.id, "ປະຕິເສດ")}
                        className="inline-flex h-7 items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50 active:scale-[0.97] transition-all"
                      >
                        <X size={12} strokeWidth={2.5} /> {t("common.reject", "ປະຕິເສດ")}
                      </button>
                    )}
                    {approved && (
                      <button
                        onClick={() => onSetStatus(q.id, "ລໍຖ້າອະນຸມັດ")}
                        className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        {t("projectDetail.undoApprove", "ຍົກເລີກອະນຸມັດ")}
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(q.id)}
                        title={t("common.delete", "ລົບ")}
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
  const t = useT();
  if (!requests.length) {
    return (
      <div className="py-12 text-center text-slate-400">
        <PackageOpen size={32} className="mx-auto mb-2 text-slate-300" />
        <span className="text-xs font-semibold">{t("projectDetail.noRequests", "ຍັງບໍ່ມີການຂໍເບີກ")}</span>
      </div>
    );
  }
  const stLabel = (s: string) => (s === "withdrawn" ? t("projectDetail.withdrawn", "ເບີກແລ້ວ") : s === "rejected" ? t("common.reject", "ປະຕິເສດ") : t("projectDetail.requested", "ຮ້ອງຂໍ"));
  const stTone = (s: string) => (s === "withdrawn" ? "green" : s === "rejected" ? "red" : "amber");
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <th className="px-4 py-3 text-left">{t("projectDetail.docNo", "ເລກທີ່")}</th>
            <th className="px-4 py-3 text-left">{t("common.date", "ວັນທີ")}</th>
            <th className="px-4 py-3 text-right">{t("projectDetail.itemsCol", "ລາຍການ")}</th>
            <th className="px-4 py-3 text-left">{t("common.status", "ສະຖານະ")}</th>
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
                  {isErp && <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">{t("projectDetail.legacy", "ເກົ່າ")}</span>}
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
  const t = useT();
  if (!rows.length) {
    return (
      <div className="py-12 text-center text-slate-400">
        <Boxes size={32} className="mx-auto mb-2 text-slate-300" />
        <span className="text-xs font-semibold">{t("projectDetail.noMaterials", "ຍັງບໍ່ມີວັດສະດຸ (ຕ້ອງມີ BOQ ກ່ອນ)")}</span>
      </div>
    );
  }
  const sum = (k: string) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <th className="px-4 py-3 text-left">{t("projectDetail.itemsCol", "ລາຍການ")}</th>
            <th className="px-4 py-3 text-left">{t("projectDetail.fromBoq", "ໃບ BOQ")}</th>
            <th className="px-4 py-3 text-left">{t("common.unit", "ໜ່ວຍ")}</th>
            <th className="px-4 py-3 text-right">{t("projectDetail.boqTotal", "ຍອດ BOQ")}</th>
            <th className="px-4 py-3 text-right">{t("projectDetail.requestMaterial", "ຂໍເບີກ")}</th>
            <th className="px-4 py-3 text-right">{t("projectDetail.withdrawn", "ເບີກແລ້ວ")}</th>
            <th className="px-4 py-3 text-right">{t("projectDetail.remaining", "ຄົງເຫຼືອ")}</th>
            <th className="px-4 py-3 text-center">{t("common.status", "ສະຖານະ")}</th>
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
                <td className="px-4 py-3 font-bold text-slate-900">
                  <div>{r.description || r.item_code || "-"}</div>
                  {r.item_code && <div className="mt-0.5 font-mono text-[10.5px] font-medium text-slate-400">{t("projectDetail.itemCode", "ລະຫັດ")}: {r.item_code}</div>}
                  {Array.isArray(r.substitutes) && r.substitutes.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.substitutes.map((s: any, si: number) => (
                        <span key={si} className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          ↻ {t("projectDetail.substitutedTo", "ປ່ຽນເປັນ")}: <span className="font-mono">{s.code}</span>{s.name ? ` · ${s.name}` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {Array.isArray(r.boq_docs) && r.boq_docs.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1">
                      {r.boq_docs.map((dn: string) => (
                        <Link key={dn} href={`/boq/${encodeURIComponent(dn)}`} className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-blue-600 hover:bg-blue-100">{dn}</Link>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500">{r.unit || "-"}</td>
                <td className="px-4 py-3 text-right font-mono text-slate-700">{(Number(r.boq_qty) || 0).toLocaleString("en-US")}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-amber-600">{(Number(r.request_qty) || 0).toLocaleString("en-US")}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-600">{(Number(r.withdraw_qty) || 0).toLocaleString("en-US")}</td>
                <td className={`px-4 py-3 text-right font-mono font-bold ${remain > 0 ? "text-slate-900" : "text-slate-400"}`}>{remain.toLocaleString("en-US")}</td>
                <td className="px-4 py-3 text-center">
                  {status === "withdrawn" ? (
                    <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{t("projectDetail.withdrawn", "ເບີກແລ້ວ")}</span>
                  ) : status === "requested" ? (
                    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">{t("projectDetail.pendingWithdraw", "ລໍຖ້າເບີກ")}</span>
                  ) : (
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{t("projectDetail.notRequested", "ຍັງບໍ່ຂໍເບີກ")}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 bg-slate-50/60 font-bold">
            <td className="px-4 py-3 text-slate-900" colSpan={3}>{t("common.total", "ລວມ")}</td>
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
  const t = useT();
  if (!workorders.length) {
    return (
      <div className="py-12 text-center text-slate-400">
        <Wrench size={32} className="mx-auto mb-2 text-slate-300" />
        <span className="text-xs font-semibold">{t("projectDetail.noWorkOrders", "ຍັງບໍ່ມີໃບງານ")}</span>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <th className="px-4 py-3 text-left">{t("projectDetail.workOrderWord", "ໃບງານ")}</th>
            <th className="px-4 py-3 text-left">{t("projectDetail.team", "ທີມ")}</th>
            <th className="px-4 py-3 text-left">{t("common.date", "ວັນທີ")}</th>
            <th className="px-4 py-3 text-right">{t("projectDetail.hours", "ຊົ່ວໂມງ")}</th>
            <th className="px-4 py-3 text-right">{t("projectDetail.laborCost", "ຄ່າແຮງ")}</th>
            <th className="px-4 py-3 text-right">{t("common.actions", "ຈັດການ")}</th>
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
                      title={t("common.delete", "ລົບ")}
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
  const t = useT();
  if (!tasks.length) {
    return (
      <div className="py-12 text-center text-slate-400">
        <CalendarRange size={32} className="mx-auto mb-2 text-slate-300" />
        <span className="text-xs font-semibold">{t("projectDetail.noTasks", "ຍັງບໍ່ໄດ້ກຳນົດໜ້າວຽກ")}</span>
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
            <th className="px-4 py-3 text-left">{t("projectDetail.taskCol", "ໜ້າວຽກ")}</th>
            <th className="px-4 py-3 text-left">{t("projectDetail.phase", "ໄລຍະ")}</th>
            <th className="px-4 py-3 text-right">{t("projectDetail.days", "ວັນ")}</th>
            <th className="px-4 py-3 text-right">{t("projectDetail.hours", "ຊົ່ວໂມງ")}</th>
            <th className="px-4 py-3 text-left">{t("projectDetail.team", "ທີມ")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tasks.map((tk, i) => (
            <tr key={tk.id ?? i} className="hover:bg-slate-50/50">
              <td className="px-4 py-3 font-bold text-slate-900">{tk.title}</td>
              <td className="px-4 py-3 text-slate-500">{tk.phase || "-"}</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">{Number(tk.est_days) || 0}</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">{Number(tk.est_hours) || 0}</td>
              <td className="px-4 py-3 text-slate-500 font-bold">{tk.technician_name || t("projectDetail.assignLater", "— ກຳນົດຕາມຫຼັງ")}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 bg-slate-50/60 font-bold">
            <td className="px-4 py-3 text-slate-900" colSpan={2}>{t("common.total", "ລວມ")}</td>
            <td className="px-4 py-3 text-right font-mono text-blue-600">{totalDays} {t("projectDetail.days", "ວັນ")}</td>
            <td className="px-4 py-3 text-right font-mono text-blue-600">{totalHours} {t("overview.hoursUnit", "ຊມ")}</td>
            <td className="px-4 py-3" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function BoqList({ boqs, onSetStatus, onDelete, canApproveNext = false }: { boqs: any[]; onSetStatus: (docNo: any, status: string) => void; onDelete?: (b: any) => void; canApproveNext?: boolean }) {
  const t = useT();
  const statusLabel = (s: string) =>
    s === "ອະນຸມັດແລ້ວ" ? t("status.approved", "ອະນຸມັດແລ້ວ")
    : s === "ປະຕິເສດ" ? t("status.rejected", "ປະຕິເສດ")
    : t("projectDetail.pendingApproval", "ລໍຖ້າອະນຸມັດ");
  // Per contract: the first BOQ may be approved by a manager (boq.approve);
  // every subsequent (2nd+) BOQ of the SAME contract may only be approved/
  // rejected by an admin (ຜູ້ດູແລລະບົບ). Mirror the server check (approveBoq)
  // so non-admins do not see action buttons that would just fail. Within each
  // contract the first BOQ is the earliest by doc_date then doc_no.
  const docKey = (b: any) => String(b?.doc_no ?? b?.boq_no ?? "");
  const firstDocByContract = new Map<string, string>();
  for (const b of boqs) {
    const cno = String(b?.contract_no ?? "");
    const cur = firstDocByContract.get(cno);
    const sortKey = `${String(b?.doc_date ?? "")}|${docKey(b)}`;
    if (!cur || sortKey < cur) firstDocByContract.set(cno, sortKey);
  }
  const firstDocNos = new Set([...firstDocByContract.values()].map((k) => k.split("|")[1]));
  if (!boqs.length) {
    return (
      <div className="py-12 text-center text-slate-400">
        <ListChecks size={32} className="mx-auto mb-2 text-slate-300" />
        <span className="text-xs font-semibold">{t("projectDetail.noBoq", "ຍັງບໍ່ມີ BOQ")}</span>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <th className="px-4 py-3 text-left">{t("projectDetail.boqNo", "BOQ ເລກທີ່")}</th>
            <th className="px-4 py-3 text-left">{t("common.date", "ວັນທີ")}</th>
            <th className="px-4 py-3 text-left">{t("projectDetail.requester", "ຜູ້ຂໍ")}</th>
            <th className="px-4 py-3 text-left">{t("common.approver", "ຜູ້ອະນຸມັດ")}</th>
            <th className="px-4 py-3 text-left">{t("common.status", "ສະຖານະ")}</th>
            <th className="px-4 py-3 text-right">{t("common.actions", "ຈັດການ")}</th>
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
            // 2nd+ BOQ of a contract: only an admin OR a user granted the boq
            // "approve_next" permission may approve/reject/reset.
            const canApprove = canApproveNext || firstDocNos.has(String(docNo));
            return (
              <tr key={docNo || i} className="group transition-colors hover:bg-slate-50/50">
                <td className="px-4 py-3 font-mono font-bold">
                  <Link href={`/boq/${encodeURIComponent(docNo)}`} className="text-blue-600 hover:text-blue-700 hover:underline">{docNo || "-"}</Link>
                </td>
                <td className="px-4 py-3 text-slate-500">{(b.doc_date ?? "").toString().slice(0, 10) || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{b.user_created || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{b.approver || "-"}</td>
                <td className="px-4 py-3"><Pill tone={tone as any}>{statusLabel(status)}</Pill></td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {canApprove && !approved && (
                      <button
                        onClick={() => onSetStatus(docNo, "ອະນຸມັດແລ້ວ")}
                        className="inline-flex h-7 items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 active:scale-[0.97] transition-all"
                      >
                        <Check size={12} strokeWidth={2.5} /> {t("common.approve", "ອະນຸມັດ")}
                      </button>
                    )}
                    {canApprove && !rejected && !approved && (
                      <button
                        onClick={() => onSetStatus(docNo, "ປະຕິເສດ")}
                        className="inline-flex h-7 items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50 active:scale-[0.97] transition-all"
                      >
                        <X size={12} strokeWidth={2.5} /> {t("common.reject", "ປະຕິເສດ")}
                      </button>
                    )}
                    {canApprove && (approved || rejected) && (
                      <button
                        onClick={() => onSetStatus(docNo, "ລໍຖ້າອະນຸມັດ")}
                        className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        {t("common.cancel", "ຍົກເລີກ")}
                      </button>
                    )}
                    {!canApprove && !approved && !rejected && (
                      <span className="text-[10px] font-bold text-amber-600">{t("projectDetail.needAdminApprove", "ຕ້ອງໃຫ້ຜູ້ດູແລລະບົບ ຫຼື ຜູ້ມີສິດອະນຸມັດໃບຕໍ່ໄປ")}</span>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(b)}
                        title={t("common.delete", "ລົບ")}
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
  const t = useT();
  if (!contracts.length) {
    return (
      <div className="py-12 text-center text-slate-400">
        <FileSignature size={32} className="mx-auto mb-2 text-slate-300" />
        <span className="text-xs font-semibold">{t("projectDetail.noContracts", "ຍັງບໍ່ມີສັນຍາ")}</span>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {contracts.map((c, i) => {
        const isErp = c.src === "erp";
        const sales = isErp ? Number(c.approve_status_1) === 1 : !!c.sales_approved;
        const full = sales;
        return (
          <div key={c.id ?? c.contract_no ?? i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="min-w-0">
                <div className="flex items-center flex-wrap gap-2">
                  <span className="font-mono text-sm font-extrabold text-slate-900">{c.contract_no || "-"}</span>
                  <Pill tone={full ? "green" : "amber"}>{full ? t("projectDetail.complete", "ສົມບູນ") : t("projectDetail.pendingApproval", "ລໍຖ້າອະນຸມັດ")}</Pill>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-bold text-blue-600">{t("projectDetail.value", "ມູນຄ່າ")} {fmtMoney(c.total_amount)}</span>
                  {c.sign_date && <span className="text-slate-300">|</span>}
                  {c.sign_date && <span>{t("projectDetail.signDate", "ເຊັນວັນທີ")}: {String(c.sign_date).slice(0, 10)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <Link
                  href={isErp ? `/contracts/${encodeURIComponent(c.contract_no || "")}` : `/contracts/${c.id}`}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50/50 transition-colors"
                >
                  {t("common.detail", "ລາຍລະອຽດ")} →
                </Link>
                {onDelete && (
                  <button
                    onClick={() => onDelete(c)}
                    title={t("common.delete", "ລົບ")}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
            {isErp ? (
              <div className="mt-3 flex flex-wrap gap-4 text-xs font-bold text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="flex items-center gap-1.5">{t("projectDetail.sales", "ຝ່າຍຂາຍ")}: {sales ? <span className="text-emerald-600">{t("common.approve", "ອະນຸມັດ")} ✓</span> : <span className="text-amber-500">{t("projectDetail.waiting", "ລໍຖ້າ")}</span>}</span>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-3">
                <ApprovalCell
                  label={t("projectDetail.salesManager", "ຜູ້ຈັດການຝ່າຍຂາຍ")}
                  approved={sales}
                  approver={c.sales_approver}
                  onApprove={() => onApprove(c.id, "sales", true)}
                  onUndo={() => onApprove(c.id, "sales", false)}
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
  const t = useT();
  const blocked = !!locked && !approved;
  return (
    <div className={`flex items-center flex-wrap gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/40 px-3 py-2 text-xs ${blocked ? "opacity-70" : ""}`}>
      <span className="font-bold text-slate-500">{label}:</span>
      {approved ? (
        <div className="flex items-center gap-2">
          <Pill tone="green">✓ {t("status.approved", "ອະນຸມັດແລ້ວ")}</Pill>
          {approver && <span className="text-[10px] text-slate-400 font-bold">{t("projectDetail.by", "ໂດຍ")}: {approver}</span>}
          {onUndo && <button onClick={onUndo} className="text-[10px] font-bold text-slate-400 hover:text-rose-600 transition-colors">{t("common.cancel", "ຍົກເລີກ")}</button>}
        </div>
      ) : blocked ? (
        <span className="text-[10px] font-bold text-slate-400">🔒 {lockedHint || t("projectDetail.waitPrevStep", "ລໍຖ້າຂັ້ນຕອນກ່ອນໜ້າ")}</span>
      ) : (
        <button
          onClick={onApprove}
          className="inline-flex h-7 items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 active:scale-[0.97] transition-all"
        >
          <Check size={12} strokeWidth={2.5} /> {t("common.approve", "ອະນຸມັດ")}
        </button>
      )}
    </div>
  );
}

function SurveyList({ surveys, onDelete }: { surveys: any[]; onDelete?: (id: any) => void }) {
  const t = useT();
  if (!surveys.length) {
    return (
      <div className="py-12 text-center text-slate-400">
        <MapPin size={32} className="mx-auto mb-2 text-slate-300" />
        <span className="text-xs font-semibold">{t("projectDetail.noSurvey", "ຍັງບໍ່ໄດ້ສຳຫຼວດ")}</span>
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
                    {t("projectDetail.by", "ໂດຍ")}: {s.surveyor}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {d.condition && <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200/60 rounded-md px-2 py-0.5 font-semibold">{t("projectDetail.condition", "ສະພາບ")}: {d.condition}</span>}
                {onDelete && (
                  <button
                    onClick={() => onDelete(s.id)}
                    title={t("common.delete", "ລົບ")}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            {meas.length > 0 && (
              <div className="mb-3.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{t("projectDetail.measurements", "ຜົນການວັດແທກ")}</div>
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
                <span className="font-bold text-xs text-slate-700 block mb-1.5">{t("projectDetail.initialMaterials", "ວັດສະດຸເບື້ອງຕົ້ນ")}:</span>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                  {mats.map((m: any, j: number) => (
                    <span key={j} className="inline-flex items-center gap-1.5 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                      {m.item} ({m.qty} {m.unit || t("common.unit", "ໜ່ວຍ")})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(c.power || c.wallType || c.access || c.obstacles) && (
              <div className="mb-3.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{t("projectDetail.siteChecklist", "ລາຍການກວດສອບໜ້າງານ")}</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {c.power && <div className="rounded-xl bg-slate-50/40 border border-slate-200/50 p-2.5 text-xs"><span className="text-slate-400 block text-[10px] font-semibold">{t("projectDetail.power", "ໄຟຟ້າ")}:</span><span className="font-bold text-slate-700">{c.power}</span></div>}
                  {c.wallType && <div className="rounded-xl bg-slate-50/40 border border-slate-200/50 p-2.5 text-xs"><span className="text-slate-400 block text-[10px] font-semibold">{t("projectDetail.wallCeiling", "ຝາ/ເພດານ")}:</span><span className="font-bold text-slate-700">{c.wallType}</span></div>}
                  {c.access && <div className="rounded-xl bg-slate-50/40 border border-slate-200/50 p-2.5 text-xs"><span className="text-slate-400 block text-[10px] font-semibold">{t("projectDetail.access", "ທາງເຂົ້າ")}:</span><span className="font-bold text-slate-700">{c.access}</span></div>}
                  {c.obstacles && <div className="rounded-xl bg-slate-50/40 border border-slate-200/50 p-2.5 text-xs"><span className="text-slate-400 block text-[10px] font-semibold">{t("projectDetail.obstacles", "ອຸປະສັກ")}:</span><span className="font-bold text-slate-700">{c.obstacles}</span></div>}
                </div>
              </div>
            )}

            {photos.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{t("projectDetail.sitePhotos", "ຮູບພາບໜ້າງານ")}</div>
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
                <span className="font-bold text-blue-800 block mb-0.5">{t("projectDetail.additionalNotes", "ຂໍ້ສັງເກດເພີ່ມເຕີມ")}:</span>
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
