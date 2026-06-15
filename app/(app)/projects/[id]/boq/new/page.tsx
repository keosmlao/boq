"use client";

/**
 * v2 — Create / edit a BOQ for a project (ERP odg_projects_boq).
 * A BOQ is a flat list of line items (quantities only — no price). Materials are
 * prefilled from the contract's products (locked); labour and consumables are
 * added as ordinary free-text rows. Persisted to odg_projects_boq(_detail).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Save, Plus, Trash2, ListChecks, FileDown, Upload, Wrench, PackageOpen } from "lucide-react";
import * as XLSX from "xlsx";
import { getProjectsBoq, advanceProjectStage } from "@/_actions/projects";
import { getContracts } from "@/_actions/contracts";
import { getCustomer } from "@/_actions/customers";
import { saveBoq, getBoq, updateBoqErp } from "@/_actions/boq";
import { Page, Card, Btn, inputCls, tblCls, thCls, tdCls } from "../../../../_components/ui";
import InventoryPicker from "../../../../_components/InventoryPicker";

type Mat = { itemCode?: string; description: string; unit?: string; qty: number; locked?: boolean };

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function CreateBoqPage() {
  const { id } = useParams();
  const router = useRouter();
  const editParam = useSearchParams().get("edit");
  const editDocNo = editParam ? decodeURIComponent(editParam) : "";

  const [project, setProject] = useState<any>(null);
  const [erpContract, setErpContract] = useState<any>(null); // odg_projects_contract row (for saveBoq)
  const [custName, setCustName] = useState("");
  const [custCode, setCustCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [mats, setMats] = useState<Mat[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Edit mode: load the existing ERP BOQ and prefill its items.
        if (editDocNo) {
          const bRes: any = await getBoq(editDocNo);
          if (!alive) return;
          if (bRes && bRes.success !== false) {
            setProject({ id: bRes.project_id, project_name: bRes.project_name });
            setCustName(bRes.cust_code || "");
            setErpContract({ contract_no: bRes.contract_no, cust_code: bRes.cust_code });
            setMats(
              (Array.isArray(bRes.boq_list) ? bRes.boq_list : []).map((it: any) => ({
                itemCode: it.item_code || "",
                description: String(it.item_name || ""),
                unit: String(it.unit_code || ""),
                qty: num(it.qty) || 1,
                locked: false,
              })),
            );
          } else {
            setError(bRes?.message || "ບໍ່ພົບ BOQ");
          }
          setLoading(false);
          return;
        }

        const [pRes, cRes]: any = await Promise.all([
          getProjectsBoq({ projectId: String(id) }),
          getContracts({ projectId: String(id) }),
        ]);
        if (!alive) return;
        const p = pRes?.success ? (pRes.data || [])[0] : null;
        setProject(p);

        // ERP contract (odg_projects_contract) — required to issue a BOQ.
        const erp = (Array.isArray(p?.contractlist) ? p.contractlist : [])[0] || null;
        setErpContract(erp);
        setCustCode(erp?.cust_code || p?.sml_code || "");

        // Prefill materials from the v2 contract's inventory products (locked).
        const v2ct = (cRes?.success ? cRes.data || [] : [])[0] || null;
        const products = (Array.isArray(v2ct?.items) ? v2ct.items : []).filter(
          (it: any) => String(it.item_code || "").trim() !== "",
        );
        setMats(
          products.map((it: any) => ({
            itemCode: it.item_code || "",
            description: String(it.description || it.item_name || ""),
            unit: String(it.unit || ""),
            qty: num(it.qty) || 1,
            locked: true,
          })),
        );

        const code = erp?.cust_code || p?.sml_code;
        if (code) {
          const cuRes: any = await getCustomer(String(code));
          if (alive && cuRes?.success) setCustName(cuRes.data.name || "");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, editDocNo]);

  // material helpers
  const setMat = (i: number, patch: Partial<Mat>) => setMats((a) => a.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  const addMat = (preset?: Partial<Mat>) => setMats((a) => [...a, { description: "", qty: 1, ...preset }]);
  const removeMat = (i: number) => setMats((a) => a.filter((_, idx) => idx !== i));

  const totalQty = useMemo(() => mats.reduce((s, m) => s + num(m.qty), 0), [mats]);

  // Excel import (materials)
  const fileRef = useRef<HTMLInputElement | null>(null);
  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{ item_code: "", description: "ຕົວຢ່າງວັດສະດຸ", unit: "ອັນ", qty: 1 }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BOQ");
    XLSX.writeFile(wb, "boq_materials_template.xlsx");
  };
  const onImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const imported: Mat[] = rows
        .map((r) => ({
          itemCode: String(r.item_code ?? r.code ?? "").trim(),
          description: String(r.description ?? r.name ?? r.item_name ?? "").trim(),
          unit: String(r.unit ?? "").trim(),
          qty: num(r.qty ?? r.quantity) || 1,
          locked: false,
        }))
        .filter((r) => r.description);
      if (imported.length) setMats((a) => [...a, ...imported]);
    } catch {
      setError("ອ່ານໄຟລ໌ Excel ບໍ່ສຳເລັດ");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const valid = mats.filter((m) => m.description.trim() && num(m.qty) > 0);
    if (!valid.length) {
      setError("ກະລຸນາມີລາຍການຢ່າງໜ້ອຍ 1 ແຖວ");
      return;
    }
    const items = valid.map((m) => ({
      item_code: m.itemCode || null,
      item_name: m.description,
      unit_code: m.unit || null,
      qty: num(m.qty),
    }));

    setSaving(true);
    try {
      if (editDocNo) {
        const res: any = await updateBoqErp(editDocNo, { items });
        if (res?.success) router.push(`/boq/${encodeURIComponent(editDocNo)}`);
        else setError(res?.message || "ບັນທຶກບໍ່ສຳເລັດ");
        return;
      }

      let username = "";
      try { username = JSON.parse(localStorage.getItem("v2_user") || "{}").username || ""; } catch { /* ignore */ }

      const res: any = await saveBoq({
        cust_code: custCode || erpContract?.cust_code || project?.sml_code || "",
        project_id: String(id),
        contract_no: erpContract?.contract_no || String(erpContract?.roworder ?? ""),
        username,
        items,
      });
      if (res?.success) {
        await advanceProjectStage(String(id), "BOQ").catch(() => {});
        router.push(`/projects/${id}?tab=boq`);
      } else {
        setError(res?.message || "ບັນທຶກບໍ່ສຳເລັດ");
      }
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

  if (!editDocNo && !erpContract) {
    return (
      <Page max="max-w-[700px]">
        <Card className="border-t-2 border-t-cyan-400 p-6 text-center">
          <p className="text-[13px] text-[var(--theme-text-soft)]">
            ຕ້ອງມີ <b>ສັນຍາ</b> ກ່ອນ ຈຶ່ງສ້າງ BOQ ໄດ້.
          </p>
          <div className="mt-4 flex justify-center">
            <Btn onClick={() => router.push(`/projects/${id}`)}>ກັບໄປໂຄງການ</Btn>
          </div>
        </Card>
      </Page>
    );
  }

  return (
    <Page max="max-w-none">
      <form onSubmit={submit}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => router.push(`/projects/${project?.id ?? id}`)}
              className="mb-1 inline-flex items-center gap-1 text-[12px] text-[var(--theme-text-mute)] hover:text-[var(--theme-primary)]"
            >
              <ArrowLeft size={14} /> ໄປໂຄງການ
            </button>
            <h1 className="flex items-center gap-2 text-[19px] font-bold leading-tight text-[var(--theme-text)]">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-sky-500 text-white">
                <ListChecks size={16} />
              </span>
              {editDocNo ? "ແກ້ໄຂ BOQ" : "ສ້າງ BOQ"}
            </h1>
            {(custName || project?.project_name) && (
              <p className="text-[12px] text-[var(--theme-text-mute)]">
                {custName && <span className="font-medium text-[var(--theme-text-soft)]">ລູກຄ້າ: {custName}</span>}
                {custName && project?.project_name && " · "}
                {project?.project_name && <>ໂຄງການ: {project.project_name}</>}
                {erpContract?.contract_no && <> · ສັນຍາ: {erpContract.contract_no}</>}
              </p>
            )}
          </div>
          <Btn type="submit" disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ BOQ"}
          </Btn>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>
        )}

        {/* Items — materials + labour + consumables, all as line items (qty only) */}
        <Card className="mb-4 overflow-hidden border-t-2 border-t-cyan-400">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--theme-border-subtle)] px-3 py-2">
            <h2 className="flex items-center gap-2 text-[13px] font-bold text-[var(--theme-text)]">
              <span className="h-4 w-1 rounded bg-cyan-500" /> ລາຍການ BOQ (ຈຳນວນ)
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Btn type="button" variant="outline" onClick={downloadTemplate}><FileDown size={14} /> Template</Btn>
              <Btn type="button" variant="outline" onClick={() => fileRef.current?.click()}><Upload size={14} /> Import Excel</Btn>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onImportExcel} />
              <Btn type="button" variant="outline" onClick={() => addMat({ description: "ຄ່າແຮງ" })}><Wrench size={14} /> ຄ່າແຮງ</Btn>
              <Btn type="button" variant="outline" onClick={() => addMat({ description: "ວັດສະດຸສິ້ນເປືອງ" })}><PackageOpen size={14} /> ສິ້ນເປືອງ</Btn>
              <Btn type="button" variant="outline" onClick={() => addMat()}><Plus size={14} /> ເພີ່ມແຖວ</Btn>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className={tblCls}>
              <thead>
                <tr>
                  <th className={`${thCls} w-8`}>#</th>
                  <th className={thCls}>ລາຍການ / ສິນຄ້າ</th>
                  <th className={`${thCls} w-28`}>ໜ່ວຍ</th>
                  <th className={`${thCls} w-28 text-right`}>ຈຳນວນ</th>
                  <th className={`${thCls} w-8`} />
                </tr>
              </thead>
              <tbody>
                {mats.map((m, i) => (
                  <tr key={i}>
                    <td className={`${tdCls} text-[11px] text-[var(--theme-text-mute)]`}>{i + 1}</td>
                    <td className={tdCls}>
                      {m.locked ? (
                        <div className="flex items-center gap-2 text-[12.5px] text-[var(--theme-text)]">
                          <span className="font-medium">{m.description}</span>
                          {m.itemCode && <span className="font-mono text-[10.5px] text-[var(--theme-text-mute)]">{m.itemCode}</span>}
                        </div>
                      ) : (
                        <InventoryPicker
                          value={m.description}
                          onText={(t) => setMat(i, { description: t })}
                          onSelect={(it) => setMat(i, { itemCode: it.code, description: it.name, unit: it.unit || m.unit })}
                        />
                      )}
                    </td>
                    <td className={tdCls}>
                      <input value={m.unit ?? ""} onChange={(e) => setMat(i, { unit: e.target.value })} disabled={m.locked} className={`${inputCls} h-8 disabled:bg-[var(--theme-bg-muted)] disabled:opacity-70`} placeholder="ໜ່ວຍ" />
                    </td>
                    <td className={tdCls}>
                      <input type="number" min="0" value={m.qty} onChange={(e) => setMat(i, { qty: Number(e.target.value) })} className={`${inputCls} h-8 text-right`} />
                    </td>
                    <td className={tdCls}>
                      {m.locked ? (
                        <span title="ສິນຄ້າຈາກສັນຍາ — ລົບບໍ່ໄດ້" className="text-[var(--theme-text-mute)] opacity-40"><Trash2 size={15} /></span>
                      ) : (
                        <button type="button" onClick={() => removeMat(i)} className="text-rose-500 hover:text-rose-700"><Trash2 size={15} /></button>
                      )}
                    </td>
                  </tr>
                ))}
                {mats.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-4 text-center text-[12px] text-[var(--theme-text-mute)]">ບໍ່ມີ — ກົດ "ເພີ່ມແຖວ" / "ຄ່າແຮງ" / "ສິ້ນເປືອງ"</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--theme-border-subtle)] px-3 py-2 text-[11px] text-[var(--theme-text-mute)]">
            <span>ສິນຄ້າຈາກສັນຍາ ລົບບໍ່ໄດ້. ຄ່າແຮງ ແລະ ວັດສະດຸສິ້ນເປືອງ ໃສ່ເປັນແຖວລາຍການ.</span>
            <span className="font-semibold text-[var(--theme-text-soft)]">{mats.length} ລາຍການ · {totalQty.toLocaleString("en-US")} ໜ່ວຍ</span>
          </div>
        </Card>

        <p className="text-[11.5px] text-[var(--theme-text-mute)]">
          ຜູ້ຂໍ/ຜູ້ສ້າງ ບັນທຶກອັດຕະໂນມັດຈາກຜູ້ໃຊ້ທີ່ເຂົ້າລະບົບ · ຜູ້ອະນຸມັດ ບັນທຶກຕອນກົດອະນຸມັດ.
        </p>
      </form>
    </Page>
  );
}
