"use client";

/**
 * Route-level error boundary for the app shell. Catches render/data errors in
 * any page and offers a retry instead of crashing to a blank screen.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Surface the error for debugging; replace with a logger if one exists.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center animate-fade-in">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-100 bg-rose-50 text-rose-600">
          <AlertTriangle size={28} />
        </div>
        <h1 className="text-xl font-black tracking-tight text-slate-900">ເກີດຂໍ້ຜິດພາດ</h1>
        <span className="accent-rule mx-auto mt-3" />
        <p className="mt-5 text-sm font-semibold text-slate-600">
          ບໍ່ສາມາດໂຫຼດໜ້ານີ້ໄດ້
        </p>
        {error?.digest && (
          <p className="mt-1.5 font-mono text-[11px] text-slate-400">#{error.digest}</p>
        )}
        <div className="mt-7 flex items-center justify-center gap-2.5">
          <button
            onClick={() => reset()}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-5 text-xs font-bold text-white shadow-sm shadow-blue-600/25 transition-all duration-150 hover:bg-blue-700 active:scale-[0.98]"
          >
            <RotateCcw size={15} />
            ລອງໃໝ່
          </button>
          <button
            onClick={() => router.push("/")}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-5 text-xs font-bold text-slate-700 transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
          >
            <Home size={15} />
            ໜ້າຫຼັກ
          </button>
        </div>
      </div>
    </div>
  );
}
