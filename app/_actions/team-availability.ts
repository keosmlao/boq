"use server";

import { query } from "@/_lib/db";
import { requirePermission } from "@/_lib/server-auth";
import { ensureWorkOrderSchema } from "@/_lib/schemas/work-order";

export type TeamAvailability = {
  code: string;
  active: number;            // open work orders (not closed/rejected)
  working: number;           // currently in_progress
  current_work_no: string | null;
  current_status: string | null;
  current_project: string | null;
};

type Result = { success: true; data: TeamAvailability[] } | { success: false; message: string };

/**
 * Per-craftsman live availability: how many open work orders each holds and the
 * most recent one. A craftsman with `active = 0` is free. Keyed by technician code.
 */
export async function getTeamAvailability(): Promise<Result> {
  try {
    await requirePermission("tech-teams", "view");
    await ensureWorkOrderSchema();
    const r = await query(`
      SELECT
        w.technician_code AS code,
        COUNT(*) FILTER (WHERE w.status NOT IN ('closed','rejected'))::int AS active,
        COUNT(*) FILTER (WHERE w.status = 'in_progress')::int            AS working,
        (array_agg(w.work_no  ORDER BY w.created_at DESC) FILTER (WHERE w.status NOT IN ('closed','rejected')))[1] AS current_work_no,
        (array_agg(w.status   ORDER BY w.created_at DESC) FILTER (WHERE w.status NOT IN ('closed','rejected')))[1] AS current_status,
        (array_agg(w.project_id ORDER BY w.created_at DESC) FILTER (WHERE w.status NOT IN ('closed','rejected')))[1] AS current_project
      FROM odg_work_order w
      WHERE NULLIF(w.technician_code, '') IS NOT NULL
      GROUP BY w.technician_code
    `);
    return { success: true, data: r.rows as TeamAvailability[] };
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}

export type TeamBusy = { code: string; name: string; working: number; current_work_no: string | null; current_status: string | null };
export type TeamAvailabilitySummary = {
  total: number;
  free: number;
  busy: number;
  working: number;
  busyTeams: TeamBusy[];
};

type SummaryResult = { success: true; data: TeamAvailabilitySummary } | { success: false; message: string };

/** Dashboard widget: team availability counts + the teams that currently hold work. */
export async function getTeamAvailabilitySummary(): Promise<SummaryResult> {
  try {
    await requirePermission("tech-teams", "view");
    await ensureWorkOrderSchema();
    const r = await query(`
      SELECT
        t.code, t.name_1 AS name,
        COUNT(w.id) FILTER (WHERE w.status NOT IN ('closed','rejected'))::int AS active,
        COUNT(w.id) FILTER (WHERE w.status = 'in_progress')::int            AS working,
        (array_agg(w.work_no ORDER BY w.created_at DESC) FILTER (WHERE w.status NOT IN ('closed','rejected')))[1] AS current_work_no,
        (array_agg(w.status  ORDER BY w.created_at DESC) FILTER (WHERE w.status NOT IN ('closed','rejected')))[1] AS current_status
      FROM odg_technicians t
      LEFT JOIN odg_work_order w ON w.technician_code = t.code
      WHERE NULLIF(t.code, '') IS NOT NULL
      GROUP BY t.code, t.name_1
      ORDER BY active DESC, working DESC, t.name_1 ASC
    `);
    const rows = r.rows as Array<{ code: string; name: string; active: number; working: number; current_work_no: string | null; current_status: string | null }>;
    const busyTeams: TeamBusy[] = rows
      .filter((x) => x.active > 0)
      .map((x) => ({ code: x.code, name: x.name, working: x.working, current_work_no: x.current_work_no, current_status: x.current_status }));
    const busy = busyTeams.length;
    const working = rows.filter((x) => x.working > 0).length;
    return {
      success: true,
      data: { total: rows.length, free: rows.length - busy, busy, working, busyTeams },
    };
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}
