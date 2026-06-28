"use server";

/**
 * Craftsman work calendar — for a date range, every technician's work orders by
 * day (which job, the day's outcome) plus the technicians with no job that day
 * (free). Feeds the weekly matrix on /tech-calendar.
 */
import { query } from "@/_lib/db";
import { requirePermission } from "@/_lib/server-auth";
import { ensureWorkOrderSchema } from "@/_lib/schemas/work-order";

export type TechCalRow = {
  code: string;
  tech_name: string;
  wo_id: string | null;
  work_no: string | null;
  work_date: string | null;
  status: string | null;
  project_id: string | null;
  project_name: string | null;
  checkin_at: string | null;
  checkout_at: string | null;
  total_hours: number | null;
  shift: string | null;
};

export async function getTechCalendar(fromISO: string, toISO: string): Promise<{ success: true; data: TechCalRow[] } | { success: false; message: string }> {
  try {
    await requirePermission("work-orders", "view");
    await ensureWorkOrderSchema();
    const r = await query(
      `
      SELECT
        t.code,
        t.name_1 AS tech_name,
        w.id::text AS wo_id,
        w.work_no,
        w.work_date::text AS work_date,
        w.status,
        w.project_id,
        p.project_name,
        w.checkin_at,
        w.checkout_at,
        w.total_hours,
        w.shift
      FROM odg_technicians t
      LEFT JOIN odg_work_order w
        ON w.technician_code = t.code
       AND w.work_date BETWEEN $1::date AND $2::date
       AND COALESCE(w.status, '') <> 'rejected'
      LEFT JOIN odg_projects p ON p.id::text = w.project_id
      WHERE NULLIF(t.code, '') IS NOT NULL
        AND lower(COALESCE(t.role, '')) IN ('technician', 'lead', 'assistant', 'helper', '')
      ORDER BY t.name_1 ASC, w.work_date ASC
      `,
      [fromISO, toISO],
    );
    return { success: true, data: r.rows as TechCalRow[] };
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}
