export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { query } from "@/_lib/db";
import { ok, serverError } from "@/_lib/http";

export async function GET() {
  try {
    const result = await query(`
      SELECT
        p.id,
        p.project_name,
        p.sml_code,
        p.project_status,
        c.contract_no,
        c.contract_name,
        c.amount AS contract_amount,
        i.installment_no,
        i.total_amount
      FROM odg_projects p
      JOIN odg_projects_contract c ON c.project_id::int = p.id
      LEFT JOIN odg_projects_item i ON i.contract_no::text = c.contract_no::text
      ORDER BY p.id DESC, c.contract_no, i.installment_no
    `);

    return ok({ data: result.rows });
  } catch (error) {
    return serverError(error);
  }
}
