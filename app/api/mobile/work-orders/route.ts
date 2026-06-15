/** Mobile: list work orders. Auth via Bearer token.
 *  Managers see all; a craftsman sees only the work orders assigned to them
 *  (technician_code === their employee_code, or assigned_username === username).
 *  Includes legacy ERP work orders (their technician_code = ERP technician_id). */
import { NextResponse } from "next/server";
import { bearerUser } from "@/_lib/api-bearer";
import { isManager } from "@/_lib/permissions";
import { getWorkOrders } from "@/_actions/workorder";

export async function GET(req: Request) {
  const user = await bearerUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const res = await getWorkOrders({});
  if (res.success === false) return NextResponse.json({ error: res.message }, { status: 500 });

  let data = res.data;
  if (!isManager(user)) {
    const me = String(user.username || "");
    data = data.filter(
      (w: any) => String(w.technician_code || "") === me || String(w.assigned_username || "") === me,
    );
  }
  return NextResponse.json({ data });
}
