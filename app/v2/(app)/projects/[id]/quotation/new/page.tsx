"use client";

/**
 * v2 — Create quotation for a project (stage 3, ສະເໜີລາຄາ).
 * Reached right after registering a project. Saves via createQuotation.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Save, Plus, Trash2, FileDown, Upload, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import { getProjectBasic } from "@/_actions/projects";
import { createQuotation, getQuotations, getQuotation, updateQuotation } from "@/_actions/quotations";
import { getSurveys } from "@/_actions/survey";
import { getCustomer } from "@/_actions/customers";
import { Page, Card, Btn, Field, inputCls, tblCls, thCls, tdCls } from "../../../../_components/ui";
import InventoryPicker from "../../../../_components/InventoryPicker";

type Line = { itemCode?: string; description: string; unit?: string; qty: number; unitPrice: number };

const todayISO = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const genQuotationNo = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `QT-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

const money = (n: number) => (Number.isFinite(n) ? n.toLocaleString("en-US") : "0");

export default function CreateQuotationPage() {
  const { id } = useParams();
  const router = useRouter();
  const editId = useSearchParams().get("edit");

  const [project, setProject] = useState<any>(null);
  const [hasQuotation, setHasQuotation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [cust, setCust] = useState({ name: "", phone: "", address: "" });
  const [quotationDate, setQuotationDate] = useState(todayISO());
  const [validityDate, setValidityDate] = useState("");
  const [discount, setDiscount] = useState(0);
  const [vatType, setVatType] = useState<"none" | "exclusive" | "inclusive">("none");
  const [vatRate, setVatRate] = useState(10);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ description: "", qty: 1, unitPrice: 0 }]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Edit mode: load the existing quotation and prefill (no blocking, no survey prefill).
        if (editId) {
          const [pRes, qres]: any = await Promise.all([getProjectBasic(String(id)), getQuotation(editId)]);
          if (!alive) return;
          setProject(pRes?.success ? pRes.data : null);
          if (qres && qres.success !== false) {
            const q: any = qres;
            setCust({ name: q.customer_name || "", phone: q.customer_phone || "", address: q.customer_address || "" });
            setQuotationDate((q.quotation_date || todayISO()).toString().slice(0, 10));
            setValidityDate((q.validity_date || "").toString().slice(0, 10));
            setDiscount(Number(q.discount) || 0);
            setVatType(q.tax_type === "exclusive" || q.tax_type === "inclusive" ? q.tax_type : "none");
            setNotes(q.notes || "");
            const its = Array.isArray(q.items) ? q.items : [];
            if (its.length)
              setLines(
                its.map((it: any) => ({
                  itemCode: it.item_code || "",
                  description: String(it.description || it.item_name || ""),
                  unit: String(it.unit || ""),
                  qty: Number(it.qty) || 1,
                  unitPrice: Number(it.unit_price) || 0,
                })),
              );
          }
          setLoading(false);
          return;
        }

        const [pRes, sRes, qRes]: any = await Promise.all([
          getProjectBasic(String(id)),
          getSurveys(String(id)),
          getQuotations({ projectId: String(id) }),
        ]);
        const p = pRes?.success ? pRes.data : null;
        if (!alive) return;
        // 1 project = 1 quotation (a rejected one may be replaced).
        const existingQuos = qRes?.success ? qRes.data || [] : [];
        setHasQuotation(existingQuos.some((q: any) => (q.status || "") !== "ປະຕິເສດ"));
        setProject(p);
        // Customer = the project's real customer (ar_customer via sml_code), not the coordinator.
        if (p?.sml_code) {
          const cRes: any = await getCustomer(String(p.sml_code));
          if (alive && cRes?.success) {
            setCust({ name: cRes.data.name || "", phone: cRes.data.phone || "", address: cRes.data.address || "" });
          } else if (alive) {
            setCust((c) => ({ ...c, name: p.coordinator || "", phone: p.phone || "" }));
          }
        } else if (p && alive) {
          setCust((c) => ({ ...c, name: p.coordinator || "", phone: p.phone || "" }));
        }

        // Pre-fill line items from the latest survey's rough material list.
        const surveys = sRes?.success ? sRes.data || [] : [];
        const mats = surveys[0]?.data?.materials;
        if (Array.isArray(mats) && mats.length) {
          setLines(
            mats.map((m: any) => ({
              itemCode: "",
              description: String(m.item || ""),
              unit: String(m.unit || ""),
              qty: Number(m.qty) || 1,
              unitPrice: 0,
            })),
          );
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, editId]);

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0),
    [lines],
  );
  const base = Math.max(subtotal - (Number(discount) || 0), 0);
  const rate = Number(vatRate) || 0;
  const vatAmount = Math.round(
    vatType === "exclusive"
      ? (base * rate) / 100
      : vatType === "inclusive"
        ? (base * rate) / (100 + rate)
        : 0,
  );
  const total = vatType === "exclusive" ? base + vatAmount : base;

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, { description: "", qty: 1, unitPrice: 0 }]);
  const removeLine = (i: number) => setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls));

  const fileRef = useRef<HTMLInputElement | null>(null);

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { item_code: "", description: "ຕົວຢ່າງລາຍການ", unit: "ຊຸດ", qty: 1, unit_price: 0 },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Items");
    XLSX.writeFile(wb, "quotation_items_template.xlsx");
  };

  const onImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const norm = (s: string) => String(s || "").trim().toLowerCase();
      const pick = (row: any, keys: string[]) => {
        for (const k of keys) {
          const hit = Object.keys(row).find((h) => norm(h) === norm(k));
          if (hit != null) return row[hit];
        }
        return "";
      };
      const imported: Line[] = rows
        .map((r) => ({
          itemCode: String(pick(r, ["item_code", "code", "ລະຫັດ"]) || ""),
          description: String(pick(r, ["description", "name", "item_name", "ລາຍລະອຽດ", "ຊື່"]) || ""),
          unit: String(pick(r, ["unit", "unit_code", "ໜ່ວຍ"]) || ""),
          qty: Number(pick(r, ["qty", "quantity", "ຈຳນວນ"])) || 0,
          unitPrice: Number(pick(r, ["unit_price", "price", "ລາຄາ"])) || 0,
        }))
        .filter((l) => l.description.trim() || l.itemCode.trim());
      if (imported.length) {
        setLines((prev) => {
          const hasContent = prev.some((l) => l.description.trim() || l.itemCode);
          return hasContent ? [...prev, ...imported] : imported;
        });
      }
    } catch (err: any) {
      setError("ນຳເຂົ້າ Excel ບໍ່ສຳເລັດ: " + (err?.message || ""));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const validLines = lines.filter((l) => l.description.trim() && (Number(l.qty) || 0) > 0);
    if (validLines.length === 0) {
      setError("ກະລຸນາເພີ່ມລາຍການຢ່າງໜ້ອຍ 1 ແຖວ (ມີຊື່ ແລະ ຈຳນວນ)");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        quotation_no: editId ? null : genQuotationNo(),
        project_id: String(id),
        project_name: project?.project_name || null,
        customer_name: cust.name || null,
        customer_phone: cust.phone || null,
        customer_address: cust.address || null,
        quotation_date: quotationDate,
        validity_date: validityDate || null,
        discount: Number(discount) || 0,
        tax: vatAmount,
        tax_type: vatType,
        subtotal,
        total_amount: total,
        notes: notes || null,
        items: validLines.map((l) => ({
          item_code: l.itemCode || null,
          description: l.description,
          unit: l.unit || null,
          qty: Number(l.qty) || 0,
          unit_price: Number(l.unitPrice) || 0,
          amount: (Number(l.qty) || 0) * (Number(l.unitPrice) || 0),
        })),
      };
      const res: any = editId ? await updateQuotation(editId, payload) : await createQuotation(payload);
      if (res?.success) router.push(editId ? `/v2/quotations/${editId}` : `/v2/projects/${id}?tab=quotations`);
      else setError(res?.message || "ບັນທຶກບໍ່ສຳເລັດ");
    } catch (err: any) {
      setError(err?.message || "ເກີດຂໍ້ຜິດພາດ");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-3 text-[var(--theme-text-mute)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--theme-border-subtle)] border-t-[var(--theme-primary)]" />
        <span className="text-sm">ກຳລັງໂຫຼດ...</span>
      </div>
    );
  }

  if (hasQuotation) {
    return (
      <Page max="max-w-[700px]">
        <Card className="border-t-2 border-t-amber-400 p-6 text-center">
          <p className="text-[13px] text-[var(--theme-text-soft)]">
            ໂຄງການນີ້ <b>ມີໃບສະເໜີລາຄາແລ້ວ</b> — 1 ໂຄງການ ມີ 1 ໃບສະເໜີ.
          </p>
          <div className="mt-4 flex justify-center">
            <Btn onClick={() => router.push(`/v2/projects/${id}`)}>ກັບໄປເບິ່ງໃບສະເໜີ</Btn>
          </div>
        </Card>
      </Page>
    );
  }

  return (
    <Page max="max-w-none">
      <form onSubmit={submit}>
        {/* Header bar */}
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => router.push(`/v2/projects/${id}`)}
              className="mb-1 inline-flex items-center gap-1 text-[12px] text-[var(--theme-text-mute)] hover:text-[var(--theme-primary)]"
            >
              <ArrowLeft size={14} /> ໄປໂຄງການ
            </button>
            <h1 className="flex items-center gap-2 text-[19px] font-bold leading-tight text-[var(--theme-text)]">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <FileText size={16} />
              </span>
              {editId ? "ແກ້ໄຂໃບສະເໜີລາຄາ" : "ສ້າງໃບສະເໜີລາຄາ"}
            </h1>
            {(cust.name || project?.project_name) && (
              <p className="text-[12px] text-[var(--theme-text-mute)]">
                {cust.name && <span className="font-medium text-[var(--theme-text-soft)]">ລູກຄ້າ: {cust.name}</span>}
                {cust.name && project?.project_name && " · "}
                {project?.project_name && <>ໂຄງການ: {project.project_name}</>}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Btn type="button" variant="outline" onClick={() => router.push(`/v2/projects/${id}`)}>
              ຂ້າມໄປກ່ອນ
            </Btn>
            <Btn type="submit" disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກໃບສະເໜີ"}
            </Btn>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">
            {error}
          </div>
        )}

        <Card className="mb-4 border-t-2 border-t-blue-400 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Field label="ຊື່ລູກຄ້າ" className="lg:col-span-2">
              <input value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} className={inputCls} placeholder="ຊື່ລູກຄ້າ" />
            </Field>
            <Field label="ເບີໂທ">
              <input value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} className={inputCls} placeholder="020..." />
            </Field>
            <Field label="ວັນທີ">
              <input type="date" value={quotationDate} onChange={(e) => setQuotationDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label="ມີຜົນເຖິງ">
              <input type="date" value={validityDate} onChange={(e) => setValidityDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label="ປະເພດ ອມພ (VAT)">
              <select value={vatType} onChange={(e) => setVatType(e.target.value as any)} className={inputCls}>
                <option value="none">ບໍ່ມີ (0%)</option>
                <option value="exclusive">ແຍກນອກ</option>
                <option value="inclusive">ລວມໃນ</option>
              </select>
            </Field>
            <Field label="ທີ່ຢູ່ລູກຄ້າ" className="sm:col-span-2 lg:col-span-6">
              <input value={cust.address} onChange={(e) => setCust({ ...cust, address: e.target.value })} className={inputCls} placeholder="ທີ່ຢູ່" />
            </Field>
          </div>
        </Card>

        {/* Line items */}
        <Card className="mb-4 overflow-hidden border-t-2 border-t-amber-400">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--theme-border-subtle)] px-3 py-2">
            <h2 className="text-[13px] font-bold text-[var(--theme-text)]">ລາຍການ</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Btn type="button" variant="outline" onClick={downloadTemplate}>
                <FileDown size={14} /> Template
              </Btn>
              <Btn type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload size={14} /> ນຳເຂົ້າ Excel
              </Btn>
              <Btn type="button" variant="outline" onClick={addLine}>
                <Plus size={14} /> ເພີ່ມແຖວ
              </Btn>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onImportExcel} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className={tblCls}>
              <thead>
                <tr>
                  <th className={`${thCls} w-8`}>#</th>
                  <th className={thCls}>ສິນຄ້າ / ລາຍລະອຽດ</th>
                  <th className={`${thCls} w-20`}>ໜ່ວຍ</th>
                  <th className={`${thCls} w-24 text-right`}>ຈຳນວນ</th>
                  <th className={`${thCls} w-32 text-right`}>ລາຄາ/ໜ່ວຍ</th>
                  <th className={`${thCls} w-32 text-right`}>ລວມ</th>
                  <th className={`${thCls} w-10`} />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td className={`${tdCls} text-[11px] text-[var(--theme-text-mute)]`}>{i + 1}</td>
                    <td className={tdCls}>
                      <InventoryPicker
                        value={l.description}
                        onText={(t) => setLine(i, { description: t })}
                        onSelect={(it) =>
                          setLine(i, {
                            itemCode: it.code,
                            description: it.name,
                            unit: it.unit || l.unit,
                            unitPrice: it.price || l.unitPrice,
                          })
                        }
                      />
                    </td>
                    <td className={tdCls}>
                      <input value={l.unit ?? ""} onChange={(e) => setLine(i, { unit: e.target.value })} className={`${inputCls} h-8`} placeholder="ໜ່ວຍ" />
                    </td>
                    <td className={tdCls}>
                      <input type="number" min="0" value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} className={`${inputCls} h-8 text-right`} />
                    </td>
                    <td className={tdCls}>
                      <input type="number" min="0" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: Number(e.target.value) })} className={`${inputCls} h-8 text-right`} />
                    </td>
                    <td className={`${tdCls} text-right font-mono tabular-nums`}>
                      {money((Number(l.qty) || 0) * (Number(l.unitPrice) || 0))}
                    </td>
                    <td className={tdCls}>
                      {lines.length > 1 && (
                        <button type="button" onClick={() => removeLine(i)} className="text-rose-500 hover:text-rose-700">
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

        {/* Notes (2/3) + Totals summary (1/3) */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="border-t-2 border-t-slate-300 p-4 lg:col-span-2">
            <Field label="ໝາຍເຫດ / ເງື່ອນໄຂ">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={8} className={`${inputCls} h-auto py-2`} placeholder="ໝາຍເຫດ, ເງື່ອນໄຂການຊຳລະ, ການຮັບປະກັນ..." />
            </Field>
          </Card>

          <Card className="border-t-2 border-t-emerald-400 p-4">
            <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-[var(--theme-text)]">
              <span className="h-4 w-1 rounded bg-emerald-500" /> ສະຫຼຸບເງິນ
            </div>
            <div className="grid grid-cols-2 items-center gap-x-3 gap-y-2.5 text-[13px]">
              <span className="text-[var(--theme-text-mute)]">ລວມຍ່ອຍ</span>
              <span className="text-right font-mono tabular-nums">{money(subtotal)}</span>
              <span className="text-[var(--theme-text-mute)]">ສ່ວນຫຼຸດ</span>
              <input type="number" min="0" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className={`${inputCls} h-8 text-right`} />
              <span className="text-[var(--theme-text-mute)]">ອັດຕາ ອມພ (%)</span>
              <input
                type="number"
                min="0"
                value={vatRate}
                onChange={(e) => setVatRate(Number(e.target.value))}
                disabled={vatType === "none"}
                className={`${inputCls} h-8 text-right disabled:cursor-not-allowed disabled:bg-[var(--theme-bg-muted)] disabled:opacity-60`}
              />
              <span className="text-[var(--theme-text-mute)]">ອມພ{vatType === "inclusive" ? " (ລວມໃນ)" : ""}</span>
              <span className="text-right font-mono tabular-nums">{money(vatAmount)}</span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-[var(--theme-border-subtle)] pt-3">
              <span className="text-[14px] font-bold text-[var(--theme-text)]">ລວມທັງໝົດ</span>
              <span className="font-mono text-[19px] font-bold tabular-nums text-[var(--theme-primary)]">{money(total)}</span>
            </div>
          </Card>
        </div>
      </form>
    </Page>
  );
}
