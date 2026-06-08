"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  ChevronRight,
  LogOut,
  Plus,
  Search,
  Settings,
} from "lucide-react";
import { usePageHeaderState } from "./PageHeader";
import { ThemeToggle } from "./theme/ThemeToggle";

const LABELS: Record<string, string> = {
  "sale-admin": "ການຂາຍ",
  "service-admin": "ບໍລິການ",
  "sale-manager": "ການຂາຍ",
  "service-manager": "ບໍລິການ",
  "head-tech": "ບໍລິການພາກສະໜາມ",
  acc: "ບັນຊີ",
  "list-project": "ໂຄງການ",
  "list-boq": "BOQ",
  "list-request": "ໃບຂໍເບີກ",
  "list-sparepart": "ສາງ",
  "list-waiting-approve": "ລໍຖ້າອະນຸມັດ",
  installments: "ງວດຊຳລະ",
  "work-orders": "ໃບສັ່ງວຽກ",
  technicians: "ຊ່າງເທັກນິກ",
  quotations: "ໃບສະເໜີລາຄາ",
  timesheets: "ໃບລົງເວລາ",
  home: "ໜ້າຫຼັກ",
  summary: "ສະຫຼຸບ",
};

function labelFor(segment: string) {
  return LABELS[segment] || decodeURIComponent(segment);
}

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const pageHeader = usePageHeaderState();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const settingsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      setUserName(u.name_1 || u.name || u.username || u.email || "ຜູ້ໃຊ້");
    } catch {
      setUserName("ຜູ້ໃຊ້");
    }
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!settingsRef.current?.contains(e.target as Node)) setSettingsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [settingsOpen]);

  const logout = () => {
    localStorage.clear();
    document.cookie = "odg-auth=; path=/; max-age=0";
    router.replace("/login");
  };

  const crumbs = useMemo(() => {
    return pathname
      .split("/")
      .filter(Boolean)
      .map((seg, index, all) => ({
        href: `/${all.slice(0, index + 1).join("/")}`,
        label: /^\d+$/.test(seg) || seg.length > 24 ? `#${seg.slice(0, 8)}` : labelFor(seg),
      }));
  }, [pathname]);

  const title = pageHeader.title || crumbs[crumbs.length - 1]?.label || "ໜ້າຫຼັກ";

  const renderAction = (
    action: NonNullable<typeof pageHeader.primaryAction>,
    primary = false,
  ) => {
    const cls = [
      "inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-sm)] px-3 text-[12px] font-medium transition-colors whitespace-nowrap",
      primary
        ? "bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)]"
        : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--bg-subtle)] hover:border-[var(--border-strong)]",
      action.disabled ? "opacity-50 cursor-not-allowed" : "",
    ].join(" ");

    if (action.href) {
      return (
        <Link key={action.label} href={action.href} className={cls} aria-disabled={action.disabled}>
          {action.icon}
          {action.label}
        </Link>
      );
    }

    return (
      <button
        key={action.label}
        type="button"
        onClick={action.onClick}
        disabled={action.disabled}
        className={cls}
      >
        {action.icon}
        {action.label}
      </button>
    );
  };

  return (
    <header className="sticky top-0 z-30">
      {/* Row 1: page title + breadcrumb + global controls */}
      <div className="flex h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--topbar-bg)] px-4">
        <div className="min-w-0 flex-1">
          {crumbs.length > 1 && (
            <nav className="mb-0.5 hidden items-center gap-1 text-[11px] text-[var(--text-mute)] md:flex">
              {crumbs.slice(0, -1).map((crumb, i) => (
                <span key={crumb.href} className="flex items-center gap-1">
                  <span className="truncate">{crumb.label}</span>
                  {i < crumbs.length - 2 && <ChevronRight size={11} className="opacity-60" />}
                  {i === crumbs.length - 2 && <ChevronRight size={11} className="opacity-60" />}
                </span>
              ))}
            </nav>
          )}
          <div className="flex items-baseline gap-2 min-w-0">
            <h1 className="truncate text-[15px] font-semibold leading-5 tracking-tight text-[var(--text)]">
              {title}
            </h1>
            {pageHeader.subtitle && (
              <span className="truncate text-[12px] text-[var(--text-mute)]">
                {pageHeader.subtitle}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-soft)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)] transition-colors"
            aria-label="ແຈ້ງເຕືອນ"
          >
            <Bell size={15} />
          </button>
          <div ref={settingsRef} className="relative">
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={settingsOpen}
              aria-label="ຕັ້ງຄ່າ"
              className={[
                "inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] transition-colors",
                settingsOpen
                  ? "bg-[var(--bg-subtle)] text-[var(--text)]"
                  : "text-[var(--text-soft)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]",
              ].join(" ")}
            >
              <Settings size={15} />
            </button>
            {settingsOpen && (
              <div
                role="menu"
                className="absolute right-0 top-9 z-40 w-56 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)] animate-fade-in"
              >
                <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-3 py-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[11px] font-semibold text-[var(--text-soft)]">
                    {(userName || "U").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[12.5px] font-semibold text-[var(--text)]">
                      {userName}
                    </div>
                    <div className="text-[10.5px] text-[var(--text-mute)]">ODG Workspace</div>
                  </div>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setSettingsOpen(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12.5px] text-[var(--text-soft)] hover:bg-[var(--bg-subtle)] hover:text-[var(--danger)] transition-colors"
                >
                  <LogOut size={14} />
                  ອອກຈາກລະບົບ
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: page actions + search (only when something is registered) */}
      {(pageHeader.primaryAction ||
        pageHeader.secondaryActions?.length ||
        pageHeader.search ||
        pageHeader.filterChips?.length) && (
        <div className="border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
            {pageHeader.search && (
              <div className="flex h-8 min-w-[240px] max-w-sm flex-1 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 focus-within:border-[var(--brand)] focus-within:ring-2 focus-within:ring-[var(--brand-ring)] transition-colors">
                <Search size={13} className="text-[var(--text-mute)]" />
                <input
                  value={pageHeader.search.value}
                  onChange={(e) => pageHeader.search?.onChange(e.target.value)}
                  placeholder={pageHeader.search.placeholder || "ຄົ້ນຫາ..."}
                  className="min-w-0 flex-1 bg-transparent text-[12.5px] text-[var(--text)] outline-none placeholder:text-[var(--text-mute)]"
                />
              </div>
            )}

            <div className={["flex flex-wrap items-center gap-2", pageHeader.search ? "ml-auto" : "ml-auto"].join(" ")}>
              {pageHeader.secondaryActions?.map((action) => renderAction(action))}
              {pageHeader.primaryAction && renderAction(pageHeader.primaryAction, true)}
            </div>
          </div>

          {pageHeader.filterChips && pageHeader.filterChips.length > 0 && (
            <div className="theme-scrollbar flex items-center gap-1.5 overflow-x-auto border-t border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-2">
              {pageHeader.filterChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={chip.onClick}
                  className={[
                    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                    chip.active
                      ? "border-transparent bg-[var(--text)] text-[var(--text-inverse)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-soft)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]",
                  ].join(" ")}
                >
                  {chip.label}
                  {chip.count !== undefined && (
                    <span
                      className={[
                        "rounded-full px-1.5 py-0 text-[9.5px] font-semibold",
                        chip.active
                          ? "bg-white/20 text-[var(--text-inverse)]"
                          : "bg-[var(--bg-subtle)] text-[var(--text-soft)]",
                      ].join(" ")}
                    >
                      {chip.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </header>
  );
}

export { usePageHeader } from "./PageHeader";
