/**
 * Printable quotation bill (ໃບສະເໜີລາຄາ). Chrome-free server page under the
 * (print) group; opened in a new tab from the quotation detail page. Labels are
 * kept as Lao literals — this is a formal Lao document.
 */
import { getQuotation } from "@/_actions/quotations";
import BillHead from "../../../_components/BillHead";
import PrintBar from "../../../_components/PrintBar";
import { money, d10, Info, Th, Td, TotalRow, Sign } from "../../../_components/bill-ui";

const vatLabel = (v: unknown) =>
  v === "exclusive" ? "ແຍກນອກ" : v === "inclusive" ? "ລວມໃນ" : "ບໍ່ມີ (0%)";

export default async function QuotationPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q: any = await getQuotation(id);

  if (!q || q.success === false) {
    return (
      <div className="mx-auto max-w-[794px] px-6 py-20 text-center text-sm font-semibold text-neutral-500">
        ບໍ່ພົບໃບສະເໜີລາຄາ
      </div>
    );
  }

  const items: any[] = Array.isArray(q.items) ? q.items : [];

  return (
    <>
      <PrintBar />
      {/* A4-ish sheet */}
      <div className="mx-auto my-4 max-w-[794px] bg-white p-8 shadow-sm print:my-0 print:max-w-none print:p-0 print:shadow-none">
        <BillHead
          title="ໃບສະເໜີລາຄາ"
          meta={[
            { label: "ເລກທີ", value: q.quotation_no || "-" },
            { label: "ວັນທີ", value: d10(q.quotation_date) },
            { label: "ມີຜົນເຖິງ", value: d10(q.validity_date) },
          ]}
        />

        {/* Customer + project */}
        <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-2 text-[12px]">
          <Info label="ລູກຄ້າ" value={q.customer_name} />
          <Info label="ໂຄງການ" value={q.project_name} />
          <Info label="ໂທ" value={q.customer_phone} />
          <Info label="ປະເພດ VAT" value={vatLabel(q.tax_type)} />
          <Info label="ທີ່ຢູ່" value={q.customer_address} full />
        </div>

        {/* Items */}
        <table className="mt-5 w-full border-collapse text-[11.5px]">
          <thead>
            <tr className="bg-neutral-100 text-neutral-700">
              <Th className="w-8 text-center">#</Th>
              <Th>ລາຍການ</Th>
              <Th className="w-24">ຍີ່ຫໍ້</Th>
              <Th className="w-24">ປະເພດສິນຄ້າ</Th>
              <Th className="w-14 text-center">ໜ່ວຍ</Th>
              <Th className="w-16 text-right">ຈຳນວນ</Th>
              <Th className="w-24 text-right">ລາຄາ/ໜ່ວຍ</Th>
              <Th className="w-24 text-right">ລວມ</Th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <Td colSpan={8} className="py-6 text-center text-neutral-400">ບໍ່ມີລາຍການ</Td>
              </tr>
            ) : (
              items.map((it, i) => (
                <tr key={i} className="break-inside-avoid">
                  <Td className="text-center text-neutral-500">{i + 1}</Td>
                  <Td className="font-semibold">{it.description || it.item_name || "-"}</Td>
                  <Td>{it.brand || "-"}</Td>
                  <Td>{it.category || "-"}</Td>
                  <Td className="text-center">{it.unit || "-"}</Td>
                  <Td className="text-right tabular-nums">{money(it.qty)}</Td>
                  <Td className="text-right tabular-nums">{money(it.unit_price)}</Td>
                  <Td className="text-right font-bold tabular-nums">
                    {money(it.amount ?? (Number(it.qty) || 0) * (Number(it.unit_price) || 0))}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-4 flex justify-end">
          <div className="w-64 space-y-1.5 text-[12px]">
            <TotalRow label="ລວມຍ່ອຍ" value={money(q.subtotal)} />
            <TotalRow label="ສ່ວນຫຼຸດ" value={money(q.discount)} />
            <TotalRow label="VAT" value={money(q.tax)} />
            <div className="flex items-center justify-between border-t-2 border-neutral-900 pt-2">
              <span className="text-[12px] font-black text-neutral-900">ລວມທັງໝົດ</span>
              <span className="text-base font-black tabular-nums text-neutral-900">{money(q.total_amount)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {q.notes && (
          <div className="mt-5 rounded border border-neutral-200 p-3 text-[11.5px]">
            <div className="mb-1 font-bold text-neutral-700">ໝາຍເຫດ / ເງື່ອນໄຂ</div>
            <div className="whitespace-pre-wrap leading-relaxed text-neutral-800">{q.notes}</div>
          </div>
        )}

        {/* Signatures */}
        <div className="mt-12 grid grid-cols-3 gap-8 text-center text-[11.5px] break-inside-avoid">
          <Sign label="ຜູ້ສະເໜີ" />
          <Sign label="ຜູ້ອະນຸມັດ" />
          <Sign label="ລູກຄ້າ" />
        </div>
      </div>
    </>
  );
}
