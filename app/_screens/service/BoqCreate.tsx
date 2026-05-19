// src/pages/boq/ProductTable.jsx
"use client";

import { useParams,useRouter } from "next/navigation";
import React, { useState, useRef, useEffect } from "react";
import {
  Plus,
  Trash2,
  ChevronDown,
  Save,
  RotateCcw,
  Upload,
  FileDown,
  FileSpreadsheet,
  Package,
} from "lucide-react";
import * as XLSX from "xlsx";

function _getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}


const ProductTable = () => {
  const { sml_code, id, contract_no } = useParams();
  const router = useRouter();
  const decodeParam = (value) => {
    try {
      return decodeURIComponent(String(value || ""));
    } catch {
      return String(value || "");
    }
  };
  const customerCode = decodeParam(sml_code);
  const projectId = decodeParam(id);
  const contractNo = decodeParam(contract_no);

  // ผลลัพธ์การค้นหาสินค้าจาก API
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearchCache, setProductSearchCache] = useState({});

  useEffect(() => {
    fetchProducts("");
    // eslint-disable-next-line
  }, []);

  // แถวในตาราง
  const [tableRows, setTableRows] = useState([
    {
      id: Date.now(),
      productId: "",
      productName: "",
      unit: "",
      quantity: 0,
    },
  ]);

  // เก็บรายการที่บันทึกแล้ว (ใช้แสดงสถานะเท่านั้น)
  const [savedData, setSavedData] = useState([]);
  const [saving, setSaving] = useState(false);

  // dropdown search state
  const [searchTerms, setSearchTerms] = useState({});
  const [openDropdowns, setOpenDropdowns] = useState({});
  const dropdownRefs = useRef({});

  // Excel import
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);

  // ปิด dropdown เมื่อคลิกนอก
  useEffect(() => {
    const handleClickOutside = (event) => {
      Object.keys(openDropdowns).forEach((rowId) => {
        if (
          openDropdowns[rowId] &&
          dropdownRefs.current[rowId] &&
          !dropdownRefs.current[rowId].contains(event.target)
        ) {
          setOpenDropdowns((prev) => ({ ...prev, [rowId]: false }));
        }
      });
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openDropdowns]);

  // เพิ่มแถวใหม่
  const addRow = () => {
    const newRowId = Date.now();
    const newRow = {
      id: newRowId,
      productId: "",
      productName: "",
      unit: "",
      quantity: 0,
    };
    setTableRows((prev) => [...prev, newRow]);
    setSearchTerms((prev) => ({ ...prev, [newRowId]: "" }));
  };

  // ลบแถว
  const removeRow = (rowId) => {
    if (tableRows.length > 1) {
      setTableRows((prev) => prev.filter((row) => row.id !== rowId));
      setSearchTerms((prev) => {
        const next = { ...prev };
        delete next[rowId];
        return next;
      });
      setOpenDropdowns((prev) => {
        const next = { ...prev };
        delete next[rowId];
        return next;
      });
    }
  };

  // ดึงสินค้าเข้าแถวจากผลค้นหา
  const updateProduct = (rowId, product) => {
    setTableRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              productId: product.code,
              productName: product.name_1,
              unit: product.unit || product.unit_cost || "",
              quantity: row.quantity || 0,
            }
          : row
      )
    );
    setSearchTerms((prev) => ({ ...prev, [rowId]: product.code }));
    setOpenDropdowns((prev) => ({ ...prev, [rowId]: false }));
  };

  // ดึงสินค้า (ค้นหา)
  const fetchProducts = async (searchTerm) => {
    setLoadingProducts(true);
    try {
      if (productSearchCache[searchTerm]) {
        setProducts(productSearchCache[searchTerm]);
        setLoadingProducts(false);
        return;
      }
      const res = await fetch(`/api/inventory?search=${encodeURIComponent(searchTerm)}`, { headers: _getAuthHeaders() }
      ).then(r => r.json());
      const result = res;
      if (result.success) {
        setProducts(Array.isArray(result.data) ? result.data : []);
        setProductSearchCache((prev) => ({
          ...prev,
          [searchTerm]: Array.isArray(result.data) ? result.data : [],
        }));
      } else {
        setProducts([]);
      }
    } catch (e) {
      setProducts([]);
    }
    setLoadingProducts(false);
  };

  // filter ออกสินค้าใน dropdown ที่ถูกเลือกไปแล้ว
  const selectedProductIds = tableRows
    .map((row) => row.productId)
    .filter(Boolean);

  const filterProducts = (currentRowProductId = null) => {
    return products.filter((product) => {
      if (!selectedProductIds.includes(product.code)) return true;
      return product.code === currentRowProductId;
    });
  };

  const updateSearchTerm = (rowId, term) => {
    setSearchTerms((prev) => ({ ...prev, [rowId]: term }));
    setOpenDropdowns((prev) => ({ ...prev, [rowId]: true }));
    fetchProducts(term);
  };

  const toggleDropdown = (rowId) => {
    setOpenDropdowns((prev) => ({ ...prev, [rowId]: !prev[rowId] }));
  };

  // ปิด dropdown เมื่อ scroll / resize
  useEffect(() => {
    const handleScroll = () => setOpenDropdowns({});
    const handleResize = () => setOpenDropdowns({});
    window.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // update qty
  const updateQuantity = (rowId, quantity) => {
    setTableRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? { ...row, quantity: parseInt(quantity, 10) || 0 }
          : row
      )
    );
  };

  // วันที่ปัจจุบัน dd-MM-yyyy
  const today = new Date();
  const pad = (n) => n.toString().padStart(2, "0");
  const dateStr = `${pad(today.getDate())}-${pad(
    today.getMonth() + 1
  )}-${today.getFullYear()}`;

  // username
  let user = "";
  try {
    const userObj = JSON.parse(localStorage.getItem("user"));
    user = userObj?.username || "";
  } catch {
    user = "";
  }

  // ===== Excel Import =====
  const handleClickImport = () => {
    if (fileInputRef.current) fileInputRef.current.value = null;
    fileInputRef.current?.click();
  };

  const readFileAsArrayBuffer = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
      reader.onabort = () => reject(new Error("ยกเลิกการอ่านไฟล์"));
      reader.onload = () => resolve(reader.result);
      reader.readAsArrayBuffer(file);
    });
  };

  const fetchProductByCode = async (code) => {
    try {
      const res = await fetch(`/api/inventory?search=${encodeURIComponent(code)}`, { headers: _getAuthHeaders() }
      ).then(r => r.json());
      const data = res?.data || [];
      return data.find((p) => p.code === code) || null;
    } catch {
      return null;
    }
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!/\.xlsx?$/.test(file.name.toLowerCase())) {
      alert("กรุณาเลือกไฟล์ Excel (.xlsx หรือ .xls)");
      return;
    }

    setImporting(true);
    try {
      const buffer = await readFileAsArrayBuffer(file);
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });

      if (!rows.length) {
        alert("ไม่พบข้อมูลในชีตแรกของไฟล์");
        setImporting(false);
        return;
      }

      const norm = (s) => String(s || "").trim().toLowerCase();
      const pick = (row, keys) => {
        for (const k of keys) {
          const key = Object.keys(row).find((h) => norm(h) === norm(k));
          if (key) return row[key];
        }
        return null;
      };

      // รวมตาม item_code
      const wanted = {};
      const excelRowMap = {};
      for (const row of rows) {
        const code = String(
          pick(row, ["item_code", "code", "รหัสสินค้า"] || "")
        ).trim();
        const qtyRaw = pick(row, ["qty", "quantity", "จำนวน"]);
        const qty = parseInt(qtyRaw, 10);
        if (!code || !Number.isFinite(qty) || qty <= 0) continue;
        wanted[code] = (wanted[code] || 0) + qty;
        excelRowMap[code] = row;
      }

      const codes = Object.keys(wanted);
      if (!codes.length) {
        alert("ไม่พบข้อมูลที่ถูกต้อง (ต้องมี item_code และ qty > 0)");
        setImporting(false);
        return;
      }

      const productMap = {};
      await Promise.all(
        codes.map(async (code) => {
          const existing = tableRows.find((r) => r.productId === code);
          if (existing && existing.productName) {
            productMap[code] = {
              code,
              name_1: existing.productName,
              unit: existing.unit || "",
              unit_cost: existing.unit || "",
            };
            return;
          }
          const prod = await fetchProductByCode(code);
          if (prod) productMap[code] = prod;
        })
      );

      setTableRows((prev) => {
        const next = [...prev];

        const indexByCode = {};
        next.forEach((r, idx) => {
          if (r.productId) indexByCode[r.productId] = idx;
        });

        for (const code of codes) {
          const prod = productMap[code];
          const qtyToAdd = wanted[code];
          const excelRow = excelRowMap[code];

          if (!prod) {
            if (indexByCode[code] != null) {
              const idx = indexByCode[code];
              next[idx] = {
                ...next[idx],
                quantity:
                  (parseInt(next[idx].quantity, 10) || 0) + qtyToAdd,
              };
            } else {
              const newId = Date.now() + Math.random();
              next.push({
                id: newId,
                productId: code,
                productName: excelRow.item_name || "",
                unit: excelRow.unit_code || "",
                quantity: qtyToAdd,
              });
            }
            continue;
          }

          if (indexByCode[code] != null) {
            const idx = indexByCode[code];
            next[idx] = {
              ...next[idx],
              quantity:
                (parseInt(next[idx].quantity, 10) || 0) + qtyToAdd,
            };
          } else {
            const newId = Date.now() + Math.random();
            next.push({
              id: newId,
              productId: prod.code,
              productName: prod.name_1,
              unit: prod.unit || prod.unit_cost || "",
              quantity: qtyToAdd,
            });
          }
        }

        return next;
      });

      alert(`นำเข้าจาก Excel สำเร็จ: ${codes.length} รหัส`);
    } catch (err) {
      console.error(err);
      alert(`นำเข้าไม่สำเร็จ: ${err.message || err}`);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const rows = [
      {
        item_code: "140601-0740",
        item_name: "ທ່ອ",
        qty: 10,
        unit_code: "ອັນ",
      },
      {
        item_code: "140601-0741",
        item_name: "ກອງ",
        qty: 5,
        unit_code: "ອັນ",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "BOQ_Import_Template.xlsx");
  };

  // ===== Save / Reset =====
  const saveData = async () => {
    const validRows = tableRows.filter(
      (row) => row.productId && row.productName && row.quantity > 0
    );

    if (validRows.length === 0) {
      alert("ກະລຸນາເພີ່ມຂໍ້ມູນສິນຄ້າກ່ອນບັນທຶກ");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/boq/save", {
      method: "POST",
      headers: { "Content-Type": "application/json", ..._getAuthHeaders() },
      body: JSON.stringify({
        cust_code: customerCode,
        doc_date: dateStr,
        project_id: projectId,
        username: user,
        contract_no: contractNo,
        items: validRows,
      }),
    }).then(r => r.json());
      if (res && res.success) {
        setSavedData([...validRows]);
        alert(
          `ບັນທຶກຂໍ້ມູນສຳເລັດ!\n${res.message || ""}`
        );
        router.back();
      } else {
        alert(
          res && res.message
            ? res.message
            : "ບັນທຶກບໍສຳເລັດ"
        );
      }
    } catch (e) {
      alert(
        "ບັນທຶກບໍສຳເລັດ: " +
          (e?.message || e.message)
      );
    } finally {
      setSaving(false);
    }
  };

  const resetData = () => {
    router.back();
  };

  const totalQty = tableRows.reduce(
    (sum, row) => sum + (parseInt(row.quantity, 10) || 0),
    0
  );
  const selectedItems = tableRows.filter((row) => row.productId).length;
  const canSave = selectedItems > 0 && totalQty > 0 && !saving;

  return (
    <>
      <div className="min-h-screen bg-[#f4f5f7] text-slate-900">
        {importing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
            <div className="flex items-center gap-3 rounded-lg bg-white px-6 py-5 shadow-[var(--theme-shadow-lg)]">
              <span className="w-6 h-6 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />
              <div className="text-sm font-medium text-slate-800">ກຳລັງນຳເຂົ້າ Excel...</div>
            </div>
          </div>
        )}
        <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col px-3 py-3 md:px-5 md:py-4">
          <header className="sticky top-0 z-20 -mx-3 border-b border-[var(--theme-border-subtle)] bg-[#f4f5f7]/95 px-3 pb-3 pt-1 backdrop-blur md:-mx-5 md:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <FileSpreadsheet className="h-4 w-4 text-[var(--theme-primary)]" />
                  BOQ Items
                </div>
                <h1 className="truncate text-[22px] font-bold leading-tight text-slate-950">
                  ອອກ BOQ ວັດສະດຸ
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>ວັນທີ: {dateStr}</span>
                  {user && <span>ຜູ້ໃຊ້: {user}</span>}
                  {projectId && <span>ໂຄງການ: {projectId}</span>}
                  {customerCode && <span>ລູກຄ້າ: {customerCode}</span>}
                  {contractNo && <span>ສັນຍາ: {contractNo}</span>}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                <button
                  onClick={resetData}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-[var(--theme-bg-muted)]"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>ກັບຄືນ</span>
                </button>
                <button
                  onClick={downloadTemplate}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-[var(--theme-bg-muted)]"
                  title="ດາວໂຫຼດໄຟລ໌ຕົວຢ່າງ Excel"
                >
                  <FileDown className="w-4 h-4" />
                  <span>ເທມເພລດ</span>
                </button>
                <button
                  onClick={handleClickImport}
                  disabled={importing}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--theme-primary)] bg-white px-3 text-xs font-semibold text-[var(--theme-primary)] shadow-sm hover:bg-[var(--theme-primary-tint)] disabled:opacity-60"
                  title="ນຳເຂົ້າຈາກ Excel"
                >
                  <Upload className="w-4 h-4" />
                  <span>{importing ? "ກຳລັງນຳເຂົ້າ..." : "ນຳເຂົ້າ Excel"}</span>
                </button>
                <button
                  onClick={saveData}
                  disabled={!canSave}
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--theme-primary)] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[var(--theme-primary-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{saving ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleImportExcel}
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
              <div className="rounded-md border border-[var(--theme-border-subtle)] bg-white px-3 py-2 shadow-sm">
                <div className="text-[10px] font-semibold uppercase text-[var(--theme-text-mute)]">Rows</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{tableRows.length}</div>
              </div>
              <div className="rounded-md border border-[var(--theme-border-subtle)] bg-white px-3 py-2 shadow-sm">
                <div className="text-[10px] font-semibold uppercase text-[var(--theme-text-mute)]">Selected</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{selectedItems}</div>
              </div>
              <div className="rounded-md border border-[var(--theme-border-subtle)] bg-white px-3 py-2 shadow-sm">
                <div className="text-[10px] font-semibold uppercase text-[var(--theme-text-mute)]">Total Qty</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{totalQty.toLocaleString()}</div>
              </div>
              <div className="rounded-md border border-[var(--theme-border-subtle)] bg-white px-3 py-2 shadow-sm">
                <div className="text-[10px] font-semibold uppercase text-[var(--theme-text-mute)]">Saved</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{savedData.length}</div>
              </div>
              {savedData.length > 0 && (
                <div className="col-span-2 text-xs text-emerald-600 md:col-span-4">
                  ບັນທຶກແລ້ວ {savedData.length} ລາຍການ
                </div>
              )}
            </div>
          </header>

          <main className="min-h-0 flex-1 py-4">
            <div className="overflow-hidden rounded-md border border-[var(--theme-border-subtle)] bg-white shadow-sm">
              <div className="flex flex-col gap-2 border-b border-[var(--theme-border-subtle)] bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <Package className="h-4 w-4 text-[var(--theme-primary)]" />
                    ລາຍການວັດສະດຸ
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    ເລືອກລະຫັດສິນຄ້າ, ກວດຫົວໜ່ວຍ ແລະກຳນົດຈຳນວນ
                  </div>
                </div>
                <button
                  onClick={addRow}
                  className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-[var(--theme-bg-muted)]"
                >
                  <Plus className="w-4 h-4" />
                  <span>ເພີ່ມລາຍການ</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse text-xs">
                  <thead className="border-b border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)]">
                  <tr>
                    <th className="w-14 border-r border-[var(--theme-border-subtle)] px-3 py-3 text-left font-semibold text-slate-600">
                      #
                    </th>
                    <th className="w-[280px] border-r border-[var(--theme-border-subtle)] px-3 py-3 text-left font-semibold text-slate-600">
                      ລະຫັດສິນຄ້າ
                    </th>
                    <th className="border-r border-[var(--theme-border-subtle)] px-3 py-3 text-left font-semibold text-slate-600">
                      ຊື່ສິນຄ້າ
                    </th>
                    <th className="w-32 border-r border-[var(--theme-border-subtle)] px-3 py-3 text-left font-semibold text-slate-600">
                      ຫົວໜ່ວຍ
                    </th>
                    <th className="w-36 border-r border-[var(--theme-border-subtle)] px-3 py-3 text-right font-semibold text-slate-600">
                      ຈຳນວນ
                    </th>
                    <th className="w-20 px-3 py-3 text-center font-semibold text-slate-600">
                      ຈັດການ
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {tableRows.map((row, index) => (
                    <tr
                      key={row.id}
                      className="transition-colors hover:bg-[var(--theme-bg-muted)]"
                    >
                      <td className="border-r border-[var(--theme-border-subtle)] px-3 py-3 text-center align-top text-slate-500">
                        {String(index + 1).padStart(2, "0")}
                      </td>

                      <td className="border-r border-[var(--theme-border-subtle)] px-3 py-3 align-top">
                        {row.productId ? (
                          <input
                            type="text"
                            value={row.productId}
                            readOnly
                            className="h-9 w-full rounded-md border border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] px-3 text-xs font-semibold text-slate-800"
                            placeholder="item_code"
                          />
                        ) : (
                          <div
                            className="relative"
                            ref={(el) =>
                              (dropdownRefs.current[row.id] = el)
                            }
                          >
                            <div className="relative">
                              <input
                                type="text"
                                value={searchTerms[row.id] || ""}
                                onChange={(e) =>
                                  updateSearchTerm(
                                    row.id,
                                    e.target.value
                                  )
                                }
                                onFocus={() =>
                                  setOpenDropdowns((prev) => ({
                                    ...prev,
                                    [row.id]: true,
                                  }))
                                }
                                placeholder="ຄົ້ນຫາລະຫັດສິນຄ້າ"
                                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 pr-8 text-xs text-slate-800 focus:border-[var(--theme-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary-tint)]"
                              />
                              <button
                                type="button"
                                onClick={() => toggleDropdown(row.id)}
                                className="absolute inset-y-0 right-1 flex items-center text-[var(--theme-text-mute)] hover:text-slate-600"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                            </div>

                            {openDropdowns[row.id] && (
                              <div
                                className="fixed overflow-y-auto rounded-lg border border-[var(--theme-border-subtle)] bg-white text-xs shadow-[var(--theme-shadow-lg)]"
                                style={{
                                  width: "min(520px, calc(100vw - 24px))",
                                  maxHeight: "22rem",
                                  top:
                                    (dropdownRefs.current[row.id]
                                      ?.getBoundingClientRect()
                                      .bottom || 0) + 4,
                                  left:
                                    dropdownRefs.current[row.id]
                                      ?.getBoundingClientRect().left ||
                                    0,
                                  zIndex: 9999,
                                }}
                              >
                                {loadingProducts ? (
                                  <div className="px-3 py-2 text-slate-500 text-center">
                                    ກຳລັງໂຫຼດ...
                                  </div>
                                ) : filterProducts(row.productId)
                                    .length > 0 ? (
                                  filterProducts(row.productId).map(
                                    (product) => (
                                      <button
                                        key={product.code}
                                        type="button"
                                        onClick={() =>
                                          updateProduct(
                                            row.id,
                                            product
                                          )
                                        }
                                        className="w-full px-3 py-2 text-left border-b border-[var(--theme-border-subtle)] last:border-b-0 hover:bg-[var(--theme-bg-muted)] focus:bg-[var(--theme-bg-muted)] focus:outline-none"
                                      >
                                        <div className="font-medium text-slate-900">
                                          {product.code}
                                        </div>
                                        <div className="mt-0.5 text-[11px] text-slate-600">
                                          {product.name_1} · ຫົວໜ່ວຍ:{" "}
                                          {product.unit || product.unit_cost || "-"} · ຄົງເຫຼືອ:{" "}
                                          {product.balance_qty ?? "-"}
                                        </div>
                                      </button>
                                    )
                                  )
                                ) : (
                                  <div className="px-3 py-2 text-slate-500 text-center">
                                    ບໍ່ພົບສິນຄ້າທີ່ຄົ້ນຫາ
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="border-r border-[var(--theme-border-subtle)] px-3 py-3 align-top">
                        <input
                          type="text"
                          value={row.productName}
                          readOnly
                          className="h-9 w-full rounded-md border border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] px-3 text-xs text-slate-800"
                          placeholder="ຊື່ສິນຄ້າຈະສະແດງອັດຕະໂນມັດ"
                        />
                      </td>

                      <td className="border-r border-[var(--theme-border-subtle)] px-3 py-3 align-top">
                        <input
                          type="text"
                          value={row.unit}
                          readOnly
                          className="h-9 w-full rounded-md border border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] px-3 text-xs text-slate-800"
                          placeholder="ຫົວໜ່ວຍ"
                        />
                      </td>

                      <td className="border-r border-[var(--theme-border-subtle)] px-3 py-3 align-top">
                        <input
                          type="number"
                          value={row.quantity}
                          onChange={(e) =>
                            updateQuantity(row.id, e.target.value)
                          }
                          min="0"
                          className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-right text-xs font-semibold text-slate-900 focus:border-[var(--theme-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary-tint)]"
                          placeholder="0"
                        />
                      </td>

                      <td className="px-3 py-3 text-center align-top">
                        {tableRows.length > 1 ? (
                          <button
                            onClick={() => removeRow(row.id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-red-600 hover:bg-red-50"
                            title="ລຶບລາຍການ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="inline-flex h-9 w-9" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)]">
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-right text-xs font-semibold text-slate-500">
                      ລວມຈຳນວນ
                    </td>
                    <td className="border-r border-[var(--theme-border-subtle)] px-3 py-3 text-right text-sm font-bold text-slate-900">
                      {totalQty.toLocaleString()}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
};

export default ProductTable;
