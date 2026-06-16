"use server";

import { query } from "@/_lib/db";
import { requirePermission } from "@/_lib/server-auth";

/** Project status labels that bound the "installation → close" span. */
const INSTALL_STATUS = "ດຳເນີນການຕິດຕັ້ງ";
const CLOSE_STATUS = "ປິດໂຄງການ";

export type ProjectTimeline = {
  installStartedAt: string | null;
  closedAt: string | null;
  durationDays: number | null; // install → close (or → now while ongoing)
  ongoing: boolean;            // installation started but not closed yet
};

type Result = { success: true; data: ProjectTimeline } | { success: false; message: string };

/**
 * How long a project ran from the start of installation (ດຳເນີນການຕິດຕັ້ງ) to
 * close (ປິດໂຄງການ). Derived from odg_project_status_history. If still open, the
 * duration counts up to now.
 */
export async function getProjectTimeline(projectId: string): Promise<Result> {
  try {
    await requirePermission("projects", "view");
    if (!projectId) return { success: false, message: "ບໍ່ມີ project id" };
    const r = await query(
      `SELECT
         MIN(changed_at) FILTER (WHERE new_value = $2) AS install_started_at,
         MIN(changed_at) FILTER (WHERE new_value = $3) AS closed_at
       FROM odg_project_status_history
       WHERE field_name = 'project_status' AND project_id = $1`,
      [String(projectId), INSTALL_STATUS, CLOSE_STATUS],
    );
    const row = r.rows[0] || {};
    const installStartedAt: string | null = row.install_started_at ? new Date(row.install_started_at).toISOString() : null;
    const closedAt: string | null = row.closed_at ? new Date(row.closed_at).toISOString() : null;

    let durationDays: number | null = null;
    let ongoing = false;
    if (installStartedAt) {
      const start = new Date(installStartedAt).getTime();
      const end = closedAt ? new Date(closedAt).getTime() : Date.now();
      durationDays = Math.max(0, Math.round((end - start) / 86_400_000));
      ongoing = !closedAt;
    }
    return { success: true, data: { installStartedAt, closedAt, durationDays, ongoing } };
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}
