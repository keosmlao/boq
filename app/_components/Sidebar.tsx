"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { logout as logoutAction } from "@/_actions/auth";
import {
  BarChart3,
  Briefcase,
  Building2,
  CheckCircle,
  CircleDollarSign,
  Clock,
  FileText,
  Home,
  KanbanSquare,
  LayoutGrid,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  Target,
  Timer,
  Users,
  Wrench,
  X,
  ChevronsLeft,
  ChevronsRight,
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

const parseRoles = (roleData: unknown): string[] => {
  if (Array.isArray(roleData)) return roleData;
  if (typeof roleData === "string" && roleData.includes(",")) {
    return roleData.split(",").map((r) => r.trim()).filter(Boolean);
  }
  return roleData ? [roleData as string] : [];
};

const COLLAPSED_KEY = "odg-sidebar-collapsed";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState("");
  const [username, setUsername] = useState("ຜູ້ໃຊ້");
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      setUsername(user.name_1 || user.username || "ຜູ້ໃຊ້");
      setRoles(parseRoles(user.allRoles || user.role || ""));
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      // ignore
    }
    setReady(true);
  }, []);

  const sidebarSections: Record<string, NavSection[]> = useMemo(
    () => ({
      sale_admin: [
        {
          section: "ການຂາຍ",
          links: [
            { label: "ໂຄງການ", path: "/sale-admin/list-project", icon: <KanbanSquare size={16} /> },
          ],
        },
        {
          section: "ການດຳເນີນງານ",
          links: [
            { label: "ໂຄງການບໍລິການ", path: "/service-admin/list-project", icon: <Building2 size={16} /> },
            { label: "BOQ", path: "/service-admin/list-boq", icon: <FileText size={16} /> },
            { label: "ໃບຂໍເບີກ", path: "/service-admin/list-request", icon: <Briefcase size={16} /> },
            { label: "ປິດໂຄງການ", path: "/service-admin/close-request", icon: <Target size={16} /> },
          ],
        },
      ],
      sale_manager: [
        {
          section: "ການຂາຍ",
          links: [
            { label: "ໂຄງການ", path: "/sale-admin/list-project", icon: <KanbanSquare size={16} /> },
          ],
        },
        {
          section: "ການດຳເນີນງານ",
          links: [
            { label: "ໂຄງການບໍລິການ", path: "/service-admin/list-project", icon: <Building2 size={16} /> },
            { label: "BOQ", path: "/service-admin/list-boq", icon: <FileText size={16} /> },
            { label: "ງວດຊຳລະ", path: "/service-admin/installments", icon: <Clock size={16} /> },
            { label: "ໃບລົງເວລາ", path: "/timesheets", icon: <Timer size={16} /> },
          ],
        },
      ],
      service_admin: [
        {
          section: "ໂຄງການ",
          links: [
            { label: "ໂຄງການ", path: "/service-admin/list-project", icon: <KanbanSquare size={16} /> },
            { label: "BOQ", path: "/service-admin/list-boq", icon: <FileText size={16} /> },
            { label: "ການຂໍປິດໂຄງການ", path: "/service-admin/close-request", icon: <Target size={16} /> },
          ],
        },
        {
          section: "ການດຳເນີນງານ",
          links: [
            { label: "ໃບຂໍເບີກ", path: "/service-admin/list-request", icon: <Briefcase size={16} /> },
            { label: "ໃບສົ່ງຄືນ", path: "/service-admin/material-return-list", icon: <RefreshCw size={16} /> },
            { label: "ໃບສັ່ງວຽກ", path: "/service-admin/work-orders", icon: <CheckCircle size={16} />, badge: "!" },
            { label: "ຊ່າງເທັກນິກ", path: "/service-admin/technicians", icon: <Users size={16} /> },
            { label: "ສາງ", path: "/service-admin/list-sparepart", icon: <LayoutGrid size={16} /> },
          ],
        },
      ],
      service_manager: [
        {
          section: "ໂຄງການ",
          links: [
            { label: "ໂຄງການ", path: "/service-admin/list-project", icon: <KanbanSquare size={16} /> },
            { label: "BOQ", path: "/service-admin/list-boq", icon: <FileText size={16} /> },
            { label: "ໃບສັ່ງວຽກ", path: "/service-admin/work-orders", icon: <CheckCircle size={16} /> },
            { label: "ໃບລົງເວລາ", path: "/timesheets", icon: <Timer size={16} /> },
          ],
        },
      ],
      head_technician: [
        {
          section: "ບ່ອນເຮັດວຽກ",
          links: [
            { label: "ໜ້າຫຼັກ", path: "/head-tech/home", icon: <Home size={16} /> },
            { label: "ສະຫຼຸບ", path: "/head-tech/summary", icon: <BarChart3 size={16} /> },
            { label: "ໂຄງການ", path: "/service-admin/list-project", icon: <KanbanSquare size={16} /> },
            { label: "ໃບສັ່ງວຽກ", path: "/service-admin/work-orders", icon: <CheckCircle size={16} /> },
            { label: "ໃບລົງເວລາ", path: "/timesheets", icon: <Timer size={16} /> },
          ],
        },
      ],
      account_admin: [
        {
          section: "ບັນຊີ",
          links: [
            { label: "ໂຄງການ", path: "/sale-admin/list-project", icon: <KanbanSquare size={16} /> },
            { label: "ງວດຊຳລະ", path: "/service-admin/installments", icon: <Clock size={16} /> },
          ],
        },
      ],
    }),
    [],
  );

  // Flat access: merge the menus of EVERY role the user has (deduped by path),
  // so there is no role to "choose" — the user just sees everything at once.
  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const seen = new Set<string>();
    const order: string[] = [];
    const bySection = new Map<string, NavLink[]>();

    for (const role of roles) {
      for (const section of sidebarSections[role] || []) {
        if (!bySection.has(section.section)) {
          bySection.set(section.section, []);
          order.push(section.section);
        }
        const bucket = bySection.get(section.section)!;
        for (const link of section.links) {
          if (seen.has(link.path)) continue;
          if (q && !link.label.toLowerCase().includes(q)) continue;
          seen.add(link.path);
          bucket.push(link);
        }
      }
    }

    return order
      .map((section) => ({ section, links: bySection.get(section)! }))
      .filter((section) => section.links.length > 0);
  }, [roles, search, sidebarSections]);

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  const logout = async () => {
    localStorage.clear();
    await logoutAction();
    router.replace("/login");
  };

  const nav = (
    <aside
      className={[
        "flex h-full flex-col border-r border-[var(--border)] bg-[var(--sidebar-bg)] text-[var(--text)]",
        collapsed ? "w-[60px]" : "w-[240px]",
        "transition-[width] duration-200 ease-out",
      ].join(" ")}
    >
      {/* Brand */}
      <div
        className={[
          "flex items-center gap-2.5 border-b border-[var(--border)] px-3",
          collapsed ? "h-14 justify-center" : "h-14",
        ].join(" ")}
      >
        <Link
          href="/sale-admin/list-project"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--text)] text-[var(--text-inverse)]"
          title="ODG"
        >
          <img src="/ODG.png" alt="ODG" className="h-5 w-5 object-contain invert dark:invert-0" />
        </Link>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold leading-tight">ODG</div>
            <div className="truncate text-[10.5px] text-[var(--text-mute)]">
              Project Management
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="border-b border-[var(--border)] p-2.5">
          <div className="flex h-8 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 focus-within:border-[var(--brand)] focus-within:ring-2 focus-within:ring-[var(--brand-ring)] transition-colors">
            <Search size={13} className="text-[var(--text-mute)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ຄົ້ນຫາເມນູ..."
              className="min-w-0 flex-1 bg-transparent text-[12px] text-[var(--text)] outline-none placeholder:text-[var(--text-mute)]"
            />
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="theme-scrollbar flex-1 overflow-y-auto px-2 py-3">
        {!ready ? (
          <div className="space-y-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-[var(--bg-subtle)]" />
            ))}
          </div>
        ) : sections.length === 0 ? (
          !collapsed && (
            <div className="px-2 py-8 text-center text-[12px] text-[var(--text-mute)]">
              ບໍ່ມີເມນູ
            </div>
          )
        ) : (
          <div className="space-y-4">
            {sections.map((section) => (
              <div key={section.section}>
                {!collapsed && (
                  <div className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-mute)]">
                    {section.section}
                  </div>
                )}
                <div className="space-y-0.5">
                  {section.links.map((link) => {
                    const active =
                      pathname === link.path || pathname.startsWith(`${link.path}/`);
                    return (
                      <Link
                        key={link.path}
                        href={link.path}
                        onClick={() => setOpen(false)}
                        title={collapsed ? link.label : undefined}
                        className={[
                          "flex items-center gap-2.5 rounded-[var(--radius-sm)] text-[13px] font-medium transition-colors",
                          collapsed
                            ? "h-9 w-9 justify-center mx-auto"
                            : "h-9 px-2.5",
                          active
                            ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                            : "text-[var(--text-soft)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]",
                        ].join(" ")}
                      >
                        <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
                          {link.icon}
                        </span>
                        {!collapsed && (
                          <>
                            <span className="min-w-0 flex-1 truncate">{link.label}</span>
                            {link.badge && (
                              <span className="rounded-full bg-[var(--danger)] px-1.5 py-0.5 text-[9px] font-bold text-white">
                                {link.badge}
                              </span>
                            )}
                          </>
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

      {/* Footer: collapse + user + logout */}
      <div className="border-t border-[var(--border)] p-2.5 space-y-2">
        <button
          type="button"
          onClick={toggleCollapsed}
          className="hidden md:flex h-7 w-full items-center justify-center gap-1.5 rounded-[var(--radius-sm)] text-[11px] font-medium text-[var(--text-mute)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)] transition-colors"
          title={collapsed ? "ຂະຫຍາຍ" : "ຫຍໍ້"}
        >
          {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
          {!collapsed && <span>ຫຍໍ້ເມນູ</span>}
        </button>

        {collapsed ? (
          <button
            type="button"
            onClick={logout}
            title="ອອກຈາກລະບົບ"
            className="flex h-9 w-9 mx-auto items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-soft)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)] transition-colors"
          >
            <LogOut size={15} />
          </button>
        ) : (
          <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-soft)] p-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[11px] font-semibold text-[var(--text-soft)]">
                {(username || "U").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-semibold text-[var(--text)] leading-tight">
                  {username}
                </div>
                <div className="truncate text-[10.5px] text-[var(--text-mute)] mt-0.5">
                  ສິດເຕັມ
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                title="ອອກຈາກລະບົບ"
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-[var(--text-mute)] hover:bg-[var(--bg-subtle)] hover:text-[var(--danger)] transition-colors"
              >
                <LogOut size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed left-2 top-2 z-50 flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--text)] text-[var(--text-inverse)] md:hidden"
        aria-label="ສະຫຼັບເມນູ"
      >
        {open ? <X size={16} /> : <Menu size={16} />}
      </button>
      {open && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setOpen(false)} />}
      <div
        className={[
          "fixed inset-y-0 left-0 z-50 transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        ].join(" ")}
      >
        {nav}
      </div>
    </>
  );
}
