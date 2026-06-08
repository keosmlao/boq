"use client";

/**
 * v2 shell — sidebar + topbar + flat auth guard.
 *
 * FLAT ACCESS: every authenticated user sees the FULL menu and can open every
 * page. There is no role filtering anywhere in the rebuild.
 */
import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Home,
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
  X,
} from "lucide-react";
import { getV2User, clearV2User, type V2User } from "../../_lib/session";
import { logout } from "@/_actions/auth";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  soon?: boolean;
};

const NAV: NavItem[] = [
  { label: "ໜ້າຫຼັກ", href: "/v2", icon: <Home size={17} /> },
  { label: "ໂຄງການ", href: "/v2/projects", icon: <FolderKanban size={17} /> },
  { label: "ໃບສະເໜີລາຄາ", href: "/v2/quotations", icon: <FileText size={17} />, soon: true },
  { label: "ສັນຍາ", href: "/v2/contracts", icon: <FileSignature size={17} />, soon: true },
  { label: "BOQ", href: "/v2/boq", icon: <ListChecks size={17} />, soon: true },
  { label: "ກຳນົດໜ້າວຽກ", href: "/v2/schedule", icon: <CalendarRange size={17} />, soon: true },
  { label: "ໃບງານ", href: "/v2/work-orders", icon: <Wrench size={17} />, soon: true },
  { label: "ຂໍເບີກ", href: "/v2/requests", icon: <PackageOpen size={17} />, soon: true },
  { label: "ບັນຊີ / ງວດຈ່າຍ", href: "/v2/finance", icon: <Wallet size={17} />, soon: true },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<V2User | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

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
      <div className="flex h-screen items-center justify-center text-[var(--theme-text-mute)]">
        ກຳລັງກວດສອບການເຂົ້າສູ່ລະບົບ...
      </div>
    );
  }

  const isActive = (href: string) =>
    href === "/v2" ? pathname === "/v2" : pathname.startsWith(href);

  const SidebarBody = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--theme-primary)] text-white">
          <FolderKanban size={18} />
        </div>
        <div className="text-[13px] font-bold leading-tight text-[var(--theme-text)]">
          ໂຄງການ
          <div className="text-[10px] font-normal text-[var(--theme-text-mute)]">ຂາຍ & ຕິດຕັ້ງ</div>
        </div>
      </div>

      <div className="flex-1 space-y-0.5 overflow-y-auto px-2">
        {NAV.map((item) =>
          item.soon ? (
            <div
              key={item.href}
              className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-[var(--theme-text-mute)] opacity-70"
              title="ກຳລັງພັດທະນາ"
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              <span className="rounded bg-[var(--theme-bg-muted)] px-1.5 py-0.5 text-[9px]">ໄວໆນີ້</span>
            </div>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition ${
                isActive(item.href)
                  ? "bg-[var(--theme-primary)] font-semibold text-white"
                  : "text-[var(--theme-text-soft)] hover:bg-[var(--theme-bg-muted)]"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ),
        )}
      </div>

      <div className="border-t border-[var(--theme-border-subtle)] p-3">
        <div className="mb-2 px-1 text-[12px]">
          <div className="font-semibold text-[var(--theme-text)]">{user?.name}</div>
          <div className="text-[10px] text-[var(--theme-text-mute)]">@{user?.username} · ສິດເຕັມ</div>
        </div>
        <button
          onClick={doLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-rose-600 transition hover:bg-rose-50"
        >
          <LogOut size={16} /> ອອກຈາກລະບົບ
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex h-screen bg-[var(--theme-page)]">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 flex-shrink-0 border-r border-[var(--theme-border-subtle)] bg-white md:block">
        {SidebarBody}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside className="absolute left-0 top-0 h-full w-60 bg-white" onClick={(e) => e.stopPropagation()}>
            {SidebarBody}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 flex-shrink-0 items-center gap-2 border-b border-[var(--theme-border-subtle)] bg-white px-3">
          <button className="md:hidden" onClick={() => setOpen(true)}>
            <Menu size={20} />
          </button>
          <span className="text-[12px] text-[var(--theme-text-mute)]">ສະບັບໃໝ່ (v2)</span>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
