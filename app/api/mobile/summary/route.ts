/** Mobile: the logged-in craftsman's monthly work summary (totals + by project). */
import { NextResponse } from "next/server";
import { bearerUser } from "@/_lib/api-bearer";
import { getCraftsmanSummary } from "@/_actions/workorder";

export async function GET(req: Request) {
  const user = await bearerUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const month = new URL(req.url).searchParams.get("month") || undefined;
  const res = await getCraftsmanSummary(user.username, month);
  if (res.success === false) return NextResponse.json({ error: res.message }, { status: 500 });
  return NextResponse.json({ data: res.data });
}
