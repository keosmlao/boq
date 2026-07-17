"use client";

import { LogOut } from "lucide-react";
import { useT } from "@/_lib/i18n";

/** Slim top bar for the field/craftsman pages: brand + logout. */
export default function FieldTopBar() {
  const t = useT();
  const logout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {/* ignore */}
    window.location.href = "/login";
  };
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-[#0f766e] px-4 py-3 text-white shadow-sm">
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ODG.png" alt="ODG" className="h-7 w-auto object-contain" />
        <span className="text-[13px] font-black tracking-wide">{t("checkin.appTitle", "ເຊັກອິນໜ້າງານ")}</span>
      </div>
      <button
        type="button"
        onClick={logout}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-[11.5px] font-bold transition-colors hover:bg-white/25"
      >
        <LogOut size={14} /> {t("shell.logout", "ອອກຈາກລະບົບ")}
      </button>
    </header>
  );
}
