/** Mobile (manager-only): latest known location of every craftsman. */
import { NextResponse } from "next/server";
import { bearerUser } from "@/_lib/api-bearer";
import { isManager } from "@/_lib/permissions";
import { listLatestLocations } from "@/_lib/tracking";

export async function GET(req: Request) {
  const user = await bearerUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isManager(user)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const data = await listLatestLocations();
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
