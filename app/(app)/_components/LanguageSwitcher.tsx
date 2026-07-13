"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useI18n } from "@/_lib/i18n";
import { LOCALES, LOCALE_META, type Locale } from "@/_lib/i18n-dict";

export default function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[11px] font-bold text-[var(--text-soft)] transition-all duration-200 hover:bg-[var(--surface-sunken)] hover:text-[var(--text)] active:scale-95"
        title={t("shell.language")}
        aria-expanded={open}
      >
        <span className="text-[15px] leading-none">{LOCALE_META[lang].flag}</span>
        <span className="hidden sm:inline">{LOCALE_META[lang].short}</span>
      </button>

      {open && (
        <>
          <button aria-hidden tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-40 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-lg)] animate-scale-up">
            {LOCALES.map((code: Locale) => (
              <button
                key={code}
                onClick={() => { setLang(code); setOpen(false); }}
                className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-[11.5px] font-bold text-[var(--text-soft)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text)] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="text-[15px] leading-none">{LOCALE_META[code].flag}</span>
                  {LOCALE_META[code].label}
                </span>
                {lang === code && <Check size={14} className="text-[var(--brand)]" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
