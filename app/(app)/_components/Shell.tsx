"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  Bell,
  Boxes,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  FileSignature,
  FileText,
  FolderKanban,
  Home,
  ListChecks,
  LogOut,
  Menu,
  PackageOpen,
  PanelLeftClose,
  Search,
  ShieldCheck,
  Sun,
  Moon,
  UserCog,
  Users,
  UsersRound,
  Wallet,
  Wrench,
  MapPin,
  Award,
  ClipboardCheck,
  Inbox,
  X,
} from "lucide-react";
import { canView, isAdmin, ROLE_LABELS, type Role } from "@/_lib/permissions";
import { getApprovalCount } from "@/_actions/approvals";
import { getNavCounts } from "@/_actions/nav-counts";
import { clearV2User, getV2User, type V2User } from "../../_lib/session";
import { useTheme } from "@/_components/theme/ThemeProvider";
import NavProgress from "./NavProgress";
import ChatWidget from "./ChatWidget";
import ConfirmProvider from "./Confirm";
import MyActivitiesBell from "./MyActivitiesBell";
import NotificationsBell from "./NotificationsBell";
import LanguageSwitcher from "./LanguageSwitcher";
import { useT } from "@/_lib/i18n";

type NavItem = { label: string; tKey: string; href: string; icon: React.ReactNode; permKey?: string };
type NavSection = { section?: string; sectionKey?: string; icon?: React.ReactNode; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  { items: [
    { label: "ພາບລວມ", tKey: "nav.overview", href: "/", icon: <Home size={14} /> },
    { label: "ລໍຖ້າອະນຸມັດ", tKey: "nav.approvals", href: "/approvals", icon: <Inbox size={14} />, permKey: "*" },
  ] },
  {
    section: "ການຂາຍ",
    sectionKey: "nav.section.sales",
    icon: <FolderKanban size={15} />,
    items: [
      { label: "ລູກຄ້າ", tKey: "nav.customers", href: "/customers", icon: <Users size={14} /> },
      { label: "ໂຄງການ", tKey: "nav.projects", href: "/projects", icon: <FolderKanban size={14} /> },
      { label: "ແຜນທີ່ໂຄງການ", tKey: "nav.projectsMap", href: "/projects/map", icon: <MapPin size={14} />, permKey: "projects" },
      { label: "ໃບສະເໜີລາຄາ", tKey: "nav.quotations", href: "/quotations", icon: <FileText size={14} /> },
      { label: "ສັນຍາ", tKey: "nav.contracts", href: "/contracts", icon: <FileSignature size={14} /> },
    ],
  },
  {
    section: "ໜ້າງານ & ຕິດຕັ້ງ",
    sectionKey: "nav.section.work",
    icon: <Wrench size={15} />,
    items: [
      { label: "BOQ", tKey: "nav.boq", href: "/boq", icon: <ListChecks size={14} /> },
      { label: "ລວມວັດສະດຸ", tKey: "nav.materials", href: "/materials", icon: <Boxes size={14} />, permKey: "boq" },
      { label: "ຕາຕະລາງວຽກ", tKey: "nav.schedule", href: "/schedule", icon: <CalendarRange size={14} /> },
      { label: "ໃບງານ", tKey: "nav.workorders", href: "/work-orders", icon: <Wrench size={14} /> },
      { label: "ງານຕິດຕັ້ງມາດຕະຖານ", tKey: "nav.stdtasks", href: "/std-tasks", icon: <ClipboardCheck size={14} /> },
      { label: "ຕິດຕາມການຕິດຕັ້ງ", tKey: "nav.installtracking", href: "/install-tracking", icon: <CalendarRange size={14} /> },
    ],
  },
  {
    section: "ທີມຊ່າງ",
    sectionKey: "nav.section.techs",
    icon: <UsersRound size={15} />,
    items: [
      { label: "ຈັດການທີມຊ່າງ", tKey: "nav.techteams", href: "/tech-teams", icon: <UsersRound size={14} /> },
      { label: "ປະຕິທິນງານຊ່າງ", tKey: "nav.techcalendar", href: "/tech-calendar", icon: <CalendarRange size={14} />, permKey: "work-orders" },
      { label: "ສະຫຼຸບຜົນງານຊ່າງ", tKey: "nav.techsummary", href: "/tech-summary", icon: <Award size={14} /> },
      { label: "ຕິດຕາມຊ່າງ", tKey: "nav.tracking", href: "/tracking", icon: <MapPin size={14} /> },
    ],
  },
  {
    section: "ສິນຄ້າ & ເບີກ",
    sectionKey: "nav.section.inventory",
    icon: <Boxes size={15} />,
    items: [
      { label: "ການຂໍເບີກ", tKey: "nav.requests", href: "/requests", icon: <PackageOpen size={14} /> },
      { label: "ສິນຄ້າ / ສະຕັອກ", tKey: "nav.inventory", href: "/inventory", icon: <Boxes size={14} /> },
    ],
  },
  {
    section: "ການເງິນ & ລາຍງານ",
    sectionKey: "nav.section.finance",
    icon: <Wallet size={15} />,
    items: [
      { label: "ບັນຊີ / ງວດຈ່າຍ", tKey: "nav.finance", href: "/finance", icon: <Wallet size={14} /> },
      { label: "ລາຍງານ & ສະຖິຕິ", tKey: "nav.reports", href: "/reports", icon: <BarChart3 size={14} /> },
    ],
  },
  {
    section: "ລະບົບ",
    sectionKey: "nav.section.system",
    icon: <ShieldCheck size={15} />,
    items: [
      { label: "ຜູ້ໃຊ້ & ສິດ", tKey: "nav.users", href: "/users", icon: <ShieldCheck size={14} /> },
      { label: "ທົດສອບແຈ້ງເຕືອນ", tKey: "nav.pushtest", href: "/push-test", icon: <Bell size={14} /> },
    ],
  },
];

const ALL_NAV = NAV_SECTIONS.flatMap((section) => section.items);

/** Returns a translation key + Lao fallback for the page header title. */
function titleFor(pathname: string): { key: string; fallback: string } {
  if (pathname === "/") return { key: "nav.overview", fallback: "ພາບລວມ" };
  if (pathname.startsWith("/projects/new")) return { key: "title.registerProject", fallback: "ລົງທະບຽນໂຄງການ" };
  if (pathname === "/projects/map") return { key: "nav.projectsMap", fallback: "ແຜນທີ່ໂຄງການ" };
  if (pathname.startsWith("/projects/")) return { key: "title.projectDetail", fallback: "ລາຍລະອຽດໂຄງການ" };
  if (pathname.startsWith("/profile")) return { key: "title.profile", fallback: "ໂປຣໄຟລ໌ & ການຕັ້ງຄ່າ" };
  const item = ALL_NAV.find((it) => it.href !== "/" && pathname.startsWith(it.href));
  return item ? { key: item.tKey, fallback: item.label } : { key: "nav.overview", fallback: "ພາບລວມ" };
}

/** Returns a translation key + fallback for the breadcrumb section label. */
function sectionFor(pathname: string): { key: string; fallback: string } {
  if (pathname === "/") return { key: "", fallback: "Workspace" };
  for (const section of NAV_SECTIONS) {
    if (section.section && section.items.some((item) => item.href !== "/" && pathname.startsWith(item.href))) {
      return { key: section.sectionKey || "", fallback: section.section };
    }
  }
  return { key: "", fallback: "ODG Projects" };
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<V2User | null>(null);
  const [ready, setReady] = useState(false);
  const [approvalCount, setApprovalCount] = useState(0);
  const [navCounts, setNavCounts] = useState<Record<string, number>>({});
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [navQuery, setNavQuery] = useState("");
  const { theme, toggle: toggleTheme } = useTheme();
  const t = useT();

  useEffect(() => {
    const storedUser = getV2User();
    if (!storedUser) {
      router.replace("/login");
      return;
    }
    setUser(storedUser);
    setReady(true);
  }, [router]);

  // Pending-approval count for the sidebar badge (refreshed periodically).
  useEffect(() => {
    let alive = true;
    const tick = () => getApprovalCount().then((c) => { if (alive) setApprovalCount(c); }).catch(() => {});
    tick();
    const h = setInterval(tick, 60_000);
    return () => { alive = false; clearInterval(h); };
  }, [pathname]);

  // "Still needs me" badge per menu item.
  useEffect(() => {
    let alive = true;
    const tick = () =>
      getNavCounts()
        .then((c) => {
          if (!alive) return;
          setNavCounts({
            "/work-orders": c.workOrders,
            "/requests": c.requests,
            "/quotations": c.quotations,
            "/contracts": c.contracts,
            "/projects": c.projects,
          });
        })
        .catch(() => {});
    tick();
    const h = setInterval(tick, 60_000);
    return () => { alive = false; clearInterval(h); };
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen]);

  const visibleSections = useMemo(
    () =>
      NAV_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (item.href === "/") return true;
          if (item.permKey === "*") return true;
          if (item.href === "/users" || item.href === "/push-test") return isAdmin(user);
          return canView(user, item.permKey ?? item.href.slice(1));
        }).filter((item) => {
          const query = navQuery.trim().toLocaleLowerCase();
          return !query || item.label.toLocaleLowerCase().includes(query) || section.section?.toLocaleLowerCase().includes(query);
        }),
      })).filter((section) => section.items.length > 0),
    [user, navQuery],
  );

  const activeHref = useMemo(() => {
    const matches = visibleSections
      .flatMap((section) => section.items)
      .filter((item) => item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`))
      .sort((a, b) => b.href.length - a.href.length);
    return matches[0]?.href || "";
  }, [pathname, visibleSections]);

  const toggleSection = (section: string) => {
    setOpenSections((current) =>
      current.includes(section)
        ? current.filter((item) => item !== section)
        : [...current, section],
    );
  };

  const doLogout = async () => {
    clearV2User();
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {
      // Local session has already been cleared.
    }
    router.replace("/login");
  };

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg)]">
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-xs font-bold text-[var(--text-mute)] shadow-[var(--shadow-sm)]">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--brand)]" />
          {t("shell.opening")}
        </div>
      </div>
    );
  }

  const initial = (user?.name || user?.username || "U").charAt(0).toUpperCase();
  const roleLabel = ROLE_LABELS[(user?.role as Role) || "staff"] || "ຜູ້ໃຊ້ງານ";

  const sidebar = (
    <nav className="flex h-full flex-col overflow-hidden border-r border-white/10 bg-[#050b1d] text-slate-300">
      <div className="flex h-[58px] items-center gap-2.5 border-b border-white/10 px-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500 text-white">
          <Wrench size={16} strokeWidth={2.5} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-display block truncate text-[12.5px] font-bold tracking-wide text-white">ODG PROJECTS</span>
          <span className="block truncate text-[9.5px] font-medium text-slate-500">{t("app.subtitle")}</span>
        </span>
        <PanelLeftClose size={15} className="hidden text-slate-500 md:block" />
        <button onClick={() => setMobileOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-mute)] hover:bg-[var(--surface-soft)] hover:text-[var(--text)] md:hidden" aria-label={t("shell.closeMenu")}>
          <X size={17} />
        </button>
      </div>

      <div className="px-4 pt-4">
        <label className="flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-slate-500 focus-within:border-teal-500/60">
          <Search size={14} />
          <input
            value={navQuery}
            onChange={(event) => setNavQuery(event.target.value)}
            placeholder={t("shell.searchMenu", "ຄົ້ນຫາເມນູ...")}
            className="min-w-0 flex-1 border-0 bg-transparent text-[11.5px] text-slate-200 outline-none placeholder:text-slate-600"
          />
        </label>
      </div>

      <div className="theme-scrollbar flex-1 space-y-1 overflow-y-auto px-2.5 py-3">
        {visibleSections.map((section, index) => (
          <div key={section.section || index}>
            {section.section && (() => {
              const containsActive = section.items.some((item) => item.href === activeHref);
              const expanded = containsActive || openSections.includes(section.section!);
              return (
                <button
                  type="button"
                  onClick={() => toggleSection(section.section!)}
                  className={`flex h-8.5 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[11.5px] font-bold transition ${containsActive ? "bg-white/[0.06] text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}
                  aria-expanded={expanded}
                >
                  <span className={containsActive ? "text-teal-400" : "text-slate-500"}>{section.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{t(section.sectionKey || "", section.section)}</span>
                  <ChevronDown size={14} className={`text-slate-600 transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>
              );
            })()}
            <div className={`space-y-0.5 ${section.section ? "ml-8 mt-0.5" : ""} ${section.section && !section.items.some((item) => item.href === activeHref) && !openSections.includes(section.section) ? "hidden" : ""}`}>
              {section.items.map((item) => {
                const active = activeHref === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={`group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[11px] font-medium transition-colors duration-150 ${
                      active
                        ? "bg-teal-500/10 pl-4 font-semibold text-white"
                        : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                    }`}
                  >
                    {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-teal-400" />}
                    <span
                      className={`flex h-6 w-6 items-center justify-center transition-colors duration-150 ${
                        active ? "text-teal-400" : "text-slate-500 group-hover:text-teal-400"
                      } ${section.section ? "hidden" : ""}`}
                    >
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{t(item.tKey, item.label)}</span>
                    {item.href === "/approvals" ? (
                      approvalCount > 0 && (
                        <span className="ml-auto inline-flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[9.5px] font-bold text-white">{approvalCount > 99 ? "99+" : approvalCount}</span>
                      )
                    ) : (
                      (navCounts[item.href] ?? 0) > 0 && (
                        <span className="ml-auto inline-flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-white/10 px-1.5 text-[9.5px] font-bold text-slate-300">
                          {navCounts[item.href]! > 99 ? "99+" : navCounts[item.href]}
                        </span>
                      )
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 p-3">
        <Link href="/profile" onClick={() => setMobileOpen(false)} className="group flex items-center gap-3 rounded-lg p-2.5 transition hover:bg-white/5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-600 text-[10px] font-bold text-white">{initial}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[10.5px] font-bold text-slate-100">{user?.name || user?.username}</span>
            <span className="mt-0.5 block truncate text-[9.5px] font-medium text-slate-500">{roleLabel}</span>
          </span>
          <UserCog size={14} className="text-slate-600 transition-colors group-hover:text-teal-400" />
        </Link>
      </div>
    </nav>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <NavProgress />
      <ChatWidget />

      <aside className="hidden w-[228px] flex-shrink-0 md:block">{sidebar}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button aria-label={t("shell.closeMenu")} className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[min(290px,88vw)] shadow-2xl">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-20 flex h-[52px] flex-shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 md:px-6">
          <button onClick={() => setMobileOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-soft)] hover:bg-[var(--surface-soft)] hover:text-[var(--text)] transition md:hidden" aria-label={t("shell.openMenu")}>
            <Menu size={18} />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--text-mute)]">
              <span>ODG Projects</span><ChevronRight size={10} /><span className="truncate font-extrabold text-teal-600 dark:text-teal-400">{(() => { const s = sectionFor(pathname); return t(s.key, s.fallback); })()}</span>
            </div>
            <h2 className="mt-1 truncate text-[13.5px] font-black tracking-tight text-[var(--text)]">{(() => { const ti = titleFor(pathname); return t(ti.key, ti.fallback); })()}</h2>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher />
            <NotificationsBell />
            <MyActivitiesBell />
            
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-soft)] hover:bg-[var(--surface-soft)] hover:text-[var(--text)] transition-all duration-300 relative overflow-hidden active:scale-95 group"
              title={theme === "dark" ? t("shell.theme.toLight") : t("shell.theme.toDark")}
            >
              <span className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative z-10 transition-transform duration-500 group-hover:rotate-45">
                {theme === "dark" ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-indigo-600 dark:text-indigo-400" />}
              </span>
            </button>

            <span className="mx-1 hidden h-6 w-px bg-[var(--border)] sm:block" />

            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((open) => !open)}
                className="flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 pr-2.5 transition-all duration-200 hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
                aria-expanded={userMenuOpen}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-[10px] font-bold text-white">{initial}</span>
                <span className="hidden max-w-[130px] text-left sm:block">
                  <span className="block truncate text-[11px] font-bold text-[var(--text)]">{user?.name || user?.username}</span>
                  <span className="block truncate text-[8.5px] font-semibold text-[var(--text-mute)] uppercase tracking-wider">{roleLabel}</span>
                </span>
                <ChevronDown size={13} className="text-[var(--text-mute)] transition duration-200" style={{ transform: userMenuOpen ? 'rotate(180deg)' : 'none' }} />
              </button>

              {userMenuOpen && (
                <>
                  <button aria-hidden tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[0_20px_50px_-16px_rgba(15,23,42,0.32)] animate-scale-up">
                    <div className="border-b border-[var(--border-soft)] px-3 py-2.5">
                      <p className="truncate text-[12px] font-black text-[var(--text)]">{user?.name || user?.username}</p>
                      <p className="mt-0.5 text-[9.5px] font-semibold text-[var(--text-mute)] uppercase tracking-wider">{roleLabel}</p>
                    </div>
                    <button onClick={() => { setUserMenuOpen(false); router.push("/profile"); }} className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[11.5px] font-bold text-[var(--text-soft)] hover:bg-[var(--surface-soft)] hover:text-[var(--text)] transition-colors">
                      <UserCog size={15} /> {t("shell.profileSettings")}
                    </button>
                    <button onClick={doLogout} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[11.5px] font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/25 transition-colors">
                      <LogOut size={15} /> {t("shell.logout")}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="system-content min-h-0 flex-1 overflow-y-auto bg-[var(--bg)]"><ConfirmProvider>{children}</ConfirmProvider></main>
      </div>
    </div>
  );
}
