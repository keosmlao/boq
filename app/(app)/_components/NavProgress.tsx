"use client";

/**
 * Top navigation progress bar — gives immediate "page is changing" feedback.
 * Most pages fetch their data client-side, so the route segment commits before
 * the data is ready; this bar covers the transition while loading.tsx / each
 * page's own spinner handle the data wait. No external dependency.
 *
 * It starts on <a> link clicks and programmatic navigations (router.push, which
 * goes through history.pushState) and completes when the URL actually changes.
 */
import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function Bar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(false);
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Wire up navigation-start detection once.
  useEffect(() => {
    const start = () => {
      // history.pushState is patched below, and Next calls it from inside a
      // useInsertionEffect — where scheduling a state update synchronously
      // throws ("useInsertionEffect must not schedule updates"). Defer to a
      // microtask so the setState runs after that phase. (Harmless from the
      // click handler path too.)
      queueMicrotask(() => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        setActive(true);
        setProgress((p) => (p > 0 && p < 90 ? p : 8));
        if (trickle.current) clearInterval(trickle.current);
        trickle.current = setInterval(() => {
          setProgress((p) => (p < 90 ? p + (90 - p) * 0.12 : p));
        }, 220);
      });
    };

    // Same-origin link clicks (skip new-tab / modified / hash / download).
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || a.target === "_blank" || a.hasAttribute("download")) return;
      try {
        const url = new URL(href, location.href);
        if (url.origin !== location.origin) return;
        if (url.pathname === location.pathname && url.search === location.search) return;
      } catch {
        return;
      }
      start();
    };

    // Programmatic navigations (router.push / replace go through history).
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = function (...args: Parameters<typeof history.pushState>) {
      start();
      return origPush.apply(this, args);
    };
    history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
      start();
      return origReplace.apply(this, args);
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      history.pushState = origPush;
      history.replaceState = origReplace;
      if (trickle.current) clearInterval(trickle.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  // Complete the bar once the route has actually changed.
  useEffect(() => {
    if (!active) return;
    if (trickle.current) clearInterval(trickle.current);
    setProgress(100);
    hideTimer.current = setTimeout(() => {
      setActive(false);
      setProgress(0);
    }, 280);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
      style={{ opacity: active ? 1 : 0, transition: "opacity 220ms ease" }}
    >
      <div
        className="h-full rounded-r-full bg-gradient-to-r from-blue-500 via-blue-600 to-blue-400 shadow-[0_0_10px_rgba(37,99,235,0.55)]"
        style={{ width: `${progress}%`, transition: "width 200ms cubic-bezier(0.16,1,0.3,1)" }}
      />
    </div>
  );
}

export default function NavProgress() {
  // useSearchParams must sit under a Suspense boundary for static pages.
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
