/** Mobile: manager approves / rejects a work order. */
import { NextResponse } from "next/server";
import { bearerUser } from "@/_lib/api-bearer";
import { approveWorkOrderAs } from "@/_lib/workorder-core";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await bearerUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const res = await approveWorkOrderAs(user, String(id), { approve: body?.approve !== false, note: body?.note });
  return NextResponse.json(res, { status: res.success ? 200 : 400 });
}
