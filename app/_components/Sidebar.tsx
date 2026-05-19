"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Briefcase,
  Building2,
  CheckCircle,
  CircleDollarSign,
  Clock,
  FileText,
  Grid3X3,
  Home,
  KanbanSquare,
  LayoutGrid,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  Shield,
  Target,
  Timer,
  Users,
  Wrench,
  X,
} from "lucide-react";

type NavLink = {
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: string;
};

type NavSection = {
  section: string;
  links: NavLink[];
};

type AppItem = {
  key: string;
  label: string;
  short: string;
  href: string;
  icon: React.ReactNode;
};

const normalizeRole = (role: unknown) =>
  typeof role === "string" && role.includes(",") ? role.split(",")[0].trim() : (role as string) || "";

const parseRoles = (roleData: unknown): string[] => {
  if (Array.isArray(roleData)) return roleData;
  if (typeof roleData === "string" && roleData.includes(",")) {
    return roleData.split(",").map((r) => r.trim()).filter(Boolean);
  }
  return roleData ? [roleData as string] : [];
};

const roleLabel: Record<string, string> = {
  sale_admin: "ແອັດມິນຂາຍ",
  sale_manager: "ຜູ້ຈັດການຂາຍ",
  service_admin: "ແອັດມິນບໍລິການ",
  service_manager: "ຜູ້ຈັດການບໍລິການ",
  head_technician: "ຫົວໜ້າຊ່າງ",
  account_admin: "ບັນຊີ",
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState("");
  const [username, setUsername] = useState("ຜູ້ໃຊ້");
  const [activeRole, setActiveRole] = useState("");
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      setUsername(user.name_1 || user.username || "ຜູ້ໃຊ້");
      setActiveRole(normalizeRole(user.role || ""));
      setRoles(parseRoles(user.allRoles || user.role || ""));
    } catch {
      // ignore localStorage parse errors
    }
    setReady(true);
  }, []);

  const apps: AppItem[] = useMemo(
    () => [
      { key: "sales", label: "ການຂາຍ", short: "ຂາຍ", href: "/sale-admin/list-project", icon: <KanbanSquare size={19} /> },
      { key: "service", label: "ບໍລິການ", short: "ບໍລິການ", href: "/service-admin/list-project", icon: <Wrench size={19} /> },
      { key: "inventory", label: "ສາງ", short: "ສາງ", href: "/service-admin/list-sparepart", icon: <LayoutGrid size={19} /> },
      { key: "accounting", label: "ບັນຊີ", short: "ບັນຊີ", href: "/service-admin/installments", icon: <CircleDollarSign size={19} /> },
      { key: "timesheets", label: "ໃບລົງເວລາ", short: "ເວລາ", href: "/timesheets", icon: <Timer size={19} /> },
      { key: "reports", label: "ລາຍງານ", short: "ລາຍງານ", href: "/head-tech/summary", icon: <BarChart3 size={19} /> },
    ],
    [],
  );

  const sidebarSections: Record<string, NavSection[]> = useMemo(
    () => ({
      sale_admin: [
        {
          section: "ການຂາຍ",
          links: [
            { label: "ໂຄງການ", path: "/sale-admin/list-project", icon: <KanbanSquare size={15} /> },
          ],
        },
        {
          section: "ການດຳເນີນງານ",
          links: [
            { label: "ໂຄງການບໍລິການ", path: "/service-admin/list-project", icon: <Building2 size={15} /> },
            { label: "BOQ", path: "/service-admin/list-boq", icon: <FileText size={15} /> },
            { label: "ໃບຂໍເບີກ", path: "/service-admin/list-request", icon: <Briefcase size={15} /> },
            { label: "ປິດໂຄງການ", path: "/service-admin/close-request", icon: <Target size={15} /> },
          ],
        },
      ],
      sale_manager: [
        {
          section: "ການຂາຍ",
          links: [
            { label: "ໂຄງການ", path: "/sale-admin/list-project", icon: <KanbanSquare size={15} /> },
          ],
        },
        {
          section: "ການດຳເນີນງານ",
          links: [
            { label: "ໂຄງການບໍລິການ", path: "/service-admin/list-project", icon: <Building2 size={15} /> },
            { label: "BOQ", path: "/service-admin/list-boq", icon: <FileText size={15} /> },
            { label: "ງວດຊຳລະ", path: "/service-admin/installments", icon: <Clock size={15} /> },
            { label: "ໃບລົງເວລາ", path: "/timesheets", icon: <Timer size={15} /> },
          ],
        },
      ],
      service_admin: [
        {
          section: "ໂຄງການ",
          links: [
            { label: "ໂຄງການ", path: "/service-admin/list-project", icon: <KanbanSquare size={15} /> },
            { label: "BOQ", path: "/service-admin/list-boq", icon: <FileText size={15} /> },
            { label: "ການຂໍປິດໂຄງການ", path: "/service-admin/close-request", icon: <Target size={15} /> },
          ],
        },
        {
          section: "ການດຳເນີນງານ",
          links: [
            { label: "ໃບຂໍເບີກ", path: "/service-admin/list-request", icon: <Briefcase size={15} /> },
            { label: "ໃບສົ່ງຄືນ", path: "/service-admin/material-return-list", icon: <RefreshCw size={15} /> },
            { label: "ໃບສັ່ງວຽກ", path: "/service-admin/work-orders", icon: <CheckCircle size={15} />, badge: "!" },
            { label: "ຊ່າງເທັກນິກ", path: "/service-admin/technicians", icon: <Users size={15} /> },
          ],
        },
      ],
      service_manager: [
        {
          section: "ໂຄງການ",
          links: [
            { label: "ໂຄງການ", path: "/service-admin/list-project", icon: <KanbanSquare size={15} /> },
            { label: "BOQ", path: "/service-admin/list-boq", icon: <FileText size={15} /> },
            { label: "ໃບສັ່ງວຽກ", path: "/service-admin/work-orders", icon: <CheckCircle size={15} /> },
            { label: "ໃບລົງເວລາ", path: "/timesheets", icon: <Timer size={15} /> },
          ],
        },
      ],
      head_technician: [
        {
          section: "ບ່ອນເຮັດວຽກ",
          links: [
            { label: "ໜ້າຫຼັກ", path: "/head-tech/home", icon: <Home size={15} /> },
            { label: "ສະຫຼຸບ", path: "/head-tech/summary", icon: <BarChart3 size={15} /> },
            { label: "ໂຄງການ", path: "/service-admin/list-project", icon: <KanbanSquare size={15} /> },
            { label: "ໃບສັ່ງວຽກ", path: "/service-admin/work-orders", icon: <CheckCircle size={15} /> },
            { label: "ໃບລົງເວລາ", path: "/timesheets", icon: <Timer size={15} /> },
          ],
        },
      ],
      account_admin: [
        {
          section: "ບັນຊີ",
          links: [
            { label: "ໂຄງການ", path: "/sale-admin/list-project", icon: <KanbanSquare size={15} /> },
            { label: "ງວດຊຳລະ", path: "/service-admin/installments", icon: <Clock size={15} /> },
          ],
        },
      ],
    }),
    [],
  );

  const sections = useMemo(() => {
    const seen = new Set<string>();
    const q = search.trim().toLowerCase();
    return (sidebarSections[activeRole] || [])
      .map((section) => ({
        ...section,
        links: section.links.filter((link) => {
          if (seen.has(link.path)) return false;
          seen.add(link.path);
          return !q || link.label.toLowerCase().includes(q);
        }),
      }))
      .filter((section) => section.links.length > 0);
  }, [activeRole, search, sidebarSections]);

  const activeApp = apps.find((app) => pathname.startsWith(app.href.split("/").slice(0, 2).join("/"))) || apps[0];

  const switchRole = (role: string) => {
    if (role === activeRole) return;

    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      user.role = role;
      localStorage.setItem("user", JSON.stringify(user));
    } catch {
      // ignore
    }

    setActiveRole(role);
    window.location.reload();
  };

  const logout = () => {
    localStorage.clear();
    document.cookie = "odg-auth=; path=/; max-age=0";
    router.replace("/login");
  };

  const nav = (
    <aside className="flex h-full bg-[#f7f5f7] text-[var(--theme-text)]">
      <div className="flex w-14 flex-col items-center border-r border-[var(--theme-border-subtle)] bg-[var(--theme-primary)] py-2 text-white">
        <Link href="/sale-admin/list-project" className="mb-2 flex h-10 w-10 items-center justify-center rounded hover:bg-white/10" title="ODG">
          <img src="/ODG.png" alt="ODG" className="h-6 w-6 object-contain" />
        </Link>
        <div className="theme-scrollbar flex flex-1 flex-col gap-1 overflow-y-auto">
          {apps.map((app) => {
            const active = activeApp.key === app.key;
            return (
              <Link
                key={app.key}
                href={app.href}
                title={app.label}
                onClick={() => setOpen(false)}
                className={[
                  "flex h-11 w-11 flex-col items-center justify-center rounded text-[9px] font-semibold transition",
                  active ? "bg-white text-[var(--theme-primary)]" : "text-white/78 hover:bg-white/10 hover:text-white",
                ].join(" ")}
              >
                {app.icon}
                <span className="mt-0.5 max-w-full truncate">{app.short}</span>
              </Link>
            );
          })}
        </div>
        <button type="button" onClick={logout} className="mt-2 flex h-10 w-10 items-center justify-center rounded text-white/78 hover:bg-white/10 hover:text-white" title="ອອກຈາກລະບົບ">
          <LogOut size={17} />
        </button>
      </div>

      <div className="flex w-[220px] flex-col border-r border-[var(--theme-border-subtle)] bg-[#f7f5f7]">
        <div className="border-b border-[var(--theme-border-subtle)] bg-white px-3 py-2.5">
          <div className="text-[13px] font-semibold text-[var(--theme-primary)]">{activeApp.label}</div>
          <div className="truncate text-[11px] text-[var(--theme-text-mute)]">{roleLabel[activeRole] || "ບ່ອນເຮັດວຽກ"}</div>
        </div>

        <div className="border-b border-[var(--theme-border-subtle)] bg-white p-2">
          <div className="flex h-8 items-center gap-2 rounded border border-[var(--theme-border)] bg-white px-2">
            <Search size={13} className="text-[var(--theme-text-mute)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ຄົ້ນຫາເມນູ..."
              className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-[var(--theme-text-mute)]"
            />
          </div>
        </div>

        <nav className="theme-scrollbar flex-1 overflow-y-auto px-2 py-2">
          {!ready ? (
            <div className="space-y-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-white" />
              ))}
            </div>
          ) : sections.length === 0 ? (
            <div className="px-2 py-8 text-center text-[12px] text-[var(--theme-text-mute)]">ບໍ່ມີເມນູ</div>
          ) : (
            <div className="space-y-3">
              {sections.map((section) => (
                <div key={section.section}>
                  <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-text-mute)]">
                    {section.section}
                  </div>
                  <div className="space-y-0.5">
                    {section.links.map((link) => {
                      const active = pathname === link.path || pathname.startsWith(`${link.path}/`);
                      return (
                        <Link
                          key={link.path}
                          href={link.path}
                          onClick={() => setOpen(false)}
                          className={[
                            "flex h-8 items-center gap-2 rounded px-2 text-[12px] transition",
                            active
                              ? "bg-white font-semibold text-[var(--theme-primary)] shadow-[inset_3px_0_0_var(--theme-primary)]"
                              : "text-[var(--theme-text-soft)] hover:bg-white hover:text-[var(--theme-text)]",
                          ].join(" ")}
                        >
                          <span className="flex h-5 w-5 items-center justify-center text-inherit">{link.icon}</span>
                          <span className="min-w-0 flex-1 truncate">{link.label}</span>
                          {link.badge && (
                            <span className="rounded bg-[var(--theme-accent)] px-1.5 py-px text-[9px] font-bold text-white">{link.badge}</span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </nav>

        <div className="border-t border-[var(--theme-border-subtle)] bg-white p-2">
          <div className="truncate text-[12px] font-semibold text-[var(--theme-text)]">{username}</div>
          {roles.length > 1 ? (
            <select
              value={activeRole}
              onChange={(event) => switchRole(event.target.value)}
              className="mt-1 h-7 w-full rounded border border-[var(--theme-border)] bg-white px-2 text-[11px] text-[var(--theme-text-soft)] outline-none focus:border-[var(--theme-primary)]"
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {roleLabel[role] || role}
                </option>
              ))}
            </select>
          ) : (
            <div className="truncate text-[11px] text-[var(--theme-text-mute)]">{roleLabel[activeRole] || activeRole}</div>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed left-2 top-2 z-50 flex h-8 w-8 items-center justify-center rounded bg-[var(--theme-primary)] text-white md:hidden"
        aria-label="ສະຫຼັບເມນູ"
      >
        {open ? <X size={16} /> : <Menu size={16} />}
      </button>
      {open && <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setOpen(false)} />}
      <div className={`fixed inset-y-0 left-0 z-50 transition-transform md:static md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        {nav}
      </div>
    </>
  );
}
