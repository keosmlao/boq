/** Mobile (manager-only): team availability — who is free vs working today. */
import { NextResponse } from "next/server";
import { bearerUser } from "@/_lib/api-bearer";
import { isManager } from "@/_lib/permissions";
import { query } from "@/_lib/db";
import { ensureWorkOrderSchema } from "@/_lib/schemas/work-order";

export async function GET(req: Request) {
  const user = await bearerUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isManager(user)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    await ensureWorkOrderSchema();
    const r = await query(`
      SELECT
        t.code,
        t.name_1                                                          AS name,
        lower(coalesce(t.role, ''))                                       AS role,
        t.helpers                                                         AS helpers,
        COUNT(w.id) FILTER (WHERE w.status NOT IN ('closed','rejected'))::int        AS active,
        COUNT(w.id) FILTER (WHERE w.status = 'in_progress')::int                     AS working,
        COUNT(w.id) FILTER (WHERE w.created_at::date = now()::date)::int             AS today,
        (array_agg(w.work_no ORDER BY w.created_at DESC) FILTER (WHERE w.status NOT IN ('closed','rejected')))[1] AS current_work_no,
        (array_agg(w.status  ORDER BY w.created_at DESC) FILTER (WHERE w.status NOT IN ('closed','rejected')))[1] AS current_status
      FROM odg_technicians t
      LEFT JOIN odg_work_order w ON w.technician_code = t.code
      WHERE lower(coalesce(t.role, '')) IN ('technician','assistant','lead','helper')
      GROUP BY t.code, t.name_1, t.role, t.helpers
      ORDER BY active DESC, t.name_1 ASC
    `);
    return NextResponse.json({ data: r.rows });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
