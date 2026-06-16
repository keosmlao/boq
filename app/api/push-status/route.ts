/** Admin push diagnostics: GET reports config + token counts; POST sends a test. */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/_lib/server-auth";
import { isAdmin } from "@/_lib/permissions";
import { pushStatus, sendTestToCraftsman } from "@/_lib/push";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const code = new URL(req.url).searchParams.get("employeeCode") || undefined;
  return NextResponse.json(await pushStatus(code));
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const code = String(body?.employeeCode || "");
  const res = await sendTestToCraftsman(code);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
