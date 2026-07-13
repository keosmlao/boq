"use client";

/**
 * Route-level error boundary for the app shell. Catches render/data errors in
 * any page and offers a retry instead of crashing to a blank screen.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Btn } from "./_components/ui";
import { useT } from "@/_lib/i18n";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  // `useT` degrades to the inline Lao fallback if the provider is not mounted
  // (see useI18n in _lib/i18n.tsx), so the boundary always renders.
  const t = useT();

  useEffect(() => {
    // Surface the error for debugging; replace with a logger if one exists.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center animate-fade-in">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--danger-soft)] bg-[var(--danger-soft)] text-[var(--danger)]">
          <AlertTriangle size={28} />
        </div>
        <h1 className="text-xl font-black tracking-tight text-[var(--text)]">{t("error.title", "ເກີດຂໍ້ຜິດພາດ")}</h1>
        <span className="accent-rule mx-auto mt-3" />
        <p className="mt-5 text-sm font-semibold text-[var(--text-soft)]">
          {t("error.desc", "ບໍ່ສາມາດໂຫຼດໜ້ານີ້ໄດ້")}
        </p>
        {error?.digest && (
          <p className="mt-1.5 font-mono text-[11px] text-[var(--text-mute)]">#{error.digest}</p>
        )}
        <div className="mt-7 flex items-center justify-center gap-2.5">
          <Btn variant="ink" className="h-10 px-5" onClick={() => reset()}>
            <RotateCcw size={15} />
            {t("error.retry", "ລອງໃໝ່")}
          </Btn>
          <Btn variant="outline" className="h-10 px-5" onClick={() => router.push("/")}>
            <Home size={15} />
            {t("error.home", "ໜ້າຫຼັກ")}
          </Btn>
        </div>
      </div>
    </div>
  );
}
