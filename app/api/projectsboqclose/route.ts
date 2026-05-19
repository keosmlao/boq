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
        p.coordinator,
        p.phone,
        pv.name_1 AS province_name,
        d.name_1 AS district_name,
        v.name_1 AS village_name,
        c.contract_no,
        c.contract_name,
        c.amount
      FROM odg_projects p
      LEFT JOIN erp_province pv ON pv.code = p.province
      LEFT JOIN erp_amper d ON d.code = p.district AND d.province = p.province
      LEFT JOIN erp_tambon v ON v.code = p.village AND v.amper = p.district AND v.province = p.province
      LEFT JOIN odg_projects_contract c ON c.project_id::int = p.id
      WHERE p.project_status IN ('ລໍຖ້າອະນຸມັດປິດໂຄງການ', 'ປິດໂຄງການ')
      ORDER BY p.id DESC
    `);

    return ok({ data: result.rows });
  } catch (error) {
    return serverError(error);
  }
}
