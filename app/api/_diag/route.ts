/** Temporary diagnostic for app→web notifications. Open in a browser while logged
 *  in: /api/_diag — returns deploy marker, your user, audience size, and the
 *  latest app material requests. Read-only. Remove after debugging. */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/_lib/server-auth";
import { query } from "@/_lib/db";

const DEPLOY_MARKER = "diag-2c4ffb7"; // bump tells us the server is running new code

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ deploy: DEPLOY_MARKER, error: "not logged in" }, { status: 401 });

  const out: any = { deploy: DEPLOY_MARKER, you: { username: user.username, role: user.role } };

  // Who would receive an app-request bell?
  try {
    const aud = await query(
      `SELECT count(*)::int AS n FROM public.odg_app_user u
        WHERE COALESCE(u.active,true)=true
          AND (lower(COALESCE(u.role,'')) IN ('admin','manager')
            OR COALESCE(u.permissions->'notifications','[]'::jsonb) ? 'receive'
            OR COALESCE(u.permissions->'requests','[]'::jsonb) ? 'view')`,
    );
    out.audience_app_user = aud.rows[0]?.n ?? 0;
  } catch (e) { out.audience_app_user_error = (e as Error).message; }

  try {
    const erp = await query(
      `SELECT count(*)::int AS n FROM odg_project_manager_user e
        WHERE e.username NOT IN (SELECT username FROM public.odg_app_user)`,
    );
    out.audience_erp = erp.rows[0]?.n ?? 0;
  } catch (e) { out.audience_erp_error = (e as Error).message; }

  // Are app material requests actually being created?
  try {
    const mr = await query(
      `SELECT id::text, work_order_id, project_id, status, created_at,
              jsonb_array_length(COALESCE(items,'[]'::jsonb)) AS n_items
         FROM odg_wo_material_request ORDER BY created_at DESC LIMIT 5`,
    );
    const c = await query(`SELECT count(*)::int AS n FROM odg_wo_material_request`);
    out.app_requests_total = c.rows[0]?.n ?? 0;
    out.app_requests_latest = mr.rows;
  } catch (e) { out.app_requests_error = (e as Error).message; }

  // Your unread bell count + latest few.
  try {
    const my = await query(
      `SELECT entity_type, kind, body, is_read, created_at
         FROM public.odg_notifications WHERE recipient_username = $1 ORDER BY id DESC LIMIT 5`,
      [user.username],
    );
    out.my_recent_notifications = my.rows;
  } catch (e) { out.my_notifications_error = (e as Error).message; }

  return NextResponse.json(out);
}
