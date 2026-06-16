"use server";

import { query } from "@/_lib/db";
import { invalidate } from "@/_lib/cache";
import { requireUser, requireManager, requireAdmin, getSessionUser } from "@/_lib/server-auth";
import { logActivity } from "./chatter";

const INSTALL_STATUS = "ດຳເນີນການຕິດຕັ້ງ";
const PAUSE_STATUS = "ພັກໂຄງການ";

/* ── schema ─────────────────────────────────────────────────────────────── */
let ready: Promise<void> | null = null;
function ensurePauseTable(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS odg_project_pause (
          id            BIGSERIAL PRIMARY KEY,
          project_id    TEXT NOT NULL,
          reason        TEXT,
          status        TEXT NOT NULL DEFAULT 'requested', -- requested|manager_ok|approved|rejected|resumed
          requested_by  TEXT,
          requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
          manager_by    TEXT,
          manager_at    TIMESTAMPTZ,
          admin_by      TEXT,
          admin_at      TIMESTAMPTZ,           -- pause START (set on admin approval)
          resumed_by    TEXT,
          resumed_at    TIMESTAMPTZ,           -- pause END
          reject_reason TEXT
        );
        CREATE INDEX IF NOT EXISTS odg_project_pause_proj_idx ON odg_project_pause(project_id);
        -- Speeds up the install-start lookup (status → ດຳເນີນການຕິດຕັ້ງ / ພັກໂຄງການ).
        CREATE INDEX IF NOT EXISTS odg_psh_field_value_idx ON odg_project_status_history(field_name, new_value);
      `);
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

type Ok<T = unknown> = { success: true } & T;
type Fail = { success: false; message: string };
const fail = (message: string): Fail => ({ success: false, message });

export type InstallRow = {
  project_id: string;
  project_name: string;
  project_status: string;
  install_started_at: string | null;
  worked_hours: number;
  wo_count: number;
  paused: boolean;
  paused_since: string | null;
  current_pause_days: number;
  total_pause_days: number;
  // pending pause request (for the workflow buttons)
  req_id: number | null;
  req_status: string | null;   // requested | manager_ok
  req_reason: string | null;
  req_by: string | null;
};

/* ── read: per-project install tracking ─────────────────────────────────── */
export async function getInstallTracking(): Promise<Ok<{ data: InstallRow[] }> | Fail> {
  try {
    await requireUser();
    await ensurePauseTable();
    const r = await query(
      `
      WITH install AS (
        SELECT project_id, MIN(changed_at) AS started
        FROM odg_project_status_history
        WHERE field_name = 'project_status' AND new_value = $1
        GROUP BY project_id
      ),
      hours AS (
        SELECT project_id,
          COALESCE(ROUND(SUM(
            CASE WHEN checkin_at IS NOT NULL AND checkout_at IS NOT NULL AND checkout_at > checkin_at
                 THEN EXTRACT(EPOCH FROM (checkout_at - checkin_at)) / 3600.0 ELSE 0 END
          )::numeric, 1), 0)::float AS worked_hours,
          MIN(checkin_at) AS first_checkin,
          COUNT(*)::int AS wo_count
        FROM odg_work_order GROUP BY project_id
      ),
      pause AS (
        SELECT project_id,
          (SUM(EXTRACT(EPOCH FROM (COALESCE(resumed_at, now()) - admin_at))) / 86400.0)::float AS total_days,
          MAX(CASE WHEN resumed_at IS NULL THEN admin_at END) AS paused_since
        FROM odg_project_pause
        WHERE status IN ('approved', 'resumed') AND admin_at IS NOT NULL
        GROUP BY project_id
      ),
      req AS (
        SELECT DISTINCT ON (project_id) project_id, id, status, reason, requested_by
        FROM odg_project_pause
        WHERE status IN ('requested', 'manager_ok')
        ORDER BY project_id, id DESC
      )
      SELECT p.id::text AS project_id, p.project_name, p.project_status,
        COALESCE(i.started, h.first_checkin) AS install_started_at,
        COALESCE(h.worked_hours, 0)::float AS worked_hours,
        COALESCE(h.wo_count, 0)::int AS wo_count,
        (p.project_status = $2) AS paused,
        pz.paused_since,
        COALESCE(pz.total_days, 0)::float AS total_pause_days,
        rq.id AS req_id, rq.status AS req_status, rq.reason AS req_reason, rq.requested_by AS req_by
      FROM odg_projects p
      LEFT JOIN install i ON i.project_id = p.id::text
      LEFT JOIN hours   h ON h.project_id = p.id::text
      LEFT JOIN pause   pz ON pz.project_id = p.id::text
      LEFT JOIN req     rq ON rq.project_id = p.id::text
      WHERE COALESCE(i.started, h.first_checkin) IS NOT NULL OR p.project_status = $2 OR rq.id IS NOT NULL
      ORDER BY (p.project_status = $2) DESC, install_started_at DESC NULLS LAST
      `,
      [INSTALL_STATUS, PAUSE_STATUS],
    );
    const now = Date.now();
    const data: InstallRow[] = (r.rows as any[]).map((x) => {
      const pausedSince = x.paused_since ? new Date(x.paused_since).toISOString() : null;
      const currentPauseDays = x.paused && pausedSince ? Math.max(0, Math.floor((now - new Date(pausedSince).getTime()) / 86_400_000)) : 0;
      return {
        project_id: String(x.project_id),
        project_name: String(x.project_name || x.project_id),
        project_status: String(x.project_status || ""),
        install_started_at: x.install_started_at ? new Date(x.install_started_at).toISOString() : null,
        worked_hours: Number(x.worked_hours || 0),
        wo_count: Number(x.wo_count || 0),
        paused: Boolean(x.paused),
        paused_since: pausedSince,
        current_pause_days: currentPauseDays,
        total_pause_days: Math.round(Number(x.total_pause_days || 0) * 10) / 10,
        req_id: x.req_id != null ? Number(x.req_id) : null,
        req_status: x.req_status || null,
        req_reason: x.req_reason || null,
        req_by: x.req_by || null,
      };
    });
    return { success: true, data };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/* ── workflow: request → manager review → admin approve → resume ─────────── */

/** Dashboard summary: counts + the currently-paused projects. */
export async function getInstallTrackingSummary(): Promise<
  Ok<{ data: { total: number; active: number; paused: number; pendingPause: number; hours: number; pausedProjects: { project_id: string; project_name: string; current_pause_days: number }[] } }> | Fail
> {
  const res = await getInstallTracking();
  if (!res.success) return fail((res as { message?: string }).message || "ໂຫຼດບໍ່ສຳເລັດ");
  const rows = res.data;
  return {
    success: true,
    data: {
      total: rows.length,
      active: rows.filter((r) => !r.paused).length,
      paused: rows.filter((r) => r.paused).length,
      pendingPause: rows.filter((r) => r.req_id).length,
      hours: Math.round(rows.reduce((a, r) => a + (r.worked_hours || 0), 0) * 10) / 10,
      pausedProjects: rows.filter((r) => r.paused).slice(0, 5).map((r) => ({ project_id: r.project_id, project_name: r.project_name, current_pause_days: r.current_pause_days })),
    },
  };
}

/** Install metrics + pause workflow state for ONE project (for the detail page). */
export async function getProjectInstall(projectId: string): Promise<Ok<{ data: InstallRow | null }> | Fail> {
  try {
    await requireUser();
    await ensurePauseTable();
    if (!projectId) return fail("ບໍ່ມີ project id");
    const pid = String(projectId);
    const [proj, inst, hrs, pz, rq] = await Promise.all([
      query(`SELECT project_name, project_status FROM odg_projects WHERE id = $1 LIMIT 1`, [Number(pid)]),
      query(`SELECT MIN(changed_at) AS started FROM odg_project_status_history WHERE field_name = 'project_status' AND new_value = $2 AND project_id = $1`, [pid, INSTALL_STATUS]),
      query(
        `SELECT COALESCE(ROUND(SUM(CASE WHEN checkin_at IS NOT NULL AND checkout_at IS NOT NULL AND checkout_at > checkin_at THEN EXTRACT(EPOCH FROM (checkout_at - checkin_at)) / 3600.0 ELSE 0 END)::numeric, 1), 0)::float AS worked_hours, MIN(checkin_at) AS first_checkin, COUNT(*)::int AS wo_count FROM odg_work_order WHERE project_id = $1`,
        [pid],
      ),
      query(`SELECT (SUM(EXTRACT(EPOCH FROM (COALESCE(resumed_at, now()) - admin_at))) / 86400.0)::float AS total_days, MAX(CASE WHEN resumed_at IS NULL THEN admin_at END) AS paused_since FROM odg_project_pause WHERE project_id = $1 AND status IN ('approved','resumed') AND admin_at IS NOT NULL`, [pid]),
      query(`SELECT id, status, reason, requested_by FROM odg_project_pause WHERE project_id = $1 AND status IN ('requested','manager_ok') ORDER BY id DESC LIMIT 1`, [pid]),
    ]);
    if (!proj.rows.length) return { success: true, data: null };
    const status = String(proj.rows[0].project_status || "");
    const startedAt = inst.rows[0]?.started || hrs.rows[0]?.first_checkin || null;
    const pausedSince = pz.rows[0]?.paused_since ? new Date(pz.rows[0].paused_since).toISOString() : null;
    const paused = status === PAUSE_STATUS;
    const data: InstallRow = {
      project_id: pid,
      project_name: String(proj.rows[0].project_name || pid),
      project_status: status,
      install_started_at: startedAt ? new Date(startedAt).toISOString() : null,
      worked_hours: Number(hrs.rows[0]?.worked_hours || 0),
      wo_count: Number(hrs.rows[0]?.wo_count || 0),
      paused,
      paused_since: pausedSince,
      current_pause_days: paused && pausedSince ? Math.max(0, Math.floor((Date.now() - new Date(pausedSince).getTime()) / 86_400_000)) : 0,
      total_pause_days: Math.round(Number(pz.rows[0]?.total_days || 0) * 10) / 10,
      req_id: rq.rows[0]?.id != null ? Number(rq.rows[0].id) : null,
      req_status: rq.rows[0]?.status || null,
      req_reason: rq.rows[0]?.reason || null,
      req_by: rq.rows[0]?.requested_by || null,
    };
    return { success: true, data };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Employee requests a project pause. */
export async function requestProjectPause(projectId: string, reason: string): Promise<Ok | Fail> {
  try {
    const u = await requireUser();
    await ensurePauseTable();
    if (!projectId) return fail("ບໍ່ມີ project id");
    // No duplicate open request.
    const open = await query(
      `SELECT 1 FROM odg_project_pause WHERE project_id = $1 AND status IN ('requested','manager_ok') LIMIT 1`,
      [String(projectId)],
    );
    if (open.rows.length) return fail("ໂຄງການນີ້ມີຄຳຮ້ອງຂໍພັກທີ່ຍັງດຳເນີນຢູ່ແລ້ວ");
    await query(
      `INSERT INTO odg_project_pause (project_id, reason, status, requested_by) VALUES ($1, $2, 'requested', $3)`,
      [String(projectId), String(reason || "").trim() || null, u.name || u.username],
    );
    await logActivity("project", String(projectId), "ຮ້ອງຂໍພັກໂຄງການ", reason || "");
    invalidate("projects:");
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Manager reviews a pause request: ok=true → manager_ok, ok=false → rejected. */
export async function reviewProjectPause(id: number, ok: boolean, note = ""): Promise<Ok | Fail> {
  try {
    const u = await requireManager();
    await ensurePauseTable();
    const r = await query(
      `UPDATE odg_project_pause
          SET status = $2, manager_by = $3, manager_at = now(), reject_reason = $4
        WHERE id = $1 AND status = 'requested'
        RETURNING project_id`,
      [Number(id), ok ? "manager_ok" : "rejected", u.name || u.username, ok ? null : (note || null)],
    );
    if (!r.rows.length) return fail("ບໍ່ພົບຄຳຮ້ອງ ຫຼື ສະຖານະບໍ່ຖືກຕ້ອງ");
    await logActivity("project", String(r.rows[0].project_id), ok ? "ກວດສອບຜ່ານ ຄຳຮ້ອງພັກ" : "ປະຕິເສດ ຄຳຮ້ອງພັກ", note || "");
    invalidate("projects:");
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Admin approves a manager-reviewed pause → project enters ພັກໂຄງການ. */
export async function approveProjectPause(id: number): Promise<Ok | Fail> {
  try {
    const u = await requireAdmin();
    await ensurePauseTable();
    const r = await query(
      `UPDATE odg_project_pause
          SET status = 'approved', admin_by = $2, admin_at = now()
        WHERE id = $1 AND status = 'manager_ok'
        RETURNING project_id`,
      [Number(id), u.name || u.username],
    );
    if (!r.rows.length) return fail("ບໍ່ພົບຄຳຮ້ອງທີ່ຜ່ານການກວດສອບ");
    const projectId = String(r.rows[0].project_id);
    await query(`UPDATE odg_projects SET project_status = $1 WHERE id = $2`, [PAUSE_STATUS, Number(projectId)]);
    await logActivity("project", projectId, "ອະນຸມັດ ພັກໂຄງການ", "");
    invalidate("projects:");
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Reject a pause request (manager or admin) at any pre-approval stage. */
export async function rejectProjectPause(id: number, reason = ""): Promise<Ok | Fail> {
  try {
    const u = await requireManager();
    await ensurePauseTable();
    const r = await query(
      `UPDATE odg_project_pause
          SET status = 'rejected', reject_reason = $2, manager_by = COALESCE(manager_by, $3), manager_at = COALESCE(manager_at, now())
        WHERE id = $1 AND status IN ('requested','manager_ok')
        RETURNING project_id`,
      [Number(id), reason || null, u.name || u.username],
    );
    if (!r.rows.length) return fail("ບໍ່ພົບຄຳຮ້ອງ");
    await logActivity("project", String(r.rows[0].project_id), "ປະຕິເສດ ຄຳຮ້ອງພັກ", reason || "");
    invalidate("projects:");
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Resume a paused project: close the open pause period and return to installing. */
export async function resumeProject(projectId: string): Promise<Ok | Fail> {
  try {
    const u = await requireManager();
    await ensurePauseTable();
    if (!projectId) return fail("ບໍ່ມີ project id");
    await query(
      `UPDATE odg_project_pause
          SET status = 'resumed', resumed_by = $2, resumed_at = now()
        WHERE project_id = $1 AND status = 'approved' AND resumed_at IS NULL`,
      [String(projectId), u.name || u.username],
    );
    await query(`UPDATE odg_projects SET project_status = $1 WHERE id = $2`, [INSTALL_STATUS, Number(projectId)]);
    await logActivity("project", String(projectId), "ກັບມາດຳເນີນ ໂຄງການ (ຍົກເລີກພັກ)", "");
    invalidate("projects:");
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Lightweight role probe for the client (which workflow buttons to show). */
export async function getMyRole(): Promise<{ role: string; isManager: boolean; isAdmin: boolean }> {
  const u = await getSessionUser();
  const role = (u?.role || "").toLowerCase();
  return { role, isManager: role === "admin" || role === "manager", isAdmin: role === "admin" };
}
