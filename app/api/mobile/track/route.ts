/** Mobile: craftsman posts their current location (tied to the active work order). */
import { NextResponse } from "next/server";
import { bearerUser } from "@/_lib/api-bearer";
import { saveLocation } from "@/_lib/tracking";

export async function POST(req: Request) {
  const user = await bearerUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  await saveLocation(user.username, body?.lat, body?.lng, body?.workOrderId ? String(body.workOrderId) : undefined, body?.workNo ? String(body.workNo) : undefined);
  return NextResponse.json({ success: true });
}
