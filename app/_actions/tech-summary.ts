"use server";

import { query } from "@/_lib/db";
import { requirePermission } from "@/_lib/server-auth";
import { ensureWorkOrderSchema } from "@/_lib/schemas/work-order";

export type TechSummaryRow = {
  code: string | null;
  name: string;
  role: string | null;
  total: number;
  closed: number;       // ສຳເລັດ / ປິດງານ
  in_progress: number;  // ກຳລັງເຮັດ
  review: number;       // awaiting_review — ລໍຖ້າກວດສອບ
  pending: number;      // open / assigned / accepted — ຍັງບໍ່ເລີ່ມ
  rejected: number;     // ປະຕິເສດ
  worked_hours: number; // ຊົ່ວໂມງເຮັດງານລວມ (check-out − check-in)
  sessions: number;     // ຈຳນວນໃບງານທີ່ມີ check-in + check-out ຄົບ
  last_activity: string | null;
};

type Result = { success: true; data: TechSummaryRow[] } | { success: false; message: string };

/** Per-craftsman work-order performance summary (managers/granted users). */
export async function getTechSummary(): Promise<Result> {
  try {
    await requirePermission("tech-summary", "view");
    await ensureWorkOrderSchema();
    const r = await query(`
      SELECT
        NULLIF(w.technician_code, '')                                AS code,
        COALESCE(t.name_1, NULLIF(w.technician_name, ''), 'ບໍ່ລະບຸ')  AS name,
        MAX(t.role)                                                  AS role,
        COUNT(*)::int                                                AS total,
        COUNT(*) FILTER (WHERE w.status = 'closed')::int             AS closed,
        COUNT(*) FILTER (WHERE w.status = 'in_progress')::int        AS in_progress,
        COUNT(*) FILTER (WHERE w.status = 'awaiting_review')::int    AS review,
        COUNT(*) FILTER (WHERE w.status IN ('open','assigned','accepted'))::int AS pending,
        COUNT(*) FILTER (WHERE w.status = 'rejected' OR w.accept_status = 'rejected')::int AS rejected,
        COALESCE(ROUND(SUM(
          CASE WHEN w.checkin_at IS NOT NULL AND w.checkout_at IS NOT NULL AND w.checkout_at > w.checkin_at
               THEN EXTRACT(EPOCH FROM (w.checkout_at - w.checkin_at)) / 3600.0
               ELSE 0 END
        )::numeric, 1), 0)::float AS worked_hours,
        COUNT(*) FILTER (WHERE w.checkin_at IS NOT NULL AND w.checkout_at IS NOT NULL AND w.checkout_at > w.checkin_at)::int AS sessions,
        MAX(COALESCE(w.closed_at, w.checkout_at, w.checkin_at, w.created_at)) AS last_activity
      FROM odg_work_order w
      LEFT JOIN odg_technicians t ON t.code = w.technician_code
      GROUP BY 1, 2
      ORDER BY total DESC, name ASC
    `);
    return { success: true, data: r.rows as TechSummaryRow[] };
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}
