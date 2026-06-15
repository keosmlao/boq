/** Mobile: warehouses (ສາງ) + locations (ທີ່ເກັບ, with ?wh=) for the request form. */
import { NextResponse } from "next/server";
import { bearerUser } from "@/_lib/api-bearer";
import { getWarehouses, getLocations } from "@/_actions/lookups";

export async function GET(req: Request) {
  const user = await bearerUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const wh = new URL(req.url).searchParams.get("wh");
  const res: any = wh ? await getLocations(wh) : await getWarehouses();
  if (res.success === false) return NextResponse.json({ error: res.message }, { status: 500 });
  return NextResponse.json({ data: res.data });
}
