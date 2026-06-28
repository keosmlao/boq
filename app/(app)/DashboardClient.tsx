"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  FileText,
  FolderKanban,
  ListChecks,
  Loader2,
  PackageOpen,
  Plus,
  TrendingUp,
  Wallet,
  Wrench,
} from "lucide-react";
import { can } from "@/_lib/permissions";
import { getV2User, type V2User } from "../_lib/session";
import { Page } from "./_components/ui";
import DashboardActivity from "./_components/DashboardActivity";
import { useT } from "@/_lib/i18n";

const text = (value: unknown) => String(value ?? "").trim();
const money = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "0";
};

const LAO_DAYS = ["ອາທິດ", "ຈັນ", "ອັງຄານ", "ພຸດ", "ພະຫັດ", "ສຸກ", "ເສົາ"];
const LAO_MONTHS = ["ມັງກອນ", "ກຸມພາ", "ມີນາ", "ເມສາ", "ພຶດສະພາ", "ມິຖຸນາ", "ກໍລະກົດ", "ສິງຫາ", "ກັນຍາ", "ຕຸລາ", "ພະຈິກ", "ທັນວາ"];
const laoDate = (date: Date) => `ວັນ${LAO_DAYS[date.getDay()]} ທີ ${date.getDate()} ${LAO_MONTHS[date.getMonth()]} ${date.getFullYear()}`;

const NEXT_ACTIONS: Record<string, { label: string; key: string; href?: string }> = {
  "ລົງທະບຽນ": { label: "ບັນທຶກການສຳຫຼວດ", key: "overview.next.recordSurvey" },
  "ສຳຫຼວດ": { label: "ສ້າງໃບສະເໜີລາຄາ", key: "overview.next.createQuotation" },
  "ສະເໜີລາຄາ": { label: "ຕິດຕາມການອະນຸມັດ", key: "overview.next.trackApproval", href: "/quotations" },
  "ສັນຍາ": { label: "ສ້າງ BOQ", key: "overview.next.createBoq" },
  BOQ: { label: "ກຳນົດໜ້າວຽກ", key: "overview.next.planTasks" },
  "ກຳນົດໜ້າວຽກ": { label: "ອອກໃບງານ", key: "overview.next.issueWorkOrder" },
  "ໃບງານ": { label: "ຕິດຕາມການຕິດຕັ້ງ", key: "overview.next.trackInstall", href: "/work-orders" },
  "ລໍຖ້າດຳເນີນ": { label: "ເປີດເບິ່ງ ແລະ ດຳເນີນຕໍ່", key: "overview.next.openContinue" },
};

const STAGE_TONES = [
  "bg-slate-700",
  "bg-slate-600",
  "bg-slate-500",
  "bg-slate-500",
  "bg-slate-400",
  "bg-slate-500",
  "bg-slate-500",
];

export default function DashboardClient({
  initialProjects,
  initialStats,
  initialRevenue,
  initialTeams,
  initialInstall,
}: {
  initialProjects: any;
  initialStats: any;
  initialRevenue: any;
  initialTeams?: any;
  initialInstall?: any;
}) {
  const router = useRouter();
  const t = useT();
  const [rows] = useState<any[]>(initialProjects ?? []);
  const [dashboard] = useState<any>(initialStats ?? null);
  const [revenue] = useState<any>(initialRevenue ?? null);
  const [teams] = useState<any>(initialTeams ?? null);
  const [install] = useState<any>(initialInstall ?? null);
  const [user, setUser] = useState<V2User | null>(null);
  const [today, setToday] = useState("");
  const [loading] = useState(false);

  React.useEffect(() => {
    setUser(getV2User());
    setToday(laoDate(new Date()));
  }, []);

  const stats = useMemo(() => {
    const total = Number(dashboard?.total ?? rows.length);
    const closed = Number(dashboard?.completed ?? rows.filter((row) => text(row.project_status) === "ປິດໂຄງການ").length);
    const active = Number(dashboard?.active ?? Math.max(total - closed, 0));
    const pending = Number(dashboard?.pending ?? rows.filter((row) => text(row.project_status).startsWith("ລໍຖ້າ")).length);
    return { total, active, pending, closed };
  }, [dashboard, rows]);

  const pipeline = useMemo(() => {
    const entries = Object.entries(dashboard?.byStatus || {})
      .map(([label, value]) => ({ label, value: Number(value) || 0 }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
    const max = Math.max(...entries.map((item) => item.value), 1);
    return entries.map((item, index) => ({ ...item, pct: (item.value / max) * 100, tone: STAGE_TONES[index % STAGE_TONES.length] }));
  }, [dashboard]);

  const actionRows = useMemo(
    () => rows.filter((row) => text(row.project_status) !== "ປິດໂຄງການ").slice(0, 7),
    [rows],
  );

  const quickActions = [
    { label: t("overview.quick.registerProject", "ລົງທະບຽນໂຄງການ"), detail: t("overview.quick.registerProjectDetail", "ເລີ່ມວຽກຂາຍໃໝ່"), href: "/projects/new", module: "projects", icon: <FolderKanban size={17} /> },
    { label: t("overview.quick.createQuotation", "ສ້າງໃບສະເໜີລາຄາ"), detail: t("overview.quick.createQuotationDetail", "ເລືອກໂຄງການກ່ອນ"), href: "/projects", module: "quotations", icon: <FileText size={17} /> },
    { label: t("overview.quick.reviewBoq", "ກວດ BOQ"), detail: t("overview.quick.reviewBoqDetail", "ຕິດຕາມການອະນຸມັດ"), href: "/boq", module: "boq", icon: <ListChecks size={17} /> },
    { label: t("overview.quick.issueWorkOrder", "ອອກໃບງານ"), detail: t("overview.quick.issueWorkOrderDetail", "ຈັດຊ່າງ ແລະ ວັນເຮັດວຽກ"), href: "/work-orders", module: "work-orders", icon: <Wrench size={17} /> },
  ].filter((item) => can(user, item.module, "create"));

  const attention = [
    {
      label: t("overview.attention.pending", "ລໍຖ້າການອະນຸມັດ"),
      value: stats.pending,
      detail: t("overview.attention.pendingDetail", "ຄວນກວດ ແລະ ຕິດຕາມກ່ອນ"),
      href: "/projects",
      tone: "border-slate-200 bg-slate-100 text-slate-700",
      icon: <CircleAlert size={16} />,
    },
    {
      label: t("overview.attention.active", "ໂຄງການກຳລັງດຳເນີນ"),
      value: stats.active,
      detail: t("overview.attention.activeDetail", "ໂຄງການທີ່ຍັງບໍ່ປິດ"),
      href: "/projects",
      tone: "border-slate-300 bg-slate-100 text-slate-800",
      icon: <TrendingUp size={16} />,
    },
    {
      label: t("overview.attention.closed", "ປິດໂຄງການແລ້ວ"),
      value: stats.closed,
      detail: t("overview.attention.closedDetail", "ພ້ອມກວດຜົນ ແລະ ລາຍງານ"),
      href: "/reports",
      tone: "border-slate-200 bg-slate-100 text-slate-700",
      icon: <CheckCircle2 size={16} />,
    },
  ];

  return (
    <Page max="max-w-none">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700">{today || t("overview.todayOverview", "ພາບລວມມື້ນີ້")}</p>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 md:text-[2rem]">
            {t("overview.greeting", "ສະບາຍດີ")}{user?.name ? `, ${user.name}` : ""}
          </h1>
          <p className="mt-1 text-[12.5px] font-medium text-slate-500">{t("overview.intro", "ກວດວຽກສຳຄັນ ແລະ ດຳເນີນຂັ້ນຕອນຕໍ່ໄປຈາກໜ້ານີ້.")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/schedule" className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-600 hover:border-slate-300 hover:bg-slate-50">
            <CalendarRange size={14} /> {t("overview.schedule", "ຕາຕະລາງວຽກ")}
          </Link>
          {can(user, "projects", "create") && (
            <Link href="/projects/new" className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-700 px-3.5 text-xs font-bold text-white shadow-sm shadow-slate-700/25 hover:bg-slate-800">
              <Plus size={14} strokeWidth={3} /> {t("overview.newProject", "ໂຄງການໃໝ່")}
            </Link>
          )}
        </div>
      </header>

      <section className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        {attention.map((item) => (
          <Link key={item.label} href={item.href} className={`group rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${item.tone}`}>
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/70">{item.icon}</span>
              <ArrowUpRight size={15} className="opacity-45 transition group-hover:opacity-100" />
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider opacity-75">{item.label}</p>
                <p className="mt-1 text-[11px] font-semibold opacity-65">{item.detail}</p>
              </div>
              <strong className="font-display text-3xl leading-none tabular-nums">{loading ? "—" : item.value}</strong>
            </div>
          </Link>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="flex items-center gap-2 text-[13px] font-black text-slate-900">
                  <ClipboardList size={16} className="text-slate-700" /> {t("overview.tasksToContinue", "ວຽກທີ່ຕ້ອງດຳເນີນຕໍ່")}
                </h2>
                <p className="mt-1 text-[11px] font-medium text-slate-400">{t("overview.tasksToContinueHint", "ເປີດໂຄງການ ຫຼື ໄປຫາໜ້າວຽກທີ່ກ່ຽວຂ້ອງໄດ້ທັນທີ")}</p>
              </div>
              <Link href="/projects" className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:underline">
                {t("overview.viewAllProjects", "ເບິ່ງໂຄງການທັງໝົດ")} <ArrowRight size={13} />
              </Link>
            </div>
            {loading ? (
              <div className="flex h-60 items-center justify-center text-slate-400"><Loader2 size={22} className="animate-spin" /></div>
            ) : actionRows.length === 0 ? (
              <div className="flex h-60 flex-col items-center justify-center gap-2 text-slate-400">
                <CheckCircle2 size={30} className="text-slate-400" />
                <span className="text-xs font-semibold">{t("overview.noPendingTasks", "ບໍ່ມີວຽກຄ້າງດຳເນີນ")}</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {actionRows.map((row, index) => {
                  const nextRaw = NEXT_ACTIONS[text(row.project_status)];
                  const next = nextRaw
                    ? { label: t(nextRaw.key, nextRaw.label), href: nextRaw.href }
                    : { label: t("overview.next.openProject", "ເປີດເບິ່ງໂຄງການ"), href: undefined as string | undefined };
                  const projectHref = `/projects/${encodeURIComponent(String(row.id))}`;
                  return (
                    <div key={row.id ?? index} className="group flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50">
                      <button onClick={() => router.push(projectHref)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 font-display text-[11px] font-bold text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-800">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-bold text-slate-900">{row.project_name || t("overview.unnamedProject", "(ບໍ່ມີຊື່ໂຄງການ)")}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{row.project_status || "-"}</span>
                            <span className="truncate text-[10.5px] font-medium text-slate-400">{row.customer_name || row.sml_code || t("overview.noCustomer", "ບໍ່ລະບຸລູກຄ້າ")}</span>
                          </span>
                        </span>
                      </button>
                      <button
                        onClick={() => router.push(next.href || projectHref)}
                        className="hidden flex-shrink-0 items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-[11px] font-bold text-slate-800 transition hover:bg-slate-200 sm:inline-flex"
                      >
                        {next.label} <ArrowRight size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-[13px] font-black text-slate-900">{t("overview.pipelineTitle", "ພາບລວມ Pipeline")}</h2>
                <p className="mt-1 text-[11px] font-medium text-slate-400">{t("overview.pipelineHint", "ຈຳນວນໂຄງການໃນແຕ່ລະຂັ້ນຕອນ")}</p>
              </div>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">{stats.total} {t("overview.projectsUnit", "ໂຄງການ")}</span>
            </div>
            {loading ? (
              <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-7 animate-pulse rounded-lg bg-slate-100" />)}</div>
            ) : pipeline.length === 0 ? (
              <p className="py-10 text-center text-xs font-semibold text-slate-400">{t("overview.noPipeline", "ຍັງບໍ່ມີຂໍ້ມູນ Pipeline")}</p>
            ) : (
              <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
                {pipeline.map((stage) => (
                  <div key={stage.label} className="grid grid-cols-[minmax(100px,auto)_1fr_28px] items-center gap-3">
                    <span className="truncate text-[11.5px] font-bold text-slate-600">{stage.label}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full ${stage.tone}`} style={{ width: `${stage.pct}%` }} /></span>
                    <strong className="text-right font-display text-xs text-slate-900">{stage.value}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="overflow-hidden rounded-2xl bg-slate-950 p-5 text-white shadow-lg shadow-slate-950/10">
            <div className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10"><Wallet size={17} /></span>
              <Link href="/reports" className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-300 hover:text-white">{t("overview.reports", "ລາຍງານ")} <ArrowUpRight size={12} /></Link>
            </div>
            <p className="mt-5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400">{t("overview.totalRevenue", "ລາຍຮັບລວມ")}</p>
            <div className="mt-1 font-display text-[1.8rem] font-bold tracking-tight">{loading ? "—" : money(revenue?.total)} <span className="text-xs text-slate-400">{t("overview.kip", "ບາດ")}</span></div>
            <div className="mt-5 grid grid-cols-2 gap-2 border-t border-white/10 pt-4">
              <div><p className="text-[10px] font-semibold text-slate-400">{t("overview.thisMonth", "ເດືອນນີ້")}</p><p className="mt-1 truncate text-[12px] font-bold">{loading ? "—" : money(revenue?.monthly)}</p></div>
              <div><p className="text-[10px] font-semibold text-slate-400">{t("overview.growth", "ການເຕີບໂຕ")}</p><p className="mt-1 text-[12px] font-bold text-slate-300">{loading ? "—" : `${Number(dashboard?.performance?.growth ?? 0)}%`}</p></div>
            </div>
          </section>

          <DashboardActivity />

          {teams && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[12px] font-black text-slate-900">{t("overview.teamAvailability", "ຄວາມວ່າງຂອງທີມຊ່າງ")}</h2>
                <Link href="/tech-teams" className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-700 hover:text-slate-800">{t("overview.manage", "ຈັດການ")} <ArrowUpRight size={12} /></Link>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-center">
                  <div className="text-lg font-black text-slate-800">{teams.free}</div>
                  <div className="text-[10px] font-bold text-slate-500">{t("overview.teamFree", "ວ່າງ")}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-center">
                  <div className="text-lg font-black text-slate-800">{teams.busy}</div>
                  <div className="text-[10px] font-bold text-slate-500">{t("overview.teamBusy", "ມີວຽກ")}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-center">
                  <div className="text-lg font-black text-slate-800">{teams.working}</div>
                  <div className="text-[10px] font-bold text-slate-500">{t("overview.teamWorking", "ກຳລັງເຮັດ")}</div>
                </div>
              </div>
              {teams.busy === 0 ? (
                <p className="mt-3 border-t border-slate-100 pt-3 text-center text-[11px] font-semibold text-slate-500">{t("overview.allTeamsFree", "ທຸກທີມວ່າງ 🎉")}</p>
              ) : (
                <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">
                  {(teams.busyTeams ?? []).slice(0, 5).map((tm: any) => (
                    <Link key={tm.code} href="/tech-teams" className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-50">
                      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-slate-400" />
                      <span className="min-w-0 flex-1 truncate text-[11.5px] font-bold text-slate-700">{tm.name}</span>
                      <span className="text-[10px] font-semibold text-slate-400">{tm.current_work_no || ""}</span>
                    </Link>
                  ))}
                  {(teams.busyTeams?.length ?? 0) > 5 && <p className="px-1.5 pt-0.5 text-[10px] text-slate-400">+{teams.busyTeams.length - 5} {t("overview.teamsUnit", "ທີມ")}</p>}
                </div>
              )}
            </section>
          )}

          {install && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[12px] font-black text-slate-900">{t("overview.installTracking", "ຕິດຕາມການຕິດຕັ້ງ")}</h2>
                <Link href="/install-tracking" className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-700 hover:text-slate-800">{t("overview.viewAll", "ເບິ່ງທັງໝົດ")} <ArrowUpRight size={12} /></Link>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-center">
                  <div className="text-lg font-black text-slate-800">{install.active}</div>
                  <div className="text-[10px] font-bold text-slate-500">{t("overview.installActive", "ກຳລັງດຳເນີນ")}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-center">
                  <div className="text-lg font-black text-slate-800">{install.paused}</div>
                  <div className="text-[10px] font-bold text-slate-500">{t("overview.installPaused", "ພັກໂຄງການ")}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-center">
                  <div className="text-lg font-black text-slate-800">{install.pendingPause}</div>
                  <div className="text-[10px] font-bold text-slate-500">{t("overview.installPendingPause", "ຄຳຮ້ອງລໍ")}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px]">
                <span className="font-semibold text-slate-400">{t("overview.totalWorkHours", "ຊົ່ວໂມງເຮັດງານລວມ")}</span>
                <span className="font-black text-slate-800">{install.hours} {t("overview.hoursUnit", "ຊມ")}</span>
              </div>
              {Array.isArray(install.pausedProjects) && install.pausedProjects.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                  {install.pausedProjects.map((p: any) => (
                    <Link key={p.project_id} href={`/projects/${p.project_id}`} className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-50">
                      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-slate-400" />
                      <span className="min-w-0 flex-1 truncate text-[11.5px] font-bold text-slate-700">{p.project_name}</span>
                      <span className="text-[10px] font-semibold text-slate-500">{t("overview.pausedFor", "ພັກ")} {p.current_pause_days} {t("overview.daysUnit", "ມື້")}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[12px] font-black text-slate-900">{t("overview.quickCreate", "ສ້າງວຽກດ່ວນ")}</h2>
              <Plus size={14} className="text-slate-400" />
            </div>
            <div className="space-y-1">
              {quickActions.length === 0 ? (
                <p className="py-6 text-center text-[11px] font-semibold text-slate-400">{t("overview.noCreatePermission", "ບໍ່ມີສິດສ້າງລາຍການ")}</p>
              ) : quickActions.map((item) => (
                <Link key={item.label} href={item.href} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-slate-50">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">{item.icon}</span>
                  <span className="min-w-0 flex-1"><span className="block text-[11.5px] font-bold text-slate-800">{item.label}</span><span className="block truncate text-[10px] font-medium text-slate-400">{item.detail}</span></span>
                  <ArrowRight size={13} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-[12px] font-black text-slate-900">{t("overview.dailyShortcuts", "ທາງລັດສຳລັບວຽກປະຈຳ")}</h2>
            <div className="grid grid-cols-2 gap-2">
              <Shortcut href="/schedule" icon={<CalendarRange size={15} />} label={t("overview.schedule", "ຕາຕະລາງວຽກ")} />
              <Shortcut href="/requests" icon={<PackageOpen size={15} />} label={t("overview.requests", "ການຂໍເບີກ")} />
              <Shortcut href="/work-orders" icon={<Wrench size={15} />} label={t("overview.workOrders", "ໃບງານ")} />
              <Shortcut href="/reports" icon={<BarChart3 size={15} />} label={t("overview.reports", "ລາຍງານ")} />
            </div>
          </section>
        </aside>
      </div>
    </Page>
  );
}

function Shortcut({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex min-h-20 flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800">
      {icon}
      <span className="text-[10.5px] font-bold">{label}</span>
    </Link>
  );
}
