/**
 * Field group — craftsman-facing pages (e.g. self check-in) with NO manager
 * Shell/sidebar. Craftsmen authenticate on the web but hold no permission
 * modules, so these pages are reached by direct URL and authorise by identity.
 * Root layout (app/layout.tsx) still supplies the Lao font + providers.
 */
import type { ReactNode } from "react";
import FieldTopBar from "./_FieldTopBar";

export default function FieldLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--canvas,#f5f6f8)]">
      <FieldTopBar />
      <main className="mx-auto w-full max-w-[560px] px-4 py-4">{children}</main>
    </div>
  );
}
