"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type PrimaryAction = {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
};

export type SearchConfig = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
};

export type FilterChip = {
  id: string;
  label: string;
  active?: boolean;
  count?: number;
  onClick?: () => void;
};

export type PageHeaderConfig = {
  title?: string;
  subtitle?: string;
  primaryAction?: PrimaryAction;
  secondaryActions?: PrimaryAction[];
  search?: SearchConfig;
  filterChips?: FilterChip[];
};

type PageHeaderContextValue = {
  config: PageHeaderConfig;
  setConfig: (next: PageHeaderConfig) => void;
};

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PageHeaderConfig>({});
  const value = useMemo(() => ({ config, setConfig }), [config]);
  return (
    <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>
  );
}

export function usePageHeaderState(): PageHeaderConfig {
  const ctx = useContext(PageHeaderContext);
  return ctx?.config ?? {};
}

type HandlersBundle = {
  primaryOnClick?: () => void;
  secondaryOnClick: Array<(() => void) | undefined>;
  searchOnChange?: (v: string) => void;
  chipsOnClick: Array<(() => void) | undefined>;
};

/**
 * Page-side hook. Call from inside a page/screen component to register its
 * title, primary action, and search box with the dashboard TopBar control
 * panel. The handlers passed in are kept up-to-date through a ref, so the
 * TopBar always invokes the LATEST callbacks (no stale-closure bugs over
 * state captured in `onClick={() => handleSubmit()}` inline lambdas).
 */
export function usePageHeader(config: PageHeaderConfig) {
  const ctx = useContext(PageHeaderContext);
  const setConfig = ctx?.setConfig;

  // Latest handlers — refreshed every render so the wrappers below always see
  // the current closure (e.g. the handleSubmit that reads the current formData).
  const handlersRef = useRef<HandlersBundle>({
    primaryOnClick: undefined,
    secondaryOnClick: [],
    searchOnChange: undefined,
    chipsOnClick: [],
  });
  handlersRef.current = {
    primaryOnClick: config.primaryAction?.onClick,
    secondaryOnClick: (config.secondaryActions || []).map((a) => a.onClick),
    searchOnChange: config.search?.onChange,
    chipsOnClick: (config.filterChips || []).map((c) => c.onClick),
  };

  // Serialize PRIMITIVE fields only — this becomes the effect dep key so the
  // context only re-renders TopBar when something visible changed.
  const key = JSON.stringify({
    t: config.title,
    s: config.subtitle,
    p: config.primaryAction
      ? {
          l: config.primaryAction.label,
          d: !!config.primaryAction.disabled,
          h: config.primaryAction.href,
        }
      : null,
    sec: (config.secondaryActions || []).map((a) => ({
      l: a.label,
      d: !!a.disabled,
      h: a.href,
    })),
    search: config.search
      ? { v: config.search.value, p: config.search.placeholder }
      : null,
    chips: (config.filterChips || []).map((c) => ({
      id: c.id,
      l: c.label,
      a: !!c.active,
      n: c.count,
    })),
  });

  useEffect(() => {
    if (!setConfig) return;

    // Build a stable config whose function fields are WRAPPERS that read the
    // latest handler from the ref at invocation time. The TopBar receives this
    // and re-renders only when `key` (primitives) changes.
    const wrapped: PageHeaderConfig = {
      title: config.title,
      subtitle: config.subtitle,
      primaryAction: config.primaryAction
        ? {
            label: config.primaryAction.label,
            icon: config.primaryAction.icon,
            href: config.primaryAction.href,
            disabled: config.primaryAction.disabled,
            onClick: () => handlersRef.current.primaryOnClick?.(),
          }
        : undefined,
      secondaryActions: config.secondaryActions?.map((a, i) => ({
        label: a.label,
        icon: a.icon,
        href: a.href,
        disabled: a.disabled,
        onClick: () => handlersRef.current.secondaryOnClick[i]?.(),
      })),
      search: config.search
        ? {
            value: config.search.value,
            placeholder: config.search.placeholder,
            onChange: (v: string) => handlersRef.current.searchOnChange?.(v),
          }
        : undefined,
      filterChips: config.filterChips?.map((c, i) => ({
        id: c.id,
        label: c.label,
        active: c.active,
        count: c.count,
        onClick: () => handlersRef.current.chipsOnClick[i]?.(),
      })),
    };

    setConfig(wrapped);
    return () => setConfig({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setConfig]);
}

// Convenience setter for components outside React lifecycle (rare).
export function useResetPageHeader() {
  const ctx = useContext(PageHeaderContext);
  return useCallback(() => ctx?.setConfig({}), [ctx]);
}
