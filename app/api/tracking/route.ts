/** Web: latest locations of all craftsmen (managers only) for the tracking map. */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/_lib/server-auth";
import { can } from "@/_lib/permissions";
import { listLatestLocations } from "@/_lib/tracking";

export async function GET() {
  // Access is granted by a manager via the /users matrix (tracking → view).
  // admin/manager always pass (can() returns true for them).
  const user = await getSessionUser();
  if (!user || !can(user, "tracking", "view")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const data = await listLatestLocations();
  return NextResponse.json({ data });
}
