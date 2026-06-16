/** My activities — a stable route handler (unlike a server action it never goes
 *  stale after a redeploy, so the topbar bell poll won't 404). */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/_lib/server-auth";
import { getMyActivities } from "@/_actions/activities";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const res = await getMyActivities();
  return NextResponse.json(res, { status: res.success ? 200 : 500 });
}
