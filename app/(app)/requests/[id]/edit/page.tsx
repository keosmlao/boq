"use client";

/**
 * Edit a craftsman app request (ໃບຂໍເບີກ ຈາກແອັບຊ່າງ) BEFORE the ຫົວໜ້າຊ່າງ
 * approves it. App requests are read-only elsewhere on the web; this page is the
 * one place the back office can correct items/qty/note while still pending.
 * v2/legacy requests are edited through the requisition form (request/new?edit=),
 * not here.
 */
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save, Plus, Trash2, ClipboardList } from "lucide-react";
import { getAppRequestForEdit, updateAppRequest } from "@/_actions/request-v2";
import { Page, Card, Btn, Field, SectionHeader, inputCls, tblCls, thCls, tdCls } from "../../../_components/ui";
import { useT } from "@/_lib/i18n";

type Line = { item_code: string; name: string; unit: string; qty: number; boq_qty: number };

export default function EditAppRequestPage() {
  const t = useT();
  const { id } = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [head, setHead] = useState<{ request_no: string; project_name: string; requester: string }>({ request_no: "", project_name: "", requester: "" });
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const res: any = await getAppRequestForEdit(String(id));
      if (!alive) return;
      if (res?.success === false) {
        setError(res.message || t("requestEdit.loadFailed", "ໂຫຼດບໍ່ສຳເລັດ"));
      } else {
        const d = res.data;
        setHead({ request_no: d.request_no || "", project_name: d.project_name || "", requester: d.requester || "" });
        setNote(d.note || "");
        setLines(
          (Array.isArray(d.items) ? d.items : []).map((it: any) => ({
            item_code: String(it.item_code || ""),
            name: String(it.name || ""),
            unit: String(it.unit || ""),
            qty: Number(it.qty) || 0,
            boq_qty: Number(it.boq_qty) || 0,
          })),
        );
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [id, t]);

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, { item_code: "", name: "", unit: "", qty: 1, boq_qty: 0 }]);
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const valid = lines.filter((l) => l.name.trim() && (Number(l.qty) || 0) > 0);
    if (!valid.length) {
      setError(t("requestEdit.needRow", "ກະລຸນາໃສ່ລາຍການວັດສະດຸຢ່າງໜ້ອຍ 1 ແຖວ (ມີຊື່ ແລະ ຈຳນວນ)"));
      return;
    }
    setSaving(true);
    try {
      const res: any = await updateAppRequest(String(id), { items: valid, note });
      if (res?.success) router.push(`/requests/${encodeURIComponent(String(id))}`);
      else setError(res?.message || t("requestEdit.saveFailed", "ບັນທຶກບໍ່ສຳເລັດ"));
    } catch (err: any) {
      setError(err?.message || t("common.error", "ເກີດຂໍ້ຜິດພາດ"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-2.5 text-[var(--text-mute)]">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-[13px] font-semibold">{t("common.loading", "ກຳລັງໂຫຼດ...")}</span>
      </div>
    );
  }

  // Hard failure (not found / already processed / no permission) — no form.
  if (error && !lines.length) {
    return (
      <Page max="max-w-[700px]">
        <Card className="p-6 text-center">
          <p className="text-[13px] font-semibold text-[var(--danger)]">{error}</p>
          <div className="mt-4 flex justify-center">
            <Btn variant="outline" onClick={() => router.push(`/requests/${encodeURIComponent(String(id))}`)}>
              <ArrowLeft size={14} /> {t("requestEdit.backToRequest", "ກັບໄປໃບຂໍເບີກ")}
            </Btn>
          </div>
        </Card>
      </Page>
    );
  }

  return (
    <Page max="max-w-[900px]">
      <form onSubmit={submit}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => router.push(`/requests/${encodeURIComponent(String(id))}`)}
              className="mb-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--text-mute)] transition-colors hover:text-[var(--brand)]"
            >
              <ArrowLeft size={14} /> {t("requestEdit.backToRequest", "ກັບໄປໃບຂໍເບີກ")}
            </button>
            <h1 className="flex items-center gap-2.5 text-[19px] font-black leading-tight tracking-tight text-[var(--text)]">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--brand-soft)] bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                <ClipboardList size={16} />
              </span>
              {t("requestEdit.title", "ແກ້ໄຂໃບຂໍເບີກ")}
            </h1>
            <p className="mt-1.5 text-[12px] text-[var(--text-mute)]">
              {[head.request_no, head.project_name, head.requester].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Btn type="button" variant="outline" onClick={() => router.push(`/requests/${encodeURIComponent(String(id))}`)}>
              {t("common.cancel", "ຍົກເລີກ")}
            </Btn>
            <Btn type="submit" variant="go" disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? t("common.saving", "ກຳລັງບັນທຶກ...") : t("common.save", "ບັນທຶກ")}
            </Btn>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-[var(--danger)] bg-[var(--danger-soft)] px-3.5 py-2.5 text-[12.5px] font-semibold text-[var(--danger)]">
            {error}
          </div>
        )}

        <Card className="mb-4 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2.5">
            <h2 className="text-[11px] font-black tracking-wider text-[var(--text)]">{t("requestEdit.items", "ລາຍການວັດສະດຸ")}</h2>
            <Btn type="button" variant="outline" onClick={addLine}>
              <Plus size={14} /> {t("requestEdit.addRow", "ເພີ່ມແຖວ")}
            </Btn>
          </div>
          <div className="overflow-x-auto">
            <table className={tblCls}>
              <thead>
                <tr>
                  <th className={`${thCls} w-8`}>#</th>
                  <th className={thCls}>{t("requestEdit.material", "ວັດສະດຸ")}</th>
                  <th className={`${thCls} w-24`}>{t("common.unit", "ໜ່ວຍ")}</th>
                  <th className={`${thCls} w-28 text-right`}>{t("common.qty", "ຈຳນວນ")}</th>
                  <th className={`${thCls} w-10`} />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td className={`${tdCls} text-[11px] text-[var(--text-mute)]`}>{i + 1}</td>
                    <td className={tdCls}>
                      <input value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} className={`${inputCls} h-8`} placeholder={t("requestEdit.material", "ວັດສະດຸ")} />
                    </td>
                    <td className={tdCls}>
                      <input value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} className={`${inputCls} h-8`} placeholder={t("common.unit", "ໜ່ວຍ")} />
                    </td>
                    <td className={tdCls}>
                      <input type="number" min="0" value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} className={`${inputCls} h-8 text-right`} />
                    </td>
                    <td className={tdCls}>
                      {lines.length > 1 && (
                        <button type="button" onClick={() => removeLine(i)} className="text-[var(--danger)] transition-opacity hover:opacity-70">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-4">
          <SectionHeader icon={<ClipboardList size={15} />} title={t("requestEdit.noteSection", "ໝາຍເຫດ")} tone="brand" />
          <Field label={t("common.note", "ໝາຍເຫດ")}>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} className={`${inputCls} h-auto py-2`} placeholder={t("requestEdit.notePlaceholder", "ໝາຍເຫດເພີ່ມເຕີມ...")} />
          </Field>
        </Card>
      </form>
    </Page>
  );
}
