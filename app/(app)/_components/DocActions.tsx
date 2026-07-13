"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { Btn } from "./ui";
import { useT } from "@/_lib/i18n";

/** Edit + Delete actions for a document detail page (with delete confirm). */
export default function DocActions({
  editHref,
  onDelete,
  afterDelete,
  label,
  canEdit = true,
  canDelete = true,
}: {
  editHref?: string;
  onDelete: () => Promise<any>;
  afterDelete: string;
  label?: string;
  /** Hide the edit button when false (permission-gated). Defaults to shown. */
  canEdit?: boolean;
  /** Hide the delete button when false (permission-gated). Defaults to shown. */
  canDelete?: boolean;
}) {
  const t = useT();
  const docLabel = label ?? t("components.docActions.entity", "ເອກະສານ");
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const del = async () => {
    setDeleting(true);
    try {
      const r: any = await onDelete();
      if (r?.success) router.push(afterDelete);
      else {
        alert(r?.message || t("components.docActions.deleteFailed", "ລົບບໍ່ສຳເລັດ"));
        setDeleting(false);
        setConfirm(false);
      }
    } catch (e: any) {
      alert(e?.message || t("common.error", "ເກີດຂໍ້ຜິດພາດ"));
      setDeleting(false);
      setConfirm(false);
    }
  };

  return (
    <div className="flex items-center gap-2.5">
      {editHref && canEdit && (
        <Btn variant="ink" onClick={() => router.push(editHref)}>
          <Pencil size={13} /> {t("common.edit", "ແກ້ໄຂ")}
        </Btn>
      )}
      {canDelete && (
        <Btn variant="danger-outline" onClick={() => setConfirm(true)}>
          <Trash2 size={13} /> {t("common.delete", "ລົບ")}
        </Btn>
      )}

      {confirm && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 pt-[20vh]" onClick={() => !deleting && setConfirm(false)}>
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--danger-soft)] text-[var(--danger)]">
                <AlertTriangle size={20} />
              </div>
              <div className="text-[14px] font-black text-[var(--text)]">{t("components.docActions.confirmTitle", "ຢືນຢັນການລົບ")}</div>
              <p className="mt-1 text-[12.5px] text-[var(--text-mute)]">{t("components.docActions.confirmMsg", "ລົບ{label}ນີ້? ການກະທຳນີ້ກັບຄືນບໍ່ໄດ້.").replace("{label}", docLabel)}</p>
            </div>
            <div className="flex gap-2 border-t border-[var(--border-soft)] bg-[var(--surface-sunken)] p-3">
              <Btn variant="outline" className="flex-1" onClick={() => setConfirm(false)} disabled={deleting}>
                {t("common.cancel", "ຍົກເລີກ")}
              </Btn>
              <Btn variant="danger" className="flex-1" onClick={del} disabled={deleting}>
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {deleting ? t("components.docActions.deleting", "ກຳລັງລົບ...") : t("common.delete", "ລົບ")}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
