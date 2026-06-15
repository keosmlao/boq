/** Web chat (cookie session). A stable route handler — unlike a server action it
 *  never goes stale after a redeploy, so the ChatWidget poll won't 404. */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/_lib/server-auth";
import { getChatMessagesCore, sendChatMessageAs } from "@/_lib/chat-core";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sinceId = new URL(req.url).searchParams.get("sinceId") || undefined;
  const res = await getChatMessagesCore(sinceId ?? undefined, 80);
  if (res.success === false) return NextResponse.json({ error: res.message }, { status: 500 });
  return NextResponse.json({ data: res.data });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const res = await sendChatMessageAs(user, String(body?.body || ""));
  return NextResponse.json(res, { status: res.success ? 200 : 400 });
}
