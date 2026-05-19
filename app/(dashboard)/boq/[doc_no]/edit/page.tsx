// src/pages/boq/EditBOQPage.jsx
"use client";

import { useParams,useRouter } from "next/navigation";
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Trash2, Search, ChevronDown, Save, RotateCcw } from 'lucide-react';
import { getInventory } from "@/_actions/lookups";
import { getBoq } from "@/_actions/boq";

function _getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}


const EditBOQPage = () => {
  // รองรับทั้ง /boq/:doc_no/edit และ /create-boq/:sml_code/:id
  const { doc_no, sml_code, id } = useParams();
  const router = useRouter();

  // ===== Header (ข้อมูลเอกสาร) =====
  const [header, setHeader] = useState({
    doc_no: '',
    doc_date: '',
    cust_code: '',      // sml_code
    project_id: '',     // id
    project_name: '',
    user_created: '',
    coordinator: '',
    phone: '',
    approve_status: 0,
    approver: null,
  });

  // ===== Products (ค้นหาจาก API) =====
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearchCache, setProductSearchCache] = useState({});

  // ===== Table rows (สินค้าใน BOQ) =====
  const [tableRows, setTableRows] = useState([
    { id: 1, productId: '', productName: '', unit: '', quantity: 0 }
  ]);

  // ===== Saved info =====
  const [savedData, setSavedData] = useState([]);

  // ===== Dropdown search states =====
  const [searchTerms, setSearchTerms] = useState({});
  const [openDropdowns, setOpenDropdowns] = useState({});
  const dropdownRefs = useRef({});

  // ===== User + Today =====
  const pad = (n) => n.toString().padStart(2, '0');
  const today = new Date();
  const dateStrDDMMYYYY = `${pad(today.getDate())}-${pad(today.getMonth() + 1)}-${today.getFullYear()}`;
  let user = '';
  try {
    const userObj = JSON.parse(localStorage.getItem('user'));
    user = userObj?.username || '';
  } catch {
    user = '';
  }

  // ========= Load BOQ by doc_no (ถ้ามี) =========
  useEffect(() => {
    const load = async () => {
      if (!doc_no) {
        // โหมด fallback (เช่น หน้า create แบบเก่า) – เติม header เบื้องต้น
        setHeader((h) => ({
          ...h,
          doc_no: '',
          doc_date: new Date().toISOString(),
          cust_code: sml_code || '',
          project_id: id || '',
          user_created: user || '',
        }));
        return;
      }

      try {
        const res: any = await getBoq(String(doc_no));
        const d = res?.data || res || {};
        setHeader({
          doc_no: d.doc_no ?? doc_no,
          doc_date: d.doc_date ?? new Date().toISOString(),
          cust_code: d.cust_code ?? sml_code ?? '',
          project_id: d.project_id ?? id ?? '',
          project_name: d.project_name ?? '',
          user_created: d.user_created ?? user ?? '',
          coordinator: d.coordinator ?? '',
          phone: d.phone ?? '',
          approve_status: typeof d.approve_status === 'number' ? d.approve_status : 0,
          approver: d.approver ?? null,
        });

        // map รายการสินค้าที่มีอยู่เดิม -> tableRows
        const rows = Array.isArray(d.boq_list) ? d.boq_list.map((bi, idx) => ({
          id: Date.now() + idx,
          productId: bi.item_code || '',
          productName: bi.item_name || '',
          unit: bi.unit_code || '',
          quantity: Number(bi.qty) || 0,
        })) : [];

        setTableRows(rows.length ? rows : [{ id: 1, productId: '', productName: '', unit: '', quantity: 0 }]);
        // ตั้งค่า searchTerms ให้โชว์รหัสในช่อง
        const initialTerms = {};
        rows.forEach(r => { initialTerms[r.id] = r.productId; });
        setSearchTerms(initialTerms);
      } catch (e) {
        console.error(e);
        alert('ດຶງຂໍ້ມູນ BOQ ບໍ່ສໍາເລັດ');
      }
    };
    load();
    // eslint-disable-next-line
  }, [doc_no]);

  // ========= Load products =============
  const fetchProducts = async (searchTerm) => {
    setLoadingProducts(true);
    try {
      if (productSearchCache[searchTerm]) {
        setProducts(productSearchCache[searchTerm]);
        setLoadingProducts(false);
        return;
      }
      const result = await getInventory({ search: searchTerm });
      if (result.success) {
        setProducts(result);
        setProductSearchCache(prev => ({ ...prev, [searchTerm]: result }));
      } else {
        setProducts([]);
      }
    } catch {
      setProducts([]);
    }
    setLoadingProducts(false);
  };

  useEffect(() => {
    fetchProducts('');
    // eslint-disable-next-line
  }, []);

  // ========= Outside click close dropdown =========
  useEffect(() => {
    const handleClickOutside = (event) => {
      Object.keys(openDropdowns).forEach(rowId => {
        if (openDropdowns[rowId] &&
          dropdownRefs.current[rowId] &&
          !dropdownRefs.current[rowId].contains(event.target)) {
          setOpenDropdowns(prev => ({ ...prev, [rowId]: false }));
        }
      });
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdowns]);

  // ========= Scroll/resize -> close dropdowns =========
  useEffect(() => {
    const handleScroll = () => setOpenDropdowns({});
    const handleResize = () => setOpenDropdowns({});
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // ========= Selected product ids (เพื่อซ่อนสินค้าที่ถูกเลือกแล้ว) =========
  const selectedProductIds = useMemo(
    () => tableRows.map(row => row.productId).filter(Boolean),
    [tableRows]
  );

  const filterProducts = (currentRowProductId = null) => {
    return products.filter(product => {
      if (!selectedProductIds.includes(product.code)) return true;
      return product.code === currentRowProductId;
    });
  };

  // ========= Row ops =========
  const addRow = () => {
    const newRowId = Date.now();
    const newRow = { id: newRowId, productId: '', productName: '', unit: '', quantity: 0 };
    setTableRows(prev => [...prev, newRow]);
    setSearchTerms(prev => ({ ...prev, [newRowId]: '' }));
  };

  const removeRow = (rid) => {
    if (tableRows.length <= 1) return;
    setTableRows(prev => prev.filter(r => r.id !== rid));
    setSearchTerms(prev => {
      const n = { ...prev };
      delete n[rid];
      return n;
    });
    setOpenDropdowns(prev => {
      const n = { ...prev };
      delete n[rid];
      return n;
    });
  };

  const updateProduct = (rowId, product) => {
    setTableRows(prev => prev.map(row =>
      row.id === rowId
        ? {
            ...row,
            productId: product.code,
            productName: product.name_1,
            unit: product.unit_cost || '', // ถ้าต้องการหน่วยจริง อาจเปลี่ยน field เป็น unit_name
            quantity: row.quantity || 0
          }
        : row
    ));
    setSearchTerms(prev => ({ ...prev, [rowId]: product.code }));
    setOpenDropdowns(prev => ({ ...prev, [rowId]: false }));
  };

  const updateSearchTerm = (rowId, term) => {
    setSearchTerms(prev => ({ ...prev, [rowId]: term }));
    setOpenDropdowns(prev => ({ ...prev, [rowId]: true }));
    fetchProducts(term);
  };

  const toggleDropdown = (rowId) => {
    setOpenDropdowns(prev => ({ ...prev, [rowId]: !prev[rowId] }));
  };

  const updateQuantity = (rowId, quantity) => {
    setTableRows(prev => prev.map(row =>
      row.id === rowId
        ? { ...row, quantity: parseInt(quantity) || 0 }
        : row
    ));
  };

  // ========= Save (PUT /boq/:doc_no) =========
  const saveData = async () => {
    // validate
    const validRows = tableRows.filter(row =>
      row.productId && row.productName && row.quantity > 0
    );
    if (validRows.length === 0) {
      alert('ກະລຸນາເພີ່ມຂໍ້ມູນສິນຄ້າກ່ອນບັນທຶກ');
      return;
    }
    const payload = {
      doc_no: header.doc_no,
      doc_date: header.doc_date || new Date().toISOString(),
      cust_code: header.cust_code,
      project_id: header.project_id,
      username: user,
      // map เป็นรูปแบบ detail
      items: validRows.map(r => ({
        id: r.id,
        productId: r.productId,
        productName: r.productName,
        unit: r.unit,
        quantity: r.quantity
      }))
    };

    try {
      if (!header.doc_no) {
        alert('ບໍ່ພົບເລກທີ່ BOQ (doc_no)');
        return;
      }
      const res = await fetch(`/api/boq/${encodeURIComponent(header.doc_no)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ..._getAuthHeaders() },
      body: JSON.stringify(payload),
    }).then(r => r.json());
      if (res?.success) {
        setSavedData(validRows);
        alert(`ບັນທຶກສຳເລັດ! ${res.message || ''}`);
        router.back();
      } else {
        alert(res?.message || 'ບັນທຶກບໍສຳເລັດ');
      }
    } catch (e) {
      alert('ບັນທຶກບໍສຳເລັດ: ' + (e?.message || e.message));
    }
  };

  const resetData = () => router.back();

  // ========= totals =========
  const totalQty = tableRows.reduce((sum, r) => sum + (r.quantity || 0), 0);

  const isEditable = header.approve_status === 0;

  return (
    <div className="p-6 max-w-6xl mx-auto bg-white">
      {/* Header bar */}
      <div className="bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-primary-strong)] rounded-lg p-4 mb-6 shadow-[var(--theme-shadow)]">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-white">
              ✏️ {header.doc_no ? `Edit BOQ: ${header.doc_no}` : `${header.project_id || id || ''} - ລາຍການສິນຄ້າ`}
            </h1>
            <span className="text-white/80 text-sm">📅 {dateStrDDMMYYYY}</span>
            <span className="text-white/80 text-sm">👤 {header.user_created || user || '-'}</span>
            {!!header.project_name && (
              <span className="text-white/90 text-sm">📌 {header.project_name}</span>
            )}
          </div>
          <div className="flex gap-3">
            {isEditable && (
              <>
                <button
                  onClick={saveData}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white font-medium rounded-lg transition-all duration-200 backdrop-blur-sm border border-white/30"
                >
                  <Save size={18} />
                  <span className="hidden sm:inline">ບັນທຶກຂໍ້ມູນ</span>
                  <span className="sm:hidden">ບັນທຶກ</span>
                </button>
                <button
                  onClick={resetData}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white font-medium rounded-lg transition-all duration-200 backdrop-blur-sm border border-white/30"
                >
                  <RotateCcw size={18} />
                  <span className="hidden sm:inline">ກັບຄືນ/ລ້າງ</span>
                  <span className="sm:hidden">ກັບຄືນ</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status Bar */}
        <div className="mt-3 pt-3 border-t border-white/20">
          <div className="flex flex-wrap gap-4 text-white/90 text-sm">
            <span>📊 ລວມ: {tableRows.length} ລາຍການ</span>
            <span>📦 ຈຳນວນ: {totalQty} ຫົວໜ່ວຍ</span>
            {savedData.length > 0 && (
              <span className="text-green-200">✅ ບັນທຶກແລ້ວ: {savedData.length} ລາຍການ</span>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg relative">
        <table className="w-full border-collapse relative z-0">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-700">ລຳດັບ</th>
              <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-700">ລະຫັດສິນຄ້າ</th>
              <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-700">ຊື່ສິນຄ້າ</th>
              <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-700">ຫົວໜ່ວຍ</th>
              <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-700">ຈຳນວນ</th>
              <th className="border border-gray-200 px-4 py-3 text-center font-semibold text-gray-700">ການປະຕິບັດ</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, index) => (
              <tr key={row.id} className="hover:bg-gray-100 odd:bg-gray-50">
                <td className="border border-gray-200 px-4 py-3 text-center">
                  {index + 1}
                </td>
                <td className="border border-gray-200 px-4 py-3">
                  <div className="relative" ref={(el) => dropdownRefs.current[row.id] = el}>
                    <div className="relative">
                      <input
                        type="text"
                        value={searchTerms[row.id] ?? row.productId ?? ''}
                        onChange={isEditable ? (e) => updateSearchTerm(row.id, e.target.value) : undefined}
                        onFocus={isEditable ? () => setOpenDropdowns(prev => ({ ...prev, [row.id]: true })) : undefined}
                        placeholder="ປ້ອນລະຫັດສິນຄ້າ..."
                        className="w-full px-3 py-2 pr-8 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]"
                        readOnly={!isEditable}
                        disabled={!isEditable}
                      />
                      {isEditable && (
                        <button
                          type="button"
                          onClick={() => toggleDropdown(row.id)}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <ChevronDown size={16} />
                        </button>
                      )}
                    </div>

                    {isEditable && openDropdowns[row.id] && (
                      <div
                        className="fixed bg-white border border-gray-300 rounded-lg shadow-[var(--theme-shadow)] max-h-100 overflow-y-auto"
                        style={{
                          zIndex: 9999,
                          minWidth: '100px',
                          width: '500px',
                          top: dropdownRefs.current[row.id]?.getBoundingClientRect().bottom + window.scrollY + 4 || 0,
                          left: dropdownRefs.current[row.id]?.getBoundingClientRect().left + window.scrollX || 0
                        }}>
                        {loadingProducts ? (
                          <div className="px-3 py-2 text-gray-500 text-center">ກຳລັງໂຫຼດ...</div>
                        ) : filterProducts(row.productId).length > 0 ? (
                          filterProducts(row.productId).map(product => (
                            <button
                              key={product.code}
                              type="button"
                              onClick={() => updateProduct(row.id, product)}
                              className="w-full px-3 py-2 text-left border-b border-gray-100 last:border-b-0 hover:bg-[var(--theme-primary-tint)] focus:bg-[var(--theme-primary-tint)] focus:outline-none"
                            >
                              <div className="font-medium text-gray-900">{product.code}</div>
                              <div className="text-sm text-gray-600">
                                {product.name_1} (ຕົ້ນທຶນ: {product.unit_cost}, ຄົງເຫຼືອ: {product.balance_qty})
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-gray-500 text-center">ບໍ່ພົບສິນຄ້າທີ່ຄົ້ນຫາ</div>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                <td className="border border-gray-200 px-4 py-3">
                  <input
                    type="text"
                    value={row.productName}
                    readOnly
                    className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded text-gray-700"
                    placeholder="ຊື່ສິນຄ້າຈະແສດງອັດຕະໂນມັດ"
                  />
                </td>
                <td className="border border-gray-200 px-4 py-3">
                  <input
                    type="text"
                    value={row.unit}
                    readOnly
                    className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded text-gray-700"
                    placeholder="ຫົວໜ່ວຍ"
                  />
                </td>
                <td className="border border-gray-200 px-4 py-3">
                  <input
                    type="number"
                    value={row.quantity}
                    onChange={isEditable ? (e) => updateQuantity(row.id, e.target.value) : undefined}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]"
                    placeholder="0"
                    readOnly={!isEditable}
                    disabled={!isEditable}
                  />
                </td>
                <td className="border border-gray-200 px-4 py-3 text-center">
                  {isEditable && tableRows.length > 1 && (
                    <button
                      onClick={() => removeRow(row.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="ລຶບລາຍການ"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {isEditable && (
              <tr>
                <td colSpan="6" className="border border-gray-200 px-4 py-3 text-center">
                  <button
                    onClick={addRow}
                    className="flex items-center justify-center gap-2 w-full py-2 text-[var(--theme-primary)] hover:bg-[var(--theme-primary-tint)] rounded transition-colors"
                  >
                    <Plus size={20} />
                    ເພີ່ມລາຍການສິນຄ້າ
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export { EditBOQPage as default };
