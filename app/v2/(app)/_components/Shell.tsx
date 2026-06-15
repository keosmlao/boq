"use client";

/**
 * v2 shell — corporate/dense sidebar + topbar. Flat access: every authenticated
 * user sees the full menu (no role filtering anywhere).
 * Visually redesigned to be premium and modern.
 */
import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Home,
  Users,
  FolderKanban,
  FileText,
  FileSignature,
  ListChecks,
  CalendarRange,
  Wrench,
  PackageOpen,
  Wallet,
  LogOut,
  Menu,
  Plus,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";
import { getV2User, clearV2User, type V2User } from "../../_lib/session";
import { logout } from "@/_actions/auth";
import { can, canView, isManager } from "@/_lib/permissions";

type NavItem = { label: string; href: string; icon: React.ReactNode; soon?: boolean; color?: string };

type NavSection = { section?: string; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  { items: [{ label: "ໜ້າຫຼັກ", href: "/v2", icon: <Home size={15} />, color: "bg-slate-100 text-slate-600" }] },
  {
    section: "ການຂາຍ & ໂຄງການ",
    items: [
      { label: "ລູກຄ້າ", href: "/v2/customers", icon: <Users size={15} />, color: "bg-violet-100 text-violet-600" },
      { label: "ໂຄງການ", href: "/v2/projects", icon: <FolderKanban size={15} />, color: "bg-blue-100 text-blue-600" },
      { label: "ໃບສະເໜີລາຄາ", href: "/v2/quotations", icon: <FileText size={15} />, color: "bg-amber-100 text-amber-600" },
      { label: "ສັນຍາ", href: "/v2/contracts", icon: <FileSignature size={15} />, color: "bg-emerald-100 text-emerald-600" },
    ],
  },
  {
    section: "ບໍລິການ",
    items: [
      { label: "BOQ", href: "/v2/boq", icon: <ListChecks size={15} />, color: "bg-cyan-100 text-cyan-600" },
      { label: "ກຳນົດໜ້າວຽກ", href: "/v2/schedule", icon: <CalendarRange size={15} />, color: "bg-teal-100 text-teal-600" },
      { label: "ໃບງານ", href: "/v2/work-orders", icon: <Wrench size={15} />, color: "bg-blue-100 text-blue-600" },
      { label: "ຂໍເບີກ", href: "/v2/requests", icon: <PackageOpen size={15} />, color: "bg-pink-100 text-pink-600" },
    ],
  },
  {
    section: "ບັນຊີ",
    items: [{ label: "ບັນຊີ / ງວດຈ່າຍ", href: "/v2/finance", icon: <Wallet size={15} />, color: "bg-green-100 text-green-600" }],
  },
  {
    section: "ລະບົບ",
    items: [{ label: "ຜູ້ໃຊ້ & ສິດ", href: "/v2/users", icon: <ShieldCheck size={15} />, color: "bg-blue-100 text-blue-600" }],
  },
];

const ALL_NAV: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

function titleFor(pathname: string): string {
  if (pathname === "/v2") return "ໜ້າຫຼັກ";
  if (pathname.startsWith("/v2/projects/new")) return "ລົງທະບຽນໂຄງການ";
  if (pathname === "/v2/projects") return "ໂຄງການ";
  if (pathname.startsWith("/v2/projects/")) return "ລາຍລະອຽດໂຄງການ";
  return ALL_NAV.find((n) => pathname.startsWith(n.href) && n.href !== "/v2")?.label || "ໜ້າຫຼັກ";
}

/** Breadcrumb kicker — the nav section that owns the current page. */
function sectionFor(pathname: string): string {
  if (pathname === "/v2") return "ພາບລວມ";
  for (const sec of NAV_SECTIONS) {
    if (sec.section && sec.items.some((n) => n.href !== "/v2" && pathname.startsWith(n.href))) {
      return sec.section;
    }
  }
  return "ODG Workspace";
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<V2User | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const u = getV2User();
    if (!u) {
      router.replace("/v2/login");
      return;
    }
    setUser(u);
    setReady(true);
  }, [router]);

  const doLogout = async () => {
    clearV2User();
    try {
      await logout();
    } catch {
      /* ignore */
    }
    router.replace("/v2/login");
  };

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--theme-page)] text-xs font-bold text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
          <span>ກຳລັງກວດສອບການເຂົ້າສູ່ລະບົບ...</span>
        </div>
      </div>
    );
  }

  const isActive = (href: string) =>
    href === "/v2" ? pathname === "/v2" : pathname.startsWith(href);

  const initial = (user?.name || "U").charAt(0).toUpperCase();

  // Filter nav by the current user's permissions: dashboard is always visible,
  // the users area is manager-only, business modules need `view`.
  const visibleSections = NAV_SECTIONS.map((sec) => ({
    ...sec,
    items: sec.items.filter((item) => {
      if (item.href === "/v2") return true;
      if (item.href === "/v2/users") return isManager(user);
      return canView(user, item.href.replace("/v2/", ""));
    }),
  })).filter((sec) => sec.items.length > 0);

  const SidebarBody = (
    <nav className="flex h-full flex-col bg-white text-slate-700 select-none border-r border-slate-200">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl premium-gradient text-white shadow-md shadow-blue-600/25">
          <FolderKanban size={16} strokeWidth={2.5} />
        </div>
        <div className="min-w-0 leading-tight">
          <div className="font-display truncate text-[14px] font-bold tracking-tight text-slate-900">ODG Projects</div>
          <div className="truncate text-[9.5px] font-bold text-blue-500 uppercase tracking-[0.2em]">ຂາຍ &amp; ຕິດຕັ້ງ</div>
        </div>
      </div>

      {/* Quick create */}
      {can(user, "projects", "create") && (
        <div className="px-3.5 pt-4">
          <Link
            href="/v2/projects/new"
            onClick={() => setOpen(false)}
            className="flex h-10 items-center justify-center gap-2 rounded-xl premium-gradient premium-gradient-hover text-[12.5px] font-bold text-white shadow-md shadow-blue-600/25 transition-all duration-150 hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <Plus size={15} strokeWidth={2.75} /> ສ້າງໂຄງການ
          </Link>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 space-y-5 overflow-y-auto px-3.5 py-4 theme-scrollbar">
        {visibleSections.map((sec, si) => (
          <div key={si} className="space-y-1.5">
            {sec.section && (
              <div className="px-3 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                {sec.section}
              </div>
            )}
            <div className="space-y-1">
              {sec.items.map((item) => {
                const active = isActive(item.href);
                return item.soon ? (
                  <div
                    key={item.href}
                    className="flex cursor-not-allowed items-center gap-3 rounded-xl px-2.5 py-2 text-[12px] text-slate-400 opacity-60"
                    title="ກຳລັງພັດທະນາ"
                  >
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                      {item.icon}
                    </span>
                    <span className="flex-1 font-medium">{item.label}</span>
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[8px] text-slate-400 font-black tracking-wider uppercase">ໄວໆ</span>
                  </div>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`group flex items-center gap-3 rounded-xl px-2.5 py-2 text-[12px] font-semibold ring-1 ring-inset transition-all duration-150 ${
                      active
                        ? "bg-blue-50 text-blue-700 ring-blue-200"
                        : "text-slate-600 ring-transparent hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-all ${
                      active
                        ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                        : "bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600"
                    }`}>
                      {item.icon}
                    </span>
                    <span className="flex-1 transition-transform duration-150 group-hover:translate-x-0.5">{item.label}</span>
                    {active && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.7)]" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* System status footer */}
      <div className="border-t border-slate-100 px-3.5 py-3.5">
        <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[10.5px] font-bold text-slate-500">ລະບົບພ້ອມໃຊ້ງານ</span>
          <span className="font-display ml-auto rounded-md bg-blue-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-blue-600">v2</span>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="flex h-screen bg-[var(--theme-page)] overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 flex-shrink-0 md:block">
        {SidebarBody}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300" />
          <aside
            className="absolute left-0 top-0 h-full w-64 animate-slide-in-right"
            onClick={(e) => e.stopPropagation()}
            style={{ animationDirection: "reverse" }}
          >
            {SidebarBody}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-16 flex-shrink-0 items-center gap-3 border-b border-slate-200 bg-white/85 backdrop-blur-md px-4 md:px-6 sticky top-0 z-30">
          <button
            className="md:hidden flex h-9 w-9 items-center justify-center text-slate-700 hover:bg-slate-100 rounded-xl transition-all active:scale-95 border border-slate-200"
            onClick={() => setOpen(true)}
            aria-label="ເມນູ"
          >
            <Menu size={18} />
          </button>

          {/* Title block */}
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="h-7 w-1.5 flex-shrink-0 rounded-full bg-gradient-to-b from-blue-500 to-blue-600" />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{sectionFor(pathname)}</div>
              <h2 className="truncate text-[15px] font-black tracking-tight text-slate-900">{titleFor(pathname)}</h2>
            </div>
          </div>

          {/* Right cluster */}
          <div className="ml-auto flex items-center gap-2.5">
            {can(user, "projects", "create") && (
              <Link
                href="/v2/projects/new"
                className="inline-flex h-9.5 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-bold text-white shadow-sm shadow-blue-600/25 transition-all hover:bg-blue-700 active:scale-[0.98]"
              >
                <Plus size={15} strokeWidth={2.75} />
                <span className="hidden sm:inline">ສ້າງໂຄງການ</span>
              </Link>
            )}

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex h-9.5 items-center gap-2 rounded-xl border border-slate-200 bg-white pl-1.5 pr-2 transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98]"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg premium-gradient text-[11px] font-black text-white">{initial}</span>
                <span className="hidden max-w-[120px] truncate text-[12px] font-bold text-slate-700 sm:block">{user?.name}</span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`} />
              </button>

              {menuOpen && (
                <>
                  <button aria-hidden tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 origin-top-right overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_45px_-12px_rgba(15,23,42,0.28)] animate-scale-up">
                    <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 p-3.5">
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl premium-gradient text-[12px] font-black text-white">{initial}</span>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-black text-slate-900">{user?.name}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600">ສິດເຕັມ</div>
                      </div>
                    </div>
                    <div className="p-1.5">
                      <button
                        onClick={doLogout}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[12.5px] font-bold text-rose-600 transition-colors hover:bg-rose-50"
                      >
                        <LogOut size={15} /> ອອກຈາກລະບົບ
                      </button>
                    </div>
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
