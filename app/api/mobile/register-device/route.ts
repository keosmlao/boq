/** Mobile: register this device's FCM token for the logged-in craftsman. */
import { NextResponse } from "next/server";
import { bearerUser } from "@/_lib/api-bearer";
import { registerDeviceToken } from "@/_lib/push";

export async function POST(req: Request) {
  const user = await bearerUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const token = String(body?.token || "");
  if (!token) return NextResponse.json({ success: false, message: "no token" }, { status: 400 });
  await registerDeviceToken(user.username, token, body?.platform ? String(body.platform) : undefined);
  return NextResponse.json({ success: true });
}
