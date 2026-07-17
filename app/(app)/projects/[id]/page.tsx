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
  ClipboardCheck,
  FolderKanban,
  Wallet,
  GitBranch,
} from "lucide-react";
import {
  Page,
  PageHeader,
  Card,
  Pill,
  Btn,
  Segmented,
  SectionHeader,
  TwoLine,
  tblCls,
  thCls,
  tdCls,
  trHover,
  type PillTone,
} from "../../_components/ui";
import {
  getProjectsBoq,
  deleteProjectAction,
  advanceProjectStage,
  deleteProjectContract,
  approveProjectAction,
  requestProjectClose,
  approveProjectClose,
  rejectProjectClose,
} from "@/_actions/projects";
import { getProjectTimeline, type ProjectTimeline } from "@/_actions/project-timeline";
import { deleteBoq as deleteLegacyBoq, approveBoq, checkAccountingApprove } from "@/_actions/boq";
import { getQuotations, approveQuotation, deleteQuotation } from "@/_actions/quotations";
import { getSurveys, deleteSurvey } from "@/_actions/survey";
import { getContracts, setContractApproval, deleteContract } from "@/_actions/contracts";
import { getProjectMaterials } from "@/_actions/boq-v2";
import { getProjectTasks, deleteTaskPlan } from "@/_actions/tasks-v2";
import { getWorkOrders, deleteWorkOrder } from "@/_actions/workorder";
import { canEditWorkOrder } from "@/_lib/workorder-stage";
import { getRequests } from "@/_actions/request-v2";
import { getProjectSmlFinance } from "@/_actions/sml-finance";
import { computeStages, computeCloseReadiness, isContractApproved, type Stage } from "@/_components/pipeline";
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

/** v2 pipeline stage order + close-out (mirrors advanceProjectStage on the server). */
const V2_STAGES = [
  "ລົງທະບຽນ",
  "ສຳຫຼວດ",
  "ສະເໜີລາຄາ",
  "ສັນຍາ",
  "BOQ",
  "ກຳນົດໜ້າວຽກ",
  "ໃບງານ",
  "ລໍຖ້າອະນຸມັດປິດໂຄງການ",
  "ປິດໂຄງການ",
];

/** Pill tone for a legacy Lao project_status string. */
const projectStatusTone = (s?: string | null): PillTone => {
  const v = String(s || "").trim();
  if (v === "ປິດໂຄງການ" || v === "ໃນງານ" || v === "ໃບງານ") return "green";
  if (v === "ພັກໂຄງການ") return "red";
  if (v.startsWith("ລໍຖ້າ")) return "amber";
  if (!v) return "neutral";
  return "brand";
};

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
  const canEditWO = can(me, "work-orders", "edit");
  const canDeleteSurvey = can(me, "projects", "delete");
  // A survey is a project document → it follows the `projects` module (like its create/delete).
  const canEditSurvey = can(me, "projects", "edit");
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
  // Close-out state — derived from the work orders this page already loaded.
  const closeState = useMemo(() => computeCloseReadiness(project, workorders), [project, workorders]);
  const canApproveContract = can(me, "contracts", "approve");
  const canRequestClose = can(me, "projects", "edit") && closeState.canRequestClose;
  const canDecideClose = isManager(me) && closeState.pendingClose;

  const doRequestClose = async () => {
    if (!(await confirm({
      title: t("projectDetail.requestClose", "ຂໍປິດໂຄງການ"),
      message: t("projectDetail.requestCloseMsg", "ໃບງານປິດຄົບແລ້ວ. ສົ່ງຄຳຮ້ອງຂໍປິດໂຄງການ ໃຫ້ຜູ້ຈັດການອະນຸມັດ?"),
      confirmLabel: t("projectDetail.requestClose", "ຂໍປິດໂຄງການ"),
    }))) return;
    const res: any = await requestProjectClose(String(id));
    if (res?.success) reload();
    else alert(res?.message || t("common.error", "ບໍ່ສຳເລັດ"));
  };

  const doApproveClose = async () => {
    if (!(await confirm({
      title: t("projectDetail.approveClose", "ອະນຸມັດປິດໂຄງການ"),
      message: t("projectDetail.approveCloseMsg", "ອະນຸມັດປິດໂຄງການນີ້? ໂຄງການຈະຢຸດຢູ່ຂັ້ນຕອນສຸດທ້າຍ."),
      confirmLabel: t("common.approve", "ອະນຸມັດ"),
    }))) return;
    const res: any = await approveProjectClose(String(id));
    if (res?.success) reload();
    else alert(res?.message || t("common.error", "ບໍ່ສຳເລັດ"));
  };

  const doRejectClose = async () => {
    if (!(await confirm({
      title: t("projectDetail.rejectClose", "ປະຕິເສດການປິດໂຄງການ"),
      message: t("projectDetail.rejectCloseMsg", "ປະຕິເສດ ຄຳຮ້ອງຂໍປິດໂຄງການ?"),
      confirmLabel: t("common.reject", "ປະຕິເສດ"),
      tone: "danger",
    }))) return;
    const res: any = await rejectProjectClose(String(id));
    if (res?.success) reload();
    else alert(res?.message || t("common.error", "ບໍ່ສຳເລັດ"));
  };


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

  // Contract approval — v2 (odg_contract, two-way toggle) and legacy ERP
  // (odg_projects_contract, approve-only), using the same server actions and
  // permission gating as /contracts/[id]. A fully approved contract (sales AND
  // accounting) advances the project to ສັນຍາ.
  const setContractStep = async (c: any, which: "sales" | "accounting", approved: boolean) => {
    let user: any = {};
    try {
      user = JSON.parse(localStorage.getItem("v2_user") || "{}");
    } catch {
      /* ignore */
    }
    const isErp = c?.src === "erp";
    if (isErp && !approved) return; // ERP approvals cannot be undone
    if (approved && !(await confirm({ title: t("projectDetail.confirmApproveTitle", "ຢືນຢັນການອະນຸມັດ"), message: which === "sales" ? t("projectDetail.approveContractSales", "ອະນຸມັດສັນຍາ (ຝ່າຍຂາຍ)?") : t("projectDetail.approveContractAccounting", "ອະນຸມັດສັນຍາ (ຝ່າຍບັນຊີ)?"), confirmLabel: t("common.approve", "ອະນຸມັດ") }))) return;
    const username = user.username || user.name || "";
    const res: any = isErp
      ? which === "sales"
        ? await approveProjectAction(String(c.project_id ?? id), { username, contract_no: String(c.contract_no) })
        : await checkAccountingApprove(String(c.contract_no), { username, project_id: String(id) })
      : await setContractApproval(String(c.id), which, approved, user.name || "");
    if (res?.success) {
      // Stage follows APPROVAL: no-op unless sales AND accounting are both in.
      if (approved) await advanceProjectStage(String(id), "ສັນຍາ").catch(() => {});
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
  const editSurvey = (sid: any) => router.push(`/projects/${id}/survey/new?edit=${encodeURIComponent(String(sid))}`);
  const editWO = (wid: any) => router.push(`/projects/${id}/workorder/new?edit=${encodeURIComponent(String(wid))}`);
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
      <div className="flex h-[60vh] items-center justify-center gap-3 text-[var(--text-mute)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--brand)]" />
        <span className="text-sm font-semibold">{t("common.loading", "ກຳລັງໂຫຼດ...")}</span>
      </div>
    );
  }
  if (!project) {
    return (
      <div className="w-full px-4 py-10 text-center text-[var(--text-mute)] md:px-6">
        {t("projectDetail.notFound", "ບໍ່ພົບໂຄງການ")}
        <div className="mt-3">
          <button onClick={() => router.push("/projects")} className="text-[var(--brand)] hover:underline">
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

  const tabOptions = tabs.map((tb) => ({
    value: tb.key,
    icon: TAB_ICONS[tb.key],
    label: (
      <span className="flex items-center gap-1.5">
        {tb.label}
        {typeof tb.n === "number" && (
          <span className="rounded-full bg-black/10 px-1.5 text-[10px] font-black dark:bg-white/15">{tb.n}</span>
        )}
      </span>
    ),
  }));

  const showCta =
    current &&
    stageAction[current.key] &&
    !(current.key === "contract" && hasAnyContract) &&
    !(current.key === "quotation" && hasActiveQuo);

  const location = [project.village_name, project.district_name, project.province_name].filter(Boolean).join(" · ");

  return (
    <Page max="max-w-none">
      <PageHeader
        title={project.project_name || t("projectDetail.noName", "(ບໍ່ມີຊື່)")}
        subtitle={[project.sml_code, project.coordinator, location].filter(Boolean).join(" · ") || undefined}
        badge={<Pill tone={projectStatusTone(project.project_status)}>{project.project_status || "-"}</Pill>}
        actions={
          <>
            {showCta && (
              <Btn variant="go" onClick={() => router.push(stageAction[current!.key]!.href)}>
                <Plus size={14} /> {stageAction[current!.key]!.label}
              </Btn>
            )}
            {canRequestClose && (
              <Btn variant="go" onClick={doRequestClose}>
                <ClipboardCheck size={14} /> {t("projectDetail.requestClose", "ຂໍປິດໂຄງການ")}
              </Btn>
            )}
            {canDecideClose && (
              <Btn variant="go" onClick={doApproveClose}>
                <Check size={14} /> {t("projectDetail.approveClose", "ອະນຸມັດປິດໂຄງການ")}
              </Btn>
            )}
            {canEditProject && (
              <Btn variant="ink" onClick={() => router.push(`/projects/${id}/edit`)}>
                <Pencil size={14} /> {t("common.edit", "ແກ້ໄຂ")}
              </Btn>
            )}
            {canDeleteProject && (
              <Btn variant="danger-outline" onClick={() => setConfirmDel(true)}>
                <Trash2 size={14} /> {t("common.delete", "ລຶບ")}
              </Btn>
            )}
            <Btn variant="outline" onClick={() => router.push("/projects")}>
              <ArrowLeft size={14} /> {t("projectDetail.backToProjectList", "ກັບໄປລາຍການໂຄງການ")}
            </Btn>
          </>
        }
      />

      {loadError && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-4 py-3 text-xs font-bold text-[var(--danger)]">
          <AlertTriangle size={15} />
          <span>{t("projectDetail.partialLoadError", "ໂຫຼດຂໍ້ມູນບາງສ່ວນບໍ່ສຳເລັດ")}: {loadError}</span>
        </div>
      )}

      {/* Two-column workspace: info rail (left) + tabbed content (right) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[330px_minmax(0,1fr)]">
        {/* ── Left rail ── */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card className="p-4">
            <SectionHeader icon={<FolderKanban size={14} />} title={t("projectDetail.tabOverview", "ພາບລວມ")} tone="brand" />
            <div className="space-y-2.5">
              <RailRow icon={<User size={13} />} label={t("projectDetail.customerCode", "ລະຫັດລູກຄ້າ")} value={project.sml_code} mono />
              <RailRow icon={<User size={13} />} label={t("projectDetail.coordinator", "ຜູ້ປະສານ")} value={project.coordinator} />
              <RailRow icon={<Phone size={13} />} label={t("common.phone", "ໂທ")} value={project.phone} />
              <RailRow icon={<MapPin size={13} />} label={t("projectDetail.location", "ສະຖານທີ່")} value={location} />
            </div>
          </Card>

          {/* Stage progress + current-stage CTA */}
          <Card className="p-4">
            <SectionHeader icon={<GitBranch size={14} />} title={t("projectDetail.projectStages", "ຂັ້ນຕອນໂຄງການ")} tone="slate" />
            <CustomStageStepper stages={stages} />
            {showCta && (
              <Btn variant="go" className="mt-4 h-10 w-full" onClick={() => router.push(stageAction[current!.key]!.href)}>
                <Plus size={14} /> {stageAction[current!.key]!.label}
              </Btn>
            )}

            {/* ── Close-out (ກວດຮັບ/ປິດງານ) — real preconditions only ── */}
            <div className="mt-4 border-t border-[var(--border-soft)] pt-3">
              {closeState.closed ? (
                <div className="flex items-center gap-2 rounded-xl border border-[var(--success-soft)] bg-[var(--success-soft)] px-3 py-2 text-[11.5px] font-bold text-[var(--success)]">
                  <Check size={14} /> {t("projectDetail.projectClosed", "ປິດໂຄງການແລ້ວ")}
                </div>
              ) : closeState.pendingClose ? (
                <div className="space-y-2">
                  <div className="rounded-xl border border-[var(--warning-soft)] bg-[var(--warning-soft)] px-3 py-2 text-[11.5px] font-bold text-[var(--warning)]">
                    {t("projectDetail.waitManagerClose", "ລໍຖ້າຜູ້ຈັດການອະນຸມັດປິດໂຄງການ")}
                  </div>
                  {canDecideClose && (
                    <div className="flex gap-2">
                      <Btn variant="go" className="h-9 flex-1" onClick={doApproveClose}>
                        <Check size={13} /> {t("common.approve", "ອະນຸມັດ")}
                      </Btn>
                      <Btn variant="danger-outline" className="h-9 flex-1" onClick={doRejectClose}>
                        <X size={13} /> {t("common.reject", "ປະຕິເສດ")}
                      </Btn>
                    </div>
                  )}
                </div>
              ) : canRequestClose ? (
                <Btn variant="go" className="h-10 w-full" onClick={doRequestClose}>
                  <ClipboardCheck size={14} /> {t("projectDetail.requestClose", "ຂໍປິດໂຄງການ")}
                </Btn>
              ) : (
                <p className="text-[10.5px] font-semibold text-[var(--text-mute)]">
                  {closeState.woTotal === 0
                    ? t("projectDetail.closeNeedsWorkOrders", "ຕ້ອງມີໃບງານ ແລະ ປິດໃບງານທັງໝົດກ່ອນ ຈຶ່ງປິດໂຄງການໄດ້")
                    : `${t("projectDetail.closeNeedsClosedWo", "ຕ້ອງປິດໃບງານທັງໝົດກ່ອນ")} (${closeState.woClosed}/${closeState.woTotal})`}
                </p>
              )}
            </div>
          </Card>
        </aside>

        {/* ── Right content ── */}
        <div className="min-w-0">
          <div className="mb-4 overflow-x-auto pb-1">
            <Segmented<TabKey> value={tab} onChange={(v) => selectTab(v)} options={tabOptions} />
          </div>

          <Card className="p-4 md:p-5">
          {tab === "overview" && (
            <div className="space-y-5">
              <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
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
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-[12px] font-black text-[var(--text)]">{t("projectDetail.installPauseStatus", "ສະຖານະການຕິດຕັ້ງ / ການພັກ")}</h3>
                    {install.paused
                      ? <Pill tone="red">{t("overview.pausedFor", "ພັກ")} {install.current_pause_days} {t("overview.daysUnit", "ມື້")} ({t("projectDetail.since", "ຕັ້ງແຕ່")} {fmtDay(install.paused_since)})</Pill>
                      : <Pill tone="green">{t("overview.installActive", "ກຳລັງດຳເນີນ")}</Pill>}
                  </div>
                  {install.total_pause_days > 0 && (
                    <p className="mb-3 text-[11.5px] text-[var(--text-mute)]">{t("projectDetail.totalPaused", "ເຄີຍພັກລວມ")} {install.total_pause_days} {t("overview.daysUnit", "ມື້")}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {install.paused && isManager(me) && (
                      <Btn variant="go" onClick={async () => { if (await confirm({ title: t("projectDetail.resumeTitle", "ກັບມາດຳເນີນ"), message: t("projectDetail.resumeMsg", "ຍົກເລີກການພັກ ແລະ ກັບໄປຕິດຕັ້ງ?"), confirmLabel: t("projectDetail.resumeTitle", "ກັບມາດຳເນີນ") })) { const r: any = await resumeProject(String(id)); if (r?.success) reload(); else alert(r?.message); } }}>{t("projectDetail.resumeTitle", "ກັບມາດຳເນີນ")}</Btn>
                    )}
                    {!install.paused && !install.req_id && (
                      <Btn variant="outline" onClick={async () => { const reason = window.prompt(t("projectDetail.pauseReasonPrompt", "ເຫດຜົນທີ່ຂໍພັກໂຄງການ:"), ""); if (reason == null) return; const r: any = await requestProjectPause(String(id), reason); if (r?.success) reload(); else alert(r?.message); }}>{t("projectDetail.requestPause", "ຮ້ອງຂໍພັກ")}</Btn>
                    )}
                    {install.req_status === "requested" && (isManager(me) ? (
                      <>
                        <span className="self-center text-[11.5px] font-semibold text-[var(--text-mute)]">{t("projectDetail.pauseRequest", "ຄຳຮ້ອງພັກ")}{install.req_reason ? `: ${install.req_reason}` : ""} —</span>
                        <Btn variant="ink" onClick={async () => { if (await confirm({ title: t("projectDetail.reviewPauseTitle", "ກວດສອບຄຳຮ້ອງພັກ"), message: t("projectDetail.reviewPauseMsg", "ກວດສອບຜ່ານ?"), confirmLabel: t("projectDetail.pass", "ຜ່ານ") })) { const r: any = await reviewProjectPause(install.req_id!, true); if (r?.success) reload(); else alert(r?.message); } }}>{t("projectDetail.reviewPass", "ກວດສອບຜ່ານ")}</Btn>
                        <Btn variant="danger-outline" onClick={async () => { if (await confirm({ title: t("common.reject", "ປະຕິເສດ"), message: t("projectDetail.rejectPauseMsg", "ປະຕິເສດ ຄຳຮ້ອງພັກ?"), confirmLabel: t("common.reject", "ປະຕິເສດ"), tone: "danger" })) { const r: any = await rejectProjectPause(install.req_id!); if (r?.success) reload(); else alert(r?.message); } }}>{t("common.reject", "ປະຕິເສດ")}</Btn>
                      </>
                    ) : <span className="text-[11.5px] font-semibold text-[var(--warning)]">{t("projectDetail.waitManagerReview", "ລໍຖ້າຜູ້ຈັດການກວດສອບຄຳຮ້ອງພັກ")}</span>)}
                    {install.req_status === "manager_ok" && (isAdmin(me) ? (
                      <>
                        <span className="self-center text-[11.5px] font-semibold text-[var(--text-mute)]">{t("projectDetail.reviewed", "ກວດສອບແລ້ວ")} —</span>
                        <Btn variant="ink" onClick={async () => { if (await confirm({ title: t("projectDetail.approvePauseTitle", "ອະນຸມັດ ພັກໂຄງການ"), message: t("projectDetail.approvePauseMsg", "ອະນຸມັດ ໃຫ້ພັກໂຄງການ?"), confirmLabel: t("common.approve", "ອະນຸມັດ") })) { const r: any = await approveProjectPause(install.req_id!); if (r?.success) reload(); else alert(r?.message); } }}>{t("projectDetail.approvePause", "ອະນຸມັດພັກ")}</Btn>
                        <Btn variant="danger-outline" onClick={async () => { if (await confirm({ title: t("common.reject", "ປະຕິເສດ"), message: t("projectDetail.rejectPauseMsg", "ປະຕິເສດ ຄຳຮ້ອງພັກ?"), confirmLabel: t("common.reject", "ປະຕິເສດ"), tone: "danger" })) { const r: any = await rejectProjectPause(install.req_id!); if (r?.success) reload(); else alert(r?.message); } }}>{t("common.reject", "ປະຕິເສດ")}</Btn>
                      </>
                    ) : <span className="text-[11.5px] font-semibold text-[var(--warning)]">{t("projectDetail.waitAdminApprove", "ລໍຖ້າຜູ້ດູແລລະບົບອະນຸມັດ")}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}
          {tab === "survey" && (
            <div>
              <div className="mb-4 flex justify-end">
                <Btn variant="go" onClick={() => router.push(`/projects/${id}/survey/new`)}>
                  <Plus size={14} /> {t("projectDetail.addSurvey", "ເພີ່ມການສຳຫຼວດ")}
                </Btn>
              </div>
              <SurveyList surveys={surveys} onEdit={canEditSurvey ? editSurvey : undefined} onDelete={canDeleteSurvey ? delSurvey : undefined} />
            </div>
          )}
          {tab === "quotations" && (
            <div>
              {/* A project can carry many quotations (one per brand), so this
                  button stays available even after one already exists. */}
              <div className="mb-4 flex justify-end">
                <Btn variant="go" onClick={() => router.push(`/projects/${id}/quotation/new`)}>
                  <Plus size={14} /> {t("projectDetail.createQuotationShort", "ສ້າງໃບສະເໜີ")}
                </Btn>
              </div>
              <QuotationList quotations={quotations} onSetStatus={setQuoStatus} onDelete={canDeleteQuotation ? delQuotation : undefined} />
            </div>
          )}
          {tab === "contracts" && (
            <div>
              {!hasAnyContract && (
                <div className="mb-4 flex justify-end">
                  <Btn variant="go" onClick={() => router.push(`/projects/${id}/contract/new`)}>
                    <Plus size={14} /> {t("projectDetail.ctaCreateContract", "ສ້າງສັນຍາ")}
                  </Btn>
                </div>
              )}
              <ContractList
                contracts={allContracts}
                onApprove={setContractStep}
                onDelete={canDeleteContract ? delContract : undefined}
                canApprove={canApproveContract}
              />
            </div>
          )}
          {tab === "boq" && (
            <div>
              {hasAnyContract && (
                <div className="mb-4 flex justify-end">
                  <Btn variant="go" onClick={() => router.push(`/projects/${id}/boq/new`)}>
                    <Plus size={14} /> {t("projectDetail.ctaCreateBoq", "ສ້າງ BOQ")}
                  </Btn>
                </div>
              )}
              {!hasAnyContract && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-[var(--warning-soft)] bg-[var(--warning-soft)] px-4 py-3 text-xs font-bold text-[var(--warning)]">
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
                    <Btn variant="danger-outline" onClick={delTaskPlan}>
                      <Trash2 size={13} /> {t("projectDetail.deleteTaskPlan", "ລຶບແຜນວຽກ")}
                    </Btn>
                  )}
                  {canEditTaskPlan && (
                    <Btn variant="ink" onClick={() => router.push(`/projects/${id}/tasks/new`)}>
                      <Pencil size={14} /> {t("projectDetail.editTaskPlan", "ແກ້ໄຂແຜນວຽກ")}
                    </Btn>
                  )}
                </div>
              )}
              <TaskList tasks={tasks} />
            </div>
          )}
          {tab === "workorders" && (
            <div>
              <div className="mb-4 flex justify-end">
                <Btn variant="go" onClick={() => router.push(`/projects/${id}/workorder/new`)}>
                  <Plus size={14} /> {t("projectDetail.ctaIssueWorkOrder", "ອອກໃບງານ")}
                </Btn>
              </div>
              <WorkOrderList workorders={workorders} onEdit={canEditWO ? editWO : undefined} onDelete={canDeleteWO ? delWO : undefined} />
            </div>
          )}
          {tab === "materials" && <MaterialsSummary rows={materials} />}
          {tab === "requests" && (
            <div>
              {materials.length > 0 && (
                <div className="mb-4 flex justify-end">
                  <Btn variant="go" onClick={() => router.push(`/projects/${id}/request/new`)}>
                    <Plus size={14} /> {t("projectDetail.requestMaterial", "ຂໍເບີກ")}
                  </Btn>
                </div>
              )}
              <RequestList requests={requests} />
            </div>
          )}
          {tab === "finance" && <SmlFinance loading={smlLoading} data={sml} />}
          </Card>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[12vh] backdrop-blur-xs" onClick={() => !deleting && setConfirmDel(false)}>
          <div
            className="animate-fade-in w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--danger-soft)] text-[var(--danger)]">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-base font-black text-[var(--text)]">{t("projectDetail.deleteProjectTitle", "ລຶບໂຄງການ?")}</h3>
              <p className="mt-2 text-xs leading-relaxed text-[var(--text-mute)]">
                <span className="font-bold text-[var(--text)]">{project.project_name}</span>{" "}
                {relatedTotal > 0
                  ? t("projectDetail.deleteWithDocs", "ມີເອກະສານກ່ຽວຂ້ອງຢູ່. ການລຶບຈະລົບເອກະສານລຸ່ມນີ້ທັງໝົດ ແລະ ບໍ່ສາມາດກູ້ຄືນໄດ້.")
                  : t("projectDetail.deletePermanent", "ຈະຖືກລຶບຖາວອນ ແລະ ບໍ່ສາມາດກູ້ຄືນໄດ້.")}
              </p>
            </div>
            {relatedTotal > 0 && (
              <div className="mx-5 mb-4 max-h-56 overflow-y-auto rounded-xl border border-[var(--warning-soft)] bg-[var(--warning-soft)] px-3 py-2.5 text-left">
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black tracking-wide text-[var(--warning)]">
                  {t("projectDetail.relatedDocs", "ເອກະສານກ່ຽວຂ້ອງ")} ({relatedTotal})
                </div>
                <ul className="space-y-1.5">
                  {relatedDocs.map((g) => (
                    <li key={g.key} className="text-[11px] leading-relaxed">
                      <span className="font-bold text-[var(--text)]">{g.label}</span>
                      <span className="ml-1 rounded-full bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-black text-[var(--warning)]">{g.count}</span>
                      <span className="ml-1.5 text-[var(--text-soft)]">
                        {g.samples.join(", ")}{g.count > g.samples.length ? " …" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-2 border-t border-[var(--border-soft)] bg-[var(--surface-sunken)] p-3.5">
              <Btn variant="outline" className="flex-1" onClick={() => setConfirmDel(false)} disabled={deleting}>
                {t("common.cancel", "ຍົກເລີກ")}
              </Btn>
              <Btn variant="danger" className="flex-1" onClick={doDelete} disabled={deleting}>
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {deleting ? t("projectDetail.deleting", "ກຳລັງລຶບ...") : t("projectDetail.confirmDelete", "ຢືນຢັນລຶບ")}
              </Btn>
            </div>
          </div>
        </div>
      )}
      <div className="mt-5"><ActivityFeed entityType="project" entityId={String(id)} /></div>
    </Page>
  );
}

const fmtMoney = (v: unknown) => {
  const n = Number(v);
  return Number.isNaN(n) ? "-" : n.toLocaleString("en-US");
};

/** Empty state shared by every tab list. */
function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="py-12 text-center text-[var(--text-mute)]">
      <div className="mb-2 flex justify-center opacity-60">{icon}</div>
      <span className="text-xs font-semibold">{text}</span>
    </div>
  );
}

/** Project financial footprint pulled from SML/ERP (read-only). */
function SmlFinance({ loading, data }: { loading: boolean; data: any }) {
  const t = useT();
  if (loading || !data) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-[var(--text-mute)]">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-xs font-semibold">{t("projectDetail.loadingSml", "ກຳລັງໂຫຼດຂໍ້ມູນ SML...")}</span>
      </div>
    );
  }
  if (data.error) {
    return <div className="py-10 text-center text-xs font-semibold text-[var(--danger)]">{data.error}</div>;
  }
  if (!data.linked) {
    return (
      <div className="py-12 text-center text-[var(--text-mute)]">
        <Wallet size={32} className="mx-auto mb-2 opacity-60" />
        <p className="text-xs font-semibold">{t("projectDetail.noSmlBill", "ໂຄງການນີ້ຍັງບໍ່ໄດ້ອອກບິນຂາຍຢູ່ SML")}</p>
        {data.projectCode && <p className="mt-1 text-[11px]">{t("projectDetail.code", "ລະຫັດ")}: {data.projectCode}</p>}
      </div>
    );
  }
  const { bills, payments, expenses, totals, projectCode } = data;
  const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString("en-GB") : "—");
  const cards: { label: string; value: any; color: string }[] = [
    { label: t("projectDetail.billedValue", "ມູນຄ່າບິນຂາຍ"), value: totals.billed, color: "var(--info)" },
    { label: t("projectDetail.outstanding", "ຍັງຄ້າງຊຳລະ"), value: totals.outstanding, color: "var(--warning)" },
    { label: t("projectDetail.paid", "ຮັບຊຳລະແລ້ວ"), value: totals.paid, color: "var(--success)" },
    { label: t("projectDetail.expenseCost", "ຄ່າໃຊ້ຈ່າຍ/ຕົ້ນທຶນ"), value: totals.expense, color: "var(--danger)" },
  ];
  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] px-3 py-2.5">
            <div className="text-[10px] font-bold tracking-wide text-[var(--text-mute)]">{c.label}</div>
            <div className="mt-0.5 text-sm font-black tabular-nums" style={{ color: c.color }}>{fmtMoney(c.value)}</div>
          </div>
        ))}
      </div>
      <div className="text-[11px] font-semibold text-[var(--text-mute)]">
        {t("projectDetail.smlCode", "ລະຫັດ SML")}: <span className="font-mono text-[var(--text-soft)]">{projectCode}</span>
      </div>

      <SmlSection title={t("projectDetail.billList", "ລາຍການບິນຂາຍ")} count={bills.length} empty={t("projectDetail.noBills", "ບໍ່ມີບິນຂາຍ")}>
        <table className={tblCls}>
          <thead><tr>
            <th className={thCls}>{t("projectDetail.docNo", "ເລກທີ່")}</th><th className={thCls}>{t("common.date", "ວັນທີ")}</th><th className={thCls}>{t("projectDetail.type", "ປະເພດ")}</th><th className={thCls}>{t("common.customer", "ລູກຄ້າ")}</th><th className={`${thCls} text-right`}>{t("projectDetail.value", "ມູນຄ່າ")}</th><th className={`${thCls} text-right`}>{t("projectDetail.due", "ຄ້າງ")}</th>
          </tr></thead>
          <tbody>
            {bills.map((b: any, i: number) => (
              <tr key={b.doc_no || i} className={trHover}>
                <td className={`${tdCls} font-mono font-semibold text-[var(--text)]`}>{b.doc_no}</td>
                <td className={tdCls}>{fmtDate(b.doc_date)}</td>
                <td className={tdCls}>{b.doc_kind}</td>
                <td className={tdCls}>{b.cust_code || "—"}</td>
                <td className={`${tdCls} text-right font-semibold tabular-nums text-[var(--text)]`}>{fmtMoney(b.total_amount)}</td>
                <td className={`${tdCls} text-right tabular-nums text-[var(--warning)]`}>{b.balance_amount ? fmtMoney(b.balance_amount) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SmlSection>

      <SmlSection title={t("projectDetail.paymentList", "ລາຍການຊຳລະ")} count={payments.length} empty={t("projectDetail.noPayments", "ບໍ່ມີລາຍການຊຳລະ (ໜີ້ AR)")}>
        <table className={tblCls}>
          <thead><tr>
            <th className={thCls}>{t("projectDetail.docNo", "ເລກທີ່")}</th><th className={thCls}>{t("common.date", "ວັນທີ")}</th><th className={thCls}>{t("projectDetail.method", "ວິທີ")}</th><th className={`${thCls} text-right`}>{t("projectDetail.value", "ມູນຄ່າ")}</th><th className={`${thCls} text-right`}>{t("projectDetail.paidCol", "ຊຳລະ")}</th><th className={`${thCls} text-right`}>{t("projectDetail.debtBalance", "ຍອດໜີ້")}</th>
          </tr></thead>
          <tbody>
            {payments.map((p: any, i: number) => (
              <tr key={p.doc_no || i} className={trHover}>
                <td className={`${tdCls} font-mono font-semibold text-[var(--text)]`}>{p.doc_no}</td>
                <td className={tdCls}>{fmtDate(p.doc_date)}</td>
                <td className={tdCls}>{p.payment_method || "—"}</td>
                <td className={`${tdCls} text-right tabular-nums text-[var(--text)]`}>{fmtMoney(p.amount)}</td>
                <td className={`${tdCls} text-right font-semibold tabular-nums text-[var(--success)]`}>{fmtMoney(p.total_pay_money)}</td>
                <td className={`${tdCls} text-right tabular-nums text-[var(--warning)]`}>{fmtMoney(p.total_debt_balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SmlSection>

      <SmlSection title={t("projectDetail.expenseList", "ຄ່າໃຊ້ຈ່າຍ / ຕົ້ນທຶນ (ບັນຊີ)")} count={expenses.length} empty={t("projectDetail.noExpenses", "ບໍ່ມີຄ່າໃຊ້ຈ່າຍ")}>
        <table className={tblCls}>
          <thead><tr>
            <th className={thCls}>{t("projectDetail.accountCode", "ລະຫັດບັນຊີ")}</th><th className={thCls}>{t("projectDetail.accountName", "ຊື່ບັນຊີ")}</th><th className={`${thCls} text-right`}>{t("projectDetail.value", "ມູນຄ່າ")}</th>
          </tr></thead>
          <tbody>
            {expenses.map((e: any, i: number) => (
              <tr key={e.account_code || i} className={trHover}>
                <td className={`${tdCls} font-mono`}>{e.account_code}</td>
                <td className={`${tdCls} text-[var(--text)]`}>{e.account_name}</td>
                <td className={`${tdCls} text-right font-semibold tabular-nums text-[var(--danger)]`}>{fmtMoney(e.debit - e.credit)}</td>
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
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center gap-2 border-b border-[var(--border-soft)] bg-[var(--surface-sunken)] px-3 py-2">
        <span className="h-3.5 w-1 rounded bg-[var(--brand)]" />
        <h3 className="text-[12px] font-black text-[var(--text)]">{title}</h3>
        <Pill tone="neutral">{count}</Pill>
      </div>
      {count > 0 ? <div className="overflow-x-auto">{children}</div> : <div className="px-3 py-6 text-center text-[11px] font-semibold text-[var(--text-mute)]">{empty}</div>}
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
    return <Empty icon={<FileText size={32} />} text={t("projectDetail.noQuotations", "ຍັງບໍ່ມີໃບສະເໜີລາຄາ")} />;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <table className={tblCls}>
        <thead>
          <tr>
            <th className={thCls}>{t("projectDetail.docNo", "ເລກທີ່")}</th>
            <th className={thCls}>{t("common.date", "ວັນທີ")}</th>
            <th className={`${thCls} text-right`}>{t("projectDetail.value", "ມູນຄ່າ")}</th>
            <th className={thCls}>{t("common.status", "ສະຖານະ")}</th>
            <th className={`${thCls} text-right`}>{t("common.actions", "ຈັດການ")}</th>
          </tr>
        </thead>
        <tbody>
          {quotations.map((q, i) => {
            const status = (q.status ?? "").toString();
            const approved = status === "ອະນຸມັດແລ້ວ";
            const rejected = status === "ປະຕິເສດ";
            const tone: PillTone = approved ? "green" : rejected ? "red" : "amber";
            return (
              <tr key={q.id ?? i} className={trHover}>
                <td className={`${tdCls} font-mono font-semibold`}>
                  <Link href={`/quotations/${q.id}`} className="text-[var(--brand)] hover:underline">{q.quotation_no || "-"}</Link>
                </td>
                <td className={tdCls}>{(q.quotation_date ?? "").toString().slice(0, 10) || "-"}</td>
                <td className={`${tdCls} text-right font-semibold tabular-nums text-[var(--text)]`}>{fmtMoney(q.total_amount)}</td>
                <td className={tdCls}><Pill tone={tone}>{status || t("projectDetail.pendingApproval", "ລໍຖ້າອະນຸມັດ")}</Pill></td>
                <td className={tdCls}>
                  <div className="flex items-center justify-end gap-2">
                    {!approved && (
                      <MiniBtn tone="go" onClick={() => onSetStatus(q.id, "ອະນຸມັດແລ້ວ")}>
                        <Check size={12} /> {t("common.approve", "ອະນຸມັດ")}
                      </MiniBtn>
                    )}
                    {!rejected && !approved && (
                      <MiniBtn tone="danger" onClick={() => onSetStatus(q.id, "ປະຕິເສດ")}>
                        <X size={12} /> {t("common.reject", "ປະຕິເສດ")}
                      </MiniBtn>
                    )}
                    {approved && (
                      <MiniBtn tone="muted" onClick={() => onSetStatus(q.id, "ລໍຖ້າອະນຸມັດ")}>
                        {t("projectDetail.undoApprove", "ຍົກເລີກອະນຸມັດ")}
                      </MiniBtn>
                    )}
                    {onDelete && <DelBtn title={t("common.delete", "ລົບ")} onClick={() => onDelete(q.id)} />}
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
    return <Empty icon={<PackageOpen size={32} />} text={t("projectDetail.noRequests", "ຍັງບໍ່ມີການຂໍເບີກ")} />;
  }
  const stLabel = (s: string) => (s === "withdrawn" ? t("projectDetail.withdrawn", "ເບີກແລ້ວ") : s === "rejected" ? t("common.reject", "ປະຕິເສດ") : t("projectDetail.requested", "ຮ້ອງຂໍ"));
  const stTone = (s: string): PillTone => (s === "withdrawn" ? "green" : s === "rejected" ? "red" : "amber");
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <table className={tblCls}>
        <thead>
          <tr>
            <th className={thCls}>{t("projectDetail.docNo", "ເລກທີ່")}</th>
            <th className={thCls}>{t("common.date", "ວັນທີ")}</th>
            <th className={`${thCls} text-right`}>{t("projectDetail.itemsCol", "ລາຍການ")}</th>
            <th className={thCls}>{t("common.status", "ສະຖານະ")}</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r, i) => {
            const st = String(r.status || "requested");
            const items = Array.isArray(r.items) ? r.items : [];
            const isErp = r.src === "erp";
            return (
              <tr key={r.id ?? i} className={trHover}>
                <td className={`${tdCls} font-mono font-semibold`}>
                  <Link href={`/requests/${encodeURIComponent(r.id)}`} className="text-[var(--brand)] hover:underline">{r.request_no || "-"}</Link>
                  {isErp && (
                    <span className="ml-2 rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--text-mute)]">
                      {t("projectDetail.legacy", "ເກົ່າ")}
                    </span>
                  )}
                </td>
                <td className={tdCls}>{(r.created_at ?? "").toString().slice(0, 10) || "-"}</td>
                <td className={`${tdCls} text-right tabular-nums font-semibold text-[var(--text)]`}>{items.length}</td>
                <td className={tdCls}><Pill tone={stTone(st)}>{stLabel(st)}</Pill></td>
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
    return <Empty icon={<Boxes size={32} />} text={t("projectDetail.noMaterials", "ຍັງບໍ່ມີວັດສະດຸ (ຕ້ອງມີ BOQ ກ່ອນ)")} />;
  }
  const sum = (k: string) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <table className={tblCls}>
        <thead>
          <tr>
            <th className={thCls}>{t("projectDetail.itemsCol", "ລາຍການ")}</th>
            <th className={thCls}>{t("projectDetail.fromBoq", "ໃບ BOQ")}</th>
            <th className={thCls}>{t("common.unit", "ໜ່ວຍ")}</th>
            <th className={`${thCls} text-right`}>{t("projectDetail.boqTotal", "ຍອດ BOQ")}</th>
            <th className={`${thCls} text-right`}>{t("projectDetail.requestMaterial", "ຂໍເບີກ")}</th>
            <th className={`${thCls} text-right`}>{t("projectDetail.withdrawn", "ເບີກແລ້ວ")}</th>
            <th className={`${thCls} text-right`}>{t("projectDetail.remaining", "ຄົງເຫຼືອ")}</th>
            <th className={`${thCls} text-center`}>{t("common.status", "ສະຖານະ")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const remain = Number(r.remaining) || 0;
            const requested = Number(r.request_qty) || 0;
            const withdrawn = Number(r.withdraw_qty) || 0;
            const status = withdrawn > 0 ? "withdrawn" : requested > 0 ? "requested" : "available";
            return (
              <tr key={i} className={trHover}>
                <td className={tdCls}>
                  <TwoLine
                    primary={r.description || r.item_code || "-"}
                    secondary={r.item_code ? <span className="font-mono">{t("projectDetail.itemCode", "ລະຫັດ")}: {r.item_code}</span> : undefined}
                  />
                  {Array.isArray(r.substitutes) && r.substitutes.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.substitutes.map((s: any, si: number) => (
                        <span key={si} className="inline-flex items-center gap-1 rounded bg-[var(--warning-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--warning)]">
                          ↻ {t("projectDetail.substitutedTo", "ປ່ຽນເປັນ")}: <span className="font-mono">{s.code}</span>{s.name ? ` · ${s.name}` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className={tdCls}>
                  {Array.isArray(r.boq_docs) && r.boq_docs.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1">
                      {r.boq_docs.map((dn: string) => (
                        <Link
                          key={dn}
                          href={`/boq/${encodeURIComponent(dn)}`}
                          className="rounded bg-[var(--brand-soft)] px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-[var(--brand-strong)] hover:opacity-80"
                        >
                          {dn}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[var(--text-mute)]">-</span>
                  )}
                </td>
                <td className={tdCls}>{r.unit || "-"}</td>
                <td className={`${tdCls} text-right tabular-nums`}>{(Number(r.boq_qty) || 0).toLocaleString("en-US")}</td>
                <td className={`${tdCls} text-right font-semibold tabular-nums text-[var(--warning)]`}>{(Number(r.request_qty) || 0).toLocaleString("en-US")}</td>
                <td className={`${tdCls} text-right font-semibold tabular-nums text-[var(--success)]`}>{(Number(r.withdraw_qty) || 0).toLocaleString("en-US")}</td>
                <td className={`${tdCls} text-right font-bold tabular-nums ${remain > 0 ? "text-[var(--text)]" : "text-[var(--text-mute)]"}`}>{remain.toLocaleString("en-US")}</td>
                <td className={`${tdCls} text-center`}>
                  {status === "withdrawn" ? (
                    <Pill tone="green">{t("projectDetail.withdrawn", "ເບີກແລ້ວ")}</Pill>
                  ) : status === "requested" ? (
                    <Pill tone="amber">{t("projectDetail.pendingWithdraw", "ລໍຖ້າເບີກ")}</Pill>
                  ) : (
                    <Pill tone="neutral">{t("projectDetail.notRequested", "ຍັງບໍ່ຂໍເບີກ")}</Pill>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-[var(--surface-sunken)] font-bold">
            <td className={`${tdCls} text-[var(--text)]`} colSpan={3}>{t("common.total", "ລວມ")}</td>
            <td className={`${tdCls} text-right tabular-nums text-[var(--text)]`}>{sum("boq_qty").toLocaleString("en-US")}</td>
            <td className={`${tdCls} text-right tabular-nums text-[var(--warning)]`}>{sum("request_qty").toLocaleString("en-US")}</td>
            <td className={`${tdCls} text-right tabular-nums text-[var(--success)]`}>{sum("withdraw_qty").toLocaleString("en-US")}</td>
            <td className={`${tdCls} text-right tabular-nums text-[var(--brand)]`}>{sum("remaining").toLocaleString("en-US")}</td>
            <td className={tdCls} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function WorkOrderList({ workorders, onEdit, onDelete }: { workorders: any[]; onEdit?: (id: any) => void; onDelete?: (id: any) => void }) {
  const t = useT();
  if (!workorders.length) {
    return <Empty icon={<Wrench size={32} />} text={t("projectDetail.noWorkOrders", "ຍັງບໍ່ມີໃບງານ")} />;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <table className={tblCls}>
        <thead>
          <tr>
            <th className={thCls}>{t("projectDetail.workOrderWord", "ໃບງານ")}</th>
            <th className={thCls}>{t("projectDetail.team", "ທີມ")}</th>
            <th className={thCls}>{t("common.date", "ວັນທີ")}</th>
            <th className={`${thCls} text-right`}>{t("projectDetail.hours", "ຊົ່ວໂມງ")}</th>
            <th className={`${thCls} text-right`}>{t("projectDetail.laborCost", "ຄ່າແຮງ")}</th>
            <th className={`${thCls} text-right`}>{t("common.actions", "ຈັດການ")}</th>
          </tr>
        </thead>
        <tbody>
          {workorders.map((w, i) => (
            <tr key={w.id ?? i} className={trHover}>
              <td className={`${tdCls} font-mono font-semibold`}>
                <Link href={`/work-orders/${w.id}`} className="text-[var(--brand)] hover:underline">{w.work_no || "-"}</Link>
              </td>
              <td className={`${tdCls} font-semibold text-[var(--text)]`}>{w.technician_name || "-"}</td>
              <td className={tdCls}>{(w.work_date ?? w.created_at ?? "").toString().slice(0, 10) || "-"}</td>
              <td className={`${tdCls} text-right tabular-nums`}>{Number(w.total_hours) || 0}</td>
              <td className={`${tdCls} text-right font-semibold tabular-nums text-[var(--text)]`}>{fmtMoney(w.labor_cost)}</td>
              <td className={tdCls}>
                <div className="flex items-center justify-end">
                  {/* Editable only before the work order enters the flow (not yet approved/accepted). */}
                  {onEdit && canEditWorkOrder(w) && <EditBtn title={t("common.edit", "ແກ້ໄຂ")} onClick={() => onEdit(w.id)} />}
                  {onDelete && <DelBtn title={t("common.delete", "ລົບ")} onClick={() => onDelete(w.id)} />}
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
    return <Empty icon={<CalendarRange size={32} />} text={t("projectDetail.noTasks", "ຍັງບໍ່ໄດ້ກຳນົດໜ້າວຽກ")} />;
  }
  const totalDays = tasks.reduce((s, tk) => s + (Number(tk.est_days) || 0), 0);
  const totalHours = tasks.reduce((s, tk) => s + (Number(tk.est_hours) || 0), 0);
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <table className={tblCls}>
        <thead>
          <tr>
            <th className={thCls}>{t("projectDetail.taskCol", "ໜ້າວຽກ")}</th>
            <th className={thCls}>{t("projectDetail.phase", "ໄລຍະ")}</th>
            <th className={`${thCls} text-right`}>{t("projectDetail.days", "ວັນ")}</th>
            <th className={`${thCls} text-right`}>{t("projectDetail.hours", "ຊົ່ວໂມງ")}</th>
            <th className={thCls}>{t("projectDetail.team", "ທີມ")}</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((tk, i) => (
            <tr key={tk.id ?? i} className={trHover}>
              <td className={`${tdCls} font-semibold text-[var(--text)]`}>{tk.title}</td>
              <td className={tdCls}>{tk.phase || "-"}</td>
              <td className={`${tdCls} text-right font-semibold tabular-nums text-[var(--text)]`}>{Number(tk.est_days) || 0}</td>
              <td className={`${tdCls} text-right font-semibold tabular-nums text-[var(--text)]`}>{Number(tk.est_hours) || 0}</td>
              <td className={tdCls}>{tk.technician_name || t("projectDetail.assignLater", "— ກຳນົດຕາມຫຼັງ")}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-[var(--surface-sunken)] font-bold">
            <td className={`${tdCls} text-[var(--text)]`} colSpan={2}>{t("common.total", "ລວມ")}</td>
            <td className={`${tdCls} text-right tabular-nums text-[var(--brand)]`}>{totalDays} {t("projectDetail.days", "ວັນ")}</td>
            <td className={`${tdCls} text-right tabular-nums text-[var(--brand)]`}>{totalHours} {t("overview.hoursUnit", "ຊມ")}</td>
            <td className={tdCls} />
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
    return <Empty icon={<ListChecks size={32} />} text={t("projectDetail.noBoq", "ຍັງບໍ່ມີ BOQ")} />;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <table className={tblCls}>
        <thead>
          <tr>
            <th className={thCls}>{t("projectDetail.boqNo", "BOQ ເລກທີ່")}</th>
            <th className={thCls}>{t("common.date", "ວັນທີ")}</th>
            <th className={thCls}>{t("projectDetail.requester", "ຜູ້ຂໍ")}</th>
            <th className={thCls}>{t("common.approver", "ຜູ້ອະນຸມັດ")}</th>
            <th className={thCls}>{t("common.status", "ສະຖານະ")}</th>
            <th className={`${thCls} text-right`}>{t("common.actions", "ຈັດການ")}</th>
          </tr>
        </thead>
        <tbody>
          {boqs.map((b, i) => {
            const docNo = b.doc_no || b.boq_no || "";
            const apv = Number(b.approve_status);
            const status = apv === 1 ? "ອະນຸມັດແລ້ວ" : apv === 2 ? "ປະຕິເສດ" : "ລໍຖ້າອະນຸມັດ";
            const approved = status === "ອະນຸມັດແລ້ວ";
            const rejected = status === "ປະຕິເສດ";
            const tone: PillTone = approved ? "green" : rejected ? "red" : "amber";
            // 2nd+ BOQ of a contract: only an admin OR a user granted the boq
            // "approve_next" permission may approve/reject/reset.
            const canApprove = canApproveNext || firstDocNos.has(String(docNo));
            return (
              <tr key={docNo || i} className={trHover}>
                <td className={`${tdCls} font-mono font-semibold`}>
                  <Link href={`/boq/${encodeURIComponent(docNo)}`} className="text-[var(--brand)] hover:underline">{docNo || "-"}</Link>
                </td>
                <td className={tdCls}>{(b.doc_date ?? "").toString().slice(0, 10) || "-"}</td>
                <td className={tdCls}>{b.user_created || "-"}</td>
                <td className={tdCls}>{b.approver || "-"}</td>
                <td className={tdCls}><Pill tone={tone}>{statusLabel(status)}</Pill></td>
                <td className={tdCls}>
                  <div className="flex items-center justify-end gap-2">
                    {canApprove && !approved && (
                      <MiniBtn tone="go" onClick={() => onSetStatus(docNo, "ອະນຸມັດແລ້ວ")}>
                        <Check size={12} /> {t("common.approve", "ອະນຸມັດ")}
                      </MiniBtn>
                    )}
                    {canApprove && !rejected && !approved && (
                      <MiniBtn tone="danger" onClick={() => onSetStatus(docNo, "ປະຕິເສດ")}>
                        <X size={12} /> {t("common.reject", "ປະຕິເສດ")}
                      </MiniBtn>
                    )}
                    {canApprove && (approved || rejected) && (
                      <MiniBtn tone="muted" onClick={() => onSetStatus(docNo, "ລໍຖ້າອະນຸມັດ")}>
                        {t("common.cancel", "ຍົກເລີກ")}
                      </MiniBtn>
                    )}
                    {!canApprove && !approved && !rejected && (
                      <span className="text-[10px] font-bold text-[var(--warning)]">{t("projectDetail.needAdminApprove", "ຕ້ອງໃຫ້ຜູ້ດູແລລະບົບ ຫຼື ຜູ້ມີສິດອະນຸມັດໃບຕໍ່ໄປ")}</span>
                    )}
                    {onDelete && <DelBtn title={t("common.delete", "ລົບ")} onClick={() => onDelete(b)} />}
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
  canApprove = false,
}: {
  contracts: any[];
  onApprove: (c: any, which: "sales" | "accounting", approved: boolean) => void;
  onDelete?: (c: any) => void;
  canApprove?: boolean;
}) {
  const t = useT();
  if (!contracts.length) {
    return <Empty icon={<FileSignature size={32} />} text={t("projectDetail.noContracts", "ຍັງບໍ່ມີສັນຍາ")} />;
  }
  return (
    <div className="space-y-3">
      {contracts.map((c, i) => {
        const isErp = c.src === "erp";
        const sales = isErp ? Number(c.approve_status_1) === 1 : !!c.sales_approved;
        const accounting = isErp
          ? Math.max(Number(c.approve_status_2) || 0, Number(c.acc_approve) || 0) === 1
          : !!c.accounting_approved;
        // "ສົມບູນ" only when BOTH approvals are in — same rule as the stepper.
        const full = isContractApproved(c);
        return (
          <div key={c.id ?? c.contract_no ?? i} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-soft)] pb-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-extrabold text-[var(--text)]">{c.contract_no || "-"}</span>
                  <Pill tone={full ? "green" : "amber"}>{full ? t("projectDetail.complete", "ສົມບູນ") : t("projectDetail.pendingApproval", "ລໍຖ້າອະນຸມັດ")}</Pill>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-[var(--text-mute)]">
                  <span className="font-bold text-[var(--brand)]">{t("projectDetail.value", "ມູນຄ່າ")} {fmtMoney(c.total_amount)}</span>
                  {c.sign_date && <span className="text-[var(--border-strong)]">|</span>}
                  {c.sign_date && <span>{t("projectDetail.signDate", "ເຊັນວັນທີ")}: {String(c.sign_date).slice(0, 10)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <Link
                  href={isErp ? `/contracts/${encodeURIComponent(c.contract_no || "")}` : `/contracts/${c.id}`}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold text-[var(--brand)] transition-colors hover:bg-[var(--brand-tint)]"
                >
                  {t("common.detail", "ລາຍລະອຽດ")} →
                </Link>
                {onDelete && <DelBtn title={t("common.delete", "ລົບ")} onClick={() => onDelete(c)} />}
              </div>
            </div>
            {/* BOTH approvals — a contract is only complete when sales AND accounting are in. */}
            <div className="mt-3 flex flex-wrap gap-3">
              <ApprovalCell
                label={t("projectDetail.salesManager", "ຜູ້ຈັດການຝ່າຍຂາຍ")}
                approved={sales}
                approver={isErp ? c.approver_1 : c.sales_approver}
                onApprove={canApprove ? () => onApprove(c, "sales", true) : undefined}
                onUndo={!isErp && canApprove ? () => onApprove(c, "sales", false) : undefined}
              />
              <ApprovalCell
                label={t("projectDetail.accounting", "ບັນຊີ")}
                approved={accounting}
                approver={isErp ? c.acc_approver || c.approver_2 : c.accounting_approver}
                locked={!sales}
                lockedHint={t("projectDetail.waitSalesApprove", "ລໍຖ້າຝ່າຍຂາຍອະນຸມັດ")}
                onApprove={canApprove ? () => onApprove(c, "accounting", true) : undefined}
                onUndo={!isErp && canApprove ? () => onApprove(c, "accounting", false) : undefined}
              />
            </div>
            {isErp && (
              <p className="mt-2 text-[10px] font-semibold text-[var(--text-mute)]">
                {t("projectDetail.erpNoUndo", "ສັນຍາເກົ່າ (ERP) — ການອະນຸມັດຍົກເລີກບໍ່ໄດ້")}
              </p>
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
  /** Omitted when the user has no contracts.approve permission. */
  onApprove?: () => void;
  onUndo?: () => void;
}) {
  const t = useT();
  const blocked = !!locked && !approved;
  return (
    <div className={`flex flex-wrap items-center gap-2.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-sunken)] px-3 py-2 text-xs ${blocked ? "opacity-70" : ""}`}>
      <span className="font-bold text-[var(--text-mute)]">{label}:</span>
      {approved ? (
        <div className="flex items-center gap-2">
          <Pill tone="green">✓ {t("status.approved", "ອະນຸມັດແລ້ວ")}</Pill>
          {approver && <span className="text-[10px] font-bold text-[var(--text-mute)]">{t("projectDetail.by", "ໂດຍ")}: {approver}</span>}
          {onUndo && (
            <button onClick={onUndo} className="text-[10px] font-bold text-[var(--text-mute)] transition-colors hover:text-[var(--danger)]">
              {t("common.cancel", "ຍົກເລີກ")}
            </button>
          )}
        </div>
      ) : blocked ? (
        <span className="text-[10px] font-bold text-[var(--text-mute)]">🔒 {lockedHint || t("projectDetail.waitPrevStep", "ລໍຖ້າຂັ້ນຕອນກ່ອນໜ້າ")}</span>
      ) : onApprove ? (
        <MiniBtn tone="go" onClick={onApprove}>
          <Check size={12} /> {t("common.approve", "ອະນຸມັດ")}
        </MiniBtn>
      ) : (
        <Pill tone="amber">{t("projectDetail.waiting", "ລໍຖ້າ")}</Pill>
      )}
    </div>
  );
}

function SurveyList({ surveys, onEdit, onDelete }: { surveys: any[]; onEdit?: (id: any) => void; onDelete?: (id: any) => void }) {
  const t = useT();
  if (!surveys.length) {
    return <Empty icon={<MapPin size={32} />} text={t("projectDetail.noSurvey", "ຍັງບໍ່ໄດ້ສຳຫຼວດ")} />;
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
          <div key={s.id ?? i} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-soft)] pb-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-extrabold text-[var(--text)]">
                  {(s.survey_date ?? "").toString().slice(0, 10) || "-"}
                </span>
                {s.surveyor && (
                  <Pill tone="brand">
                    {t("projectDetail.by", "ໂດຍ")}: {s.surveyor}
                  </Pill>
                )}
              </div>
              <div className="flex items-center gap-3">
                {d.condition && <Pill tone="neutral">{t("projectDetail.condition", "ສະພາບ")}: {d.condition}</Pill>}
                {onEdit && <EditBtn title={t("common.edit", "ແກ້ໄຂ")} onClick={() => onEdit(s.id)} />}
                {onDelete && <DelBtn title={t("common.delete", "ລົບ")} onClick={() => onDelete(s.id)} />}
              </div>
            </div>

            {meas.length > 0 && (
              <div className="mb-3.5">
                <div className="mb-2 text-[10px] font-bold tracking-wider text-[var(--text-mute)]">{t("projectDetail.measurements", "ຜົນການວັດແທກ")}</div>
                <div className="flex flex-wrap gap-2">
                  {meas.map((m: any, j: number) => (
                    <span key={j} className="rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] px-3 py-1 text-xs text-[var(--text-soft)]">
                      {m.label}: <b className="font-bold text-[var(--brand)]">{m.value}</b> {m.unit}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {mats.length > 0 && (
              <div className="mb-3.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-sunken)] p-3">
                <span className="mb-1.5 block text-xs font-bold text-[var(--text)]">{t("projectDetail.initialMaterials", "ວັດສະດຸເບື້ອງຕົ້ນ")}:</span>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-soft)]">
                  {mats.map((m: any, j: number) => (
                    <span key={j} className="inline-flex items-center gap-1.5 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
                      {m.item} ({m.qty} {m.unit || t("common.unit", "ໜ່ວຍ")})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(c.power || c.wallType || c.access || c.obstacles) && (
              <div className="mb-3.5">
                <div className="mb-2 text-[10px] font-bold tracking-wider text-[var(--text-mute)]">{t("projectDetail.siteChecklist", "ລາຍການກວດສອບໜ້າງານ")}</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {c.power && <CheckCell label={t("projectDetail.power", "ໄຟຟ້າ")} value={c.power} />}
                  {c.wallType && <CheckCell label={t("projectDetail.wallCeiling", "ຝາ/ເພດານ")} value={c.wallType} />}
                  {c.access && <CheckCell label={t("projectDetail.access", "ທາງເຂົ້າ")} value={c.access} />}
                  {c.obstacles && <CheckCell label={t("projectDetail.obstacles", "ອຸປະສັກ")} value={c.obstacles} />}
                </div>
              </div>
            )}

            {photos.length > 0 && (
              <div className="mb-3">
                <div className="mb-2 text-[10px] font-bold tracking-wider text-[var(--text-mute)]">{t("projectDetail.sitePhotos", "ຮູບພາບໜ້າງານ")}</div>
                <div className="flex flex-wrap gap-2">
                  {photos.map((url: string, j: number) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={j} src={url} alt="" className="h-16 w-16 cursor-zoom-in rounded-xl object-cover ring-1 ring-[var(--border)] transition-all duration-300 hover:scale-105 hover:ring-[var(--brand)]" />
                  ))}
                </div>
              </div>
            )}

            {s.findings && (
              <div className="mt-3 rounded-xl border border-[var(--border-soft)] bg-[var(--brand-tint)] p-3 text-xs font-medium leading-relaxed text-[var(--text-soft)]">
                <span className="mb-0.5 block font-bold text-[var(--brand-strong)]">{t("projectDetail.additionalNotes", "ຂໍ້ສັງເກດເພີ່ມເຕີມ")}:</span>
                {s.findings}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CheckCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-sunken)] p-2.5 text-xs">
      <span className="block text-[10px] font-semibold text-[var(--text-mute)]">{label}:</span>
      <span className="font-bold text-[var(--text)]">{value}</span>
    </div>
  );
}

/* ── Small in-table controls ─────────────────────────────────────────────── */

function MiniBtn({ tone, onClick, children }: { tone: "go" | "danger" | "muted"; onClick: () => void; children: React.ReactNode }) {
  const cls =
    tone === "go"
      ? "border border-[var(--go)] bg-[var(--surface)] text-[var(--go)] hover:bg-[var(--go-soft)]"
      : tone === "danger"
        ? "border border-[var(--danger)] bg-[var(--surface)] text-[var(--danger)] hover:bg-[var(--danger-soft)]"
        : "border border-transparent text-[var(--text-mute)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text)]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold transition-all active:scale-[0.97] ${cls}`}
    >
      {children}
    </button>
  );
}

function EditBtn({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-mute)] transition-colors hover:bg-[var(--brand-tint)] hover:text-[var(--brand)]"
    >
      <Pencil size={13} />
    </button>
  );
}

function DelBtn({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-mute)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
    >
      <Trash2 size={13} />
    </button>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border-b border-[var(--border-soft)] px-2 py-2.5 text-[13px] transition-colors hover:bg-[var(--surface-sunken)]">
      <dt className="font-semibold text-[var(--text-mute)]">{label}</dt>
      <dd className="text-right font-bold text-[var(--text)]">{value || "-"}</dd>
    </div>
  );
}

/** Info row inside the identity card (left rail). */
function RailRow({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text-mute)]">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold tracking-wider text-[var(--text-mute)]">{label}</div>
        <div className={`break-words text-[12px] font-bold text-[var(--text)] ${mono ? "font-mono" : ""}`}>{value}</div>
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
    { key: "close", label: "ກວດຮັບ/ປິດງານ", icon: <ClipboardCheck size={13} strokeWidth={2.5} /> },
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
          circleCls = "border-[var(--success)] bg-[var(--success)] text-white";
          labelCls = "text-[var(--success)] font-bold";
        } else if (isCurrent) {
          circleCls = "border-[var(--ink)] bg-[var(--ink)] text-[var(--ink-text)]";
          labelCls = "text-[var(--text)] font-black";
        } else if (isNa) {
          circleCls = "border-dashed border-[var(--border)] bg-[var(--surface)] text-[var(--text-mute)]";
          labelCls = "text-[var(--text-mute)] font-medium";
        } else {
          circleCls = "border-[var(--border)] bg-[var(--surface)] text-[var(--text-mute)]";
          labelCls = "text-[var(--text-soft)] font-semibold";
        }

        const lineBg = isDone ? "bg-[var(--success)]" : "bg-[var(--border)]";

        return (
          <li key={stage.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border-2 transition-all ${circleCls}`}>
                {isCurrent && <span className="absolute inset-0 animate-ping rounded-lg bg-[var(--ink)] opacity-20" />}
                {isDone ? <Check size={14} strokeWidth={3} className="relative z-10" /> : <span className="relative z-10">{def.icon}</span>}
              </div>
              {!isLast && <div className={`my-1 min-h-[14px] w-[2px] flex-1 rounded-full ${lineBg}`} />}
            </div>
            <div className="pb-4">
              <div className={`text-[12px] leading-tight ${labelCls}`}>{stage.label}</div>
              {stage.detail && <div className="mt-0.5 text-[10px] leading-tight text-[var(--text-mute)]">{stage.detail}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
