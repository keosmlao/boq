/** Web: which craftsmen are online (same access as tracking). */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/_lib/server-auth";
import { can } from "@/_lib/permissions";
import { listPresence } from "@/_lib/presence";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !can(user, "tracking", "view")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const data = await listPresence();
  return NextResponse.json({ data });
}
