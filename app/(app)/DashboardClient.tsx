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
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { can } from "@/_lib/permissions";
import { getV2User, type V2User } from "../_lib/session";
import { Btn, Card, Page, PageHeader, Pill, SectionHeader, Stat } from "./_components/ui";
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

/** Divider / chip tint that reads correctly on the ink slab in both themes. */
const onInk = (pct: number) => `color-mix(in srgb, var(--ink-text) ${pct}%, transparent)`;

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

/** Pipeline bar colours — data colours, cycled from the semantic token set. */
const STAGE_TONES = [
  "var(--brand)",
  "var(--info)",
  "var(--warning)",
  "var(--success)",
  "var(--brand-strong)",
  "var(--text-soft)",
  "var(--text-mute)",
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
      href: "/projects",
      icon: <CircleAlert size={18} />,
    },
    {
      label: t("overview.attention.active", "ໂຄງການກຳລັງດຳເນີນ"),
      value: stats.active,
      href: "/projects",
      icon: <TrendingUp size={18} />,
    },
    {
      label: t("overview.attention.closed", "ປິດໂຄງການແລ້ວ"),
      value: stats.closed,
      href: "/reports",
      icon: <CheckCircle2 size={18} />,
    },
  ];

  return (
    <Page max="max-w-none">
      <PageHeader
        title={`${t("overview.greeting", "ສະບາຍດີ")}${user?.name ? `, ${user.name}` : ""}`}
        subtitle={t("overview.intro", "ກວດວຽກສຳຄັນ ແລະ ດຳເນີນຂັ້ນຕອນຕໍ່ໄປຈາກໜ້ານີ້.")}
        badge={<Pill tone="neutral">{today || t("overview.todayOverview", "ພາບລວມມື້ນີ້")}</Pill>}
        actions={
          <>
            <Btn variant="outline" onClick={() => router.push("/schedule")}>
              <CalendarRange size={14} /> {t("overview.schedule", "ຕາຕະລາງວຽກ")}
            </Btn>
            {can(user, "projects", "create") && (
              <Btn variant="go" onClick={() => router.push("/projects/new")}>
                <Plus size={14} strokeWidth={3} /> {t("overview.newProject", "ໂຄງການໃໝ່")}
              </Btn>
            )}
          </>
        }
      />

      <section className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        {attention.map((item) => (
          <Stat
            key={item.label}
            icon={item.icon}
            label={item.label}
            value={loading ? "—" : item.value}
            onClick={() => router.push(item.href)}
          />
        ))}
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-soft)] px-5 py-4">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-[13px] font-black text-[var(--text)]">
                  <ClipboardList size={16} className="text-[var(--brand)]" /> {t("overview.tasksToContinue", "ວຽກທີ່ຕ້ອງດຳເນີນຕໍ່")}
                </h2>
                <p className="mt-1 text-[11px] font-medium text-[var(--text-mute)]">{t("overview.tasksToContinueHint", "ເປີດໂຄງການ ຫຼື ໄປຫາໜ້າວຽກທີ່ກ່ຽວຂ້ອງໄດ້ທັນທີ")}</p>
              </div>
              <Link href="/projects" className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--brand)] hover:underline">
                {t("overview.viewAllProjects", "ເບິ່ງໂຄງການທັງໝົດ")} <ArrowRight size={13} />
              </Link>
            </div>
            {loading ? (
              <div className="flex h-60 items-center justify-center text-[var(--text-mute)]"><Loader2 size={22} className="animate-spin" /></div>
            ) : actionRows.length === 0 ? (
              <div className="flex h-60 flex-col items-center justify-center gap-2 text-[var(--text-mute)]">
                <CheckCircle2 size={30} />
                <span className="text-xs font-semibold">{t("overview.noPendingTasks", "ບໍ່ມີວຽກຄ້າງດຳເນີນ")}</span>
              </div>
            ) : (
              <div>
                {actionRows.map((row, index) => {
                  const nextRaw = NEXT_ACTIONS[text(row.project_status)];
                  const next = nextRaw
                    ? { label: t(nextRaw.key, nextRaw.label), href: nextRaw.href }
                    : { label: t("overview.next.openProject", "ເປີດເບິ່ງໂຄງການ"), href: undefined as string | undefined };
                  const projectHref = `/projects/${encodeURIComponent(String(row.id))}`;
                  return (
                    <div
                      key={row.id ?? index}
                      className="group flex items-center gap-3 border-b border-[var(--border-soft)] px-4 py-3 transition-colors last:border-b-0 hover:bg-[var(--brand-tint)]"
                    >
                      <button onClick={() => router.push(projectHref)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--surface-sunken)] text-[11px] font-bold text-[var(--text-mute)] transition-colors group-hover:bg-[var(--brand-soft)] group-hover:text-[var(--brand-strong)]">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-bold text-[var(--text)]">{row.project_name || t("overview.unnamedProject", "(ບໍ່ມີຊື່ໂຄງການ)")}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-2">
                            <Pill tone="neutral">{row.project_status || "-"}</Pill>
                            <span className="truncate text-[10.5px] font-medium text-[var(--text-mute)]">{row.customer_name || row.sml_code || t("overview.noCustomer", "ບໍ່ລະບຸລູກຄ້າ")}</span>
                          </span>
                        </span>
                      </button>
                      <Btn
                        variant="outline"
                        onClick={() => router.push(next.href || projectHref)}
                        className="hidden flex-shrink-0 sm:inline-flex"
                      >
                        {next.label} <ArrowRight size={12} />
                      </Btn>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <SectionHeader icon={<BarChart3 size={15} />} title={t("overview.pipelineTitle", "ພາບລວມ Pipeline")} tone="brand" className="mb-1" />
                <p className="mb-4 text-[11px] font-medium text-[var(--text-mute)]">{t("overview.pipelineHint", "ຈຳນວນໂຄງການໃນແຕ່ລະຂັ້ນຕອນ")}</p>
              </div>
              <Pill tone="neutral">{stats.total} {t("overview.projectsUnit", "ໂຄງການ")}</Pill>
            </div>
            {loading ? (
              <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-7 animate-pulse rounded-lg bg-[var(--surface-sunken)]" />)}</div>
            ) : pipeline.length === 0 ? (
              <p className="py-10 text-center text-xs font-semibold text-[var(--text-mute)]">{t("overview.noPipeline", "ຍັງບໍ່ມີຂໍ້ມູນ Pipeline")}</p>
            ) : (
              <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
                {pipeline.map((stage) => (
                  <div key={stage.label} className="grid grid-cols-[minmax(100px,auto)_1fr_28px] items-center gap-3">
                    <span className="truncate text-[11.5px] font-bold text-[var(--text-soft)]">{stage.label}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                      <span className="block h-full rounded-full" style={{ width: `${stage.pct}%`, background: stage.tone }} />
                    </span>
                    <strong className="text-right text-xs font-black tabular-nums text-[var(--text)]">{stage.value}</strong>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-5">
          <div
            className="overflow-hidden rounded-xl bg-[var(--ink)] p-5 text-[var(--ink-text)] shadow-[var(--shadow-md)]"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: onInk(12) }}>
                <Wallet size={17} />
              </span>
              <Link href="/reports" className="inline-flex items-center gap-1 text-[10.5px] font-bold opacity-70 transition-opacity hover:opacity-100">
                {t("overview.reports", "ລາຍງານ")} <ArrowUpRight size={12} />
              </Link>
            </div>
            <p className="mt-5 text-[10.5px] font-bold tracking-wider opacity-60">{t("overview.totalRevenue", "ລາຍຮັບລວມ")}</p>
            <div className="mt-1 text-[1.8rem] font-black leading-tight tracking-tight tabular-nums">
              {loading ? "—" : money(revenue?.total)} <span className="text-xs font-bold opacity-60">{t("overview.kip", "ບາດ")}</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 border-t pt-4" style={{ borderColor: onInk(14) }}>
              <div>
                <p className="text-[10px] font-semibold opacity-60">{t("overview.thisMonth", "ເດືອນນີ້")}</p>
                <p className="mt-1 truncate text-[12px] font-bold tabular-nums">{loading ? "—" : money(revenue?.monthly)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold opacity-60">{t("overview.growth", "ການເຕີບໂຕ")}</p>
                <p className="mt-1 text-[12px] font-bold tabular-nums opacity-80">{loading ? "—" : `${Number(dashboard?.performance?.growth ?? 0)}%`}</p>
              </div>
            </div>
          </div>

          <DashboardActivity />

          {teams && (
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <SectionHeader icon={<Users size={15} />} title={t("overview.teamAvailability", "ຄວາມວ່າງຂອງທີມຊ່າງ")} tone="brand" className="mb-0" />
                <Link href="/tech-teams" className="inline-flex flex-shrink-0 items-center gap-1 text-[10.5px] font-bold text-[var(--brand)] hover:underline">
                  {t("overview.manage", "ຈັດການ")} <ArrowUpRight size={12} />
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <MiniStat value={teams.free} label={t("overview.teamFree", "ວ່າງ")} />
                <MiniStat value={teams.busy} label={t("overview.teamBusy", "ມີວຽກ")} />
                <MiniStat value={teams.working} label={t("overview.teamWorking", "ກຳລັງເຮັດ")} />
              </div>
              {teams.busy === 0 ? (
                <p className="mt-3 border-t border-[var(--border-soft)] pt-3 text-center text-[11px] font-semibold text-[var(--text-mute)]">{t("overview.allTeamsFree", "ທຸກທີມວ່າງ 🎉")}</p>
              ) : (
                <div className="mt-3 space-y-1 border-t border-[var(--border-soft)] pt-3">
                  {(teams.busyTeams ?? []).slice(0, 5).map((tm: any) => (
                    <Link key={tm.code} href="/tech-teams" className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-[var(--brand-tint)]">
                      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[var(--warning)]" />
                      <span className="min-w-0 flex-1 truncate text-[11.5px] font-bold text-[var(--text-soft)]">{tm.name}</span>
                      <span className="text-[10px] font-semibold text-[var(--text-mute)]">{tm.current_work_no || ""}</span>
                    </Link>
                  ))}
                  {(teams.busyTeams?.length ?? 0) > 5 && (
                    <p className="px-1.5 pt-0.5 text-[10px] text-[var(--text-mute)]">+{teams.busyTeams.length - 5} {t("overview.teamsUnit", "ທີມ")}</p>
                  )}
                </div>
              )}
            </Card>
          )}

          {install && (
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <SectionHeader icon={<Wrench size={15} />} title={t("overview.installTracking", "ຕິດຕາມການຕິດຕັ້ງ")} tone="blue" className="mb-0" />
                <Link href="/install-tracking" className="inline-flex flex-shrink-0 items-center gap-1 text-[10.5px] font-bold text-[var(--brand)] hover:underline">
                  {t("overview.viewAll", "ເບິ່ງທັງໝົດ")} <ArrowUpRight size={12} />
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <MiniStat value={install.active} label={t("overview.installActive", "ກຳລັງດຳເນີນ")} />
                <MiniStat value={install.paused} label={t("overview.installPaused", "ພັກໂຄງການ")} />
                <MiniStat value={install.pendingPause} label={t("overview.installPendingPause", "ຄຳຮ້ອງລໍ")} />
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-[var(--border-soft)] pt-2.5 text-[11px]">
                <span className="font-semibold text-[var(--text-mute)]">{t("overview.totalWorkHours", "ຊົ່ວໂມງເຮັດງານລວມ")}</span>
                <span className="font-black tabular-nums text-[var(--text)]">{install.hours} {t("overview.hoursUnit", "ຊມ")}</span>
              </div>
              {Array.isArray(install.pausedProjects) && install.pausedProjects.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-[var(--border-soft)] pt-2">
                  {install.pausedProjects.map((p: any) => (
                    <Link key={p.project_id} href={`/projects/${p.project_id}`} className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-[var(--brand-tint)]">
                      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[var(--danger)]" />
                      <span className="min-w-0 flex-1 truncate text-[11.5px] font-bold text-[var(--text-soft)]">{p.project_name}</span>
                      <span className="text-[10px] font-semibold text-[var(--text-mute)]">{t("overview.pausedFor", "ພັກ")} {p.current_pause_days} {t("overview.daysUnit", "ມື້")}</span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          )}

          <Card className="p-4">
            <SectionHeader icon={<Plus size={15} />} title={t("overview.quickCreate", "ສ້າງວຽກດ່ວນ")} tone="emerald" />
            <div className="space-y-1">
              {quickActions.length === 0 ? (
                <p className="py-6 text-center text-[11px] font-semibold text-[var(--text-mute)]">{t("overview.noCreatePermission", "ບໍ່ມີສິດສ້າງລາຍການ")}</p>
              ) : quickActions.map((item) => (
                <Link key={item.label} href={item.href} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-[var(--brand-tint)]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface-sunken)] text-[var(--text-soft)] transition-colors group-hover:bg-[var(--brand-soft)] group-hover:text-[var(--brand-strong)]">
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11.5px] font-bold text-[var(--text)]">{item.label}</span>
                    <span className="block truncate text-[10px] font-medium text-[var(--text-mute)]">{item.detail}</span>
                  </span>
                  <ArrowRight size={13} className="text-[var(--text-mute)] transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <SectionHeader icon={<ArrowRight size={15} />} title={t("overview.dailyShortcuts", "ທາງລັດສຳລັບວຽກປະຈຳ")} tone="neutral" />
            <div className="grid grid-cols-2 gap-2">
              <Shortcut href="/schedule" icon={<CalendarRange size={15} />} label={t("overview.schedule", "ຕາຕະລາງວຽກ")} />
              <Shortcut href="/requests" icon={<PackageOpen size={15} />} label={t("overview.requests", "ການຂໍເບີກ")} />
              <Shortcut href="/work-orders" icon={<Wrench size={15} />} label={t("overview.workOrders", "ໃບງານ")} />
              <Shortcut href="/reports" icon={<BarChart3 size={15} />} label={t("overview.reports", "ລາຍງານ")} />
            </div>
          </Card>
        </aside>
      </div>
    </Page>
  );
}

function MiniStat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] px-2 py-2 text-center">
      <div className="text-lg font-black tabular-nums text-[var(--text)]">{value}</div>
      <div className="text-[10px] font-bold text-[var(--text-mute)]">{label}</div>
    </div>
  );
}

function Shortcut({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-20 flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] p-3 text-[var(--text-soft)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--brand-tint)] hover:text-[var(--text)]"
    >
      {icon}
      <span className="text-[10.5px] font-bold">{label}</span>
    </Link>
  );
}
