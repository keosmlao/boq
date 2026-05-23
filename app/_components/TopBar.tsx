"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  Grid3X3,
  LogOut,
  Plus,
  Search,
  Settings,
  UserCircle2,
} from "lucide-react";
import { usePageHeaderState } from "./PageHeader";

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
      setUserName(u.name || u.username || u.email || "ຜູ້ໃຊ້");
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

  const appName = crumbs[0]?.label || "ODG";
  const title = pageHeader.title || crumbs[crumbs.length - 1]?.label || "ໜ້າຫຼັກ";

  const actionClass = (primary = false) =>
    [
      "inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-[12px] font-semibold transition",
      primary
        ? "bg-[var(--theme-accent)] text-white hover:bg-[var(--theme-accent-strong)]"
        : "border border-[var(--theme-border)] bg-white text-[var(--theme-text-soft)] hover:border-[var(--theme-primary-soft)] hover:bg-[var(--theme-primary-tint)] hover:text-[var(--theme-primary)]",
    ].join(" ");

  const renderAction = (action: NonNullable<typeof pageHeader.primaryAction>, primary = false) => {
    if (action.href) {
      return (
        <Link key={action.label} href={action.href} className={actionClass(primary)} aria-disabled={action.disabled}>
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
        className={`${actionClass(primary)} ${action.disabled ? "cursor-not-allowed opacity-50" : ""}`}
      >
        {action.icon}
        {action.label}
      </button>
    );
  };

  return (
    <header className="sticky top-0 z-30">
      <div className="flex h-11 items-center gap-2 bg-[var(--theme-primary)] px-3 text-white shadow-[0_1px_0_rgba(0,0,0,0.18)]">
        <button type="button" className="hidden h-8 w-8 items-center justify-center rounded hover:bg-white/10 md:flex" aria-label="ແອັບ">
          <Grid3X3 size={16} />
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold">ODG</span>
          <span className="hidden text-white/35 md:inline">/</span>
          <span className="hidden truncate text-sm text-white/85 md:inline">{appName}</span>
        </div>

        <nav className="ml-4 hidden h-full items-center text-[13px] md:flex">
          {["ການດຳເນີນງານ", "ລາຍງານ", "ຕັ້ງຄ່າ"].map((item) => (
            <button key={item} type="button" className="h-full px-3 text-white/82 transition hover:bg-white/10 hover:text-white">
              {item}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <div ref={settingsRef} className="relative">
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={settingsOpen}
              aria-label="ຕັ້ງຄ່າ"
              className={`flex h-8 w-8 items-center justify-center rounded transition ${settingsOpen ? "bg-white/15 text-white" : "text-white/82 hover:bg-white/10 hover:text-white"}`}
            >
              <Settings size={15} />
            </button>
            {settingsOpen && (
              <div
                role="menu"
                className="absolute right-0 top-9 z-40 w-56 overflow-hidden rounded-md border border-[var(--theme-border)] bg-white text-[var(--theme-text)] shadow-lg"
              >
                <div className="flex items-center gap-2 border-b border-[var(--theme-border-subtle)] px-3 py-2.5">
                  <UserCircle2 size={28} className="text-[var(--theme-text-mute)]" />
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold">{userName}</div>
                    <div className="text-[10px] text-[var(--theme-text-mute)]">ODG Workspace</div>
                  </div>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setSettingsOpen(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--theme-text)] transition hover:bg-[var(--theme-primary-tint)] hover:text-[var(--theme-primary)]"
                >
                  <LogOut size={14} />
                  ອອກຈາກລະບົບ
                </button>
              </div>
            )}
          </div>
          <button type="button" className="flex h-8 w-8 items-center justify-center rounded text-white/82 hover:bg-white/10 hover:text-white" aria-label="ແຈ້ງເຕືອນ">
            <Bell size={15} />
          </button>
          <button type="button" className="hidden h-8 items-center gap-1 rounded px-2 text-[12px] font-semibold text-white/82 hover:bg-white/10 hover:text-white sm:flex">
            ຜູ້ໃຊ້ ODG
            <ChevronDown size={13} />
          </button>
        </div>
      </div>

      <div className="border-b border-[var(--theme-border)] bg-white">
        <div className="flex min-h-[56px] flex-col gap-2 px-3 py-2 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            {crumbs.length > 1 && (
              <nav className="mb-0.5 hidden items-center gap-1.5 text-[11px] text-[var(--theme-text-mute)] md:flex">
                {crumbs.slice(0, -1).map((crumb) => (
                  <span key={crumb.href} className="flex items-center gap-1.5">
                    <span className="truncate">{crumb.label}</span>
                    <span className="text-[var(--theme-border-strong)]">/</span>
                  </span>
                ))}
              </nav>
            )}
            <div className="flex items-baseline gap-2">
              <h1 className="truncate text-[18px] font-semibold leading-6 text-[var(--theme-text)]">{title}</h1>
              {pageHeader.subtitle && (
                <span className="truncate text-[12px] text-[var(--theme-text-mute)]">{pageHeader.subtitle}</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {pageHeader.primaryAction ? renderAction(pageHeader.primaryAction, true) : (
              <button type="button" className={actionClass(true)}>
                <Plus size={13} />
                ສ້າງໃໝ່
              </button>
            )}
            {pageHeader.secondaryActions?.map((action) => renderAction(action))}

            <div className="flex h-8 min-w-[260px] items-center gap-2 rounded border border-[var(--theme-border)] bg-white px-2.5 focus-within:border-[var(--theme-primary)] focus-within:ring-2 focus-within:ring-[var(--theme-primary)]/15">
              <Search size={14} className="text-[var(--theme-text-mute)]" />
              {pageHeader.search ? (
                <input
                  value={pageHeader.search.value}
                  onChange={(event) => pageHeader.search?.onChange(event.target.value)}
                  placeholder={pageHeader.search.placeholder || "ຄົ້ນຫາ..."}
                  className="min-w-0 flex-1 bg-transparent text-[12px] text-[var(--theme-text)] outline-none placeholder:text-[var(--theme-text-mute)]"
                />
              ) : (
                <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--theme-text-mute)]">Search...</span>
              )}
            </div>

          </div>
        </div>

        {pageHeader.filterChips && pageHeader.filterChips.length > 0 && (
          <div className="theme-scrollbar flex items-center gap-1.5 overflow-x-auto border-t border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] px-3 py-1.5">
            {pageHeader.filterChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={chip.onClick}
                className={[
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition",
                  chip.active
                    ? "border-[var(--theme-primary)] bg-[var(--theme-primary-tint)] text-[var(--theme-primary)]"
                    : "border-[var(--theme-border)] bg-white text-[var(--theme-text-soft)] hover:border-[var(--theme-primary-soft)] hover:text-[var(--theme-primary)]",
                ].join(" ")}
              >
                {chip.label}
                {chip.count !== undefined && (
                  <span className={chip.active ? "rounded-full bg-[var(--theme-primary)] px-1.5 py-px text-[9px] font-semibold text-white" : "rounded-full bg-[var(--theme-bg-muted)] ring-1 ring-[var(--theme-border-subtle)] px-1.5 py-px text-[9px] font-semibold text-[var(--theme-text-soft)]"}>
                    {chip.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

export { usePageHeader } from "./PageHeader";
