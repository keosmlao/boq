"use client";


import AuthGuard from "@/_components/AuthGuard";
import { getNextRequestDocNo } from "@/_actions/requests";
import { getWarehouses, getLocations } from "@/_actions/lookups";
import { getBoq } from "@/_actions/boq";
import { createSparepartRequest } from "@/_actions/requests";
import { useParams, useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Package,
  Printer,
  RotateCw,
  Save,
  Search,
  X,
} from "lucide-react";

function _getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type ItemRow = {
  item_code: string;
  item_name: string;
  unit_code: string;
  boq_qty: number;
  withdraw: number;
  boq_balance: number;
  stock_total: number | null;
  stock_location: number | null;
  balance: number;
  qty: number;
};

const fmtNum = (n: any) => Number(n || 0).toLocaleString("en-US");

/**
 * Odoo-style form sheet for creating a material request (ໃບຂໍເບີກ) from an
 * approved BOQ. Status bar → stat boxes → form sheet → embedded items table.
 */
function BoqRequestPage() {
  const { docNo } = useParams<{ docNo: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [docNoLoading, setDocNoLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const [rows, setRows] = useState<ItemRow[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [itemsModalOpen, setItemsModalOpen] = useState(false);

  // Header
  const [reqDocNo, setReqDocNo] = useState("");
  const [docDate, setDocDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [docTime, setDocTime] = useState(() =>
    new Date().toTimeString().slice(0, 5),
  );
  const [remark, setRemark] = useState("");
  const [contractNo, setContractNo] = useState("");
  const [requestCustCode, setRequestCustCode] = useState("");

  // Storage
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [itemCodes, setItemCodes] = useState<string[]>([]);

  const handleBack = () => router.back();

  const fetchDocNo = async () => {
    setDocNoLoading(true);
    try {
      const res = await getNextRequestDocNo();
      setReqDocNo(res?.doc_no || "");
    } catch (e) {
      console.error(e);
      setReqDocNo("");
      alert("ດຶງເລກທີເອກະສານບໍ່ສຳເລັດ");
    } finally {
      setDocNoLoading(false);
    }
  };

  // Reset on open
  useEffect(() => {
    setRows([]);
    setReqDocNo("");
    setDocDate(new Date().toISOString().split("T")[0]);
    setDocTime(new Date().toTimeString().slice(0, 5));
    setRemark("");
    setSelectedWarehouse("");
    setSelectedLocation("");
    setLocations([]);
    setRequestCustCode("");
    setItemCodes([]);
  }, [docNo]);

  // Load warehouses
  useEffect(() => {
    (async () => {
      try {
        const res = await getWarehouses();
        const list = (res?.success && Array.isArray(res.data) ? res.data : []) as any[];
        setWarehouses(list);
        if (list.length === 1) setSelectedWarehouse(list[0].code);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // Load locations
  useEffect(() => {
    (async () => {
      if (!selectedWarehouse) {
        setLocations([]);
        setSelectedLocation("");
        return;
      }
      try {
        const res = await getLocations(selectedWarehouse);
        const list = (res?.success && Array.isArray(res.data) ? res.data : []) as any[];
        setLocations(list);
        if (list.length === 1) setSelectedLocation(list[0].code);
        else setSelectedLocation("");
      } catch (e) {
        console.error(e);
        setLocations([]);
        setSelectedLocation("");
      }
    })();
  }, [selectedWarehouse]);

  // Apply stock balances (info-only — qty cap = boq_balance, not stock)
  const applyStockBalances = useCallback(
    (options: any) => {
      const { totalMap, locationMap, hasTotal, hasLocation } = options || {};
      setRows((prev) =>
        prev.map((r) => {
          const boqBalance = Number(r.boq_balance ?? r.balance ?? 0);
          const totalBalance = hasTotal
            ? Number(totalMap?.get(r.item_code) ?? 0)
            : null;
          const locationBalance = hasLocation
            ? Number(locationMap?.get(r.item_code) ?? 0)
            : null;
          // Hard limit is BOQ remaining only. Stock is shown as info so the
          // user can decide; over-stock entry is allowed but visually flagged.
          const limit = Math.max(boqBalance, 0);
          const qty = Math.min(Number(r.qty) || 0, limit);
          return {
            ...r,
            boq_balance: boqBalance,
            stock_total: totalBalance,
            stock_location: locationBalance,
            balance: limit,
            qty,
          };
        }),
      );
    },
    [],
  );

  useEffect(() => {
    let ignore = false;
    const run = async () => {
      if (itemCodes.length === 0) {
        applyStockBalances({
          totalMap: new Map(),
          locationMap: new Map(),
          hasTotal: false,
          hasLocation: false,
        });
        return;
      }
      setBalanceLoading(true);
      const totalReq = fetch("/api/inventory/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json", ..._getAuthHeaders() },
        body: JSON.stringify({ items: itemCodes }),
      });
      const locationReq =
        selectedWarehouse && selectedLocation
          ? fetch("/api/inventory/balance", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ..._getAuthHeaders(),
              },
              body: JSON.stringify({
                items: itemCodes,
                warehouse: selectedWarehouse,
                location: selectedLocation,
              }),
            })
          : Promise.resolve(null);
      try {
        const [totalRes, locationRes] = await Promise.allSettled([
          totalReq,
          locationReq,
        ]);
        if (ignore) return;
        const toMap = (res: any) => {
          if (!res || res.status !== "fulfilled") return new Map();
          return res.value
            .json()
            .then((j: any) => {
              const list = Array.isArray(j?.data?.data) ? j.data.data : [];
              return new Map(
                list.map((x: any) => [x.item_code, Number(x.balance_qty ?? 0)]),
              );
            })
            .catch(() => new Map());
        };
        const [totalMap, locationMap] = await Promise.all([
          toMap(totalRes),
          toMap(locationRes),
        ]);
        applyStockBalances({
          totalMap,
          locationMap,
          hasTotal: totalRes.status === "fulfilled",
          hasLocation:
            !!selectedWarehouse &&
            !!selectedLocation &&
            locationRes.status === "fulfilled",
        });
      } catch (e) {
        console.error(e);
        if (!ignore) {
          applyStockBalances({
            totalMap: new Map(),
            locationMap: new Map(),
            hasTotal: false,
            hasLocation: false,
          });
        }
      } finally {
        if (!ignore) setBalanceLoading(false);
      }
    };
    run();
    return () => {
      ignore = true;
    };
  }, [selectedWarehouse, selectedLocation, itemCodes, applyStockBalances]);

  // Load BOQ
  useEffect(() => {
    let ignore = false;
    const run = async () => {
      if (!docNo) return;
      setLoading(true);
      try {
        const resp: any = await getBoq(docNo);
        if (ignore) return;
        const list = Array.isArray(resp?.boq_list) ? resp.boq_list : [];
        const lines: ItemRow[] = list
          .map((x: any) => {
            const boq_qty = Number(x.boq_qty ?? x.qty ?? 0);
            const withdraw = Number(x.withdraw ?? 0);
            const boq_balance = Number(
              x.balance ?? Math.max(boq_qty - withdraw, 0),
            );
            return {
              item_code: x.item_code,
              item_name: x.item_name,
              unit_code: x.unit_code,
              boq_qty,
              withdraw,
              boq_balance,
              stock_total: null,
              stock_location: null,
              balance: boq_balance,
              qty: 0,
            };
          })
          .filter((x: ItemRow) => x.boq_balance > 0);
        setContractNo(resp.contract_id || "");
        setRequestCustCode(resp.cust_code || "");
        setRows(lines);
        setItemCodes(
          Array.from(new Set(lines.map((x: ItemRow) => x.item_code).filter(Boolean))),
        );
        await fetchDocNo();
      } catch (e) {
        console.error(e);
        alert("ໂຫຼດຂໍ້ມູນ BOQ ບໍ່ສຳເລັດ");
        handleBack();
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    run();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docNo]);

  const changeQty = (idx: number, val: string) => {
    setRows((prev) => {
      const next = [...prev];
      const max = Number(next[idx].balance || 0);
      let q = Number(val || 0);
      if (q < 0) q = 0;
      if (q > max) q = max;
      next[idx].qty = q;
      return next;
    });
  };

  const totalItems = useMemo(
    () => rows.filter((r) => Number(r.qty) > 0).length,
    [rows],
  );
  const totalQty = useMemo(
    () => rows.reduce((acc, r) => acc + (Number(r.qty) || 0), 0),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const s = itemSearch.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        (r.item_code || "").toLowerCase().includes(s) ||
        (r.item_name || "").toLowerCase().includes(s),
    );
  }, [rows, itemSearch]);

  const buildPayload = () => {
    const items = rows
      .filter((r) => Number(r.qty) > 0)
      .map((r) => ({
        item_code: r.item_code,
        item_name: r.item_name,
        unit_code: r.unit_code,
        qty: Number(r.qty),
      }));
    if (!reqDocNo) throw new Error("NO_DOCNO");
    if (!docDate) throw new Error("NO_DOCDATE");
    if (!selectedWarehouse) throw new Error("NO_WAREHOUSE");
    if (!selectedLocation) throw new Error("NO_LOCATION");
    if (items.length === 0) throw new Error("NO_ITEMS");
    const userStr =
      typeof window !== "undefined" ? localStorage.getItem("user") : null;
    const requester = userStr
      ? JSON.parse(userStr).username || "unknown"
      : "unknown";
    return {
      requester,
      contract_no: contractNo || "",
      doc_no: reqDocNo,
      doc_date: docDate,
      doc_time: docTime,
      doc_ref: docNo,
      cust_code: requestCustCode,
      remark: remark.trim(),
      warehouse_code: selectedWarehouse,
      warehouse_name:
        warehouses.find((w) => w.code === selectedWarehouse)?.name_1 || "",
      location_code: selectedLocation,
      location_name:
        locations.find((l) => l.code === selectedLocation)?.name_1 || "",
      items,
    };
  };

  const saveRequest = useCallback(async () => {
    try {
      setSaving(true);
      const payload = buildPayload();
      const res: any = await createSparepartRequest(payload);
      const createdDocNo = res?.doc_no || payload.doc_no || reqDocNo;
      return createdDocNo;
    } catch (e: any) {
      console.error(e);
      const code = e?.message;
      if (code === "NO_DOCNO")
        alert("ບໍ່ມີເລກທີເອກະສານ ກົດ Reload ເພື່ອດຶງເລກໃໝ່");
      else if (code === "NO_DOCDATE") alert("ກະລຸນາເລືອກວັນທີ");
      else if (code === "NO_WAREHOUSE") alert("ກະລຸນາເລືອກສາງ");
      else if (code === "NO_LOCATION") alert("ກະລຸນາເລືອກສະຖານທີ່ຈັດເກັບ");
      else if (code === "NO_ITEMS") alert("ກະລຸນາລະບຸຈຳນວນທີ່ຈະຂໍເບີກ");
      else alert("ບັນທຶກບໍ່ສຳເລັດ");
      throw e;
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, reqDocNo, docDate, docTime, selectedWarehouse, selectedLocation, contractNo, requestCustCode, remark, warehouses, locations, docNo]);

  const submit = useCallback(async () => {
    try {
      await saveRequest();
      alert("ບັນທຶກໃບຂໍເບີກແລ້ວ");
      handleBack();
    } catch {
      /* handled */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveRequest]);

  const submitAndPrint = useCallback(async () => {
    try {
      const created = await saveRequest();
      window.open(
        `/print/rwpj/${encodeURIComponent(created)}?auto=1`,
        "_blank",
        "noopener,noreferrer",
      );
      handleBack();
    } catch {
      /* handled */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveRequest]);

  const canSubmit =
    totalItems > 0 && !!reqDocNo && !!docDate && !!selectedWarehouse && !!selectedLocation;

  // Workflow stages (Odoo-style status bar)
  const stages: Array<{ id: string; label: string }> = [
    { id: "draft", label: "ສະບັບຮ່າງ" },
    { id: "saved", label: "ບັນທຶກ" },
    { id: "withdrawn", label: "ເບີກແລ້ວ" },
  ];
  const activeStageIdx = 0; // always draft on this page

  return (
    <div className="min-h-screen bg-[var(--theme-page)] text-[var(--theme-text)]">
      {/* Top toolbar — back + breadcrumb + actions */}
      <header className="sticky top-0 z-30 border-b border-[var(--theme-border-subtle)] bg-white">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center gap-3 px-4 py-2.5">
          <button
            onClick={handleBack}
            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[12px] text-[var(--theme-text-soft)] transition hover:bg-[var(--theme-bg-muted)] hover:text-[var(--theme-text)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            ກັບຄືນ
          </button>
          <nav className="flex items-center gap-1.5 text-[11px] text-[var(--theme-text-mute)]">
            <span>BOQ</span>
            <span className="text-[var(--theme-border-strong)]">/</span>
            <span className="font-mono text-[var(--theme-text-soft)]">
              {docNo}
            </span>
            <span className="text-[var(--theme-border-strong)]">/</span>
            <span className="text-[var(--theme-text)]">ສ້າງໃບຂໍເບີກ</span>
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={handleBack}
              disabled={saving}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--theme-border-subtle)] bg-white px-3 text-[11px] font-semibold text-[var(--theme-text-soft)] transition hover:bg-[var(--theme-bg-muted)] disabled:opacity-50"
            >
              ຍົກເລີກ
            </button>
            <button
              onClick={submit}
              disabled={!canSubmit || saving}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--theme-primary)] px-3 text-[11px] font-semibold text-white transition hover:bg-[var(--theme-primary-strong)] disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              ບັນທຶກ
            </button>
            <button
              onClick={submitAndPrint}
              disabled={!canSubmit || saving}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--theme-accent)] px-3 text-[11px] font-semibold text-white transition hover:bg-[var(--theme-accent-strong)] disabled:opacity-50"
            >
              <Printer className="h-3.5 w-3.5" />
              ບັນທຶກ & ພິມ
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1480px] px-4 py-4 space-y-3">
        {/* Status bar — Odoo-style workflow stepper */}
        <div className="flex items-center gap-2 rounded-md border border-[var(--theme-border-subtle)] bg-white px-3 py-2 text-[12px]">
          {stages.map((stage, idx) => {
            const isPast = idx < activeStageIdx;
            const isCurrent = idx === activeStageIdx;
            return (
              <React.Fragment key={stage.id}>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${
                    isCurrent
                      ? "bg-[var(--theme-primary)] text-white"
                      : isPast
                        ? "text-[var(--theme-primary)]"
                        : "text-[var(--theme-text-mute)]"
                  }`}
                >
                  {isPast && <Check className="h-3 w-3" />}
                  {stage.label}
                </span>
                {idx < stages.length - 1 && (
                  <span className="text-[var(--theme-border-strong)]">›</span>
                )}
              </React.Fragment>
            );
          })}
          <span className="ml-auto inline-flex items-center gap-3 text-[11px] text-[var(--theme-text-mute)]">
            <span>
              <span className="font-semibold text-[var(--theme-text)] tabular-nums">
                {totalItems}
              </span>{" "}
              ລາຍການ
            </span>
            <span className="text-[var(--theme-border-strong)]">·</span>
            <span>
              <span className="font-semibold text-[var(--theme-text)] tabular-nums">
                {fmtNum(totalQty)}
              </span>{" "}
              ຈຳນວນ
            </span>
            {balanceLoading && (
              <span className="inline-flex items-center gap-1">
                <RotateCw className="h-3 w-3 animate-spin" />
                ດຶງ stock
              </span>
            )}
          </span>
        </div>

        {/* Form sheet — Odoo style */}
        <div className="overflow-hidden rounded-md border border-[var(--theme-border-subtle)] bg-white shadow-sm">
          {/* Form header */}
          <div className="border-b border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)]/50 px-5 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text-mute)]">
              ໃບຂໍເບີກອຸປະກອນ
            </div>
            <h1 className="mt-1 font-mono text-[18px] font-bold text-[var(--theme-text)]">
              {reqDocNo || (
                <span className="text-[var(--theme-text-mute)]">
                  ກົດ Reload ເພື່ອດຶງເລກໃໝ່
                </span>
              )}
            </h1>
          </div>

          {loading ? (
            <div className="flex h-40 items-center justify-center text-[var(--theme-text-mute)]">
              <RotateCw className="h-5 w-5 animate-spin mr-2" />
              ກຳລັງໂຫຼດ BOQ...
            </div>
          ) : (
            <>
              {/* Form fields — 2 column grid */}
              <div className="grid gap-x-6 gap-y-3 px-5 py-4 md:grid-cols-2">
                <Field label="ເລກທີເອກະສານ">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={reqDocNo}
                      readOnly
                      placeholder="ກົດ Reload"
                      className="flex-1 rounded-md border border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] px-2 py-1.5 font-mono text-[12px] text-[var(--theme-text)]"
                    />
                    <button
                      onClick={fetchDocNo}
                      disabled={docNoLoading || saving}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--theme-border-subtle)] bg-white px-2 text-[10px] font-semibold text-[var(--theme-text-soft)] transition hover:bg-[var(--theme-bg-muted)] disabled:opacity-50"
                    >
                      <RotateCw
                        className={`h-3 w-3 ${docNoLoading ? "animate-spin" : ""}`}
                      />
                      Reload
                    </button>
                  </div>
                </Field>

                <Field label="ວັນທີ">
                  <input
                    type="date"
                    value={docDate}
                    onChange={(e) => setDocDate(e.target.value)}
                    disabled={saving}
                    className="w-full rounded-md border border-[var(--theme-border-subtle)] bg-white px-2 py-1.5 text-[12px] outline-none focus:border-[var(--theme-primary-soft)]"
                  />
                </Field>

                <Field label="ສາງ">
                  <SelectField
                    value={selectedWarehouse}
                    onChange={setSelectedWarehouse}
                    disabled={saving}
                    placeholder="— ເລືອກສາງ —"
                  >
                    {warehouses.map((w: any) => (
                      <option key={w.code} value={w.code}>
                        {w.code}
                        {w.name_1 ? ` — ${w.name_1}` : ""}
                      </option>
                    ))}
                  </SelectField>
                </Field>

                <Field label="ສະຖານທີ່ຈັດເກັບ">
                  <SelectField
                    value={selectedLocation}
                    onChange={setSelectedLocation}
                    disabled={!selectedWarehouse || saving}
                    placeholder={
                      selectedWarehouse
                        ? "— ເລືອກສະຖານທີ່ —"
                        : "ກະລຸນາເລືອກສາງກ່ອນ"
                    }
                  >
                    {locations.map((l: any) => (
                      <option key={l.code} value={l.code}>
                        {l.code}
                        {l.name_1 ? ` — ${l.name_1}` : ""}
                      </option>
                    ))}
                  </SelectField>
                </Field>

                <div className="md:col-span-2">
                  <Field label="ໝາຍເຫດ">
                    <input
                      type="text"
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                      disabled={saving}
                      placeholder="ໝາຍເຫດ..."
                      className="w-full rounded-md border border-[var(--theme-border-subtle)] bg-white px-2 py-1.5 text-[12px] outline-none focus:border-[var(--theme-primary-soft)]"
                    />
                  </Field>
                </div>
              </div>

              {/* Selected items section + open-modal button */}
              <div className="border-t border-[var(--theme-border-subtle)]">
                <div className="flex items-center gap-2 border-b border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)]/50 px-5 py-2">
                  <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text-soft)]">
                    ລາຍການທີ່ເລືອກ
                  </h2>
                  <span className="rounded bg-white px-1.5 py-px text-[10px] font-semibold tabular-nums text-[var(--theme-text-mute)] ring-1 ring-[var(--theme-border-subtle)]">
                    {totalItems} / {rows.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setItemsModalOpen(true)}
                    disabled={rows.length === 0}
                    className="ml-auto inline-flex h-7 items-center gap-1 rounded-md bg-[var(--theme-primary)] px-3 text-[11px] font-semibold text-white transition hover:bg-[var(--theme-primary-strong)] disabled:opacity-50"
                  >
                    <Package className="h-3 w-3" />
                    ເລືອກລາຍການ
                  </button>
                </div>

                {totalItems === 0 ? (
                  <div className="flex items-center gap-2 px-5 py-6 text-[11px] text-[var(--theme-text-mute)]">
                    <Package className="h-4 w-4 opacity-50" />
                    {rows.length === 0
                      ? "ບໍ່ມີລາຍການທີ່ຄົງເຫຼືອໃນ BOQ ນີ້"
                      : 'ຍັງບໍ່ໄດ້ເລືອກລາຍການ — ກົດ "ເລືອກລາຍການ" ເພື່ອເພີ່ມ'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-[var(--theme-border-subtle)] bg-white text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text-mute)]">
                          <th className="px-4 py-2 text-left">#</th>
                          <th className="px-4 py-2 text-left">ລະຫັດ</th>
                          <th className="px-4 py-2 text-left">ລາຍການ</th>
                          <th className="px-4 py-2 text-left">ໜ່ວຍ</th>
                          <th className="px-4 py-2 text-right">ຂໍເບີກ</th>
                          <th className="px-4 py-2 w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--theme-border-subtle)]">
                        {rows
                          .filter((r) => Number(r.qty) > 0)
                          .map((r) => {
                            const idx = rows.findIndex(
                              (x) => x.item_code === r.item_code,
                            );
                            return (
                              <tr
                                key={r.item_code}
                                className="text-[12px] hover:bg-[var(--theme-bg-muted)]/40"
                              >
                                <td className="whitespace-nowrap px-4 py-1.5 font-mono text-[10px] text-[var(--theme-text-mute)]">
                                  {String(idx + 1).padStart(2, "0")}
                                </td>
                                <td className="whitespace-nowrap px-4 py-1.5 font-mono text-[11px] text-[var(--theme-text-soft)]">
                                  {r.item_code}
                                </td>
                                <td className="px-4 py-1.5 text-[var(--theme-text)]">
                                  {r.item_name}
                                </td>
                                <td className="whitespace-nowrap px-4 py-1.5 text-[10px] text-[var(--theme-text-mute)]">
                                  {r.unit_code}
                                </td>
                                <td className="whitespace-nowrap px-4 py-1.5 text-right font-mono text-[12px] font-semibold tabular-nums text-[var(--theme-text)]">
                                  {fmtNum(r.qty)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-1.5 text-right">
                                  <button
                                    onClick={() => changeQty(idx, "0")}
                                    title="ລົບອອກ"
                                    className="flex h-6 w-6 items-center justify-center rounded text-[var(--theme-text-mute)] transition hover:bg-rose-50 hover:text-rose-600"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Items picker modal */}
      {itemsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-8"
          onClick={() => setItemsModalOpen(false)}
        >
          <div
            className="w-full max-w-5xl overflow-hidden rounded-lg border border-[var(--theme-border-subtle)] bg-white shadow-[var(--theme-shadow-lg)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--theme-border-subtle)] px-4 py-2.5">
              <div className="min-w-0">
                <h3 className="text-[14px] font-semibold text-[var(--theme-text)]">
                  ເລືອກລາຍການອຸປະກອນ
                </h3>
                <p className="text-[10px] text-[var(--theme-text-mute)]">
                  ປ້ອນຈຳນວນທີ່ຕ້ອງການແລ້ວກົດ "ສຳເລັດ"
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-[200px] items-center gap-2 rounded-md border border-[var(--theme-border-subtle)] bg-white px-2">
                  <Search className="h-3 w-3 text-[var(--theme-text-mute)]" />
                  <input
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder="ຄົ້ນຫາສິນຄ້າ..."
                    className="min-w-0 flex-1 bg-transparent text-[11px] outline-none"
                  />
                  {itemSearch && (
                    <button
                      onClick={() => setItemSearch("")}
                      className="text-[var(--theme-text-mute)] hover:text-[var(--theme-text)]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setItemsModalOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded text-[var(--theme-text-mute)] hover:bg-[var(--theme-bg-muted)] hover:text-[var(--theme-text)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[70vh] overflow-auto">
              {filteredRows.length === 0 ? (
                <div className="flex items-center gap-2 px-5 py-6 text-[11px] text-[var(--theme-text-mute)]">
                  <Package className="h-4 w-4 opacity-50" />
                  {rows.length === 0
                    ? "ບໍ່ມີລາຍການທີ່ຄົງເຫຼືອໃນ BOQ ນີ້"
                    : "ບໍ່ພົບລາຍການທີ່ຄົ້ນຫາ"}
                </div>
              ) : (
                <table className="min-w-full">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-[var(--theme-border-subtle)] text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text-mute)]">
                      <th className="px-4 py-2 text-left">#</th>
                      <th className="px-4 py-2 text-left">ລະຫັດ</th>
                      <th className="px-4 py-2 text-left">ລາຍການ</th>
                      <th className="px-4 py-2 text-left">ໜ່ວຍ</th>
                      <th className="px-4 py-2 text-right">BOQ</th>
                      <th className="px-4 py-2 text-right">ຄົງເຫຼືອ</th>
                      <th className="px-4 py-2 text-right">ໃນສາງ</th>
                      <th className="px-4 py-2 text-right">ຂໍເບີກ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--theme-border-subtle)]">
                    {filteredRows.map((r) => {
                      const idx = rows.findIndex(
                        (x) => x.item_code === r.item_code,
                      );
                      const isSelected = Number(r.qty) > 0;
                      const hasLoc =
                        !!selectedWarehouse && !!selectedLocation;
                      const stock = hasLoc ? r.stock_location : r.stock_total;
                      const stockOut = stock === 0;
                      const stockShort =
                        stock !== null && stock > 0 && stock < r.boq_balance;
                      return (
                        <tr
                          key={r.item_code}
                          className={`text-[12px] transition ${
                            isSelected
                              ? "bg-[var(--theme-primary-tint)]/40"
                              : "hover:bg-[var(--theme-bg-muted)]/40"
                          }`}
                        >
                          <td className="whitespace-nowrap px-4 py-1.5 font-mono text-[10px] text-[var(--theme-text-mute)]">
                            {String(idx + 1).padStart(2, "0")}
                          </td>
                          <td className="whitespace-nowrap px-4 py-1.5 font-mono text-[11px] text-[var(--theme-text-soft)]">
                            {r.item_code}
                          </td>
                          <td className="px-4 py-1.5 text-[var(--theme-text)]">
                            {r.item_name}
                          </td>
                          <td className="whitespace-nowrap px-4 py-1.5 text-[10px] text-[var(--theme-text-mute)]">
                            {r.unit_code}
                          </td>
                          <td className="whitespace-nowrap px-4 py-1.5 text-right font-mono tabular-nums">
                            {fmtNum(r.boq_qty)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-1.5 text-right font-mono tabular-nums text-[var(--theme-text-soft)]">
                            {fmtNum(r.boq_balance)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-1.5 text-right">
                            <span
                              className={`font-mono tabular-nums ${
                                stockOut
                                  ? "text-rose-700 font-semibold"
                                  : stockShort
                                    ? "text-amber-700"
                                    : "text-[var(--theme-text-soft)]"
                              }`}
                            >
                              {stock === null ? "—" : fmtNum(stock)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-1.5 text-right">
                            <input
                              type="number"
                              min={0}
                              max={Number(r.balance || r.boq_balance || 0)}
                              value={r.qty}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => changeQty(idx, e.target.value)}
                              className={`w-20 rounded border px-2 py-0.5 text-right font-mono text-[11px] tabular-nums outline-none transition ${
                                isSelected
                                  ? "border-[var(--theme-primary-soft)] bg-white focus:border-[var(--theme-primary)]"
                                  : "border-[var(--theme-border-subtle)] bg-white focus:border-[var(--theme-primary-soft)]"
                              }`}
                            />
                            {stock !== null && Number(r.qty) > stock && (
                              <div className="mt-0.5 text-[9px] text-amber-700">
                                ⚠ ເກີນ stock ({fmtNum(stock)})
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] p-3">
              <span className="text-[11px] text-[var(--theme-text-mute)]">
                ເລືອກ <span className="font-semibold tabular-nums text-[var(--theme-text)]">{totalItems}</span> ລາຍ ·{" "}
                <span className="font-semibold tabular-nums text-[var(--theme-text)]">{fmtNum(totalQty)}</span> ຈຳນວນ
              </span>
              <button
                onClick={() => setItemsModalOpen(false)}
                className="rounded-md bg-[var(--theme-primary)] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[var(--theme-primary-strong)]"
              >
                ສຳເລັດ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text-mute)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function SelectField({
  value,
  onChange,
  disabled,
  placeholder,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="block w-full appearance-none rounded-md border border-[var(--theme-border-subtle)] bg-white px-2 py-1.5 pr-7 text-[12px] outline-none focus:border-[var(--theme-primary-soft)] disabled:bg-[var(--theme-bg-muted)] disabled:text-[var(--theme-text-mute)]"
      >
        <option value="">{placeholder || "—"}</option>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--theme-text-mute)]" />
    </div>
  );
}

export default function Page() {
  return (
    <AuthGuard roles={["service_admin", "service_manager", "head_technician"]}>
      <BoqRequestPage />
    </AuthGuard>
  );
}
