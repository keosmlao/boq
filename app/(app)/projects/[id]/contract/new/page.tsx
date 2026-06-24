"use client";

/**
 * v2 — Create contract (stage 4, ສັນຍາ) from an APPROVED quotation.
 * After save the contract needs two approvals (sales manager + accounting),
 * done from the project's "ສັນຍາ" tab.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Save, FileSignature, Paperclip, X } from "lucide-react";
import { getQuotations } from "@/_actions/quotations";
import { createContract, getContracts, getContract, updateContract } from "@/_actions/contracts";
import { advanceProjectStage } from "@/_actions/projects";
import { Page, Card, Btn, Field, inputCls } from "../../../../_components/ui";
import { useT } from "@/_lib/i18n";

const todayISO = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const money = (v: unknown) => {
  const n = Number(v);
  return Number.isNaN(n) ? "-" : n.toLocaleString("en-US");
};

export default function CreateContractPage() {
  const t = useT();
  const { id } = useParams();
  const router = useRouter();
  const editId = useSearchParams().get("edit");

  const [approvedQuos, setApprovedQuos] = useState<any[]>([]);
  const [contractData, setContractData] = useState<any>(null);
  const [hasContract, setHasContract] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [quoId, setQuoId] = useState<string>("");
  const [contractNo, setContractNo] = useState("");
  const [signDate, setSignDate] = useState(todayISO());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [acAmount, setAcAmount] = useState("");        // งวด 1 · ຄ່າແອ
  const [installAmount, setInstallAmount] = useState(""); // งวด 2 · ຄ່າຕິດຕັ້ງ
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<{ fileName: string; base64: string }[]>([]);

  const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const read = await Promise.all(
      files.map(
        (f) =>
          new Promise<{ fileName: string; base64: string }>((resolve) => {
            const r = new FileReader();
            r.onload = () => resolve({ fileName: f.name, base64: String(r.result).split(",")[1] || "" });
            r.readAsDataURL(f);
          }),
      ),
    );
    setAttachments((prev) => [...prev, ...read.filter((x) => x.base64)]);
    e.target.value = "";
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (editId) {
          const cres: any = await getContract(editId);
          if (alive && cres && cres.success !== false) {
            setContractData(cres);
            setSignDate((cres.sign_date || todayISO()).toString().slice(0, 10));
            setStartDate((cres.start_date || "").toString().slice(0, 10));
            setEndDate((cres.end_date || "").toString().slice(0, 10));
            setPaymentTerms(cres.payment_terms || "");
            setNotes(cres.notes || "");
          }
          setLoading(false);
          return;
        }
        const [qRes, cRes]: any = await Promise.all([
          getQuotations({ projectId: String(id) }),
          getContracts({ projectId: String(id) }),
        ]);
        const all = qRes?.success ? qRes.data || [] : [];
        const approved = all.filter((q: any) => (q.status ?? "").toString() === "ອະນຸມັດແລ້ວ");
        if (!alive) return;
        const existing = cRes?.success ? cRes.data || [] : [];
        setHasContract(existing.length > 0);
        setApprovedQuos(approved);
        if (approved[0]) {
          setQuoId(String(approved[0].id));
          setPaymentTerms(approved[0].terms || "");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, editId]);

  const selected = useMemo(
    () => approvedQuos.find((q) => String(q.id) === quoId) || null,
    [approvedQuos, quoId],
  );
  const items = Array.isArray(selected?.items)
    ? selected.items
    : Array.isArray(contractData?.items)
      ? contractData.items
      : [];

  const contractTotal = Number(selected?.total_amount ?? contractData?.amount ?? 0);
  const installSum = (Number(acAmount) || 0) + (Number(installAmount) || 0);
  const sumMatches = contractTotal <= 0 || installSum === contractTotal;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!editId && !quoId) {
      setError(t("contractNew.selectApprovedQuotation", "ກະລຸນາເລືອກໃບສະເໜີທີ່ອະນຸມັດແລ້ວ"));
      return;
    }
    if (!editId && !contractNo.trim()) {
      setError(t("contractNew.contractNoRequired", "ກະລຸນາພິມເລກທີສັນຍາ"));
      return;
    }
    if (!startDate || !endDate) {
      setError(t("contractNew.datesRequired", "ກະລຸນາໃສ່ວັນທີເລີ່ມ ແລະ ວັນທີສິ້ນສຸດ"));
      return;
    }
    const ac = Number(acAmount) || 0;
    const inst = Number(installAmount) || 0;
    const installments = [
      ...(ac > 0 ? [{ installment_no: 1, total_amount: ac, label: "ຄ່າແອ" }] : []),
      ...(inst > 0 ? [{ installment_no: 2, total_amount: inst, label: "ຄ່າຕິດຕັ້ງ" }] : []),
    ];
    const composedTerms =
      installments.map((x) => `${x.installment_no}. ${x.label}: ${x.total_amount.toLocaleString("en-US")} ບາດ`).join(" · ") || paymentTerms;
    setSaving(true);
    try {
      // Edit keeps the full contract (items/customer/totals) and only changes dates/terms/notes.
      const res: any = editId
        ? await updateContract(editId, {
            ...contractData,
            sign_date: signDate,
            start_date: startDate,
            end_date: endDate,
            payment_terms: composedTerms,
            notes,
          })
        : await createContract(
            {
              project_id: String(id),
              contract_no: contractNo.trim(),
              sign_date: signDate,
              start_date: startDate,
              end_date: endDate,
              payment_terms: composedTerms,
              installments,
              attachments,
              notes,
            },
            { fromQuotation: quoId },
          );
      if (res?.success) {
        if (editId) {
          router.push(`/contracts/${editId}`);
          return;
        }
        await advanceProjectStage(String(id), "ສັນຍາ").catch(() => {});
        router.push(`/projects/${id}?tab=contracts`);
      } else setError(res?.message || t("contractNew.saveFailed", "ບັນທຶກບໍ່ສຳເລັດ"));
    } catch (err: any) {
      setError(err?.message || t("contractNew.errorOccurred", "ເກີດຂໍ້ຜິດພາດ"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-3 text-[var(--theme-text-mute)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--theme-border-subtle)] border-t-[var(--theme-primary)]" />
        <span className="text-sm">{t("common.loading", "ກຳລັງໂຫຼດ...")}</span>
      </div>
    );
  }

  return (
    <Page max="max-w-[1000px]">
      <button
        onClick={() => router.push(`/projects/${id}`)}
        className="mb-2 inline-flex items-center gap-1 text-[12px] text-[var(--theme-text-mute)] hover:text-[var(--theme-primary)]"
      >
        <ArrowLeft size={14} /> {t("contractNew.toProject", "ໄປໂຄງການ")}
      </button>

      <div className="mb-4 flex items-center gap-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 p-4 text-white shadow-[var(--theme-shadow)]">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
          <FileSignature size={24} />
        </div>
        <div>
          <h1 className="text-[18px] font-bold leading-tight">{editId ? t("contractNew.editContract", "ແກ້ໄຂສັນຍາ") : t("contractNew.createContract", "ສ້າງສັນຍາ")}</h1>
          <p className="text-[12px] text-white/85">{t("contractNew.fromApprovedQuotation", "ຈາກໃບສະເໜີລາຄາທີ່ອະນຸມັດແລ້ວ")}</p>
        </div>
      </div>

      {!editId && hasContract ? (
        <Card className="p-6 text-center">
          <p className="text-[13px] text-[var(--theme-text-soft)]">
            {t("contractNew.alreadyHasPrefix", "ໂຄງການນີ້")} <b>{t("contractNew.alreadyHasContract", "ມີສັນຍາແລ້ວ")}</b> {t("contractNew.oneProjectOneContract", "— 1 ໂຄງການ ມີ 1 ສັນຍາ.")}
          </p>
          <div className="mt-4 flex justify-center">
            <Btn onClick={() => router.push(`/projects/${id}`)}>{t("contractNew.backToViewContract", "ກັບໄປເບິ່ງສັນຍາ")}</Btn>
          </div>
        </Card>
      ) : !editId && approvedQuos.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-[13px] text-[var(--theme-text-soft)]">
            {t("contractNew.noApprovedPrefix", "ຍັງບໍ່ມີໃບສະເໜີລາຄາທີ່")} <b>{t("status.approved", "ອະນຸມັດແລ້ວ")}</b> {t("contractNew.noApprovedSuffix", "— ຕ້ອງສ້າງ ແລະ ອະນຸມັດໃບສະເໜີກ່ອນ ຈຶ່ງສ້າງສັນຍາໄດ້.")}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Btn variant="outline" onClick={() => router.push(`/projects/${id}`)}>{t("contractNew.backToProject", "ກັບໄປໂຄງການ")}</Btn>
            <Btn onClick={() => router.push(`/projects/${id}/quotation/new`)}>{t("contractNew.createQuotation", "ສ້າງໃບສະເໜີ")}</Btn>
          </div>
        </Card>
      ) : (
        <form onSubmit={submit}>
          {error && (
            <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">
              {error}
            </div>
          )}

          <Card className="mb-4 border-t-2 border-t-blue-400 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {editId ? (
                <Field label={t("contractNew.contractNo", "ເລກສັນຍາ")} className="lg:col-span-3">
                  <input value={contractData?.contract_no || ""} readOnly className={`${inputCls} bg-[var(--theme-bg-muted)]`} />
                </Field>
              ) : (
                <Field label={t("contractNew.refQuotation", "ອ້າງອີງໃບສະເໜີ (ອະນຸມັດແລ້ວ)")} required className="lg:col-span-2">
                  <select value={quoId} onChange={(e) => setQuoId(e.target.value)} className={inputCls}>
                    {approvedQuos.map((q) => (
                      <option key={q.id} value={String(q.id)}>
                        {q.quotation_no} — {money(q.total_amount)}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {!editId && (
                <Field label={t("contractNew.contractNo", "ເລກທີສັນຍາ")} required>
                  <input value={contractNo} onChange={(e) => setContractNo(e.target.value)} className={inputCls} placeholder={t("contractNew.contractNoPlaceholder", "ພິມເລກທີສັນຍາ")} />
                </Field>
              )}
              <Field label={t("contractNew.signDate", "ວັນທີເຊັນສັນຍາ")}>
                <input type="date" value={signDate} onChange={(e) => setSignDate(e.target.value)} className={inputCls} />
              </Field>
              <Field label={t("contractNew.startDate", "ວັນທີເລີ່ມ")} required>
                <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
              </Field>
              <Field label={t("contractNew.endDate", "ວັນທີສິ້ນສຸດ")} required>
                <input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
              </Field>
              <div className="lg:col-span-3">
                <div className="mb-1.5 text-[12px] font-semibold text-[var(--theme-text-soft)]">{t("contractNew.paymentTerms", "ເງື່ອນໄຂການຊຳລະ")}</div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label={t("contractNew.installmentAc", "ງວດ 1 · ຄ່າແອ (ບາດ)")}>
                    <input type="number" min="0" inputMode="numeric" value={acAmount} onChange={(e) => setAcAmount(e.target.value)} className={`${inputCls} text-right tabular-nums`} placeholder="0" />
                  </Field>
                  <Field label={t("contractNew.installmentInstall", "ງວດ 2 · ຄ່າຕິດຕັ້ງ (ບາດ)")}>
                    <input type="number" min="0" inputMode="numeric" value={installAmount} onChange={(e) => setInstallAmount(e.target.value)} className={`${inputCls} text-right tabular-nums`} placeholder="0" />
                  </Field>
                </div>
                <div className={`mt-1.5 flex items-center justify-between rounded-lg px-3 py-1.5 text-[12px] ${sumMatches ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  <span>{t("contractNew.installmentSum", "ລວມ 2 ງວດ")}: <b className="tabular-nums">{money(installSum)}</b> {t("common.kip", "ບາດ")}</span>
                  {contractTotal > 0 && (
                    <span>{sumMatches ? t("contractNew.sumOk", "= ຍອດສັນຍາ ✓") : `${t("contractNew.contractTotal", "ຍอดสัญญา")}: ${money(contractTotal)}`}</span>
                  )}
                </div>
              </div>
              <Field label={t("common.note", "ໝາຍເຫດ")} className="lg:col-span-3">
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCls} h-auto py-2`} />
              </Field>
              {!editId && (
                <div className="lg:col-span-3">
                  <div className="mb-1.5 text-[12px] font-semibold text-[var(--theme-text-soft)]">{t("contractNew.attachments", "ເອກະສານສັນຍາ (ແນບໄຟລ໌)")}</div>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)]/40 px-3 py-3 text-[12.5px] text-[var(--theme-text-mute)] transition hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]">
                    <Paperclip size={15} /> {t("contractNew.pickFiles", "ກົດເພື່ອເລືອກໄຟລ໌ (PDF/ຮູບ)")}
                    <input type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={onPickFiles} />
                  </label>
                  {attachments.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {attachments.map((a, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 rounded-md border border-[var(--theme-border-subtle)] bg-white px-2.5 py-1.5 text-[12px]">
                          <span className="flex min-w-0 items-center gap-1.5 truncate text-[var(--theme-text)]"><Paperclip size={12} className="shrink-0 text-[var(--theme-text-mute)]" /> {a.fileName}</span>
                          <button type="button" onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} className="shrink-0 text-[var(--theme-text-mute)] hover:text-rose-600">
                            <X size={13} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Selected quotation preview (items come from the quotation) */}
          <Card className="mb-4 overflow-hidden border-t-2 border-t-amber-400">
            <div className="flex items-center justify-between border-b border-[var(--theme-border-subtle)] px-3 py-2">
              <h2 className="text-[13px] font-bold text-[var(--theme-text)]">{t("contractNew.itemsFromQuotation", "ລາຍການ (ຈາກໃບສະເໜີ)")}</h2>
              <span className="text-[12px] text-[var(--theme-text-mute)]">{t("contractNew.value", "ມູນຄ່າ")}: {money(selected?.total_amount)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-[var(--theme-border-subtle)] text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text-mute)]">
                    <th className="px-3 py-2 text-left">{t("contractNew.description", "ລາຍລະອຽດ")}</th>
                    <th className="px-3 py-2 text-left">{t("common.unit", "ໜ່ວຍ")}</th>
                    <th className="px-3 py-2 text-right">{t("common.qty", "ຈຳນວນ")}</th>
                    <th className="px-3 py-2 text-right">{t("common.price", "ລາຄາ")}</th>
                    <th className="px-3 py-2 text-right">{t("contractNew.lineTotal", "ລວມ")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-4 text-center text-[var(--theme-text-mute)]">{t("contractNew.noItems", "ບໍ່ມີລາຍການ")}</td></tr>
                  ) : (
                    items.map((it: any, i: number) => (
                      <tr key={i} className="border-b border-[var(--theme-border-subtle)] last:border-0">
                        <td className="px-3 py-1.5">{it.description || it.item_code || "-"}</td>
                        <td className="px-3 py-1.5 text-[var(--theme-text-soft)]">{it.unit || "-"}</td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums">{money(it.qty)}</td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums">{money(it.unit_price)}</td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums">{money(it.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex justify-end gap-2">
            <Btn type="button" variant="outline" onClick={() => router.push(`/projects/${id}`)}>{t("common.cancel", "ຍົກເລີກ")}</Btn>
            <Btn type="submit" disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? t("common.saving", "ກຳລັງບັນທຶກ...") : t("contractNew.saveContract", "ບັນທຶກສັນຍາ")}
            </Btn>
          </div>
        </form>
      )}
    </Page>
  );
}
