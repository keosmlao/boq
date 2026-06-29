/** Mobile (manager/approver): advance a material request — approved / issued / rejected. */
import { NextResponse } from "next/server";
import { bearerUser } from "@/_lib/api-bearer";
import { setMaterialRequestStatusAs } from "@/_lib/workorder-core";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await bearerUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const res = await setMaterialRequestStatusAs(user, String(id), String(body?.status || ""), body?.note ? String(body.note) : undefined);
  return NextResponse.json(res, { status: res.success ? 200 : 400 });
}
