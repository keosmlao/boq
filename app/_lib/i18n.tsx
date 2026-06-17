"use client";

/**
 * Lightweight client-side i18n. The app is client-rendered with a localStorage
 * session, so locale lives in localStorage ("v2_lang") and a React context —
 * no routing/server changes. Use `const t = useT()` then `t("nav.projects")`.
 * Components used outside the provider still work (graceful no-op fallback),
 * which keeps the incremental rollout safe.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DICT, LOCALES, type Locale } from "./i18n-dict";
import { PAGE_DICT } from "./i18n-dict-pages";

// Base + page/feature translations. Page keys are namespaced so they don't
// collide with the base common.*/nav.* keys.
const ALL: Record<string, Partial<Record<Locale, string>>> = { ...DICT, ...PAGE_DICT };

const STORAGE_KEY = "v2_lang";

type Ctx = { lang: Locale; setLang: (l: Locale) => void; t: (key: string, fallback?: string) => string };
const I18nContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Locale>("lo");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (saved && LOCALES.includes(saved)) {
        setLangState(saved);
        document.documentElement.lang = saved;
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setLang = useCallback((l: Locale) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
      document.documentElement.lang = l;
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: string, fallback?: string) => {
      const entry = ALL[key];
      if (!entry) return fallback ?? key;
      return entry[lang] || entry.lo || fallback || key;
    },
    [lang],
  );

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  // Graceful fallback when a component renders outside the provider.
  if (!ctx) return { lang: "lo", setLang: () => {}, t: (k, f) => f ?? k };
  return ctx;
}

/** Convenience: `const t = useT()` → `t("nav.projects")`. */
export function useT() {
  return useI18n().t;
}
