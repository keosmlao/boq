"use client";

/** v2 — Material request (ຂໍເບີກ). Request BOQ materials (within remaining). */
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Save, PackageOpen, Plus, Search, Trash2, X, Repeat } from "lucide-react";
import { getProjectBasic } from "@/_actions/projects";
import { getCustomer } from "@/_actions/customers";
import { getProjectMaterials } from "@/_actions/boq-v2";
import { createRequest, updateRequest, getRequestDetail } from "@/_actions/request-v2";
import { getWarehouses, getLocations, getStockBalancesAtLocation, getInventory, getTechnicians } from "@/_actions/lookups";
import { Page, Card, Btn, inputCls, tblCls, thCls, tdCls } from "../../../../_components/ui";
import RSelect from "../../../../_components/RSelect";
import { useT } from "@/_lib/i18n";

type Row = {
  item_code: string;
  description: string;
  unit: string;
  remaining: number;
  boq_qty: number;
  pending_request_qty: number;
  withdraw_qty: number;
  boq_remaining: number;
  stock_remaining: number;
  qty: number;
  /** The BOQ line this row draws down. Differs from item_code when substituted. */
  boq_item_code: string;
  /** Original BOQ item name (shown when substituted). */
  boq_item_name: string;
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function RequestPage() {
  const t = useT();
  const { id } = useParams();
  const router = useRouter();
  const sp = useSearchParams();
  const editId = sp.get("edit");
  const fromApp = sp.get("fromApp"); // pull an app request (app-<id>) into a new requisition
  const seedId = editId || fromApp;

  const [fromAppId, setFromAppId] = useState("");
  const [project, setProject] = useState<any>(null);
  const [custName, setCustName] = useState("");
  const [boqRows, setBoqRows] = useState<Row[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [substIdx, setSubstIdx] = useState<number | null>(null);
  const [substQuery, setSubstQuery] = useState("");
  const [substResults, setSubstResults] = useState<any[]>([]);
  const [substLoading, setSubstLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [usedByCode, setUsedByCode] = useState("");
  const [shelves, setShelves] = useState<any[]>([]);
  const [whCode, setWhCode] = useState("");
  const [shelfCode, setShelfCode] = useState("");
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState("");
  const boqItemCodesKey = useMemo(
    // Include cart rows' codes too, so substitute products (not in the BOQ list)
    // still get their stock balance fetched for the selected location.
    () => [...new Set([...boqRows, ...rows].map((row) => row.item_code).filter(Boolean))].join("\u001f"),
    [boqRows, rows],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [pRes, mRes, whRes, techRes]: any = await Promise.all([getProjectBasic(String(id)), getProjectMaterials(String(id)), getWarehouses(), getTechnicians()]);
        if (!alive) return;
        const p = pRes?.success ? pRes.data : null;
        setProject(p);
        setWarehouses(whRes?.success ? whRes.data || [] : []);
        setTechnicians(techRes?.success ? techRes.data || [] : []);

        const mats = mRes?.success ? mRes.data || [] : [];
        const availableRows = mats
          .filter((m: any) => num(m.remaining) > 0)
          .map((m: any) => ({
            item_code: m.item_code || "",
            description: m.description || "",
            unit: m.unit || "",
            remaining: num(m.remaining),
            boq_qty: num(m.boq_qty),
            pending_request_qty: num(m.pending_request_qty ?? m.request_qty),
            withdraw_qty: num(m.withdraw_qty),
            boq_remaining: num(m.remaining),
            stock_remaining: 0,
            qty: 0,
            boq_item_code: m.item_code || "",
            boq_item_name: m.description || "",
          }));
        setBoqRows(availableRows);

        if (seedId) {
          // Prefill from an existing request (edit) OR from an app request (pull).
          // qty editable, max = remaining + the seed's own qty (added back below).
          const remMap: Record<string, number> = {};
          const materialMap = new Map<string, any>();
          for (const m of mats) remMap[String(m.item_code || m.description || "")] = num(m.remaining);
          for (const m of mats) materialMap.set(String(m.item_code || m.description || ""), m);
          try {
            const detRes: any = await getRequestDetail(String(seedId));
            if (alive && detRes?.success) {
              const reqItems = Array.isArray(detRes.data?.items) ? detRes.data.items : [];
              setRows(
                reqItems.map((it: any) => {
                  // For substituted lines, BOQ figures come from the original BOQ code.
                  const boqCode = String(it.boq_item_code || it.item_code || "").trim();
                  const key = boqCode || String(it.description || "");
                  const qty = num(it.qty);
                  const material = materialMap.get(key) || {};
                  return {
                    item_code: it.item_code || "",
                    description: it.description || it.item_name || "",
                    unit: it.unit || it.unit_code || "",
                    remaining: (remMap[key] ?? 0) + qty,
                    boq_qty: num(material.boq_qty),
                    pending_request_qty: Math.max(num(material.pending_request_qty ?? material.request_qty) - qty, 0),
                    withdraw_qty: num(material.withdraw_qty),
                    boq_remaining: (remMap[key] ?? 0) + qty,
                    stock_remaining: 0,
                    qty,
                    boq_item_code: boqCode || (it.item_code || ""),
                    boq_item_name: String(it.boq_item_name || material.description || it.description || ""),
                  };
                }),
              );
              setBoqRows((current) => {
                const merged = [...current];
                for (const it of reqItems) {
                  const key = String(it.item_code || it.description || "");
                  const qty = num(it.qty);
                  const index = merged.findIndex((m) => String(m.item_code || m.description || "") === key);
                  if (index >= 0) merged[index] = {
                    ...merged[index],
                    remaining: merged[index].remaining + qty,
                    boq_remaining: merged[index].boq_remaining + qty,
                  };
                }
                return merged;
              });
              const firstItem = reqItems[0];
              if (firstItem?.wh_code) setWhCode(String(firstItem.wh_code));
              if (firstItem?.shelf_code) setShelfCode(String(firstItem.shelf_code));
              setNotes(detRes.data?.notes || "");
              if (detRes.data?.used_by_code) setUsedByCode(String(detRes.data.used_by_code));
              // Pulling an app request → create NEW (not edit); remember the source.
              if (fromApp && !editId) setFromAppId(String(fromApp));
            }
          } catch {
            /* ignore */
          }
        }
        if (p?.sml_code) {
          const cuRes: any = await getCustomer(String(p.sml_code));
          if (alive && cuRes?.success) setCustName(cuRes.data.name || "");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [editId, id]);

  // Load shelves whenever the selected warehouse changes.
  useEffect(() => {
    if (!editId) setShelfCode("");
    if (!whCode) { setShelves([]); return; }
    let alive = true;
    (async () => {
      const r: any = await getLocations(whCode);
      if (alive) setShelves(r?.success ? r.data || [] : []);
    })();
    return () => { alive = false; };
  }, [editId, whCode]);

  // Load real ERP stock for the selected warehouse + location.
  useEffect(() => {
    if (!whCode || !shelfCode || !boqItemCodesKey) {
      setStockError("");
      setBoqRows((current) => current.map((row) => ({ ...row, stock_remaining: 0, remaining: 0 })));
      return;
    }
    let alive = true;
    setStockLoading(true);
    setStockError("");
    setBoqRows((current) => current.map((row) => ({ ...row, stock_remaining: 0, remaining: 0 })));
    (async () => {
      try {
        const codes = boqItemCodesKey.split("\u001f");
        const result: any = await getStockBalancesAtLocation(codes, whCode, shelfCode);
        if (!alive) return;
        if (!result?.success) {
          setStockError(result?.message || t("requestNew.stockLoadFailed", "ບໍ່ສາມາດໂຫຼດ stock ຄົງເຫຼືອໄດ້"));
          return;
        }
        const stockMap = new Map<string, number>(
          (result.data || []).map((row: any) => [String(row.ic_code || "").trim(), Math.max(num(row.balance_qty), 0)]),
        );
        setBoqRows((current) => current.map((row) => {
          const stock = row.item_code ? num(stockMap.get(row.item_code)) : 0;
          return { ...row, stock_remaining: stock, remaining: Math.min(row.boq_remaining, stock) };
        }));
        setRows((current) => current.map((row) => {
          const stock = row.item_code ? num(stockMap.get(row.item_code)) : 0;
          const remaining = Math.min(row.boq_remaining, stock);
          return { ...row, stock_remaining: stock, remaining, qty: Math.min(row.qty, remaining) };
        }));
      } finally {
        if (alive) setStockLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [boqItemCodesKey, shelfCode, whCode]);

  // Substitution product search (debounced) — runs while the substitute modal is open.
  useEffect(() => {
    if (substIdx === null) return;
    let alive = true;
    setSubstLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res: any = await getInventory({ search: substQuery.trim(), limit: 30 });
        if (alive) setSubstResults(res?.success ? res.data || [] : []);
      } finally {
        if (alive) setSubstLoading(false);
      }
    }, 300);
    return () => { alive = false; clearTimeout(handle); };
  }, [substIdx, substQuery]);

  const totalReq = useMemo(() => rows.reduce((s, r) => s + num(r.qty), 0), [rows]);
  const rowKey = (row: Pick<Row, "item_code" | "description">) => String(row.item_code || row.description || "");
  const selectableRows = useMemo(() => {
    const selected = new Set(rows.map(rowKey));
    const query = pickerQuery.trim().toLowerCase();
    return boqRows.filter((row) => {
      if (selected.has(rowKey(row))) return false;
      // Show items that still have BOQ remaining even if out of stock — those
      // can be added and then substituted with an in-stock product.
      if (row.boq_remaining <= 0) return false;
      if (!query) return true;
      return [row.item_code, row.description, row.unit].some((value) => String(value || "").toLowerCase().includes(query));
    });
  }, [boqRows, pickerQuery, rows]);
  const canSelectMore = useMemo(() => {
    const selected = new Set(rows.map(rowKey));
    return !!whCode && !!shelfCode && !stockLoading && boqRows.some((row) => row.boq_remaining > 0 && !selected.has(rowKey(row)));
  }, [boqRows, rows, shelfCode, stockLoading, whCode]);
  const setRow = (i: number, qty: number) =>
    setRows((a) => a.map((r, idx) => (idx === i ? { ...r, qty: Math.min(Math.max(qty, 0), r.remaining) } : r)));
  const addRow = (row: Row) => {
    setRows((current) => [...current, { ...row, qty: Math.min(1, row.remaining) }]);
    setPickerOpen(false);
    setPickerQuery("");
  };
  const removeRow = (i: number) => setRows((current) => current.filter((_, index) => index !== i));

  // Replace the issued product on a cart row, keeping its BOQ linkage so the
  // BOQ line still draws down. Stock for the new product refetches via effect.
  const applySubstitute = (i: number, inv: { code: string; name: string; unit: string }) => {
    setRows((current) =>
      current.map((r, idx) =>
        idx === i
          ? {
              ...r,
              item_code: inv.code,
              description: inv.name,
              unit: inv.unit || r.unit,
              stock_remaining: 0,
              remaining: 0,
              qty: 0,
            }
          : r,
      ),
    );
    setSubstIdx(null);
    setSubstQuery("");
  };
  const clearSubstitute = (i: number) =>
    setRows((current) =>
      current.map((r, idx) =>
        idx === i
          ? { ...r, item_code: r.boq_item_code, description: r.boq_item_name, stock_remaining: 0, remaining: 0, qty: 0 }
          : r,
      ),
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!whCode || !shelfCode) {
      setError(t("requestNew.selectWarehouseAndLocation", "ກະລຸນາເລືອກສາງ ແລະ ທີ່ຈັດເກັບ"));
      return;
    }
    const wh = warehouses.find((w) => String(w.code) === whCode);
    const sh = shelves.find((s) => String(s.code) === shelfCode);
    const items = rows.filter((r) => num(r.qty) > 0).map((r) => ({
      item_code: r.item_code || null,
      description: r.description,
      unit: r.unit || null,
      qty: num(r.qty),
      boq_item_code: r.boq_item_code || r.item_code || null,
      boq_item_name: r.boq_item_name || r.description || null,
      wh_code: whCode || null,
      wh_name: wh?.name_1 || null,
      shelf_code: shelfCode || null,
      shelf_name: sh?.name_1 || null,
    }));
    if (!items.length) {
      setError(t("requestNew.enterRequestQty", "ກະລຸນາໃສ່ຈຳນວນທີ່ຕ້ອງເບີກ"));
      return;
    }
    setSaving(true);
    try {
      let requester = "";
      try { requester = JSON.parse(localStorage.getItem("v2_user") || "{}").name || ""; } catch { /* Ignore malformed local user data. */ }
      const usedTech = technicians.find((tch) => String(tch.code) === usedByCode);
      const usedBy = { used_by_code: usedByCode || null, used_by_name: usedTech?.name_1 || null };
      const res: any = editId
        ? await updateRequest(String(editId), { items, notes: notes || null, ...usedBy })
        : await createRequest({ project_id: String(id), project_name: project?.project_name || null, items, notes: notes || null, requester, ...usedBy, from_app_id: fromAppId || null });
      if (res?.success) router.push(editId ? `/requests/${encodeURIComponent(String(editId))}` : `/projects/${id}?tab=requests`);
      else setError(res?.message || t("requestNew.saveFailed", "ບັນທຶກບໍ່ສຳເລັດ"));
    } catch (err: any) {
      setError(err?.message || t("requestNew.errorOccurred", "ເກີດຂໍ້ຜິດພາດ"));
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
    <Page max="max-w-none">
      <form onSubmit={submit}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <button type="button" onClick={() => router.push(`/projects/${id}`)} className="mb-1 inline-flex items-center gap-1 text-[12px] text-[var(--theme-text-mute)] hover:text-[var(--theme-primary)]">
              <ArrowLeft size={14} /> {t("requestNew.toProject", "ໄປໂຄງການ")}
            </button>
            <h1 className="flex items-center gap-2 text-[19px] font-bold leading-tight text-[var(--theme-text)]">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 text-white">
                <PackageOpen size={16} />
              </span>
              {editId ? t("requestNew.editRequest", "ແກ້ໄຂໃບຂໍເບີກ") : t("requestNew.requestMaterials", "ຂໍເບີກວັດສະດຸ")}
            </h1>
            {(custName || project?.project_name) && (
              <p className="text-[12px] text-[var(--theme-text-mute)]">
                {custName && <span className="font-medium text-[var(--theme-text-soft)]">{t("requestNew.customerLabel", "ລູກຄ້າ")}: {custName}</span>}
                {custName && project?.project_name && " · "}
                {project?.project_name && <>{t("requestNew.projectLabel", "ໂຄງການ")}: {project.project_name}</>}
              </p>
            )}
          </div>
          <Btn type="submit" disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? t("common.saving", "ກຳລັງບັນທຶກ...") : editId ? t("requestNew.saveEdit", "ບັນທຶກການແກ້ໄຂ") : t("requestNew.submitRequest", "ສົ່ງຂໍເບີກ")}
          </Btn>
        </div>

        {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>}

        {fromAppId && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[12.5px] font-semibold text-blue-700">
            {t("requestNew.pulledFromApp", "ດຶງມาจากใบขอเบิกจากแอป")}: {fromAppId.replace(/^app-/, "APP-")} — {t("requestNew.pulledFromAppHint", "ເລືອກສາງ ແລ້ວ ສົ່ງ ເພื่อออกใบเบิกจริง")}
          </div>
        )}

        <Card className="mb-4 border-t-2 border-t-pink-400 p-4">
          <div className="mb-3">
            <label className="mb-1 block text-[12px] font-semibold text-[var(--theme-text-soft)]">{t("requestNew.usedBy", "ຜູ້ໃຊ້ວັດສະດຸ (ທີມ/ຊ່າງ)")}</label>
            <RSelect
              value={usedByCode}
              onChange={setUsedByCode}
              options={technicians.map((tch) => ({ value: String(tch.code), label: `${tch.name_1 || tch.code}${tch.code ? ` (${tch.code})` : ""}` }))}
              placeholder={t("requestNew.selectTech", "-- ເລືອກທີມ/ຊ່າງ --")}
              isClearable
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-[var(--theme-text-soft)]">{t("requestNew.warehouse", "ສາງ (Warehouse)")}</label>
              <RSelect
                value={whCode}
                onChange={setWhCode}
                options={warehouses.map((w) => ({ value: String(w.code), label: `${w.code} - ${w.name_1}` }))}
                placeholder={t("requestNew.selectWarehouse", "-- ເລືອກສາງ --")}
                disabled={rows.length > 0}
                isClearable
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-[var(--theme-text-soft)]">{t("requestNew.location", "ທີ່ເກັບ (ຊັ້ນວາງ)")}</label>
              <RSelect
                value={shelfCode}
                onChange={setShelfCode}
                options={shelves.map((s) => ({ value: String(s.code), label: `${s.code} - ${s.name_1}` }))}
                placeholder={whCode ? t("requestNew.selectLocation", "-- ເລືອກທີ່ເກັບ --") : t("requestNew.selectWarehouseFirst", "ເລືອກສາງກ່ອນ")}
                disabled={!whCode || rows.length > 0}
                isClearable
              />
            </div>
          </div>
          {rows.length > 0 && <p className="mt-2 text-[10.5px] text-[var(--theme-text-mute)]">{t("requestNew.clearCartBeforeChange", "ລຶບລາຍການອອກຈາກ cart ທັງໝົດ ກ່ອນປ່ຽນສາງ ຫຼື ທີ່ຈັດເກັບ")}</p>}
          {stockError && <p className="mt-2 text-[11px] text-rose-600">{stockError}</p>}
        </Card>

        <Card className="overflow-hidden border-t-2 border-t-pink-400">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--theme-border-subtle)] px-3 py-2">
            <div className="text-[13px] font-bold text-[var(--theme-text)]">
              {t("requestNew.materialsList", "ລາຍການວັດສະດຸ")} ({t("requestNew.requesting", "ຂໍເບີກ")} {totalReq})
            </div>
            <Btn type="button" variant="outline" onClick={() => setPickerOpen(true)} disabled={!canSelectMore}>
              <Plus size={14} /> {t("requestNew.selectFromBoq", "ເລືອກລາຍການວັດສະດຸຈາກ BOQ")}
            </Btn>
          </div>
          {rows.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <PackageOpen size={30} className="mx-auto mb-2 text-[var(--theme-text-mute)]" />
              <p className="text-[13px] font-semibold text-[var(--theme-text-soft)]">{t("requestNew.cartEmpty", "Cart ຍັງເປົ່າ")}</p>
              <p className="mt-1 text-[11.5px] text-[var(--theme-text-mute)]">
                {!whCode || !shelfCode ? t("requestNew.selectWhBeforeMaterials", "ເລືອກສາງ ແລະ ທີ່ຈັດເກັບກ່ອນເລືອກວັດສະດຸ") : boqRows.length > 0 ? t("requestNew.selectMaterialsFromBoq", "ເລືອກວັດສະດຸຈາກ BOQ ເພື່ອເພີ່ມເຂົ້າທີລະລາຍການ") : t("requestNew.noRemainingBoq", "ບໍ່ມີວັດສະດຸ BOQ ທີ່ຄົງເຫຼືອໃຫ້ເບີກ")}
              </p>
            </div>
          ) : <div className="overflow-x-auto">
            <table className={tblCls}>
              <thead>
                <tr>
                  <th className={thCls}>{t("requestNew.item", "ລາຍການ")}</th>
                  <th className={`${thCls} w-20`}>{t("common.unit", "ໜ່ວຍ")}</th>
                  <th className={`${thCls} w-20 text-right`}>BOQ</th>
                  <th className={`${thCls} w-24 text-right`}>{t("requestNew.pendingWithdraw", "ລໍຖ້າເບີກ")}</th>
                  <th className={`${thCls} w-24 text-right`}>{t("requestNew.withdrawn", "ເບີກແລ້ວ")}</th>
                  <th className={`${thCls} w-24 text-right`}>{t("requestNew.canWithdrawMore", "ເບີກເພີ່ມໄດ້")}</th>
                  <th className={`${thCls} w-24 text-right`}>{t("requestNew.stockInWarehouse", "Stock ສາງ")}</th>
                  <th className={`${thCls} w-32 text-right`}>{t("requestNew.requesting", "ຂໍເບີກ")}</th>
                  <th className={`${thCls} w-12`} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const substituted = !!r.boq_item_code && r.boq_item_code !== r.item_code;
                  return (
                  <tr key={i}>
                    <td className={`${tdCls} font-medium text-[var(--theme-text)]`}>
                      <div>{r.description || r.item_code}</div>
                      {substituted ? (
                        <div className="mt-0.5 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          <Repeat size={10} /> {t("requestNew.substitutedFrom", "ປ່ຽນຈາກ")}: {r.boq_item_name || r.boq_item_code}
                        </div>
                      ) : r.stock_remaining <= 0 ? (
                        <div className="mt-0.5 text-[10px] font-semibold text-rose-500">{t("requestNew.outOfStock", "ບໍ່ມີ stock — ກົດ ‘ປ່ຽນ’")}</div>
                      ) : null}
                    </td>
                    <td className={tdCls}>{r.unit || "-"}</td>
                    <td className={`${tdCls} text-right tabular-nums text-[var(--theme-text-soft)]`}>{r.boq_qty.toLocaleString("en-US")}</td>
                    <td className={`${tdCls} text-right tabular-nums text-amber-600`}>{r.pending_request_qty.toLocaleString("en-US")}</td>
                    <td className={`${tdCls} text-right tabular-nums text-blue-600`}>{r.withdraw_qty.toLocaleString("en-US")}</td>
                    <td className={`${tdCls} text-right font-semibold tabular-nums text-[var(--theme-text)]`}>{r.boq_remaining.toLocaleString("en-US")}</td>
                    <td className={`${tdCls} text-right tabular-nums text-emerald-600`}>{r.stock_remaining.toLocaleString("en-US")}</td>
                    <td className={tdCls}>
                      <input type="number" min="0" max={r.remaining} value={r.qty} onChange={(e) => setRow(i, Number(e.target.value))} className={`${inputCls} h-8 text-right`} />
                    </td>
                    <td className={`${tdCls} text-center`}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button type="button" onClick={() => { setSubstIdx(i); setSubstQuery(""); }} className={`${substituted ? "text-amber-600" : "text-slate-400"} hover:text-amber-700`} title={t("requestNew.substitute", "ປ່ຽນສິນຄ້າ")}>
                          <Repeat size={15} />
                        </button>
                        {substituted && (
                          <button type="button" onClick={() => clearSubstitute(i)} className="text-slate-400 hover:text-slate-600" title={t("requestNew.undoSubstitute", "ກັບໄປສິນຄ້າ BOQ")}>
                            <X size={14} />
                          </button>
                        )}
                        <button type="button" onClick={() => removeRow(i)} className="text-rose-500 hover:text-rose-700" aria-label={t("requestNew.removeItem", "ລຶບລາຍການ")}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>}
          <div className="border-t border-[var(--theme-border-subtle)] p-3">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCls} h-auto py-2`} placeholder={t("common.note", "ໝາຍເຫດ")} />
          </div>
        </Card>
      </form>

      {pickerOpen && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 px-3 pt-[8vh]" onClick={() => setPickerOpen(false)}>
          <div className="w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-[var(--theme-shadow-lg)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-3 text-white">
              <div>
                <h2 className="text-[14px] font-bold">{t("requestNew.pickerTitle", "ເລືອກວັດສະດຸຈາກ BOQ")}</h2>
                <p className="text-[10.5px] text-white/80">{t("requestNew.pickerSubtitle", "ເພີ່ມເຂົ້າ cart ທີລະລາຍການ")}</p>
              </div>
              <button type="button" onClick={() => setPickerOpen(false)} className="text-white/80 hover:text-white"><X size={18} /></button>
            </div>
            <div className="border-b border-[var(--theme-border-subtle)] p-3">
              <div className="flex h-9 items-center gap-2 rounded-md border border-[var(--theme-border-subtle)] px-2.5">
                <Search size={14} className="text-[var(--theme-text-mute)]" />
                <input autoFocus value={pickerQuery} onChange={(e) => setPickerQuery(e.target.value)} placeholder={t("requestNew.searchPlaceholder", "ຄົ້ນຫາລະຫັດ ຫຼື ຊື່ວັດສະດຸ...")} className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
              </div>
            </div>
            <div className="max-h-[58vh] overflow-y-auto">
              {stockLoading ? (
                <div className="flex items-center justify-center gap-2 px-4 py-10 text-[12px] text-[var(--theme-text-mute)]"><Loader2 size={15} className="animate-spin" /> {t("requestNew.loadingStock", "ກຳລັງໂຫຼດ stock ຕາມສາງ...")}</div>
              ) : selectableRows.length === 0 ? (
                <div className="px-4 py-10 text-center text-[12px] text-[var(--theme-text-mute)]">{t("requestNew.noStockItems", "ບໍ່ພົບລາຍການ BOQ ທີ່ມີ stock ໃນສາງ/ທີ່ຈັດເກັບນີ້")}</div>
              ) : selectableRows.map((row) => (
                <button key={rowKey(row)} type="button" onClick={() => addRow(row)} className="flex w-full items-center gap-3 border-b border-[var(--theme-border-subtle)] px-4 py-3 text-left last:border-0 hover:bg-pink-50/60">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-pink-100 text-pink-600"><Plus size={15} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold text-[var(--theme-text)]">{row.description || row.item_code}</span>
                    <span className="block truncate text-[10.5px] text-[var(--theme-text-mute)]">{row.item_code || "-"} · {row.unit || "-"}</span>
                  </span>
                  <span className="text-right text-[10.5px] text-[var(--theme-text-mute)]">
                    BOQ: <strong className="text-[11.5px] text-[var(--theme-text-soft)]">{row.boq_qty.toLocaleString("en-US")}</strong>
                    {" - "}{t("requestNew.pendingShort", "ລໍຖ້າ")}: <strong className="text-[11.5px] text-amber-600">{row.pending_request_qty.toLocaleString("en-US")}</strong>
                    {" - "}{t("requestNew.withdrawn", "ເບີກແລ້ວ")}: <strong className="text-[11.5px] text-blue-600">{row.withdraw_qty.toLocaleString("en-US")}</strong><br />
                    {t("requestNew.canWithdrawMore", "ເບີກເພີ່ມໄດ້")}: <strong className="text-[11.5px] text-[var(--theme-text)]">{row.boq_remaining.toLocaleString("en-US")}</strong>
                    {" · "}
                    Stock: <strong className="text-[11.5px] text-emerald-600">{row.stock_remaining.toLocaleString("en-US")}</strong>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {substIdx !== null && rows[substIdx] && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/40 px-3 pt-[8vh]" onClick={() => setSubstIdx(null)}>
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-[var(--theme-shadow-lg)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-white">
              <div className="min-w-0">
                <h2 className="flex items-center gap-1.5 text-[14px] font-bold"><Repeat size={15} /> {t("requestNew.substituteTitle", "ປ່ຽນສິນຄ້າແທນ")}</h2>
                <p className="truncate text-[10.5px] text-white/85">{t("requestNew.substituteFor", "ແທນ BOQ")}: {rows[substIdx].boq_item_name || rows[substIdx].boq_item_code}</p>
              </div>
              <button type="button" onClick={() => setSubstIdx(null)} className="text-white/80 hover:text-white"><X size={18} /></button>
            </div>
            <div className="border-b border-[var(--theme-border-subtle)] p-3">
              <p className="mb-2 text-[11.5px] text-[var(--theme-text-mute)]">{t("requestNew.substituteHint", "ເລືອກສິນຄ້າມາແທນ — ຍອດ BOQ ເດີມຍັງຖືກຕັດ. ການປ່ຽນຕ້ອງຜ່ານການອະນຸມັດ.")}</p>
              <div className="flex h-9 items-center gap-2 rounded-md border border-[var(--theme-border-subtle)] px-2.5">
                <Search size={14} className="text-[var(--theme-text-mute)]" />
                <input autoFocus value={substQuery} onChange={(e) => setSubstQuery(e.target.value)} placeholder={t("requestNew.searchProduct", "ຄົ້ນຫາສິນຄ້າ (ລະຫັດ/ຊື່)...")} className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {substLoading ? (
                <div className="flex items-center justify-center gap-2 px-4 py-10 text-[12px] text-[var(--theme-text-mute)]"><Loader2 size={15} className="animate-spin" /> {t("common.loading", "ກຳລັງໂຫຼດ...")}</div>
              ) : substResults.length === 0 ? (
                <div className="px-4 py-10 text-center text-[12px] text-[var(--theme-text-mute)]">{t("requestNew.noProducts", "ບໍ່ພົບສິນຄ້າ")}</div>
              ) : substResults.map((it: any, idx: number) => (
                <button
                  key={String(it.code || idx)}
                  type="button"
                  onClick={() => applySubstitute(substIdx, { code: String(it.code ?? ""), name: String(it.name_1 ?? it.item_name ?? it.code ?? ""), unit: String(it.unit ?? it.unit_code ?? "") })}
                  className="flex w-full items-center gap-3 border-b border-[var(--theme-border-subtle)] px-4 py-2.5 text-left last:border-0 hover:bg-amber-50/70"
                >
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-600"><Repeat size={14} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold text-[var(--theme-text)]">{it.name_1 || it.item_name || it.code}</span>
                    <span className="block truncate text-[10.5px] text-[var(--theme-text-mute)]">{it.code || "-"}{it.unit ? ` · ${it.unit}` : ""}{it.brand_name ? ` · ${it.brand_name}` : ""}</span>
                  </span>
                  <span className="flex-shrink-0 text-right text-[10.5px] text-[var(--theme-text-mute)]">
                    Stock: <strong className={`text-[11.5px] ${num(it.balance_qty) > 0 ? "text-emerald-600" : "text-rose-500"}`}>{num(it.balance_qty).toLocaleString("en-US")}</strong>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
