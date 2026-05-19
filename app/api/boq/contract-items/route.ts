export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/_lib/db";
import { cleanText, serverError, toNumber } from "@/_lib/http";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const custCode = cleanText(params.get("cust_code"));
    const contractId = toNumber(params.get("contract_id"), 0);
    const contractNo = cleanText(params.get("contract_no"));

    const values: unknown[] = [];
    const where: string[] = [];

    if (custCode) {
      values.push(custCode);
      where.push(`d.cust_code = $${values.length}`);
    }
    if (contractId) {
      values.push(contractId);
      where.push(`d.contract_id = $${values.length}`);
    } else if (contractNo) {
      values.push(contractNo);
      where.push(`c.contract_no = $${values.length}`);
    }

    const result = await query(
      `
        SELECT
          d.item_code,
          d.item_name,
          d.unit_code,
          SUM(d.qty)::numeric AS boq_qty,
          0::numeric AS withdraw_qty,
          SUM(d.qty)::numeric AS remaining_qty,
          d.contract_id
        FROM odg_projects_boq_detail d
        LEFT JOIN odg_projects_contract c
          ON c.roworder = d.contract_id
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        GROUP BY d.item_code, d.item_name, d.unit_code, d.contract_id
        ORDER BY d.item_code ASC
      `,
      values,
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    return serverError(error, "Load contract BOQ items failed");
  }
}
