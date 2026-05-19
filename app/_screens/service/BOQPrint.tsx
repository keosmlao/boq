// src/pages/service/BOQPrint.jsx
"use client";

import { useParams,useRouter } from "next/navigation";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useReactToPrint } from "react-to-print"; // v3
import PrintableInvoice from "./PrintableInvoice";
import { ArrowLeft, Printer, Loader2 } from "lucide-react";

function _getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}


export default function BOQPrint() {
  const { docNo } = useParams();
  const router = useRouter();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // IMPORTANT for react-to-print v3
  const contentRef = useRef(null);

  // โหลดข้อมูล BOQ สำหรับใบพิมพ์
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const resp = await fetch(`/api/boq/${encodeURIComponent(docNo)}`, { headers: _getAuthHeaders() }).then(r => r.json());
        const payload = resp ?? null;
        if (mounted) setData(payload);
      } catch (e) {
        console.error(e);
        if (mounted) setData(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [docNo]);

  // ตั้งค่า print handler (v3 ต้องระบุ contentRef)
  const handlePrint = useReactToPrint({
    contentRef,                     // ✅ สำคัญ
    documentTitle: `BOQ_${docNo}`,  // ชื่อไฟล์เมื่อ Save as PDF
    removeAfterPrint: false,        // คงหน้าไว้หลังพิมพ์
    onAfterPrint: () => {
      // จะย้อนกลับ/ปิดก็ได้ (แล้วแต่ต้องการ)
      // router.back();
    },
  });

  // เปิด dialog print อัตโนมัติหลังโหลดข้อมูลเสร็จ
  useEffect(() => {
    if (!loading && data) {
      // เว้น 0ms เพื่อให้ DOM แน่ใจว่ามี contentRef แล้ว
      const t = setTimeout(() => {
        handlePrint();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [loading, data, handlePrint]);

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-3 text-gray-600">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>ກຳລັງໂຫຼດ...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className="mb-4">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
          >
            <ArrowLeft className="w-4 h-4" /> ກັບຄືນ
          </button>
        </div>
        <div className="text-red-600">ບໍ່ພົບຂໍ້ມູນ BOQ: {docNo}</div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      {/* แถบควบคุมบนจอ (ไม่ถูกพิมพ์) */}
      <div className="mb-4 print:hidden flex items-center">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
        >
          <ArrowLeft className="w-4 h-4" /> ກັບຄືນ
        </button>
      </div>

      {/* พื้นที่ที่จะพิมพ์: ต้องผูก ref นี้ */}
      <div ref={contentRef} className="bg-white shadow print:shadow-none print:bg-white mx-auto max-w-4xl p-6">
        <PrintableInvoice data={data} docNo={docNo} />
      </div>
    </div>
  );
}
