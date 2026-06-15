"use client";

/** v2 — Quotation detail (read view of one quotation + its line items). */
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileText, FolderKanban } from "lucide-react";
import { getQuotation, deleteQuotation } from "@/_actions/quotations";
import { Page, Card, Btn, SectionHeader } from "../../_components/ui";
import DocActions from "../../_components/DocActions";

const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "-";
};
const d10 = (v: unknown) => (v ? String(v).slice(0, 10) : "-");
const vatLabel = (t: unknown) => {
  const s = String(t ?? "");
  return s === "exclusive" ? "ແຍກນອກ" : s === "inclusive" ? "ລວມໃນ" : "ບໍ່ມີ (0%)";
};

export default function QuotationDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [q, setQ] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res: any = await getQuotation(String(id));
        if (alive) setQ(res && res.success !== false ? res : null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-3 text-[var(--theme-text-mute)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--theme-border-subtle)] border-t-[var(--theme-primary)]" />
        <span className="text-sm font-semibold">ກຳລັງໂຫຼດ...</span>
      </div>
    );
  }
  if (!q) {
    return <div className="px-4 py-10 text-center text-[var(--theme-text-mute)]">ບໍ່ພົບໃບສະເໜີລາຄາ</div>;
  }

  const items = Array.isArray(q.items) ? q.items : [];
  const status = String(q.status || "ລໍຖ້າອະນຸມັດ");

  return (
    <Page max="max-w-none w-full">
      {/* Back button and actions with smooth transitions */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => router.push("/v2/quotations")}
          className="group inline-flex items-center gap-2 text-xs font-bold text-[var(--theme-text-soft)] transition-colors hover:text-blue-600"
        >
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
          <span>ກັບໄປລາຍການໃບສະເໜີ</span>
        </button>
        <DocActions
          editHref={q.project_id ? `/v2/projects/${q.project_id}/quotation/new?edit=${id}` : undefined}
          onDelete={() => deleteQuotation(String(id))}
          afterDelete="/v2/quotations"
          label="ໃບສະເໜີ"
        />
      </div>

      {/* Main header banner — blue gradient */}
      <div className="mb-5 flex items-center gap-4 rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 p-5 text-white shadow-md shadow-blue-600/15">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
          <FileText size={24} />
        </div>
        <div className="min-w-0">
          <h1 className="font-mono text-xl font-extrabold leading-tight tracking-tight">{q.quotation_no || "-"}</h1>
          <p className="text-xs text-white/75 font-medium mt-0.5">
            {q.project_name || ""}{q.customer_name ? ` · ${q.customer_name}` : ""}
          </p>
        </div>
        <div className="ml-auto">
          <span className="rounded-md border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-white">{status}</span>
        </div>
      </div>

      {/* Info Grid Card */}
      <Card className="mb-5 p-5 border border-slate-200 shadow-sm rounded-2xl bg-white">
        <SectionHeader icon={<FolderKanban size={14} />} title="ຂໍ້ມູນໃບສະເໜີ" tone="neutral" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-xs sm:grid-cols-3 mt-4 border-t border-slate-100 pt-4">
          <Info label="ລູກຄ້າ" value={q.customer_name} />
          <Info label="ໂທ" value={q.customer_phone} />
          <Info label="ວັນທີ" value={d10(q.quotation_date)} />
          <Info label="ມີຜົນເຖິງ" value={d10(q.validity_date)} />
          <Info label="ປະເພດ VAT" value={vatLabel(q.tax_type)} />
          <Info label="ທີ່ຢູ່" value={q.customer_address} />
          <Info label="ໝາຍເຫດ" value={q.notes} full />
        </div>
      </Card>

      {/* Items Table Card */}
      <Card className="mb-5 overflow-hidden border border-slate-200 shadow-sm rounded-2xl bg-white">
        <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">ລາຍການ</h2>
        </div>
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-slate-400">ບໍ່ມີລາຍການ</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-xs">
              <thead>
                <tr className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3 border-b border-slate-200/60 text-left w-12">#</th>
                  <th className="px-5 py-3 border-b border-slate-200/60 text-left">ລາຍການ</th>
                  <th className="px-5 py-3 border-b border-slate-200/60 text-left w-24">ໜ່ວຍ</th>
                  <th className="px-5 py-3 border-b border-slate-200/60 text-right w-24">ຈຳນວນ</th>
                  <th className="px-5 py-3 border-b border-slate-200/60 text-right w-32">ລາຄາ</th>
                  <th className="px-5 py-3 border-b border-slate-200/60 text-right w-32">ລວມ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-5 py-3.5 text-slate-400 font-semibold">{i + 1}</td>
                    <td className="px-5 py-3.5 text-slate-800 font-bold">{it.description || it.item_name || "-"}</td>
                    <td className="px-5 py-3.5 text-slate-500 font-semibold">{it.unit || "-"}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-slate-700 font-bold">{money(it.qty)}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-slate-700 font-bold">{money(it.unit_price)}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-slate-900 font-extrabold">
                      {money(it.amount ?? (Number(it.qty) || 0) * (Number(it.unit_price) || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Bottom Summary Grid */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {q.project_id && (
            <button
              onClick={() => router.push(`/v2/projects/${q.project_id}`)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-[0.98]"
            >
              <FolderKanban size={14} /> <span>ໄປໜ້າໂຄງການ</span>
            </button>
          )}
        </div>
        <Card className="w-full max-w-sm border border-slate-200 p-5 shadow-sm rounded-2xl bg-white">
          <div className="space-y-2.5 text-xs font-bold">
            <div className="flex justify-between">
              <span className="text-slate-400">ລວມຍ່ອຍ</span>
              <span className="font-mono text-slate-800">{money(q.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">ສ່ວນຫຼຸດ</span>
              <span className="font-mono text-slate-800">{money(q.discount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">VAT</span>
              <span className="font-mono text-slate-800">{money(q.tax)}</span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm font-black text-slate-900">
            <span>ລວມທັງໝົດ</span>
            <span className="font-mono text-lg text-slate-900 font-black tracking-tight">{money(q.total_amount)}</span>
          </div>
        </Card>
      </div>
    </Page>
  );
}

function Info({ label, value, full }: { label: string; value: any; full?: boolean }) {
  return (
    <div className={full ? "col-span-2 sm:col-span-3 border-t border-slate-100/50 pt-2" : ""}>
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</div>
      <div className="text-xs font-extrabold text-slate-800 mt-0.5 leading-relaxed">{value || "-"}</div>
    </div>
  );
}
