/** Notifications — a stable route handler (unlike a server action it never goes
 *  stale after a redeploy, so the topbar bell poll won't 404). */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/_lib/server-auth";
import { getMyNotifications, markNotificationsRead } from "@/_actions/notifications";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const res = await getMyNotifications();
  return NextResponse.json(res, { status: res.success ? 200 : 500 });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids : undefined;
  const res = await markNotificationsRead(ids);
  return NextResponse.json(res, { status: res.success ? 200 : 500 });
}
