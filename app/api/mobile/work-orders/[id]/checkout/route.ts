/** Mobile: on-completion check-out (photo + GPS) — closes the job. */
import { NextResponse } from "next/server";
import { bearerUser } from "@/_lib/api-bearer";
import { checkOutWorkOrderAs } from "@/_lib/workorder-core";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await bearerUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const res = await checkOutWorkOrderAs(user, String(id), {
    lat: Number(body?.lat),
    lng: Number(body?.lng),
    photoBase64: String(body?.photoBase64 || ""),
    photoName: body?.photoName,
  });
  return NextResponse.json(res, { status: res.success ? 200 : 400 });
}
