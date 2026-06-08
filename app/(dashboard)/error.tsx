"use client";

import { AlertCircle, RotateCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--danger-soft)] text-[var(--danger)]">
          <AlertCircle size={22} />
        </div>
        <h2 className="mt-4 text-[16px] font-semibold text-[var(--text)]">
          ເກີດຂໍ້ຜິດພາດ
        </h2>
        <p className="mt-1.5 text-[12.5px] text-[var(--text-soft)]">
          {error?.message || "ມີບັນຫາໃນການໂຫຼດໜ້ານີ້"}
        </p>
        <button
          onClick={reset}
          className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--brand)] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[var(--brand-hover)]"
        >
          <RotateCcw size={14} />
          ລອງໃໝ່
        </button>
      </div>
    </div>
  );
}
