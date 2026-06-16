/** Mobile: the logged-in user changes their own password (odg_employee). */
import { NextResponse } from "next/server";
import { bearerUser } from "@/_lib/api-bearer";
import { changeEmployeePassword } from "@/_lib/auth-core";

export async function POST(req: Request) {
  const user = await bearerUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const res = await changeEmployeePassword(user.username, body?.oldPassword, body?.newPassword);
  if (!res.ok) return NextResponse.json({ success: false, message: (res as { message?: string }).message || "ປ່ຽນລະຫັດບໍ່ສຳເລັດ" }, { status: 400 });
  return NextResponse.json({ success: true });
}
