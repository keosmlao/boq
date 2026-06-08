"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Slim progress bar across the very top of the viewport.
 *
 * Triggers on every Link click and route change. We can't observe the actual
 * navigation lifecycle in App Router, so we:
 *   1. Listen for "click on any link/button that navigates" → start.
 *   2. Stop when the URL (pathname or search) actually changes.
 *
 * The bar is purely visual feedback — actual page rendering is gated by
 * loading.tsx + the page server work.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef<number>(0);

  const stop = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setProgress(100);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 220);
  };

  const start = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    startedAtRef.current = Date.now();
    setVisible(true);
    setProgress(8);
    if (tickRef.current) clearInterval(tickRef.current);
    // Approach 90% asymptotically — completion is filled by the route effect.
    tickRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p;
        const remaining = 90 - p;
        return Math.min(90, p + Math.max(0.5, remaining * 0.08));
      });
    }, 120);
  };

  // Detect clicks on internal navigation triggers.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as HTMLElement | null)?.closest(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      // Skip external links.
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (
          url.pathname === window.location.pathname &&
          url.search === window.location.search
        ) {
          return;
        }
      } catch {
        return;
      }

      start();
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Stop when the route actually changes.
  useEffect(() => {
    if (visible) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(
    () => () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    },
    [],
  );

  if (!visible && progress === 0) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[300] h-[2px] bg-transparent"
    >
      <div
        className="h-full bg-[var(--brand)] transition-[width,opacity] duration-150 ease-out"
        style={{
          width: `${progress}%`,
          opacity: visible ? 1 : 0,
          boxShadow: "0 0 8px var(--brand)",
        }}
      />
    </div>
  );
}
