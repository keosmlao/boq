export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { query } from "@/_lib/db";
import { ok, serverError } from "@/_lib/http";

/**
 * GET /api/warehouses
 * Returns active warehouses from `ic_warehouse`.
 * Frontend reads `warehouse_code`/`code` and `warehouse_name`/`name`.
 */
export async function GET() {
  try {
    const result = await query(
      `
      SELECT
        code,
        code AS warehouse_code,
        name_1,
        name_1 AS warehouse_name,
        name_1 AS name,
        name_2,
        branch_code,
        wh_manager
      FROM ic_warehouse
      ORDER BY code ASC
      `,
    );
    return ok({ success: true, data: result.rows });
  } catch (error) {
    return serverError(error);
  }
}
