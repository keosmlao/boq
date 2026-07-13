"use client";

import Link from "next/link";
import { Compass, Home } from "lucide-react";
import { useT } from "@/_lib/i18n";

/**
 * Global 404 — rendered for any unmatched route, outside the app shell. It does
 * no server work, so it is a client component purely so it can read the locale
 * from `LanguageProvider` (mounted in the root layout).
 */
export default function NotFound() {
  const t = useT();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-md text-center animate-fade-in">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-strong)]">
          <Compass size={30} />
        </div>
        <h1 className="text-5xl font-black tracking-tight text-[var(--text)]">404</h1>
        <span className="accent-rule mx-auto mt-4" />
        <p className="mt-5 text-sm font-semibold text-[var(--text-soft)]">{t("notFound.title", "ບໍ່ພົບໜ້າທີ່ທ່ານຊອກຫາ")}</p>
        <p className="mt-1.5 text-xs text-[var(--text-mute)]">{t("notFound.desc", "ໜ້ານີ້ອາດຖືກຍ້າຍ ຫຼື ບໍ່ມີຢູ່ແລ້ວ")}</p>
        <Link
          href="/"
          className="mt-7 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[var(--go)] px-5 text-xs font-bold text-white transition-all duration-150 hover:bg-[var(--go-hover)] active:scale-[0.98]"
        >
          <Home size={15} />
          {t("notFound.backHome", "ກັບໄປໜ້າຫຼັກ")}
        </Link>
      </div>
    </div>
  );
}
