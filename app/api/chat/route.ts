/** Web chat (cookie session). A stable route handler — unlike a server action it
 *  never goes stale after a redeploy, so the ChatWidget poll won't 404. */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/_lib/server-auth";
import { getChatMessagesCore, sendChatMessageAs, markChatReadAs, getReadWatermark } from "@/_lib/chat-core";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const sinceId = url.searchParams.get("sinceId") || undefined;
  // When the panel is open the client passes markRead=1 so the user's read
  // high-water mark advances (drives the other side's "read" receipts).
  if (url.searchParams.get("markRead") === "1") {
    await markChatReadAs(user, url.searchParams.get("lastId") || undefined);
  }
  const res = await getChatMessagesCore(sinceId ?? undefined, 80);
  if (res.success === false) return NextResponse.json({ error: res.message }, { status: 500 });
  const readWatermark = await getReadWatermark(user.username);
  return NextResponse.json({ data: res.data, readWatermark });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const res = await sendChatMessageAs(user, String(body?.body || ""));
  return NextResponse.json(res, { status: res.success ? 200 : 400 });
}
