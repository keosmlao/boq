/** Mobile: list work orders (v2 only). Auth via Bearer token. */
import { NextResponse } from "next/server";
import { bearerUser } from "@/_lib/api-bearer";
import { getWorkOrders } from "@/_actions/workorder";

export async function GET(req: Request) {
  const user = await bearerUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const res = await getWorkOrders({});
  if (res.success === false) return NextResponse.json({ error: res.message }, { status: 500 });

  // Mobile only acts on the active (v2) work orders; legacy erp-* rows are read-only elsewhere.
  const data = res.data.filter((w: any) => w.src !== "erp");
  return NextResponse.json({ data });
}
