"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Loader2, AlertTriangle } from "lucide-react";

/** Edit + Delete actions for a document detail page (with delete confirm). */
export default function DocActions({
  editHref,
  onDelete,
  afterDelete,
  label = "ເອກະສານ",
}: {
  editHref?: string;
  onDelete: () => Promise<any>;
  afterDelete: string;
  label?: string;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const del = async () => {
    setDeleting(true);
    try {
      const r: any = await onDelete();
      if (r?.success) router.push(afterDelete);
      else {
        alert(r?.message || "ລົບບໍ່ສຳເລັດ");
        setDeleting(false);
        setConfirm(false);
      }
    } catch (e: any) {
      alert(e?.message || "ເກີດຂໍ້ຜິດພາດ");
      setDeleting(false);
      setConfirm(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {editHref && (
        <button
          onClick={() => router.push(editHref)}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--theme-border-subtle)] bg-white px-3 text-[12px] font-medium text-[var(--theme-text-soft)] hover:bg-[var(--theme-bg-muted)]"
        >
          <Pencil size={13} /> ແກ້ໄຂ
        </button>
      )}
      <button
        onClick={() => setConfirm(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-200 bg-white px-3 text-[12px] font-medium text-rose-600 hover:bg-rose-50"
      >
        <Trash2 size={13} /> ລົບ
      </button>

      {confirm && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 pt-[20vh]" onClick={() => !deleting && setConfirm(false)}>
          <div className="w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-[var(--theme-shadow-lg)]" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-100">
                <AlertTriangle size={20} />
              </div>
              <div className="text-[14px] font-semibold text-[var(--theme-text)]">ຢືນຢັນການລົບ</div>
              <p className="mt-1 text-[12.5px] text-[var(--theme-text-mute)]">ລົບ{label}ນີ້? ການກະທຳນີ້ກັບຄືນບໍ່ໄດ້.</p>
            </div>
            <div className="flex gap-2 border-t border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] p-3">
              <button onClick={() => setConfirm(false)} disabled={deleting} className="flex-1 rounded-md border border-[var(--theme-border-subtle)] bg-white py-2 text-[12px] font-semibold text-[var(--theme-text-soft)] hover:bg-[var(--theme-bg-muted)] disabled:opacity-60">
                ຍົກເລີກ
              </button>
              <button onClick={del} disabled={deleting} className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-rose-600 py-2 text-[12px] font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {deleting ? "ກຳລັງລົບ..." : "ລົບ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
