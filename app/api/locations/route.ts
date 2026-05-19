export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { query } from "@/_lib/db";
import { ok, serverError } from "@/_lib/http";

/**
 * GET /api/locations?warehouse={code}
 *
 * Returns shelf locations for a given warehouse. Two strategies:
 *   1. JOIN via `ic_wh_shelf` (the assignment table) — preferred.
 *   2. Fallback: shelves whose `whcode` directly references the warehouse.
 *
 * The frontend reads `location_code`/`code` and `location_name`/`name`.
 */
export async function GET(request: NextRequest) {
  try {
    const warehouse = request.nextUrl.searchParams.get("warehouse")?.trim();
    if (!warehouse) {
      return ok({ success: true, data: [] });
    }

    const result = await query(
      `
      SELECT DISTINCT
        s.code,
        s.code AS location_code,
        s.name_1,
        s.name_1 AS location_name,
        s.name_1 AS name,
        s.name_2,
        s.whcode,
        s.remark
      FROM ic_shelf s
      WHERE (
        s.whcode = $1
        OR EXISTS (
          SELECT 1 FROM ic_wh_shelf w
          WHERE w.wh_code = $1 AND w.shelf_code = s.code
        )
      )
      ORDER BY s.code ASC
      `,
      [warehouse],
    );
    return ok({ success: true, data: result.rows });
  } catch (error) {
    return serverError(error);
  }
}
