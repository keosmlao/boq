// src/pages/print/PrintRWPJ.jsx
"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

function _getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function PrintRWPJ() {
  const { docNo } = useParams();
  const searchParams = useSearchParams();
  const auto = searchParams.get("auto") === "1";
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/requestsparepart/${encodeURIComponent(docNo)}`, { headers: _getAuthHeaders() }).then(r => r.json());
        console.log(res || null);
        setData(res || null);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [docNo]);

  useEffect(() => {
    if (auto && data) {
      setTimeout(() => window.print(), 300);
    }
  }, [auto, data]);

  if (!data) return <div style={{ padding: 32, fontSize: 18, textAlign: 'center' }}>ກຳລັງໂຫຼດ...</div>;

  return (
    <div style={{ maxWidth: '210mm', margin: '0 auto', padding: '5mm', background: '#fff', fontFamily: 'var(--font-lao), sans-serif' }}>
      <style>{`
        @media print {
          body { background: #fff !important; margin: 0; }
          @page { size: A4; margin: 0; }
          .print-container { margin: 0 !important; padding: 15mm !important; max-width: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Company Header */}
      <div style={{ textAlign: 'center', marginBottom: '10mm', borderBottom: '2px solid #2563eb', paddingBottom: '5mm' }}>
        <h1 style={{ fontSize: '24pt', fontWeight: 'bold', margin: 0, color: '#1e40af' }}>ໃບຂໍເບີກອຸປະກອນ</h1>
        <div style={{ fontSize: '14pt', color: '#64748b', marginTop: '2mm' }}>Spare Part Request Form</div>
      </div>

      {/* Document Info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5mm', marginBottom: '5mm', fontSize: '12pt' }}>
        <div>
          <div style={{ marginBottom: '2mm' }}><b>ເລກທີເອກະສານ:</b> {data.doc_no}</div>
          <div style={{ marginBottom: '2mm' }}><b>ວັນທີ:</b> {data.doc_date}</div>
          <div style={{ marginBottom: '2mm' }}><b>ຜູ້ຂໍເບີກ:</b> {data.create_name || '-'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ marginBottom: '2mm' }}><b>ສາງ:</b> [{data.wh_from}] {data.wh_name}</div>
          <div style={{ marginBottom: '2mm' }}><b>ຈຸດຈັດເກັບ:</b> [{data.location_from}] {data.location_name}</div>
        </div>
      </div>

      {/* Items Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10mm', fontSize: '11pt' }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={{ padding: '3mm', border: '1px solid #cbd5e1', textAlign: 'center', width: '10%' }}>ລຳດັບ</th>
            <th style={{ padding: '3mm', border: '1px solid #cbd5e1', textAlign: 'left', width: '15%' }}>ລະຫັດ</th>
            <th style={{ padding: '3mm', border: '1px solid #cbd5e1', textAlign: 'left', width: '45%' }}>ລາຍການ</th>
            <th style={{ padding: '3mm', border: '1px solid #cbd5e1', textAlign: 'center', width: '15%' }}>ໜ່ວຍ</th>
            <th style={{ padding: '3mm', border: '1px solid #cbd5e1', textAlign: 'right', width: '15%' }}>ຈຳນວນ</th>
          </tr>
        </thead>
        <tbody>
          {Array.isArray(data.items) && data.items.map((item, idx) => (
            <tr key={item.item_code} style={{ background: idx % 2 ? '#fff' : '#f8fafc' }}>
              <td style={{ padding: '2mm 3mm', border: '1px solid #cbd5e1', textAlign: 'center' }}>{idx + 1}</td>
              <td style={{ padding: '2mm 3mm', border: '1px solid #cbd5e1' }}>{item.item_code}</td>
              <td style={{ padding: '2mm 3mm', border: '1px solid #cbd5e1' }}>{item.item_name}</td>
              <td style={{ padding: '2mm 3mm', border: '1px solid #cbd5e1', textAlign: 'center' }}>{item.unit_code}</td>
              <td style={{ padding: '2mm 3mm', border: '1px solid #cbd5e1', textAlign: 'right' }}>{Number(item.qty).toLocaleString()}</td>
            </tr>
          ))}
          {/* Empty rows to maintain table size */}
          {Array.from({ length: Math.max(0, 10 - (data.items?.length || 0)) }).map((_, idx) => (
            <tr key={`empty-${idx}`}>
              <td style={{ padding: '2mm 3mm', border: '1px solid #cbd5e1' }}>&nbsp;</td>
              <td style={{ padding: '2mm 3mm', border: '1px solid #cbd5e1' }}></td>
              <td style={{ padding: '2mm 3mm', border: '1px solid #cbd5e1' }}></td>
              <td style={{ padding: '2mm 3mm', border: '1px solid #cbd5e1' }}></td>
              <td style={{ padding: '2mm 3mm', border: '1px solid #cbd5e1' }}></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Remark */}
      <div style={{ fontSize: '11pt', marginBottom: '10mm', padding: '3mm', border: '1px solid #cbd5e1', borderRadius: '2mm' }}>
        <b>ໝາຍເຫດ:</b> {data.remark || '-'}
      </div>

      {/* Signature Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5mm', fontSize: '11pt', textAlign: 'center' }}>
        <div>
          <div style={{ borderTop: '1px solid #000', marginTop: '15mm', paddingTop: '2mm' }}>
            ຜູ້ຂໍເບີກ<br/>
            ວັນທີ: ........./........./..........
          </div>
        </div>
        <div>
          <div style={{ borderTop: '1px solid #000', marginTop: '15mm', paddingTop: '2mm' }}>
            ຜູ້ກວດສອບ/ອະນຸມັດ<br/>
            ວັນທີ: ........./........./..........
          </div>
        </div>
        <div>
          <div style={{ borderTop: '1px solid #000', marginTop: '15mm', paddingTop: '2mm' }}>
            ຜູ້ຈ່າຍເຄື່ອງ<br/>
            ວັນທີ: ........./........./..........
          </div>
        </div>
      </div>
    </div>
  );
}
