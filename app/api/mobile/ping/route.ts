/** Mobile: presence heartbeat — marks the craftsman online. */
import { NextResponse } from "next/server";
import { bearerUser } from "@/_lib/api-bearer";
import { savePresence } from "@/_lib/presence";

export async function POST(req: Request) {
  const user = await bearerUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await savePresence(user.username);
  return NextResponse.json({ success: true });
}
