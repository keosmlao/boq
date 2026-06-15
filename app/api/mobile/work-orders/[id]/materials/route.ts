/** Mobile: material requests (ໃບຂໍເບີກ) for a work order — list + create. */
import { NextResponse } from "next/server";
import { bearerUser } from "@/_lib/api-bearer";
import { createMaterialRequestAs, listMaterialRequests } from "@/_lib/workorder-core";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await bearerUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const res = await listMaterialRequests(String(id));
  if (res.success === false) return NextResponse.json({ error: res.message }, { status: 500 });
  return NextResponse.json({ data: res.data });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await bearerUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const res = await createMaterialRequestAs(user, String(id), Array.isArray(body?.items) ? body.items : [], body?.note ? String(body.note) : undefined);
  return NextResponse.json(res, { status: res.success ? 200 : 400 });
}
