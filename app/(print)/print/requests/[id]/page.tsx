/**
 * Printable material-request bill (ໃບຂໍເບີກວັດສະດຸ). Chrome-free server page
 * under the (print) group; opened in a new tab from the request detail page.
 * Handles all request sources (v2 / legacy / app) since getRequestDetail
 * normalises them into { request_no|doc_no, project_name, requester, items[] }.
 */
import { getRequestDetail } from "@/_actions/request-v2";
import BillHead from "../../../_components/BillHead";
import PrintBar from "../../../_components/PrintBar";
import { money, d10, Info, Th, Td, Sign } from "../../../_components/bill-ui";

export default async function RequestPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res: any = await getRequestDetail(decodeURIComponent(String(id)));

  if (!res || res.success === false || !res.data) {
    return (
      <div className="mx-auto max-w-[794px] px-6 py-20 text-center text-sm font-semibold text-neutral-500">
        ບໍ່ພົບໃບຂໍເບີກ
      </div>
    );
  }

  const r: any = res.data;
  const items: any[] = Array.isArray(r.items) ? r.items : [];
  const totalQty = items.reduce((s, it) => s + (Number(it.qty) || 0), 0);

  return (
    <>
      <PrintBar />
      <div className="mx-auto my-4 max-w-[794px] bg-white p-8 shadow-sm print:my-0 print:max-w-none print:p-0 print:shadow-none">
        <BillHead
          title="ໃບຂໍເບີກວັດສະດຸ"
          meta={[
            { label: "ເລກທີ", value: r.request_no || r.doc_no || "-" },
            { label: "ວັນທີ", value: d10(r.created_at || r.doc_date) },
          ]}
        />

        <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-2 text-[12px]">
          <Info label="ໂຄງການ" value={r.project_name} />
          <Info label="ຜູ້ຮ້ອງຂໍເບີກ" value={r.requester} />
          {r.used_by_name ? <Info label="ຜູ້ໃຊ້ວັດສະດຸ (ທີມ/ຊ່າງ)" value={r.used_by_name} /> : null}
          {r.contract_no ? <Info label="ສັນຍາ" value={r.contract_no} /> : null}
        </div>

        <table className="mt-5 w-full border-collapse text-[11.5px]">
          <thead>
            <tr className="bg-neutral-100 text-neutral-700">
              <Th className="w-8 text-center">#</Th>
              <Th className="w-28">ລະຫັດ</Th>
              <Th>ລາຍການ</Th>
              <Th className="w-28">ຄັງ / ບ່ອນວາງ</Th>
              <Th className="w-14 text-center">ໜ່ວຍ</Th>
              <Th className="w-16 text-right">ຈຳນວນ</Th>
              <Th className="w-28">ໝາຍເຫດ</Th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <Td colSpan={7} className="py-6 text-center text-neutral-400">ບໍ່ມີລາຍການ</Td>
              </tr>
            ) : (
              items.map((it, i) => (
                <tr key={i} className="break-inside-avoid">
                  <Td className="text-center text-neutral-500">{i + 1}</Td>
                  <Td className="font-mono">{it.item_code || "-"}</Td>
                  <Td className="font-semibold">{it.description || it.item_name || it.item_code || "-"}</Td>
                  <Td>{[it.wh_name, it.shelf_name].filter(Boolean).join(" / ") || "-"}</Td>
                  <Td className="text-center">{it.unit || it.unit_code || "-"}</Td>
                  <Td className="text-right tabular-nums">{money(it.qty)}</Td>
                  <Td>{it.remark || "-"}</Td>
                </tr>
              ))
            )}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="bg-neutral-50 font-bold">
                <Td colSpan={5} className="text-right">ລວມຈຳນວນ</Td>
                <Td className="text-right tabular-nums">{money(totalQty)}</Td>
                <Td />
              </tr>
            </tfoot>
          )}
        </table>

        {r.notes && (
          <div className="mt-5 rounded border border-neutral-200 p-3 text-[11.5px]">
            <div className="mb-1 font-bold text-neutral-700">ໝາຍເຫດ</div>
            <div className="whitespace-pre-wrap leading-relaxed text-neutral-800">{r.notes}</div>
          </div>
        )}

        <div className="mt-12 grid grid-cols-3 gap-8 text-center text-[11.5px] break-inside-avoid">
          <Sign label="ຜູ້ຂໍເບີກ" />
          <Sign label="ຫົວໜ້າຊ່າງ" />
          <Sign label="ຜູ້ອະນຸມັດ" />
        </div>
      </div>
    </>
  );
}
