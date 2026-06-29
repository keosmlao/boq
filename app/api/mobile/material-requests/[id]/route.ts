/** Mobile: edit (PATCH) or delete (DELETE) a material request — while still pending. */
import { NextResponse } from "next/server";
import { bearerUser } from "@/_lib/api-bearer";
import { deleteMaterialRequestAs, updateMaterialRequestAs } from "@/_lib/workorder-core";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await bearerUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const res = await updateMaterialRequestAs(
    user,
    String(id),
    Array.isArray(body?.items) ? body.items : [],
    body?.note ? String(body.note) : undefined,
  );
  return NextResponse.json(res, { status: res.success ? 200 : 400 });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await bearerUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const res = await deleteMaterialRequestAs(user, String(id));
  return NextResponse.json(res, { status: res.success ? 200 : 400 });
}
