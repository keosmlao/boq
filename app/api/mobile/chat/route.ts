/** Mobile: global chat room (read + send). Auth via Bearer token. */
import { NextResponse } from "next/server";
import { bearerUser } from "@/_lib/api-bearer";
import { getChatMessagesCore, sendChatMessageAs } from "@/_lib/chat-core";

export async function GET(req: Request) {
  const user = await bearerUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const sinceId = url.searchParams.get("sinceId") || undefined;
  const res = await getChatMessagesCore(sinceId ?? undefined, 100);
  if (res.success === false) return NextResponse.json({ error: res.message }, { status: 500 });
  return NextResponse.json({ data: res.data });
}

export async function POST(req: Request) {
  const user = await bearerUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const res = await sendChatMessageAs(user, String(body?.body || ""));
  return NextResponse.json(res, { status: res.success ? 200 : 400 });
}
