"use client";

/**
 * v2 — Create contract (stage 4, ສັນຍາ) from an APPROVED quotation.
 * After save the contract needs two approvals (sales manager + accounting),
 * done from the project's "ສັນຍາ" tab.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Save, FileSignature, Paperclip, X, Wind, Wrench } from "lucide-react";
import { getQuotations } from "@/_actions/quotations";
import { createContract, getContracts, getContract, updateContract } from "@/_actions/contracts";
import { Page, Card, Btn, Field, SectionHeader, inputCls, tblCls, thCls, tdCls } from "../../../../_components/ui";
import RSelect from "../../../../_components/RSelect";
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
  type Att = { id?: number; fileName: string; file_path?: string; base64?: string };
  const [attachments, setAttachments] = useState<Att[]>([]);
  const [removedAttIds, setRemovedAttIds] = useState<number[]>([]);

  const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const read = await Promise.all(
      files.map(
        (f) =>
          new Promise<Att>((resolve) => {
            const r = new FileReader();
            r.onload = () => resolve({ fileName: f.name, base64: String(r.result).split(",")[1] || "" });
            r.readAsDataURL(f);
          }),
      ),
    );
    setAttachments((prev) => [...prev, ...read.filter((x) => x.base64)]);
    e.target.value = "";
  };

  const removeAttachment = (i: number) => {
    setAttachments((prev) => {
      const a = prev[i];
      if (a?.id) setRemovedAttIds((ids) => [...ids, a.id!]);
      return prev.filter((_, j) => j !== i);
    });
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
            // Pre-fill the 2 installment amounts + existing attachments.
            const insts: any[] = Array.isArray(cres.installments) ? cres.installments : [];
            const i1 = insts.find((x) => Number(x.installment_no) === 1);
            const i2 = insts.find((x) => Number(x.installment_no) === 2);
            if (i1?.total_amount != null) setAcAmount(String(Number(i1.total_amount)));
            if (i2?.total_amount != null) setInstallAmount(String(Number(i2.total_amount)));
            const atts: any[] = Array.isArray(cres.attachments) ? cres.attachments : [];
            setAttachments(atts.map((a) => ({ id: a.id, fileName: a.file_name, file_path: a.file_path })));
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
            installments,
            attachments: attachments.filter((a) => a.base64),
            removedAttachmentIds: removedAttIds,
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
        // Stage follows the APPROVAL (sales + accounting), not the creation.
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
      <div className="flex h-[60vh] items-center justify-center gap-3 text-[var(--text-mute)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--brand)]" />
        <span className="text-sm">{t("common.loading", "ກຳລັງໂຫຼດ...")}</span>
      </div>
    );
  }

  const canEdit = editId || (!hasContract && approvedQuos.length > 0);

  return (
    <Page max="max-w-[1000px]">
      <form onSubmit={submit}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => router.push(`/projects/${id}`)}
              className="mb-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--text-mute)] transition-colors hover:text-[var(--brand)]"
            >
              <ArrowLeft size={14} /> {t("contractNew.toProject", "ໄປໂຄງການ")}
            </button>
            <h1 className="flex items-center gap-2.5 text-[19px] font-black leading-tight tracking-tight text-[var(--text)]">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--brand-soft)] bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                <FileSignature size={16} />
              </span>
              {editId ? t("contractNew.editContract", "ແກ້ໄຂສັນຍາ") : t("contractNew.createContract", "ສ້າງສັນຍາ")}
            </h1>
            <p className="mt-1.5 text-[12px] text-[var(--text-mute)]">{t("contractNew.fromApprovedQuotation", "ຈາກໃບສະເໜີລາຄາທີ່ອະນຸມັດແລ້ວ")}</p>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              <Btn type="button" variant="outline" onClick={() => router.push(`/projects/${id}`)}>{t("common.cancel", "ຍົກເລີກ")}</Btn>
              <Btn type="submit" variant="go" disabled={saving}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? t("common.saving", "ກຳລັງບັນທຶກ...") : t("contractNew.saveContract", "ບັນທຶກສັນຍາ")}
              </Btn>
            </div>
          )}
        </div>

      {!editId && hasContract ? (
        <Card className="p-6 text-center">
          <p className="text-[13px] text-[var(--text-soft)]">
            {t("contractNew.alreadyHasPrefix", "ໂຄງການນີ້")} <b className="text-[var(--text)]">{t("contractNew.alreadyHasContract", "ມີສັນຍາແລ້ວ")}</b> {t("contractNew.oneProjectOneContract", "— 1 ໂຄງການ ມີ 1 ສັນຍາ.")}
          </p>
          <div className="mt-4 flex justify-center">
            <Btn type="button" onClick={() => router.push(`/projects/${id}`)}>{t("contractNew.backToViewContract", "ກັບໄປເບິ່ງສັນຍາ")}</Btn>
          </div>
        </Card>
      ) : !editId && approvedQuos.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-[13px] text-[var(--text-soft)]">
            {t("contractNew.noApprovedPrefix", "ຍັງບໍ່ມີໃບສະເໜີລາຄາທີ່")} <b className="text-[var(--text)]">{t("status.approved", "ອະນຸມັດແລ້ວ")}</b> {t("contractNew.noApprovedSuffix", "— ຕ້ອງສ້າງ ແລະ ອະນຸມັດໃບສະເໜີກ່ອນ ຈຶ່ງສ້າງສັນຍາໄດ້.")}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Btn type="button" variant="outline" onClick={() => router.push(`/projects/${id}`)}>{t("contractNew.backToProject", "ກັບໄປໂຄງການ")}</Btn>
            <Btn type="button" onClick={() => router.push(`/projects/${id}/quotation/new`)}>{t("contractNew.createQuotation", "ສ້າງໃບສະເໜີ")}</Btn>
          </div>
        </Card>
      ) : (
        <>
          {error && (
            <div className="mb-4 rounded-xl border border-[var(--danger)] bg-[var(--danger-soft)] px-3.5 py-2.5 text-[12.5px] font-semibold text-[var(--danger)]">
              {error}
            </div>
          )}

          <Card className="mb-4 p-4">
            <SectionHeader icon={<FileSignature size={15} />} title={t("contractNew.contractInfo", "ຂໍ້ມູນສັນຍາ")} tone="brand" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {editId ? (
                <Field label={t("contractNew.contractNo", "ເລກສັນຍາ")} className="lg:col-span-3">
                  <input value={contractData?.contract_no || ""} readOnly className={`${inputCls} cursor-default bg-[var(--surface-sunken)] text-[var(--text-soft)] hover:border-[var(--border)] focus:border-[var(--border)] focus:ring-0`} />
                </Field>
              ) : (
                <Field label={t("contractNew.refQuotation", "ອ້າງອີງໃບສະເໜີ (ອະນຸມັດແລ້ວ)")} required className="lg:col-span-2">
                  <RSelect
                    value={quoId}
                    onChange={setQuoId}
                    options={approvedQuos.map((q) => ({ value: String(q.id), label: `${q.quotation_no} — ${money(q.total_amount)}` }))}
                    placeholder={t("contractNew.refQuotation", "ອ້າງອີງໃບສະເໜີ (ອະນຸມັດແລ້ວ)")}
                  />
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
                <SectionHeader icon={<Wind size={15} />} title={t("contractNew.paymentTitle", "ການຊຳລະ — ແບ່ງເປັນ 2 ສ່ວນ")} tone="brand" className="mb-3" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* ສ່ວນແອ */}
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--info-soft)] bg-[var(--info-soft)] text-[var(--info)]"><Wind size={17} /></span>
                        <div>
                          <div className="text-[12.5px] font-bold text-[var(--text)]">{t("contractNew.partAc", "ສ່ວນແອ")}</div>
                          <div className="text-[10.5px] text-[var(--text-mute)]">{t("contractNew.partAcDesc", "ຄ່າເຄື່ອງແອ")}</div>
                        </div>
                      </div>
                      <span className="rounded-md border border-[var(--info-soft)] bg-[var(--info-soft)] px-2 py-0.5 text-[10.5px] font-extrabold tabular-nums text-[var(--info)]">{installSum > 0 ? Math.round(((Number(acAmount) || 0) / installSum) * 100) : 0}%</span>
                    </div>
                    <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 transition-all focus-within:border-[var(--brand)] focus-within:ring-3 focus-within:ring-[var(--brand-ring)]">
                      <input type="number" min="0" inputMode="numeric" value={acAmount} onChange={(e) => setAcAmount(e.target.value)} className="h-9 min-w-0 flex-1 bg-transparent text-right text-[14px] font-bold tabular-nums text-[var(--text)] outline-none" placeholder="0" />
                      <span className="text-[11px] font-semibold text-[var(--text-mute)]">{t("common.kip", "ບາດ")}</span>
                    </div>
                  </div>
                  {/* ສ່ວນຕິດຕັ້ງ */}
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--warning-soft)] bg-[var(--warning-soft)] text-[var(--warning)]"><Wrench size={17} /></span>
                        <div>
                          <div className="text-[12.5px] font-bold text-[var(--text)]">{t("contractNew.partInstall", "ສ່ວນຕິດຕັ້ງ")}</div>
                          <div className="text-[10.5px] text-[var(--text-mute)]">{t("contractNew.partInstallDesc", "ຄ່າແຮງຕິດຕັ້ງ")}</div>
                        </div>
                      </div>
                      <span className="rounded-md border border-[var(--warning-soft)] bg-[var(--warning-soft)] px-2 py-0.5 text-[10.5px] font-extrabold tabular-nums text-[var(--warning)]">{installSum > 0 ? Math.round(((Number(installAmount) || 0) / installSum) * 100) : 0}%</span>
                    </div>
                    <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 transition-all focus-within:border-[var(--brand)] focus-within:ring-3 focus-within:ring-[var(--brand-ring)]">
                      <input type="number" min="0" inputMode="numeric" value={installAmount} onChange={(e) => setInstallAmount(e.target.value)} className="h-9 min-w-0 flex-1 bg-transparent text-right text-[14px] font-bold tabular-nums text-[var(--text)] outline-none" placeholder="0" />
                      <span className="text-[11px] font-semibold text-[var(--text-mute)]">{t("common.kip", "ບາດ")}</span>
                    </div>
                  </div>
                </div>
                {/* ລວມທັງໝົດ */}
                <div
                  className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2.5"
                  style={{
                    borderColor: sumMatches ? "var(--success)" : "var(--warning)",
                    background: sumMatches ? "var(--success-soft)" : "var(--warning-soft)",
                  }}
                >
                  <span className="text-[11px] font-black tracking-wider text-[var(--text-soft)]">{t("contractNew.paymentTotal", "ລວມທັງໝົດ")}</span>
                  <div className="flex items-center gap-2">
                    <b className="text-[16px] tabular-nums" style={{ color: sumMatches ? "var(--success)" : "var(--warning)" }}>{money(installSum)}</b>
                    <span className="text-[12px] text-[var(--text-mute)]">{t("common.kip", "ບາດ")}</span>
                    {contractTotal > 0 && (
                      <span
                        className="ml-1 rounded-md px-2 py-0.5 text-[10.5px] font-extrabold"
                        style={{
                          color: sumMatches ? "var(--success)" : "var(--warning)",
                          background: "var(--surface)",
                        }}
                      >
                        {sumMatches ? t("contractNew.sumOk", "= ຍອດສັນຍາ ✓") : `${t("contractNew.contractTotal", "ຍອດສັນຍາ")}: ${money(contractTotal)}`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Field label={t("common.note", "ໝາຍເຫດ")} className="lg:col-span-3">
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCls} h-auto py-2`} />
              </Field>
              {(
                <div className="lg:col-span-3">
                  <div className="mb-1.5 block text-[11px] font-bold tracking-wider text-[var(--text-mute)]">{t("contractNew.attachments", "ເອກະສານສັນຍາ (ແນບໄຟລ໌)")}</div>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-sunken)] px-3 py-3 text-[12.5px] font-semibold text-[var(--text-mute)] transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)]">
                    <Paperclip size={15} /> {t("contractNew.pickFiles", "ກົດເພື່ອເລືອກໄຟລ໌ (PDF/ຮູບ)")}
                    <input type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={onPickFiles} />
                  </label>
                  {attachments.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {attachments.map((a, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[12px]">
                          {a.file_path ? (
                            <a href={a.file_path} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-1.5 truncate font-semibold text-[var(--brand)] hover:underline"><Paperclip size={12} className="shrink-0" /> {a.fileName}</a>
                          ) : (
                            <span className="flex min-w-0 items-center gap-1.5 truncate text-[var(--text)]"><Paperclip size={12} className="shrink-0 text-[var(--text-mute)]" /> {a.fileName}</span>
                          )}
                          <button type="button" onClick={() => removeAttachment(i)} className="shrink-0 text-[var(--text-mute)] transition-colors hover:text-[var(--danger)]">
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
          <Card className="mb-4 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2.5">
              <h2 className="text-[11px] font-black tracking-wider text-[var(--text)]">{t("contractNew.itemsFromQuotation", "ລາຍການ (ຈາກໃບສະເໜີ)")}</h2>
              <span className="text-[12px] tabular-nums text-[var(--text-mute)]">{t("contractNew.value", "ມູນຄ່າ")}: {money(selected?.total_amount)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className={tblCls}>
                <thead>
                  <tr>
                    <th className={thCls}>{t("contractNew.description", "ລາຍລະອຽດ")}</th>
                    <th className={`${thCls} w-20`}>{t("common.unit", "ໜ່ວຍ")}</th>
                    <th className={`${thCls} w-24 text-right`}>{t("common.qty", "ຈຳນວນ")}</th>
                    <th className={`${thCls} w-32 text-right`}>{t("common.price", "ລາຄາ")}</th>
                    <th className={`${thCls} w-32 text-right`}>{t("contractNew.lineTotal", "ລວມ")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-[12px] text-[var(--text-mute)]">{t("contractNew.noItems", "ບໍ່ມີລາຍການ")}</td></tr>
                  ) : (
                    items.map((it: any, i: number) => (
                      <tr key={i}>
                        <td className={`${tdCls} font-semibold text-[var(--text)]`}>{it.description || it.item_code || "-"}</td>
                        <td className={tdCls}>{it.unit || "-"}</td>
                        <td className={`${tdCls} text-right tabular-nums`}>{money(it.qty)}</td>
                        <td className={`${tdCls} text-right tabular-nums`}>{money(it.unit_price)}</td>
                        <td className={`${tdCls} text-right font-semibold tabular-nums text-[var(--text)]`}>{money(it.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      </form>
    </Page>
  );
}
