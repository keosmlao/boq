// src/pages/boq/PrintableInvoice.jsx
"use client";

import React, { useMemo } from "react";

/**
 * Printable A4 BOQ (Lao/EN) — clean, ink-friendly
 * - A4 size with print margins
 * - Repeating header row on each printed page
 * - Avoid row breaking across pages
 * - Fixed footer with page number (Chrome)
 * - Signatory block + summary
 * - Works with Tailwind but also includes plain CSS for print reliability
 */
export default function PrintableInvoice({ data, docNo }) {
  const header = data?.header ?? {};
  const items  = Array.isArray(data?.items) ? data.items : (data?.boq_list || []);
  console.log("PrintableInvoice data:", data, docNo);
  const summary = useMemo(() => {
    const totalQty = items.reduce((s, it) => s + Number(it.boq_qty ?? it.qty ?? 0), 0);
    return { count: items.length, totalQty };
  }, [items]);

  const fmt = (n) => new Intl.NumberFormat().format(Number(n || 0));

  return (
    <div className="text-[12px] leading-relaxed text-gray-900">
      {/* Inline print styles for robustness */}
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm 12mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          thead { display: table-header-group; }   /* repeat header */
          tfoot { display: table-footer-group; }   /* fixed footer */
          .no-break { page-break-inside: avoid; }
          .section-title { font-weight: 700; }
          .footer {
            position: running(pageFooter);
          }
          .page-footer {
            display: block;
            font-size: 10px;
            color: #666;
          }
          .page-footer .page-num:after { content: counter(page); }
          .page-footer .page-count:after { content: counter(pages); }
        }
        /* On screen: A4-ish preview width */
        @media screen {
          .sheet {
            width: 210mm; min-height: 297mm; margin: 0 auto;
            background: white;
            box-shadow: 0 0 0 1px rgba(0,0,0,0.05), 0 10px 30px rgba(0,0,0,0.08);
            padding: 14mm 12mm;
          }
        }
        table.boq-table { border-collapse: collapse; width: 100%; }
        table.boq-table th, table.boq-table td {
          border: 1px solid #d1d5db; /* gray-300 */
          padding: 6px 8px;
        }
        table.boq-table th { background: #f9fafb; font-weight: 700; } /* gray-50 */
        tr.zebra:nth-child(even) td { background: #fcfcfc; }
        .muted { color: #6b7280; } /* gray-500 */
        .title { font-size: 18px; font-weight: 800; letter-spacing: .3px; }
        .subtitle { color: #4b5563; } /* gray-600 */
        .sig-line {
          border-top: 1px solid #9ca3af; /* gray-400 */
          padding-top: 6px;
          min-width: 180px;
        }
      `}</style>

      <div className="sheet">
        {/* Header */}
        <header className="flex items-start justify-between mb-4 no-break">
          <div className="flex items-start gap-3">
            {header.logoUrl && (
              <img
                src={header.logoUrl}
                alt="Logo"
                style={{ width: 48, height: 48, objectFit: "contain" }}
                className="mt-0.5"
              />
            )}
            <div>
              <div className="title">BOQ</div>
              <div className="subtitle">Bill of Quantities</div>
              {header.company_name && (
                <div className="mt-1 font-medium">{header.company_name}</div>
              )}
              {header.company_addr && (
                <div className="text-[11px] muted">{header.company_addr}</div>
              )}
            </div>
          </div>

          <div className="text-right">
            <div className="font-semibold">Doc No: {docNo || "-"}</div>
            <div>Date: {data?.doc_date || "-"}</div>
            {data?.ref_no && <div className="muted">Ref: {data.ref_no}</div>}
          </div>
        </header>

        {/* Project / Customer */}
        <section className="grid grid-cols-2 gap-4 mb-4 no-break">
          <div>
            <div className="section-title">Project / ໂຄງການ</div>
            <div>{data?.project_name || "-"}</div>
            {!!data?.project_id && (
              <div className="muted">ID: {data.project_id}</div>
            )}
            {data?.location && (
              <div className="muted">Location: {data.location}</div>
            )}
          </div>
          <div>
            <div className="section-title">Customer / ລູກຄ້າ</div>
            <div>Code: {data?.cust_code || "-"}</div>
            <div>Coordinator: {data?.coordinator || "-"}</div>
            <div>Phone: {data?.phone || "-"}</div>
          </div>
        </section>

        {/* Table */}
        <table className="boq-table">
          <thead>
            <tr>
              <th className="text-left w-30">ລະຫັດ</th>
              <th className="text-left">ລາຍການ</th>
              <th className="text-right  w-20">ຈຳນວນ</th>
              <th className="text-left  w-20">ໜ່ວຍ </th>
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? (
              items.map((it, idx) => {
                const qty = Number(it.boq_qty ?? it.qty ?? 0);
                return (
                  <tr key={idx} className="zebra no-break align-top">
                    <td>{it.item_code || "-"}</td>
                    <td style={{ wordBreak: "break-word" }}>
                      <div className="font-medium">{it.item_name || "-"}</div>
                      {it.remark && (
                        <div className="muted text-[11px] mt-0.5">
                          {it.remark}
                        </div>
                      )}
                    </td>
                    <td className="text-right">{fmt(qty)}</td>
                    <td>{it.unit_code || it.unit || "-"}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="text-center muted py-3" colSpan={4}>
                  ບໍ່ມີລາຍການ
                </td>
              </tr>
            )}
          </tbody>
          {/* Optional notes right below table body (kept outside footer for page-break control) */}
        </table>

        {/* Summary */}
        <section className="mt-3 flex items-center justify-between no-break">
          <div className="muted text-[11px]">
            Printed by system • Generated: {new Date().toLocaleString()}
          </div>
          <div className="text-right">
            <div className="font-semibold">
              ຈຳນວນລາຍການ (Items): {fmt(summary.count)}
            </div>
            <div>
              ຈຳນວນລວມ (Total Qty): <span className="font-semibold">{fmt(summary.totalQty)}</span>
            </div>
          </div>
        </section>

        {/* Remarks */}
        {(data?.remarks || data?.note) && (
          <section className="mt-3 no-break">
            <div className="section-title mb-1">ໝາຍເຫດ / Remarks</div>
            <div className="whitespace-pre-wrap">
              {data.remarks || data.note}
            </div>
          </section>
        )}

        {/* Signatures */}
        <section className="grid grid-cols-3 gap-6 mt-8 no-break">
          <div>
            <div className="sig-line"></div>
            <div className="text-[11px] mt-1">Prepared by</div>
            {data?.prepared_by && <div className="muted text-[11px]">{data.prepared_by}</div>}
          </div>
          <div>
            <div className="sig-line"></div>
            <div className="text-[11px] mt-1">Checked by</div>
            {data?.checked_by && <div className="muted text-[11px]">{data.checked_by}</div>}
          </div>
          <div>
            <div className="sig-line"></div>
            <div className="text-[11px] mt-1">Approved by</div>
            {data?.approver && <div className="muted text-[11px]">{data.approver}</div>}
          </div>
        </section>

        {/* Footer (visible in print as page footer) */}
        <footer className="mt-6">
          <div className="page-footer">
            Page <span className="page-num" /> / <span className="page-count" />
          </div>
        </footer>
      </div>
    </div>
  );
}
