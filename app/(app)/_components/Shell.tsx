"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
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
  Plus,
  ShieldCheck,
  Sun,
  Moon,
  UserCog,
  Users,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import { logout } from "@/_actions/auth";
import { can, canView, isManager, ROLE_LABELS, type Role } from "@/_lib/permissions";
import { clearV2User, getV2User, type V2User } from "../../_lib/session";
import { useTheme } from "@/_components/theme/ThemeProvider";
import NavProgress from "./NavProgress";
import ChatWidget from "./ChatWidget";
import MyActivitiesBell from "./MyActivitiesBell";
import NotificationsBell from "./NotificationsBell";

type NavItem = { label: string; href: string; icon: React.ReactNode };
type NavSection = { section?: string; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  { items: [{ label: "ພາບລວມ", href: "/", icon: <Home size={16} /> }] },
  {
    section: "ການຂາຍ & ໂຄງການ",
    items: [
      { label: "ລູກຄ້າ", href: "/customers", icon: <Users size={16} /> },
      { label: "ໂຄງການ", href: "/projects", icon: <FolderKanban size={16} /> },
      { label: "ໃບສະເໜີລາຄາ", href: "/quotations", icon: <FileText size={16} /> },
      { label: "ສັນຍາ", href: "/contracts", icon: <FileSignature size={16} /> },
    ],
  },
  {
    section: "ດຳເນີນງານ",
    items: [
      { label: "BOQ", href: "/boq", icon: <ListChecks size={16} /> },
      { label: "ຕາຕະລາງວຽກ", href: "/schedule", icon: <CalendarRange size={16} /> },
      { label: "ໃບງານ", href: "/work-orders", icon: <Wrench size={16} /> },
      { label: "ການຂໍເບີກ", href: "/requests", icon: <PackageOpen size={16} /> },
      { label: "ສິນຄ້າ / ສະຕັອກ", href: "/inventory", icon: <Boxes size={16} /> },
    ],
  },
  {
    section: "ການເງິນ & ລາຍງານ",
    items: [
      { label: "ບັນຊີ / ງວດຈ່າຍ", href: "/finance", icon: <Wallet size={16} /> },
      { label: "ລາຍງານ & ສະຖິຕິ", href: "/reports", icon: <BarChart3 size={16} /> },
    ],
  },
  {
    section: "ລະບົບ",
    items: [{ label: "ຜູ້ໃຊ້ & ສິດ", href: "/users", icon: <ShieldCheck size={16} /> }],
  },
];

const ALL_NAV = NAV_SECTIONS.flatMap((section) => section.items);

function titleFor(pathname: string): string {
  if (pathname === "/") return "ພາບລວມ";
  if (pathname.startsWith("/projects/new")) return "ລົງທະບຽນໂຄງການ";
  if (pathname.startsWith("/projects/")) return "ລາຍລະອຽດໂຄງການ";
  if (pathname.startsWith("/profile")) return "ໂປຣໄຟລ໌ & ການຕັ້ງຄ່າ";
  return ALL_NAV.find((item) => item.href !== "/" && pathname.startsWith(item.href))?.label || "ພາບລວມ";
}

function sectionFor(pathname: string): string {
  if (pathname === "/") return "Workspace";
  for (const section of NAV_SECTIONS) {
    if (section.section && section.items.some((item) => item.href !== "/" && pathname.startsWith(item.href))) return section.section;
  }
  return "ODG Projects";
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<V2User | null>(null);
  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { theme, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    const storedUser = getV2User();
    if (!storedUser) {
      router.replace("/login");
      return;
    }
    setUser(storedUser);
    setReady(true);
  }, [router]);

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
          if (item.href === "/users") return isManager(user);
          return canView(user, item.href.slice(1));
        }),
      })).filter((section) => section.items.length > 0),
    [user],
  );

  const activeHref = useMemo(() => {
    const matches = visibleSections
      .flatMap((section) => section.items)
      .filter((item) => item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`))
      .sort((a, b) => b.href.length - a.href.length);
    return matches[0]?.href || "";
  }, [pathname, visibleSections]);

  const doLogout = async () => {
    clearV2User();
    try {
      await logout();
    } catch {
      // Local session has already been cleared.
    }
    router.replace("/login");
  };

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--theme-page)]">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-bold text-slate-500 shadow-sm">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
          ກຳລັງເປີດ Workspace...
        </div>
      </div>
    );
  }

  const initial = (user?.name || user?.username || "U").charAt(0).toUpperCase();
  const roleLabel = ROLE_LABELS[(user?.role as Role) || "staff"] || "ຜູ້ໃຊ້ງານ";

  const sidebar = (
    <nav className="flex h-full flex-col overflow-hidden bg-[#0c0f1d] text-slate-300 border-r border-slate-800/40 relative shadow-2xl">
      <div className="flex h-[72px] items-center gap-3 border-b border-white/5 px-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/25 transition-transform duration-300 hover:scale-105">
          <FolderKanban size={18} strokeWidth={2.5} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-display block truncate text-[14.5px] font-extrabold tracking-tight text-white">ODG Projects</span>
          <span className="mt-0.5 block truncate text-[8px] font-black uppercase tracking-[0.25em] text-blue-400/80">Sales & Installation</span>
        </span>
        <button onClick={() => setMobileOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white md:hidden" aria-label="ປິດເມນູ">
          <X size={17} />
        </button>
      </div>

      {can(user, "projects", "create") && (
        <div className="px-4 pb-2 pt-4">
          <Link
            href="/projects/new"
            onClick={() => setMobileOpen(false)}
            className="relative flex h-10 items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-[12px] font-bold text-white shadow-md shadow-blue-950/50 transition-all duration-300 hover:from-blue-500 hover:to-indigo-500 hover:shadow-lg hover:shadow-blue-500/20 active:scale-[0.98] group"
          >
            <span className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <Plus size={15} strokeWidth={3} className="transition-transform group-hover:rotate-90 duration-300 relative z-10" />
            <span className="relative z-10">ລົງທະບຽນໂຄງການ</span>
          </Link>
        </div>
      )}

      <div className="theme-scrollbar flex-1 space-y-5 overflow-y-auto px-3 py-3">
        {visibleSections.map((section, index) => (
          <div key={section.section || index}>
            {section.section && <p className="mb-1.5 px-3 text-[8.5px] font-black uppercase tracking-[0.2em] text-slate-600">{section.section}</p>}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = activeHref === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={`group relative flex h-10 items-center gap-3 rounded-xl px-3 text-[12px] font-semibold transition-all duration-200 ${
                      active
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-950/35"
                        : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-cyan-400" />
                    )}
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-200 ${
                        active
                          ? "bg-white/12 text-white"
                          : "bg-white/[0.02] border border-white/5 text-slate-500 group-hover:bg-white/[0.06] group-hover:text-blue-400 group-hover:border-blue-500/20"
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <ChevronRight
                      size={13}
                      className={`transition-all duration-200 ${
                        active ? "text-blue-200" : "text-slate-700 opacity-0 -translate-x-1 group-hover:translate-x-0 group-hover:opacity-100"
                      }`}
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/5 p-3">
        <Link href="/profile" onClick={() => setMobileOpen(false)} className="group flex items-center gap-3 rounded-xl p-2.5 transition-all duration-200 border border-transparent hover:border-white/5 hover:bg-white/[0.03]">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-[11px] font-black text-white shadow-md shadow-blue-500/10 ring-1 ring-white/10">{initial}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11.5px] font-bold text-white group-hover:text-blue-300 transition-colors">{user?.name || user?.username}</span>
            <span className="mt-0.5 block truncate text-[9.5px] font-semibold text-slate-500 uppercase tracking-wider">{roleLabel}</span>
          </span>
          <UserCog size={14} className="text-slate-600 group-hover:text-blue-400 transition-colors" />
        </Link>
      </div>
    </nav>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--theme-page)]">
      <NavProgress />
      <ChatWidget />

      <aside className="hidden w-[272px] flex-shrink-0 md:block">{sidebar}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button aria-label="ປິດເມນູ" className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[min(290px,88vw)] shadow-2xl">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-20 flex h-[72px] flex-shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--topbar-bg)] backdrop-blur-md px-4 md:px-6 transition-all duration-300">
          <button onClick={() => setMobileOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-soft)] hover:bg-[var(--surface-soft)] hover:text-[var(--text)] transition md:hidden" aria-label="ເປີດເມນູ">
            <Menu size={18} />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--text-mute)]">
              <span>ODG Projects</span><ChevronRight size={10} /><span className="truncate text-blue-600 dark:text-blue-400 font-extrabold">{sectionFor(pathname)}</span>
            </div>
            <h2 className="mt-1 truncate text-[15.5px] font-black tracking-tight text-[var(--text)]">{titleFor(pathname)}</h2>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {canView(user, "schedule") && (
              <Link href="/schedule" className="hidden h-9 items-center gap-2 rounded-xl px-3 text-[11px] font-bold text-[var(--text-soft)] transition-all duration-200 hover:bg-[var(--surface-soft)] hover:text-[var(--text)] lg:inline-flex border border-transparent hover:border-[var(--border)]">
                <CalendarRange size={14} /> ຕາຕະລາງວຽກ
              </Link>
            )}
            {canView(user, "reports") && (
              <Link href="/reports" className="hidden h-9 items-center gap-2 rounded-xl px-3 text-[11px] font-bold text-[var(--text-soft)] transition-all duration-200 hover:bg-[var(--surface-soft)] hover:text-[var(--text)] lg:inline-flex border border-transparent hover:border-[var(--border)]">
                <BarChart3 size={14} /> ລາຍງານ
              </Link>
            )}
            <NotificationsBell />
            <MyActivitiesBell />
            
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-soft)] hover:bg-[var(--surface-soft)] hover:text-[var(--text)] transition-all duration-300 relative overflow-hidden active:scale-95 group"
              title={theme === "dark" ? "ປ່ຽນເປັນໂໝດສະຫວ່າງ" : "ປ່ຽນເປັນໂໝດກາງຄືນ"}
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
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 text-[10px] font-black text-white shadow-md shadow-blue-500/15">{initial}</span>
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
                      <UserCog size={15} /> ໂປຣໄຟລ໌ & ການຕັ້ງຄ່າ
                    </button>
                    <button onClick={doLogout} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[11.5px] font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/25 transition-colors">
                      <LogOut size={15} /> ອອກຈາກລະບົບ
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-[var(--theme-page)]">{children}</main>
      </div>
    </div>
  );
}
