/** Mobile: one work order's detail. Auth via Bearer token. */
import { NextResponse } from "next/server";
import { bearerUser } from "@/_lib/api-bearer";
import { getWorkOrderById } from "@/_actions/workorder";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await bearerUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const res = await getWorkOrderById(String(id));
  if (res.success === false) return NextResponse.json({ error: res.message }, { status: 404 });
  return NextResponse.json({ data: res.data });
}
