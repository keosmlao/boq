/** Web: latest locations of all craftsmen (managers only) for the tracking map. */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/_lib/server-auth";
import { isManager } from "@/_lib/permissions";
import { listLatestLocations } from "@/_lib/tracking";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !isManager(user)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const data = await listLatestLocations();
  return NextResponse.json({ data });
}
