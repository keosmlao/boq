export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { withTransaction } from "@/_lib/db";
import { cleanText, fail, ok, serverError, toNumber } from "@/_lib/http";

function parseDocDate(value: unknown) {
  const text = cleanText(value);
  if (!text) return new Date().toISOString().slice(0, 10);

  const dmy = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy) {
    const [, day, month, year] = dmy;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);

  return new Date().toISOString().slice(0, 10);
}

function docMonthKey(docDate: string) {
  return docDate.slice(0, 7).replace("-", "");
}

async function nextBoqDocNo(client: any, monthKey: string) {
  const result = await client.query(
    `
      SELECT doc_no
      FROM odg_projects_boq
      WHERE doc_no LIKE $1
      ORDER BY doc_no DESC
      LIMIT 1
    `,
    [`BOQ-${monthKey}-%`],
  );

  const lastDocNo = cleanText(result.rows[0]?.doc_no);
  const lastSeq = toNumber(lastDocNo.split("-").at(-1), 0);
  return `BOQ-${monthKey}-${String(lastSeq + 1).padStart(4, "0")}`;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const custCode = cleanText(payload?.cust_code);
    const projectId = cleanText(payload?.project_id);
    const username = cleanText(payload?.username);
    const contractRef = cleanText(payload?.contract_no);
    const docDate = parseDocDate(payload?.doc_date);
    const items = Array.isArray(payload?.items) ? payload.items : [];

    if (!custCode) return fail("Missing cust_code", 400);
    if (!projectId) return fail("Missing project_id", 400);
    if (!contractRef) return fail("Missing contract_no", 400);

    const validItems = items
      .map((item: any) => ({
        item_code: cleanText(item?.productId || item?.item_code || item?.code),
        item_name: cleanText(item?.productName || item?.item_name || item?.name_1),
        qty: toNumber(item?.quantity ?? item?.qty, 0),
        unit_code: cleanText(item?.unit || item?.unit_code),
      }))
      .filter((item) => item.item_code && item.item_name && item.qty > 0);

    if (!validItems.length) return fail("Missing valid BOQ items", 400);

    const result = await withTransaction(async (client) => {
      const contractResult = await client.query(
        `
          SELECT roworder, contract_no
          FROM odg_projects_contract
          WHERE project_id = $1
            AND (
              roworder = NULLIF($2, '')::int
              OR contract_no = $3
            )
          LIMIT 1
        `,
        [
          projectId,
          /^\d+$/.test(contractRef) ? contractRef : "",
          contractRef,
        ],
      );
      const contract = contractResult.rows[0];
      const contractId = toNumber(contract?.roworder, 0);

      if (!contractId) {
        return {
          missingContract: true,
          doc_no: null,
        };
      }

      const existing = await client.query(
        `
          SELECT doc_no
          FROM odg_projects_boq
          WHERE contract_id = $1
          LIMIT 1
        `,
        [contractId],
      );

      if (existing.rows[0]?.doc_no) {
        return {
          duplicate: true,
          doc_no: existing.rows[0].doc_no,
        };
      }

      const docNo = await nextBoqDocNo(client, docMonthKey(docDate));

      await client.query(
        `
          INSERT INTO odg_projects_boq (
            doc_no,
            doc_date,
            cust_code,
            project_id,
            user_created,
            approve_status,
            contract_id
          ) VALUES ($1, $2, $3, $4, $5, 0, $6)
        `,
        [docNo, docDate, custCode, projectId, username || null, contractId],
      );

      for (const item of validItems) {
        await client.query(
          `
            INSERT INTO odg_projects_boq_detail (
              doc_no,
              doc_date,
              cust_code,
              item_code,
              item_name,
              qty,
              unit_code,
              contract_id,
              project_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [
            docNo,
            docDate,
            custCode,
            item.item_code,
            item.item_name,
            item.qty,
            item.unit_code || null,
            contractId,
            toNumber(projectId, 0) || null,
          ],
        );
      }

      return {
        duplicate: false,
        doc_no: docNo,
      };
    });

    if (result.missingContract) {
      return fail("ບໍ່ພົບສັນຍາສຳລັບອອກ BOQ", 404);
    }

    if (result.duplicate) {
      return fail("BOQ ຂອງສັນຍານີ້ມີຢູ່ແລ້ວ", 409, {
        doc_no: result.doc_no,
      });
    }

    return ok({
      success: true,
      message: `Created ${result.doc_no}`,
      doc_no: result.doc_no,
      total_items: validItems.length,
    });
  } catch (error) {
    return serverError(error, "Save BOQ failed");
  }
}
